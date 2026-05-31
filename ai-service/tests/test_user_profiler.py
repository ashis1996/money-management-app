"""
Unit tests for User Profiler Service
"""

import pytest

from app.services.user_profiler import UserArchetype, UserProfilerService


@pytest.fixture
def profiler():
    return UserProfilerService()


def _credit(amount):
    return {"type": "CREDIT", "amount": amount}


def _debit(amount, category="OTHER"):
    return {"type": "DEBIT", "amount": amount, "category": category}


def _sub(amount, frequency="MONTHLY", status="ACTIVE"):
    return {"amount": amount, "frequency": frequency, "status": status}


class TestArchetypeMetrics:
    def test_metrics_capture_income_expense_savings(self, profiler):
        metrics = profiler._calculate_metrics(
            transactions=[
                _credit(100000),
                _debit(20000, category="FOOD_DINING"),
                _debit(5000, category="RENT"),
            ],
            subscriptions=[],
        )

        assert metrics["total_income"] == 100000.0
        assert metrics["total_expense"] == 25000.0
        assert metrics["savings"] == 75000.0
        assert metrics["savings_rate"] == 0.75
        assert metrics["discretionary_spending"] == 20000.0
        assert metrics["essential_spending"] == 5000.0
        assert metrics["discretionary_ratio"] == 0.8

    def test_subscription_metrics(self, profiler):
        metrics = profiler._calculate_metrics(
            transactions=[_credit(50000)],
            subscriptions=[
                _sub(199),
                _sub(299),
                _sub(99, status="CANCELLED"),  # ignored
                _sub(599, frequency="YEARLY"),  # ignored for monthly bucket
            ],
        )

        # Only ACTIVE + MONTHLY subs count for the monthly cost.
        assert metrics["monthly_subscription_cost"] == 498.0
        assert metrics["subscription_count"] == 3
        # 498 / 50000 = 0.00996 -> rounded to 4 decimals = 0.01
        assert metrics["subscription_to_income_ratio"] == pytest.approx(0.01)

    def test_zero_income_keeps_ratios_safe(self, profiler):
        metrics = profiler._calculate_metrics(
            transactions=[_debit(1000)],
            subscriptions=[],
        )

        assert metrics["savings_rate"] == 0
        assert metrics["subscription_to_income_ratio"] == 0


class TestArchetypeScores:
    def test_spend_heavy_high_when_discretionary_dominant(self, profiler):
        score = profiler._score_spend_heavy(
            {"discretionary_ratio": 0.5, "savings_rate": 0.05}
        )
        # 40 (high disc) + 35 (low savings) -> 0.75
        assert score["score"] == pytest.approx(0.75)
        assert any("discretionary" in r.lower() for r in score["reasons"])

    def test_savings_focused_excellent(self, profiler):
        score = profiler._score_savings_focused(
            {"savings_rate": 0.35, "discretionary_ratio": 0.15}
        )
        # 50 (excellent) + 30 (controlled disc) -> 0.80
        assert score["score"] == pytest.approx(0.80)

    def test_subscription_heavy_score_with_many_subs(self, profiler):
        score = profiler._score_subscription_heavy(
            {
                "subscription_count": 12,
                "subscription_to_income_ratio": 0.18,
                "monthly_subscription_cost": 5000,
            }
        )
        # 30 (>=10 subs) + 40 (>15% income) -> 0.7
        assert score["score"] == pytest.approx(0.7)

    def test_balanced_baseline(self, profiler):
        score = profiler._score_balanced(
            {
                "savings_rate": 0.18,
                "discretionary_ratio": 0.25,
                "subscription_to_income_ratio": 0.05,
            }
        )
        # base 50 + 20 + 15 + 15 = 100 -> capped at 1.0
        assert score["score"] == 1.0

    def test_credit_user_placeholder(self, profiler):
        # Credit user scoring is intentionally a 0 placeholder until
        # account-type data lands; lock the contract so we notice when
        # that wiring happens.
        score = profiler._score_credit_user({})
        assert score["score"] == 0.0


class TestDetermineArchetype:
    def test_no_data_returns_balanced_with_zero_confidence(self, profiler):
        result = profiler.determine_archetype("user-1", [])
        assert result["archetype"] == UserArchetype.BALANCED
        assert result["confidence"] == 0.0

    def test_savings_focused_user(self, profiler):
        # Income 100k, expense 60k -> 40% savings, 0% discretionary.
        result = profiler.determine_archetype(
            "user-1",
            transactions=[_credit(100000), _debit(60000, category="RENT")],
        )

        assert result["archetype"] == UserArchetype.SAVINGS_FOCUSED
        assert result["confidence"] > 0.5

    def test_spend_heavy_user(self, profiler):
        # Income 50k, expense 48k (96% on discretionary), savings rate
        # 4% -> spend-heavy outscores balanced.
        result = profiler.determine_archetype(
            "user-1",
            transactions=[
                _credit(50000),
                _debit(43000, category="SHOPPING"),
                _debit(5000, category="ENTERTAINMENT"),
            ],
        )

        assert result["archetype"] == UserArchetype.SPEND_HEAVY

    def test_returns_dashboard_priority_list(self, profiler):
        result = profiler.determine_archetype(
            "user-1",
            transactions=[_credit(100000), _debit(50000, category="RENT")],
        )

        assert isinstance(result["dashboard_priority"], list)
        assert len(result["dashboard_priority"]) > 0

    def test_recommendations_match_archetype(self, profiler):
        result = profiler.determine_archetype(
            "user-1",
            transactions=[
                _credit(50000),
                _debit(48000, category="SHOPPING"),
            ],
        )

        # Spend-heavy archetype should suggest budgets and auto-save.
        rec_titles = " ".join(r["title"] for r in result["recommendations"])
        assert (
            "Budget" in rec_titles or "Save" in rec_titles or "Spending" in rec_titles
        ), f"unexpected archetype={result['archetype']} recs={result['recommendations']}"


class TestDashboardPriority:
    @pytest.mark.parametrize(
        "archetype,expected_first",
        [
            (UserArchetype.SPEND_HEAVY, "leak_alerts"),
            (UserArchetype.SAVINGS_FOCUSED, "goal_progress"),
            (UserArchetype.SUBSCRIPTION_HEAVY, "subscription_calendar"),
            (UserArchetype.CREDIT_USER, "credit_card_due_dates"),
            (UserArchetype.BALANCED, "spending_summary"),
        ],
    )
    def test_priority_per_archetype(self, profiler, archetype, expected_first):
        priorities = profiler._get_dashboard_priority(archetype)
        assert priorities[0] == expected_first

    def test_unknown_archetype_falls_back_to_balanced(self, profiler):
        priorities = profiler._get_dashboard_priority("MYSTERY")
        assert priorities[0] == "spending_summary"


class TestUpdateUserProfile:
    def test_recomputes_archetype_from_new_data(self, profiler):
        result = profiler.update_user_profile(
            "user-1",
            current_profile={"archetype": UserArchetype.BALANCED},
            new_transactions=[_credit(100000), _debit(50000, category="RENT")],
        )

        assert result["archetype"] == UserArchetype.SAVINGS_FOCUSED
