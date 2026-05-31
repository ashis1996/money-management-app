"""
Fraud Detector Service

Detects suspicious activity in a user's transaction stream that the
existing leak detector intentionally ignores. The split is:

- LeakDetector       -> losing money to *yourself* (subscriptions you
                        don't use, frequent small expenses, late-night
                        impulse buys)
- FraudDetector (us) -> losing money to *someone else*, or to merchant
                        bugs (double-charges, card-testing patterns,
                        first-time large charges, repeated declined
                        attempts re-charged)

This service is intentionally heuristic, not statistical. We don't have
labelled fraud data for the typical Indian retail-banking user, and the
false-positive cost of a "your card may be compromised" notification is
high. Each rule has a transparent threshold and emits a severity that
the caller (backend / mobile) can use to decide whether to just surface
the row or also push a notification.

We keep the surface area small and the flags well-tested so we can
swap the rules out for a real classifier in a later phase without
breaking callers.
"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Sequence


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
class FraudDetectorService:
    """Detect suspicious transactions in a user's recent activity."""

    # --- Tunable thresholds. Documented inline so reviewers don't have
    # --- to spelunk through callers to understand "why 5 minutes?".

    #: Two charges to the same merchant for the same amount within this
    #: window are almost always a double-tap or merchant double-charge.
    DUPLICATE_WINDOW_MINUTES: int = 5

    #: Card-testing pattern: a fraudster validates a stolen card with a
    #: handful of small charges at random merchants in quick succession.
    #: We flag if N small DEBIT charges happen across distinct merchants
    #: in the same hour.
    CARD_TEST_WINDOW_MINUTES: int = 60
    CARD_TEST_MIN_COUNT: int = 3
    CARD_TEST_MAX_AMOUNT: float = 200.0

    #: A first-ever charge at a merchant that's also unusually large is
    #: worth surfacing. "Unusually large" is a multiple of the user's
    #: typical DEBIT amount.
    FIRST_LARGE_CHARGE_MULTIPLIER: float = 5.0
    FIRST_LARGE_CHARGE_FLOOR: float = 1000.0

    #: Multiple failed charges for the same amount that later succeed
    #: are a classic skimming pattern (testing if the card has limit).
    REPEATED_FAILURE_MIN_COUNT: int = 2
    REPEATED_FAILURE_WINDOW_MINUTES: int = 30

    def detect_fraud(
        self,
        user_id: str,
        transactions: Sequence[Dict[str, Any]],
        history_days: int = 90,
    ) -> Dict[str, Any]:
        """
        Run every rule against the user's transactions.

        Args:
            user_id: caller-provided id; carried back in the response so
                the backend can correlate with its own logs.
            transactions: a flat list of transaction dicts. Each row is
                expected to be either a real DB row or a parsed SMS;
                the only required keys are ``amount``, ``type``,
                ``transactionDate`` (or ``date``), and one of
                ``merchantName`` / ``merchant``.
            history_days: how far back to consider when computing the
                user's "typical" amount and merchant familiarity. The
                caller is free to pass already-trimmed data; this arg
                is just used to label the response.

        Returns:
            Dict with the full alert list, per-type summary, and the
            ids of every transaction flagged. Callers can use the ids
            to mark rows in their own UI without re-running the rules.
        """
        debits = [t for t in transactions if t.get("type") == "DEBIT"]

        alerts: List[Dict[str, Any]] = []
        alerts.extend(self._detect_duplicate_charges(debits))
        alerts.extend(self._detect_card_testing(debits))
        alerts.extend(self._detect_first_large_charges(debits))
        alerts.extend(self._detect_repeated_failures(transactions))

        # Sort: highest severity first, then most recent.
        alerts.sort(
            key=lambda a: (
                _severity_rank(a.get("severity", "LOW")),
                a.get("detected_at_iso", ""),
            ),
            reverse=True,
        )

        return {
            "user_id": user_id,
            "alerts": alerts,
            "alert_count": len(alerts),
            "summary": self._summarise(alerts),
            "history_days": history_days,
            "analyzed_at": datetime.utcnow().isoformat(),
        }

    # ======================================================================
    # Rules
    # ======================================================================

    def _detect_duplicate_charges(
        self, debits: Sequence[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Same merchant + same amount within a few minutes."""
        alerts: List[Dict[str, Any]] = []

        # Group by (merchant, amount) so we only compare within potential
        # duplicates — a quadratic scan over the full transaction list
        # would be wasteful for large histories.
        groups: Dict[tuple, List[Dict[str, Any]]] = defaultdict(list)
        for row in debits:
            merchant = _merchant_of(row)
            amount = _amount_of(row)
            tx_date = _date_of(row)
            if merchant is None or amount is None or tx_date is None:
                continue
            groups[(merchant.lower(), round(amount, 2))].append(
                {"row": row, "date": tx_date}
            )

        window = timedelta(minutes=self.DUPLICATE_WINDOW_MINUTES)
        for (_, _), rows in groups.items():
            if len(rows) < 2:
                continue
            rows.sort(key=lambda r: r["date"])
            for i in range(len(rows) - 1):
                a, b = rows[i], rows[i + 1]
                gap = b["date"] - a["date"]
                if gap <= window:
                    alerts.append(
                        self._make_alert(
                            type="DUPLICATE_CHARGE",
                            severity="HIGH",
                            title=(
                                f"Possible duplicate charge at "
                                f"{_merchant_of(a['row']) or 'merchant'}"
                            ),
                            description=(
                                "Two identical charges "
                                f"({_format_money(_amount_of(a['row']) or 0)}) "
                                f"posted {_format_gap(gap)} apart."
                            ),
                            transactions=[a["row"], b["row"]],
                            detected_at=b["date"],
                            recommendation=(
                                "Check your statement and contact the merchant "
                                "or bank to reverse one charge."
                            ),
                            potential_recovery=_amount_of(a["row"]) or 0,
                        )
                    )
        return alerts

    def _detect_card_testing(
        self, debits: Sequence[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Many small charges across distinct merchants in a short window."""
        if len(debits) < self.CARD_TEST_MIN_COUNT:
            return []

        # Filter to small DEBITs with parseable dates.
        small = []
        for row in debits:
            amount = _amount_of(row)
            tx_date = _date_of(row)
            if amount is None or tx_date is None:
                continue
            if amount > self.CARD_TEST_MAX_AMOUNT:
                continue
            small.append({"row": row, "date": tx_date, "amount": amount})

        if len(small) < self.CARD_TEST_MIN_COUNT:
            return []

        small.sort(key=lambda r: r["date"])
        window = timedelta(minutes=self.CARD_TEST_WINDOW_MINUTES)

        # Slide a window through `small` looking for >=N rows with N
        # distinct merchants. A two-pointer scan keeps this O(n).
        alerts: List[Dict[str, Any]] = []
        emitted_first_dates: List[datetime] = []
        left = 0
        for right in range(len(small)):
            while small[right]["date"] - small[left]["date"] > window:
                left += 1
            window_rows = small[left : right + 1]
            merchants = {
                (_merchant_of(r["row"]) or "").lower() for r in window_rows
            }
            if (
                len(window_rows) >= self.CARD_TEST_MIN_COUNT
                and len(merchants) >= self.CARD_TEST_MIN_COUNT
            ):
                first_date = window_rows[0]["date"]
                # Avoid emitting overlapping alerts — the next match
                # will be a strict superset of this one as we slide.
                if any(
                    abs((first_date - d).total_seconds()) < window.total_seconds()
                    for d in emitted_first_dates
                ):
                    continue
                emitted_first_dates.append(first_date)
                alerts.append(
                    self._make_alert(
                        type="CARD_TESTING",
                        severity="URGENT",
                        title="Possible card testing",
                        description=(
                            f"{len(window_rows)} small charges across "
                            f"{len(merchants)} merchants within "
                            f"{self.CARD_TEST_WINDOW_MINUTES} minutes."
                        ),
                        transactions=[r["row"] for r in window_rows],
                        detected_at=window_rows[-1]["date"],
                        recommendation=(
                            "If you don't recognise these, freeze the card "
                            "with your bank immediately."
                        ),
                        potential_recovery=sum(r["amount"] for r in window_rows),
                    )
                )
        return alerts

    def _detect_first_large_charges(
        self, debits: Sequence[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """A first-ever charge at a merchant that's unusually large."""
        if not debits:
            return []

        # Compute the user's typical DEBIT amount from at least two
        # data points; otherwise we'll false-positive on a tiny history.
        amounts = [a for a in (_amount_of(r) for r in debits) if a is not None]
        if len(amounts) < 5:
            return []
        amounts.sort()
        # Median is more robust than mean against the very outliers
        # we're trying to detect.
        median = amounts[len(amounts) // 2]
        threshold = max(
            median * self.FIRST_LARGE_CHARGE_MULTIPLIER,
            self.FIRST_LARGE_CHARGE_FLOOR,
        )

        # First-time merchants: scan in date order and emit on the
        # first row whose merchant we haven't seen yet.
        seen: set = set()
        rows_with_dates = []
        for row in debits:
            tx_date = _date_of(row)
            if tx_date is None:
                continue
            rows_with_dates.append((tx_date, row))
        rows_with_dates.sort(key=lambda x: x[0])

        alerts: List[Dict[str, Any]] = []
        for tx_date, row in rows_with_dates:
            merchant = (_merchant_of(row) or "").lower()
            if not merchant:
                continue
            if merchant in seen:
                continue
            seen.add(merchant)
            amount = _amount_of(row) or 0
            if amount >= threshold:
                alerts.append(
                    self._make_alert(
                        type="FIRST_LARGE_CHARGE",
                        severity="MEDIUM",
                        title=(
                            f"Large first charge at {_merchant_of(row) or 'merchant'}"
                        ),
                        description=(
                            f"{_format_money(amount)} — about "
                            f"{amount / median:.0f}× your typical spend."
                        ),
                        transactions=[row],
                        detected_at=tx_date,
                        recommendation=(
                            "Confirm you authorised this. If not, dispute it "
                            "with your bank."
                        ),
                        potential_recovery=amount,
                    )
                )
        return alerts

    def _detect_repeated_failures(
        self, transactions: Sequence[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Repeated failed charges for the same amount that later succeed.

        Most retail SMS messages indicate failure with a `status` field
        or an explicit "failed"/"declined" string in the body; we honour
        both. If the upstream parser hasn't surfaced a status, this rule
        emits nothing — it never invents alerts.
        """
        # Group by (merchant, amount). A failed-then-succeeded pair must
        # share both before it counts as a skim attempt.
        by_key: Dict[tuple, List[Dict[str, Any]]] = defaultdict(list)
        for row in transactions:
            merchant = _merchant_of(row)
            amount = _amount_of(row)
            tx_date = _date_of(row)
            status = _status_of(row)
            if merchant is None or amount is None or tx_date is None or not status:
                continue
            by_key[(merchant.lower(), round(amount, 2))].append(
                {"row": row, "date": tx_date, "status": status}
            )

        window = timedelta(minutes=self.REPEATED_FAILURE_WINDOW_MINUTES)
        alerts: List[Dict[str, Any]] = []
        for (_, _), rows in by_key.items():
            rows.sort(key=lambda r: r["date"])
            failures = [r for r in rows if r["status"] == "FAILED"]
            successes = [r for r in rows if r["status"] == "SUCCESS"]
            if len(failures) < self.REPEATED_FAILURE_MIN_COUNT or not successes:
                continue
            # Take the latest success and check if the failures cluster
            # right before it.
            latest_success = successes[-1]
            recent_failures = [
                f
                for f in failures
                if 0 <= (latest_success["date"] - f["date"]).total_seconds() <= window.total_seconds()
            ]
            if len(recent_failures) >= self.REPEATED_FAILURE_MIN_COUNT:
                alerts.append(
                    self._make_alert(
                        type="REPEATED_FAILURES",
                        severity="HIGH",
                        title=(
                            f"{len(recent_failures)} failed attempts before charge"
                        ),
                        description=(
                            f"{len(recent_failures)} declined attempts at "
                            f"{_merchant_of(latest_success['row']) or 'merchant'} "
                            "before a successful charge — could indicate skimming."
                        ),
                        transactions=[r["row"] for r in recent_failures]
                        + [latest_success["row"]],
                        detected_at=latest_success["date"],
                        recommendation=(
                            "If you only attempted once, contact the bank — "
                            "your card details may have been tested elsewhere."
                        ),
                        potential_recovery=_amount_of(latest_success["row"]) or 0,
                    )
                )
        return alerts

    # ======================================================================
    # Helpers
    # ======================================================================

    def _make_alert(
        self,
        *,
        type: str,
        severity: str,
        title: str,
        description: str,
        transactions: Iterable[Dict[str, Any]],
        detected_at: datetime,
        recommendation: str,
        potential_recovery: float,
    ) -> Dict[str, Any]:
        """Build the per-alert payload. Centralised so all rules ship the same shape."""
        rows = list(transactions)
        return {
            "type": type,
            "severity": severity,
            "title": title,
            "description": description,
            "recommendation": recommendation,
            "transaction_ids": [str(r.get("id")) for r in rows if r.get("id")],
            "transactions": rows,
            "detected_at": detected_at.isoformat(),
            "detected_at_iso": detected_at.isoformat(),
            "potential_recovery": round(float(potential_recovery), 2),
        }

    @staticmethod
    def _summarise(alerts: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Group alerts by type for the UI's overview card."""
        out: Dict[str, Dict[str, Any]] = {}
        for a in alerts:
            t = a["type"]
            entry = out.setdefault(
                t,
                {
                    "count": 0,
                    "potential_recovery": 0.0,
                    "highest_severity": "LOW",
                },
            )
            entry["count"] += 1
            entry["potential_recovery"] = round(
                entry["potential_recovery"] + float(a.get("potential_recovery", 0)), 2
            )
            if _severity_rank(a["severity"]) > _severity_rank(
                entry["highest_severity"]
            ):
                entry["highest_severity"] = a["severity"]
        return out


# ---------------------------------------------------------------------------
# Field accessors — mobile / backend / SMS parser all use slightly different
# key names. We centralise the lookup here so each rule stays readable.
# ---------------------------------------------------------------------------
def _merchant_of(row: Dict[str, Any]) -> Optional[str]:
    val = row.get("merchantName") or row.get("merchant")
    if val is None:
        return None
    s = str(val).strip()
    return s or None


def _amount_of(row: Dict[str, Any]) -> Optional[float]:
    val = row.get("amount")
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _date_of(row: Dict[str, Any]) -> Optional[datetime]:
    val = row.get("transactionDate") or row.get("date")
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    try:
        # Tolerate trailing 'Z' which Python's ISO parser only learned
        # to handle in 3.11. We strip it explicitly.
        return datetime.fromisoformat(str(val).replace("Z", "+00:00")).replace(
            tzinfo=None
        )
    except ValueError:
        return None


def _status_of(row: Dict[str, Any]) -> Optional[str]:
    """Map a transaction's status field (or text body) to SUCCESS/FAILED."""
    raw = row.get("status") or row.get("transaction_status")
    if isinstance(raw, str):
        upper = raw.upper()
        if upper in ("FAILED", "DECLINED", "REJECTED"):
            return "FAILED"
        if upper in ("SUCCESS", "COMPLETED", "POSTED"):
            return "SUCCESS"

    body = row.get("rawSms") or row.get("body")
    if isinstance(body, str):
        b = body.lower()
        if "declined" in b or "failed" in b or "rejected" in b:
            return "FAILED"
        if "debited" in b or "charged" in b:
            return "SUCCESS"

    return None


_SEVERITY_ORDER = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "URGENT": 4}


def _severity_rank(s: str) -> int:
    return _SEVERITY_ORDER.get(s, 0)


def _format_money(amount: float) -> str:
    return f"₹{amount:,.0f}"


def _format_gap(delta: timedelta) -> str:
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return f"{seconds}s"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m"
    hours = minutes // 60
    return f"{hours}h"
