"""
Unit tests for Financial Health Score Service
"""

from datetime import datetime, timedelta

import pytest

from app.services.health_score import FinancialHealthService


@pytest.fixture
def service():
    return FinancialHealthService()


def _credit(amount, days_ago=5, **extra):
    return {
        "type": "CREDIT",
        "amount": amount,
        "transactionDate": (datetime.utcnow() - timedelta(days=days_ago)).isoformat(),
        **extra,
    }


def _debit(amount, category="OTHER", days_ago=5, **extra):
    return {
        "type": "DEBIT",
        "amount": amount,
        "category": category,
        "transactionDate": (datetime.utcnow() - timedelta(days=days_ago)).isoformat(),
        **extra,
    }


class TestSavingsRate:
    def test_excellent_savings_rate_scores_100(self, service):
        result = service._calculate_savings_rate_score(
            [_credit(100000), _debit(50000)]
        )

        assert result["score"] == 100
        assert result["savings_rate"] == 50.0
        assert result["status"] == "EXCELLENT"

    def test_low_savings_rate_scores_50(self, service):
        # 7% savings rate -> 50 points
        result = service._calculate_savings_rate_score(
            [_credit(100000), _debit(93000)]
        )

        assert result["score"] == 50
        assert result["status"] == "NEEDS_IMPROVEMENT"

    def test_negative_savings_rate_scores_0(self, service):
        result = service._calculate_savings_rate_score(
            [_credit(50000), _debit(60000)]
        )

        assert result["score"] == 0
        assert result["net_savings"] == -10000.0

    def test_no_income_returns_zero_rate(self, service):
        # With no income the rate is 0% which falls into the
        # non-negative bucket; the score is 30, not 0.
        result = service._calculate_savings_rate_score([_debit(1000)])
        assert result["savings_rate"] == 0
        assert result["score"] == 30
        assert result["total_income"] == 0


class TestBudgetAdherence:
    def test_no_budgets_returns_neutral_score(self, service):
        result = service._calculate_budget_adherence_score([], [])

        assert result["score"] == 70
        assert result["status"] == "NO_BUDGETS"

    def test_all_budgets_on_track_scores_100(self, service):
        transactions = [
            _debit(2000, category="FOOD_DINING"),
            _debit(1000, category="TRANSPORT"),
        ]
        budgets = [
            {"categoryId": "FOOD_DINING", "amountLimit": 5000},
            {"categoryId": "TRANSPORT", "amountLimit": 3000},
        ]

        result = service._calculate_budget_adherence_score(transactions, budgets)

        assert result["score"] == 100
        assert result["budgets_on_track"] == 2
        assert result["budgets_exceeded"] == 0

    def test_partial_adherence_scaled_by_ratio(self, service):
        transactions = [
            _debit(6000, category="FOOD_DINING"),  # over
            _debit(500, category="TRANSPORT"),     # under
        ]
        budgets = [
            {"categoryId": "FOOD_DINING", "amountLimit": 5000},
            {"categoryId": "TRANSPORT", "amountLimit": 3000},
        ]

        result = service._calculate_budget_adherence_score(transactions, budgets)

        # 1 of 2 on track -> 50%
        assert result["score"] == 50
        assert result["budgets_on_track"] == 1
        assert result["budgets_exceeded"] == 1


class TestSubscriptionHealth:
    def test_no_subscriptions_perfect_score(self, service):
        result = service._calculate_subscription_health_score([])

        assert result["score"] == 100
        assert result["status"] == "NO_SUBSCRIPTIONS"

    def test_low_usage_subtracts_10_per_sub_capped_at_30(self, service):
        subs = [
            {"status": "ACTIVE", "amount": 199, "frequency": "MONTHLY", "isLowUsage": True},
            {"status": "ACTIVE", "amount": 299, "frequency": "MONTHLY", "isLowUsage": True},
            {"status": "ACTIVE", "amount": 99, "frequency": "MONTHLY", "isLowUsage": True},
            {"status": "ACTIVE", "amount": 50, "frequency": "MONTHLY", "isLowUsage": True},
        ]

        result = service._calculate_subscription_health_score(subs)

        # 4 low-usage subs -> -40 capped at -30 -> 70
        assert result["score"] == 70

    def test_price_increase_capped_at_15(self, service):
        subs = [
            {
                "status": "ACTIVE",
                "amount": 299,
                "frequency": "MONTHLY",
                "priceIncreased": True,
            }
            for _ in range(5)
        ]

        result = service._calculate_subscription_health_score(subs)

        # 5 increases -> -25 capped at -15 -> 85
        assert result["score"] == 85

    def test_inactive_subscriptions_ignored(self, service):
        subs = [
            {"status": "CANCELLED", "amount": 999, "isLowUsage": True},
            {"status": "ACTIVE", "amount": 199, "frequency": "MONTHLY"},
        ]

        result = service._calculate_subscription_health_score(subs)

        assert result["score"] == 100
        assert result["active_subscriptions"] == 1
        assert result["monthly_total"] == 199.0


class TestSpendingConsistency:
    def test_insufficient_data_returns_70(self, service):
        # Only 3 distinct days
        transactions = [
            _debit(100, days_ago=1),
            _debit(100, days_ago=2),
            _debit(100, days_ago=3),
        ]

        result = service._calculate_spending_consistency_score(transactions)

        assert result["score"] == 70
        assert result["status"] == "INSUFFICIENT_DATA"

    def test_consistent_spending_scores_high(self, service):
        # 8 days, ~₹100/day -> low CV -> 100
        transactions = [
            _debit(100, days_ago=i) for i in range(1, 9)
        ]

        result = service._calculate_spending_consistency_score(transactions)

        assert result["score"] == 100
        assert result["coefficient_of_variation"] == 0

    def test_high_variance_lower_score(self, service):
        amounts = [100, 100, 100, 5000, 100, 5000, 100, 100]
        transactions = [
            _debit(amt, days_ago=i + 1) for i, amt in enumerate(amounts)
        ]

        result = service._calculate_spending_consistency_score(transactions)

        # CV around 1.4 -> below 1.0 bucket -> 30
        assert result["score"] in {30, 50}
        assert result["coefficient_of_variation"] >= 1.0

    def test_handles_datetime_objects_in_dates(self, service):
        """The service supports both ISO strings and datetime objects."""
        transactions = [
            {
                "type": "DEBIT",
                "amount": 100,
                "transactionDate": datetime.utcnow() - timedelta(days=i),
            }
            for i in range(8)
        ]

        result = service._calculate_spending_consistency_score(transactions)
        assert result["score"] == 100


class TestImpulseControl:
    def test_no_transactions_perfect_score(self, service):
        result = service._calculate_impulse_control_score([])
        assert result["score"] == 100

    def test_high_impulse_ratio_low_score(self, service):
        transactions = [_debit(100, isImpulse=True) for _ in range(8)] + [
            _debit(100) for _ in range(2)
        ]

        result = service._calculate_impulse_control_score(transactions)

        # 80% impulse ratio -> 30 score
        assert result["score"] == 30
        assert result["impulse_ratio"] == 80.0

    def test_low_impulse_ratio_high_score(self, service):
        transactions = [_debit(100, isImpulse=True)] + [
            _debit(100) for _ in range(99)
        ]

        result = service._calculate_impulse_control_score(transactions)

        # 1% -> 100
        assert result["score"] == 100


class TestGoalProgress:
    def test_no_goals_neutral_score(self, service):
        result = service._calculate_goal_progress_score([])
        assert result["score"] == 70
        assert result["status"] == "NO_GOALS"

    def test_all_completed_perfect_score(self, service):
        result = service._calculate_goal_progress_score(
            [{"name": "Done", "isCompleted": True}]
        )
        assert result["score"] == 100
        assert result["status"] == "ALL_GOALS_COMPLETED"

    def test_progress_buckets_75_plus_scores_100(self, service):
        goals = [{"name": "G", "targetAmount": 100, "currentAmount": 80}]
        result = service._calculate_goal_progress_score(goals)
        assert result["score"] == 100

    def test_progress_below_25_scores_50(self, service):
        goals = [{"name": "G", "targetAmount": 100, "currentAmount": 10}]
        result = service._calculate_goal_progress_score(goals)
        assert result["score"] == 50


class TestRatings:
    @pytest.mark.parametrize(
        "score,expected",
        [
            (95, "EXCELLENT"),
            (85, "EXCELLENT"),
            (70, "GOOD"),
            (60, "FAIR"),
            (45, "NEEDS_ATTENTION"),
            (30, "CRITICAL"),
            (0, "CRITICAL"),
        ],
    )
    def test_rating_thresholds(self, service, score, expected):
        assert service._get_rating(score) == expected


class TestCalculateHealthScore:
    def test_full_calculation_returns_all_components(self, service):
        transactions = [
            _credit(100000),
            _debit(20000, category="FOOD_DINING"),
            _debit(5000, category="TRANSPORT"),
        ] + [_debit(500, days_ago=i + 1) for i in range(8)]

        result = service.calculate_health_score(
            user_id="user-1",
            transactions=transactions,
            budgets=[{"categoryId": "FOOD_DINING", "amountLimit": 25000}],
            subscriptions=[
                {"status": "ACTIVE", "amount": 199, "frequency": "MONTHLY"}
            ],
            goals=[{"name": "Trip", "targetAmount": 50000, "currentAmount": 30000}],
        )

        assert "score" in result
        assert 0 <= result["score"] <= 100
        assert result["max_score"] == 100
        for key in (
            "savings_rate",
            "budget_adherence",
            "subscription_health",
            "spending_consistency",
            "impulse_control",
            "goal_progress",
            "credit_utilization",
        ):
            assert key in result["components"]
        assert "calculated_at" in result

    def test_low_savings_emits_savings_insight(self, service):
        # Savings rate 1% -> score 30 -> below the 70 cutoff -> insight raised.
        result = service.calculate_health_score(
            user_id="user-1",
            transactions=[_credit(100000), _debit(99000)],
        )

        types = {i["type"] for i in result["insights"]}
        assert "SAVINGS_RATE" in types
