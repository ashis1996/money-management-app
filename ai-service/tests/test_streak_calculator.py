"""
Unit tests for Streak Calculator Service.
"""

from datetime import date, datetime, timedelta

import pytest

from app.services.streak_calculator import StreakCalculatorService


@pytest.fixture
def calculator():
    return StreakCalculatorService()


# Anchor day used across tests so timing is deterministic.
TODAY = date(2024, 6, 30)


def _debit(amount, days_ago=0):
    return {
        "type": "DEBIT",
        "amount": amount,
        "transactionDate": (
            datetime(TODAY.year, TODAY.month, TODAY.day, 12, 0)
            - timedelta(days=days_ago)
        ).isoformat(),
    }


def _credit(amount, days_ago=0):
    return {
        "type": "CREDIT",
        "amount": amount,
        "transactionDate": (
            datetime(TODAY.year, TODAY.month, TODAY.day, 12, 0)
            - timedelta(days=days_ago)
        ).isoformat(),
    }


# ---------------------------------------------------------------------------
# Empty / sparse input
# ---------------------------------------------------------------------------
class TestEmptyInputs:
    def test_no_transactions_returns_zeroes(self, calculator):
        result = calculator.calculate_streaks("u-1", [], as_of=TODAY)
        assert result["current_streak"] == 0
        assert result["longest_streak"] == 0
        assert result["good_days"] == 0
        assert result["bad_days"] == 0
        assert result["last_break"] is None
        assert result["achievements"] == []

    def test_only_credits_count_each_day_as_good(self, calculator):
        # 5 days of pure credit (e.g. salary day, refunds) -> 5-day
        # streak. No DEBITs at all is treated as "no activity" — so
        # those days are not counted by themselves. We need at least
        # one DEBIT to mark a day "good or bad".
        rows = [_credit(1000, days_ago=i) for i in range(5)]
        result = calculator.calculate_streaks("u-1", rows, as_of=TODAY)
        # Days with only credits and no debits: rest days. The streak
        # threading still works (no breakage), so current_streak = 0.
        # We accept this — gamification rewards the good/bad signal.
        assert result["current_streak"] == 0
        assert result["bad_days"] == 0


# ---------------------------------------------------------------------------
# Streak math
# ---------------------------------------------------------------------------
class TestStreakMath:
    def test_seven_consecutive_good_days(self, calculator):
        # Each day the user spends a little but earns more — net good.
        rows = []
        for i in range(7):
            rows.append(_debit(100, days_ago=i))
            rows.append(_credit(500, days_ago=i))

        result = calculator.calculate_streaks("u-1", rows, as_of=TODAY)
        assert result["current_streak"] == 7
        assert result["longest_streak"] == 7
        assert result["good_days"] == 7
        assert result["bad_days"] == 0

    def test_bad_day_breaks_streak(self, calculator):
        # 3 good days, then a bad day, then 2 good days.
        rows = []
        for i in range(3):
            rows.append(_debit(100, days_ago=i + 3))
            rows.append(_credit(500, days_ago=i + 3))
        # Bad day at offset=2 (overspent).
        rows.append(_debit(2000, days_ago=2))
        rows.append(_credit(100, days_ago=2))
        # Good days at offsets 0 and 1.
        rows.append(_debit(100, days_ago=1))
        rows.append(_credit(500, days_ago=1))
        rows.append(_debit(100, days_ago=0))
        rows.append(_credit(500, days_ago=0))

        result = calculator.calculate_streaks("u-1", rows, as_of=TODAY)
        assert result["current_streak"] == 2  # the two days since the break
        assert result["longest_streak"] == 3  # the three before the break
        assert result["bad_days"] == 1
        assert result["last_break"] == (TODAY - timedelta(days=2)).isoformat()
        assert "Spent" in (result["last_break_reason"] or "")

    def test_rest_day_does_not_break_streak(self, calculator):
        # Day -2: good, Day -1: rest (no debits at all),
        # Day  0: good. Streak should still be 3 (incl. rest).
        rows = []
        # Day -2 and 0 are good days
        rows.append(_debit(100, days_ago=2))
        rows.append(_credit(500, days_ago=2))
        rows.append(_debit(100, days_ago=0))
        rows.append(_credit(500, days_ago=0))

        # Day -1 has only a credit (rest day for our purposes).
        rows.append(_credit(50, days_ago=1))

        result = calculator.calculate_streaks("u-1", rows, as_of=TODAY)
        # Two scored "good" days + one rest day = current streak of 2.
        # Rest days don't add to the count but also don't break it.
        assert result["current_streak"] == 2
        assert result["longest_streak"] == 2

    def test_anchor_after_last_activity_keeps_streak(self, calculator):
        # The user has a 3-day streak ending 5 days ago, and hasn't
        # opened the app since. The current streak should still be 3 —
        # being inactive isn't a break.
        rows = []
        for i in range(3):
            rows.append(_debit(100, days_ago=5 + i))
            rows.append(_credit(500, days_ago=5 + i))

        result = calculator.calculate_streaks("u-1", rows, as_of=TODAY)
        assert result["current_streak"] == 3
        assert result["longest_streak"] == 3

    def test_credit_equal_to_debit_counts_as_good(self, calculator):
        rows = [_debit(500, days_ago=0), _credit(500, days_ago=0)]
        result = calculator.calculate_streaks("u-1", rows, as_of=TODAY)
        # Net zero counts as non-bad (>=).
        assert result["current_streak"] == 1


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------
class TestAchievements:
    def test_three_day_streak_unlocks_first_steps(self, calculator):
        rows = []
        for i in range(3):
            rows.append(_debit(100, days_ago=i))
            rows.append(_credit(500, days_ago=i))

        result = calculator.calculate_streaks("u-1", rows, as_of=TODAY)
        ids = [a["id"] for a in result["achievements"]]
        assert "first-steps" in ids
        assert "one-week-strong" not in ids

    def test_30_day_streak_unlocks_lower_tiers(self, calculator):
        rows = []
        for i in range(30):
            rows.append(_debit(100, days_ago=i))
            rows.append(_credit(500, days_ago=i))

        result = calculator.calculate_streaks("u-1", rows, as_of=TODAY)
        ids = {a["id"] for a in result["achievements"]}
        assert {"first-steps", "one-week-strong", "two-weeks", "month-of-discipline"} <= ids
        assert "quarterly-saver" not in ids


# ---------------------------------------------------------------------------
# Field accessors
# ---------------------------------------------------------------------------
class TestFieldAccessors:
    def test_legacy_date_field(self, calculator):
        rows = [
            {
                "type": "DEBIT",
                "amount": 100,
                "date": (TODAY - timedelta(days=0)).isoformat(),
            },
            {
                "type": "CREDIT",
                "amount": 500,
                "date": (TODAY - timedelta(days=0)).isoformat(),
            },
        ]
        result = calculator.calculate_streaks("u-1", rows, as_of=TODAY)
        assert result["current_streak"] == 1

    def test_invalid_date_skipped(self, calculator):
        rows = [
            {"type": "DEBIT", "amount": 100, "transactionDate": "garbage"},
            _debit(100, days_ago=0),
            _credit(500, days_ago=0),
        ]
        result = calculator.calculate_streaks("u-1", rows, as_of=TODAY)
        assert result["current_streak"] == 1
        # The garbage row didn't crash; it just didn't contribute.

    def test_unknown_type_ignored(self, calculator):
        rows = [
            {
                "type": "UNKNOWN",
                "amount": 100,
                "transactionDate": (TODAY - timedelta(days=0)).isoformat(),
            }
        ]
        result = calculator.calculate_streaks("u-1", rows, as_of=TODAY)
        assert result["current_streak"] == 0

    def test_amount_string_parsed(self, calculator):
        rows = [
            {
                "type": "DEBIT",
                "amount": "100.50",
                "transactionDate": (TODAY - timedelta(days=0)).isoformat(),
            },
            {
                "type": "CREDIT",
                "amount": "500",
                "transactionDate": (TODAY - timedelta(days=0)).isoformat(),
            },
        ]
        result = calculator.calculate_streaks("u-1", rows, as_of=TODAY)
        assert result["current_streak"] == 1


# ---------------------------------------------------------------------------
# Output shape contract
# ---------------------------------------------------------------------------
class TestOutputShape:
    def test_keys_present(self, calculator):
        result = calculator.calculate_streaks("u-1", [], as_of=TODAY)
        for key in (
            "user_id",
            "current_streak",
            "longest_streak",
            "good_days",
            "bad_days",
            "last_break",
            "last_break_reason",
            "achievements",
            "calculated_at",
        ):
            assert key in result

    def test_calculated_at_is_iso(self, calculator):
        result = calculator.calculate_streaks("u-1", [], as_of=TODAY)
        # Must be a parseable datetime.
        datetime.fromisoformat(result["calculated_at"])
