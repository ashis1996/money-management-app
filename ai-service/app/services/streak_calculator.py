"""
Streak Calculator Service

Computes day-streaks of "good" financial behaviour for the gamification
surface. The notion of a "good day" is a positional rule applied to a
day's net activity:

  - Net day was non-negative (saved more than spent that day), OR
  - The day had no DEBIT transactions at all (rest day — no penalty).

A streak ends when a day breaks that rule. Days with no transactions of
either kind don't reset the streak (the user just didn't open the app).

Why a streak and not raw savings rate?
  Streaks provide a clear, unambiguous progress signal that loss-aversion
  research suggests motivates ongoing engagement. Savings-rate goals are
  reset every month and feel academic; "you've hit 14 days in a row"
  feels personal and immediate.

The output is intentionally small — current and longest streaks plus a
short list of recent breakage reasons. The mobile/web surface decides
how to render it (badge, ring, calendar dots, etc.).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


class StreakCalculatorService:
    """Compute "good day" streaks from a transaction stream."""

    def calculate_streaks(
        self,
        user_id: str,
        transactions: Sequence[Dict[str, Any]],
        *,
        as_of: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Walk the day-by-day history and tally streaks.

        Args:
            user_id: caller-provided id; carried back in the response.
            transactions: list of transaction dicts. Required keys are
                ``amount`` (number), ``type`` ("DEBIT"|"CREDIT"), and a
                date under either ``transactionDate`` or ``date``.
            as_of: anchor day for "current streak" (default: today).
                Tests pass this so they can simulate a calendar.

        Returns:
            ``{
                "user_id": ...,
                "current_streak": int,                 # days up to and incl. as_of
                "longest_streak": int,                 # any window in history
                "good_days": int,                      # total in-history good days
                "bad_days": int,                       # total broken days
                "last_break": ISO date string | None,  # most recent break
                "achievements": [...],                 # earned milestones
                "calculated_at": ISO timestamp
            }``
        """
        anchor = as_of or datetime.utcnow().date()
        per_day = self._aggregate_by_day(transactions)

        if not per_day:
            return self._empty_result(user_id, anchor)

        # `goodness` is keyed by date so we can iterate the calendar
        # cleanly later. None means "no transactions" (rest day) and
        # is treated as not-bad.
        goodness: Dict[date, Optional[bool]] = {}
        breakage_reasons: Dict[date, str] = {}
        for day, totals in per_day.items():
            credits = totals["credit"]
            debits = totals["debit"]
            if debits == 0:
                # Rest day — no penalty, no contribution.
                goodness[day] = None
                continue
            if credits >= debits:
                goodness[day] = True
            else:
                goodness[day] = False
                breakage_reasons[day] = (
                    f"Spent ₹{debits - credits:,.0f} more than earned"
                )

        # Compute the longest streak in history, the current streak
        # ending at `anchor`, and the most recent break date.
        longest, _ = self._longest_streak(goodness)
        current = self._current_streak_ending(goodness, anchor)
        last_break = self._latest_break(goodness)

        achievements = self._achievements_for(longest)

        return {
            "user_id": user_id,
            "current_streak": current,
            "longest_streak": longest,
            "good_days": sum(1 for v in goodness.values() if v is True),
            "bad_days": sum(1 for v in goodness.values() if v is False),
            "last_break": last_break.isoformat() if last_break else None,
            "last_break_reason": breakage_reasons.get(last_break) if last_break else None,
            "achievements": achievements,
            "calculated_at": datetime.utcnow().isoformat(),
        }

    # ======================================================================
    # Internals
    # ======================================================================

    @staticmethod
    def _aggregate_by_day(
        transactions: Iterable[Dict[str, Any]],
    ) -> Dict[date, Dict[str, float]]:
        """Sum debits and credits per calendar day."""
        per_day: Dict[date, Dict[str, float]] = defaultdict(
            lambda: {"debit": 0.0, "credit": 0.0}
        )
        for row in transactions:
            day = _date_of(row)
            amount = _amount_of(row)
            kind = row.get("type")
            if day is None or amount is None or kind not in ("DEBIT", "CREDIT"):
                continue
            bucket = per_day[day]
            if kind == "DEBIT":
                bucket["debit"] += amount
            else:
                bucket["credit"] += amount
        return per_day

    @staticmethod
    def _longest_streak(goodness: Dict[date, Optional[bool]]) -> Tuple[int, Optional[date]]:
        """
        Sweep contiguous calendar days, counting good (True) days within
        an unbroken run. A False day resets the run; a None (rest) day
        carries the run forward without contributing to the count.

        Returns the longest tally of True days and the date of the last
        good day in that run.
        """
        if not goodness:
            return 0, None

        days_sorted = sorted(goodness.keys())
        start = days_sorted[0]
        end = days_sorted[-1]

        longest = 0
        longest_end: Optional[date] = None
        run = 0
        run_end: Optional[date] = None
        cursor = start
        while cursor <= end:
            v = goodness.get(cursor)
            if v is False:
                run = 0
                run_end = None
            elif v is True:
                run += 1
                run_end = cursor
                if run > longest:
                    longest = run
                    longest_end = run_end
            # `None` (rest day): keep the run alive but don't increment.
            cursor += timedelta(days=1)

        return longest, longest_end

    @staticmethod
    def _current_streak_ending(
        goodness: Dict[date, Optional[bool]],
        anchor: date,
    ) -> int:
        """
        Count contiguous good-or-rest days ending at `anchor`.

        Days *after* the user's last recorded transaction are skipped
        entirely — they don't reset the streak (the user just hasn't
        opened the app), but they don't add to it either.
        """
        if not goodness:
            return 0

        last_known = max(goodness.keys())
        # If the anchor is after the last known day with activity, we
        # roll the cursor back to the last activity day. The streak is
        # whatever we had at that point — being inactive doesn't break
        # it, but it also doesn't grow.
        cursor = min(anchor, last_known)
        first_known = min(goodness.keys())

        streak = 0
        while cursor >= first_known:
            v = goodness.get(cursor)
            if v is False:
                break
            if v is True:
                streak += 1
            # `None` (no activity) doesn't add or subtract — equivalent
            # to a rest day. We still walk back through it.
            cursor -= timedelta(days=1)
        return streak

    @staticmethod
    def _latest_break(goodness: Dict[date, Optional[bool]]) -> Optional[date]:
        breaks = [d for d, v in goodness.items() if v is False]
        return max(breaks) if breaks else None

    @staticmethod
    def _achievements_for(longest_streak: int) -> List[Dict[str, Any]]:
        """
        Map streak milestones to achievement payloads. The set is small
        on purpose — gamification only motivates when each rung feels
        attainable. We can extend with monthly / yearly tiers later.
        """
        ladder = [
            (3, "first-steps", "First Steps", "3 day streak"),
            (7, "one-week-strong", "One Week Strong", "7 day streak"),
            (14, "two-weeks", "Fortnight Force", "14 day streak"),
            (30, "month-of-discipline", "Month of Discipline", "30 day streak"),
            (90, "quarterly-saver", "Quarterly Saver", "90 day streak"),
            (180, "half-year-hero", "Half-Year Hero", "180 day streak"),
            (365, "year-of-savings", "Year of Savings", "365 day streak"),
        ]
        return [
            {
                "id": slug,
                "title": title,
                "description": desc,
                "threshold": threshold,
            }
            for threshold, slug, title, desc in ladder
            if longest_streak >= threshold
        ]

    @staticmethod
    def _empty_result(user_id: str, as_of: date) -> Dict[str, Any]:
        return {
            "user_id": user_id,
            "current_streak": 0,
            "longest_streak": 0,
            "good_days": 0,
            "bad_days": 0,
            "last_break": None,
            "last_break_reason": None,
            "achievements": [],
            "calculated_at": datetime.utcnow().isoformat(),
        }


# ---------------------------------------------------------------------------
# Field accessors — same shapes the rest of the AI service tolerates.
# ---------------------------------------------------------------------------
def _amount_of(row: Dict[str, Any]) -> Optional[float]:
    val = row.get("amount")
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _date_of(row: Dict[str, Any]) -> Optional[date]:
    val = row.get("transactionDate") or row.get("date")
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    try:
        return datetime.fromisoformat(str(val).replace("Z", "+00:00")).date()
    except ValueError:
        return None
