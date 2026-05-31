"""
Unit tests for Fraud Detector Service.

Each rule is exercised in isolation against hand-crafted transaction
streams. We avoid real-world fixtures because the rules are deliberately
simple and the cost of a hidden coupling between rules (e.g.
duplicate-charge accidentally firing card-testing too) is high.
"""

from datetime import datetime, timedelta

import pytest

from app.services.fraud_detector import FraudDetectorService


@pytest.fixture
def detector():
    return FraudDetectorService()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
BASE = datetime(2024, 6, 15, 12, 0, 0)  # Saturday afternoon, well-anchored


def _tx(
    amount,
    merchant="Cafe",
    minutes=0,
    seconds=0,
    days=0,
    *,
    type="DEBIT",
    status=None,
    body=None,
    id=None,
):
    """
    Build a transaction at BASE + offset, with the canonical key names
    the service consumes. `status` and `body` are only set when the
    test cares; the field accessor tolerates them being missing.
    """
    when = BASE + timedelta(days=days, minutes=minutes, seconds=seconds)
    row = {
        "id": id or f"tx-{int(when.timestamp())}-{merchant}-{amount}",
        "type": type,
        "amount": amount,
        "merchantName": merchant,
        "transactionDate": when.isoformat(),
    }
    if status:
        row["status"] = status
    if body:
        row["rawSms"] = body
    return row


# ---------------------------------------------------------------------------
# Duplicate charges
# ---------------------------------------------------------------------------
class TestDuplicateCharges:
    def test_two_identical_charges_within_window_flagged(self, detector):
        rows = [
            _tx(450, "Swiggy", minutes=0),
            _tx(450, "Swiggy", minutes=2),
        ]
        result = detector.detect_fraud("u-1", rows)

        assert result["alert_count"] == 1
        alert = result["alerts"][0]
        assert alert["type"] == "DUPLICATE_CHARGE"
        assert alert["severity"] == "HIGH"
        assert alert["potential_recovery"] == 450.0
        assert len(alert["transactions"]) == 2

    def test_outside_window_not_flagged(self, detector):
        rows = [
            _tx(450, "Swiggy", minutes=0),
            _tx(450, "Swiggy", minutes=15),  # > 5min window
        ]
        result = detector.detect_fraud("u-1", rows)
        assert result["alert_count"] == 0

    def test_different_amounts_not_flagged(self, detector):
        rows = [
            _tx(450, "Swiggy", minutes=0),
            _tx(451, "Swiggy", minutes=2),
        ]
        result = detector.detect_fraud("u-1", rows)
        assert result["alert_count"] == 0

    def test_different_merchants_not_flagged(self, detector):
        rows = [
            _tx(450, "Swiggy", minutes=0),
            _tx(450, "Zomato", minutes=2),
        ]
        result = detector.detect_fraud("u-1", rows)
        # Different merchants — no duplicate. Card-testing rule also
        # won't fire because amounts > 200 floor.
        assert result["alert_count"] == 0

    def test_credits_ignored(self, detector):
        rows = [
            _tx(450, "Refund", minutes=0, type="CREDIT"),
            _tx(450, "Refund", minutes=2, type="CREDIT"),
        ]
        result = detector.detect_fraud("u-1", rows)
        assert result["alert_count"] == 0

    def test_three_in_window_only_emits_pairwise_duplicates(self, detector):
        rows = [
            _tx(450, "Swiggy", minutes=0),
            _tx(450, "Swiggy", minutes=2),
            _tx(450, "Swiggy", minutes=4),
        ]
        result = detector.detect_fraud("u-1", rows)
        # Pairwise loop: (0,1) within 2 min, (1,2) within 2 min.
        # Both qualify — that's two alerts, both HIGH.
        types = [a["type"] for a in result["alerts"]]
        assert types == ["DUPLICATE_CHARGE", "DUPLICATE_CHARGE"]


# ---------------------------------------------------------------------------
# Card testing
# ---------------------------------------------------------------------------
class TestCardTesting:
    def test_three_small_at_distinct_merchants_flagged(self, detector):
        rows = [
            _tx(50, "MerchantA", minutes=0),
            _tx(75, "MerchantB", minutes=10),
            _tx(120, "MerchantC", minutes=20),
        ]
        result = detector.detect_fraud("u-1", rows)

        alerts = [a for a in result["alerts"] if a["type"] == "CARD_TESTING"]
        assert len(alerts) == 1
        alert = alerts[0]
        assert alert["severity"] == "URGENT"
        assert alert["potential_recovery"] == pytest.approx(245.0)

    def test_below_count_threshold_not_flagged(self, detector):
        rows = [
            _tx(50, "MerchantA", minutes=0),
            _tx(75, "MerchantB", minutes=10),
        ]
        result = detector.detect_fraud("u-1", rows)
        assert all(a["type"] != "CARD_TESTING" for a in result["alerts"])

    def test_amounts_above_floor_not_flagged(self, detector):
        rows = [
            _tx(500, "MerchantA", minutes=0),
            _tx(500, "MerchantB", minutes=10),
            _tx(500, "MerchantC", minutes=20),
        ]
        result = detector.detect_fraud("u-1", rows)
        # Exceed the small-amount floor — shouldn't be classed as card testing.
        assert all(a["type"] != "CARD_TESTING" for a in result["alerts"])

    def test_outside_window_not_flagged(self, detector):
        rows = [
            _tx(50, "MerchantA", minutes=0),
            _tx(75, "MerchantB", minutes=70),
            _tx(120, "MerchantC", minutes=140),
        ]
        result = detector.detect_fraud("u-1", rows)
        assert all(a["type"] != "CARD_TESTING" for a in result["alerts"])

    def test_same_merchant_repeated_not_flagged(self, detector):
        # 3 charges, same merchant — not card testing.
        rows = [
            _tx(50, "MerchantA", minutes=0),
            _tx(75, "MerchantA", minutes=10),
            _tx(120, "MerchantA", minutes=20),
        ]
        result = detector.detect_fraud("u-1", rows)
        assert all(a["type"] != "CARD_TESTING" for a in result["alerts"])

    def test_overlapping_windows_dedupe_emits_once(self, detector):
        # Four small charges at distinct merchants; the algorithm should
        # emit a single alert covering the cluster, not one per slide.
        rows = [
            _tx(50, "A", minutes=0),
            _tx(50, "B", minutes=5),
            _tx(50, "C", minutes=10),
            _tx(50, "D", minutes=15),
        ]
        result = detector.detect_fraud("u-1", rows)
        alerts = [a for a in result["alerts"] if a["type"] == "CARD_TESTING"]
        assert len(alerts) == 1


# ---------------------------------------------------------------------------
# First large charge at a new merchant
# ---------------------------------------------------------------------------
class TestFirstLargeCharge:
    def _build_history(self, *, typical=200, count=12):
        """A mid-sized history with a stable typical amount."""
        return [
            _tx(typical, f"Cafe-{i}", days=-i)  # past few days
            for i in range(1, count + 1)
        ]

    def test_first_charge_above_threshold_flagged(self, detector):
        history = self._build_history()
        # Median typical ~= 200; threshold is max(200*5=1000, floor=1000) = 1000.
        big = _tx(2500, "Brand-New-Store", days=0)
        result = detector.detect_fraud("u-1", history + [big])

        alerts = [a for a in result["alerts"] if a["type"] == "FIRST_LARGE_CHARGE"]
        assert len(alerts) == 1
        assert alerts[0]["severity"] == "MEDIUM"
        assert alerts[0]["potential_recovery"] == 2500.0

    def test_known_merchant_not_flagged_even_if_large(self, detector):
        history = self._build_history()
        # Already-seen merchant: large charge there isn't suspicious for
        # this rule (the leak detector / behaviour analyzer may still
        # flag it elsewhere).
        big = _tx(2500, "Cafe-1", days=0)
        result = detector.detect_fraud("u-1", history + [big])
        assert all(a["type"] != "FIRST_LARGE_CHARGE" for a in result["alerts"])

    def test_below_floor_not_flagged(self, detector):
        history = self._build_history(typical=50)  # median 50, threshold = 1000 (floor)
        small_first = _tx(800, "Brand-New-Store", days=0)
        result = detector.detect_fraud("u-1", history + [small_first])
        assert all(a["type"] != "FIRST_LARGE_CHARGE" for a in result["alerts"])

    def test_short_history_skipped(self, detector):
        # With <5 historical DEBITs, the rule abstains so a brand-new
        # user doesn't get every charge flagged.
        rows = [
            _tx(2500, "Brand-New-Store", days=0),
            _tx(200, "Cafe", days=-1),
        ]
        result = detector.detect_fraud("u-1", rows)
        assert all(a["type"] != "FIRST_LARGE_CHARGE" for a in result["alerts"])


# ---------------------------------------------------------------------------
# Repeated failures
# ---------------------------------------------------------------------------
class TestRepeatedFailures:
    def test_two_failures_then_success_flagged(self, detector):
        rows = [
            _tx(999, "Merchant", minutes=0, status="FAILED"),
            _tx(999, "Merchant", minutes=10, status="FAILED"),
            _tx(999, "Merchant", minutes=20, status="SUCCESS"),
        ]
        result = detector.detect_fraud("u-1", rows)

        alerts = [a for a in result["alerts"] if a["type"] == "REPEATED_FAILURES"]
        assert len(alerts) == 1
        assert alerts[0]["severity"] == "HIGH"
        assert alerts[0]["potential_recovery"] == 999.0

    def test_one_failure_then_success_not_flagged(self, detector):
        rows = [
            _tx(999, "Merchant", minutes=0, status="FAILED"),
            _tx(999, "Merchant", minutes=10, status="SUCCESS"),
        ]
        result = detector.detect_fraud("u-1", rows)
        assert all(a["type"] != "REPEATED_FAILURES" for a in result["alerts"])

    def test_failure_outside_window_not_flagged(self, detector):
        rows = [
            _tx(999, "Merchant", minutes=0, status="FAILED"),
            _tx(999, "Merchant", minutes=5, status="FAILED"),
            _tx(999, "Merchant", minutes=120, status="SUCCESS"),  # > 30min
        ]
        result = detector.detect_fraud("u-1", rows)
        assert all(a["type"] != "REPEATED_FAILURES" for a in result["alerts"])

    def test_status_inferred_from_body_text(self, detector):
        rows = [
            _tx(999, "Merchant", minutes=0, body="Txn declined for INR 999"),
            _tx(999, "Merchant", minutes=5, body="Txn failed for INR 999"),
            _tx(999, "Merchant", minutes=20, body="INR 999 debited from acct"),
        ]
        result = detector.detect_fraud("u-1", rows)
        alerts = [a for a in result["alerts"] if a["type"] == "REPEATED_FAILURES"]
        assert len(alerts) == 1


# ---------------------------------------------------------------------------
# Field accessors and shape contract
# ---------------------------------------------------------------------------
class TestParsing:
    def test_credits_filtered(self, detector):
        rows = [
            _tx(450, "Swiggy", minutes=0, type="CREDIT"),
            _tx(450, "Swiggy", minutes=2, type="DEBIT"),
        ]
        # Only one DEBIT — no duplicate possible.
        result = detector.detect_fraud("u-1", rows)
        assert result["alert_count"] == 0

    def test_legacy_field_names(self, detector):
        # Backend sometimes ships `merchant`+`date` instead of
        # `merchantName`+`transactionDate`. Both should work.
        rows = [
            {
                "id": "a",
                "type": "DEBIT",
                "amount": 450,
                "merchant": "Swiggy",
                "date": (BASE + timedelta(minutes=0)).isoformat(),
            },
            {
                "id": "b",
                "type": "DEBIT",
                "amount": 450,
                "merchant": "Swiggy",
                "date": (BASE + timedelta(minutes=2)).isoformat(),
            },
        ]
        result = detector.detect_fraud("u-1", rows)
        assert result["alert_count"] == 1

    def test_z_suffixed_iso_dates(self, detector):
        # `2024-06-15T12:00:00Z` is the JS-default flavour and used to
        # break the ISO parser before 3.11. The accessor strips it.
        rows = [
            {
                "id": "a",
                "type": "DEBIT",
                "amount": 450,
                "merchantName": "Swiggy",
                "transactionDate": "2024-06-15T12:00:00Z",
            },
            {
                "id": "b",
                "type": "DEBIT",
                "amount": 450,
                "merchantName": "Swiggy",
                "transactionDate": "2024-06-15T12:02:00Z",
            },
        ]
        result = detector.detect_fraud("u-1", rows)
        assert result["alert_count"] == 1

    def test_invalid_dates_skipped_not_raised(self, detector):
        rows = [
            _tx(450, "Swiggy", minutes=0),
            {"id": "b", "type": "DEBIT", "amount": 450, "merchantName": "Swiggy", "transactionDate": "garbage"},
        ]
        result = detector.detect_fraud("u-1", rows)
        # The garbage row is dropped; only one valid row left, so no
        # duplicate possible.
        assert result["alert_count"] == 0

    def test_empty_input_returns_empty_response(self, detector):
        result = detector.detect_fraud("u-1", [])
        assert result["alert_count"] == 0
        assert result["alerts"] == []
        assert result["summary"] == {}


# ---------------------------------------------------------------------------
# Summary / sorting
# ---------------------------------------------------------------------------
class TestSummary:
    def test_summary_groups_by_type(self, detector):
        rows = [
            _tx(450, "Swiggy", minutes=0),
            _tx(450, "Swiggy", minutes=2),
            _tx(50, "A", minutes=300),
            _tx(50, "B", minutes=305),
            _tx(50, "C", minutes=310),
        ]
        result = detector.detect_fraud("u-1", rows)

        summary = result["summary"]
        assert "DUPLICATE_CHARGE" in summary
        assert "CARD_TESTING" in summary
        assert summary["DUPLICATE_CHARGE"]["count"] == 1
        assert summary["DUPLICATE_CHARGE"]["highest_severity"] == "HIGH"
        assert summary["CARD_TESTING"]["count"] == 1
        assert summary["CARD_TESTING"]["highest_severity"] == "URGENT"

    def test_alerts_sorted_by_severity(self, detector):
        # An URGENT card-test alert should outrank a HIGH duplicate.
        rows = [
            _tx(450, "Swiggy", minutes=0),
            _tx(450, "Swiggy", minutes=2),
            _tx(50, "A", minutes=300),
            _tx(50, "B", minutes=305),
            _tx(50, "C", minutes=310),
        ]
        result = detector.detect_fraud("u-1", rows)
        # First alert must be URGENT.
        assert result["alerts"][0]["severity"] == "URGENT"
