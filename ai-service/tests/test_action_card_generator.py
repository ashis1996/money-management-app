"""
Unit tests for Action Card Generator Service
"""

from datetime import datetime

import pytest

from app.services.action_card_generator import ActionCardGenerator, ActionType


@pytest.fixture
def generator():
    return ActionCardGenerator()


def _sub(name, amount, **extra):
    return {
        "id": f"sub-{name}",
        "name": name,
        "merchantName": name,
        "amount": amount,
        "frequency": "MONTHLY",
        "status": "ACTIVE",
        **extra,
    }


def _credit(amount):
    return {"type": "CREDIT", "amount": amount}


def _debit(amount, category="OTHER"):
    return {"type": "DEBIT", "amount": amount, "category": category}


class TestSubscriptionCards:
    def test_low_usage_subscription_creates_cancel_card(self, generator):
        cards = generator._generate_subscription_cards(
            {"subscriptions": [_sub("ObscureSaaS", 299, isLowUsage=True)]}
        )

        assert len(cards) == 1
        card = cards[0]
        assert card["type"] == ActionType.CANCEL_SUBSCRIPTION.value
        assert card["priority"] == ActionCardGenerator.PRIORITY_HIGH
        assert card["impact_amount"] == 299.0
        assert card["action_data"]["subscription_id"] == "sub-ObscureSaaS"
        # Unrecognised merchants don't get a deep-link cancel URL but
        # do get a generic step-by-step fallback.
        assert card["action_data"]["cancel_url"] is None
        assert card["action_data"]["cancel_steps"]

    def test_known_merchant_gets_specific_cancel_url(self, generator):
        cards = generator._generate_subscription_cards(
            {"subscriptions": [_sub("Netflix", 499, isLowUsage=True)]}
        )
        url = cards[0]["action_data"]["cancel_url"]
        assert url is not None
        assert "netflix" in url.lower()

    def test_price_increase_creates_review_card(self, generator):
        cards = generator._generate_subscription_cards(
            {
                "subscriptions": [
                    _sub(
                        "Netflix",
                        649,
                        priceIncreased=True,
                        originalAmount=499,
                        priceIncreasePercent=30,
                    )
                ]
            }
        )

        assert any(c["type"] == ActionType.REVIEW_SUBSCRIPTION.value for c in cards)
        review = next(
            c for c in cards if c["type"] == ActionType.REVIEW_SUBSCRIPTION.value
        )
        assert review["impact_amount"] == 150.0
        assert review["priority"] == ActionCardGenerator.PRIORITY_MEDIUM

    def test_inactive_subscription_skipped(self, generator):
        cards = generator._generate_subscription_cards(
            {
                "subscriptions": [
                    _sub("Hotstar", 299, isLowUsage=True, status="CANCELLED")
                ]
            }
        )
        assert cards == []

    def test_duplicate_video_services_yield_card(self, generator):
        cards = generator._generate_subscription_cards(
            {
                "subscriptions": [
                    _sub("Netflix", 499),
                    _sub("Hotstar", 299),
                ]
            }
        )

        # Each subscription is otherwise healthy, so the only card we
        # expect is the duplicate-services one.
        cancel_cards = [
            c for c in cards if c["type"] == ActionType.CANCEL_SUBSCRIPTION.value
        ]
        assert len(cancel_cards) == 1
        # Cheaper service is recommended; savings = cost of the rest.
        assert cancel_cards[0]["impact_amount"] == 499.0
        assert cancel_cards[0]["action_data"]["recommended"] == "Hotstar"


class TestLeakCards:
    def test_impulse_leak_creates_avoid_card(self, generator):
        cards = generator._generate_leak_cards(
            {
                "leak_analysis": {
                    "leaks": [
                        {
                            "type": "IMPULSE_PURCHASES",
                            "transaction_count": 4,
                            "total_amount": 1200,
                            "monthly_savings": 1200,
                        }
                    ]
                }
            }
        )

        assert len(cards) == 1
        assert cards[0]["type"] == ActionType.AVOID_IMPULSE.value
        assert cards[0]["priority"] == ActionCardGenerator.PRIORITY_HIGH

    def test_late_night_leak_creates_avoid_card(self, generator):
        cards = generator._generate_leak_cards(
            {
                "leak_analysis": {
                    "leaks": [
                        {
                            "type": "LATE_NIGHT_SPENDING",
                            "total_amount": 800,
                            "monthly_savings": 400,
                        }
                    ]
                }
            }
        )

        assert cards[0]["type"] == ActionType.AVOID_IMPULSE.value
        assert cards[0]["priority"] == ActionCardGenerator.PRIORITY_MEDIUM

    def test_small_frequent_leak_creates_reduce_card(self, generator):
        cards = generator._generate_leak_cards(
            {
                "leak_analysis": {
                    "leaks": [
                        {
                            "type": "SMALL_FREQUENT",
                            "merchant": "Chai",
                            "transaction_count": 8,
                            "total_amount": 1200,
                            "monthly_savings": 1200,
                        }
                    ]
                }
            }
        )

        assert cards[0]["type"] == ActionType.REDUCE_SPENDING.value
        assert "Chai" in cards[0]["title"]

    def test_only_top_five_leaks_processed(self, generator):
        leaks = [
            {"type": "IMPULSE_PURCHASES", "transaction_count": 1, "total_amount": 100, "monthly_savings": 100}
            for _ in range(8)
        ]

        cards = generator._generate_leak_cards({"leak_analysis": {"leaks": leaks}})
        assert len(cards) == 5


class TestBudgetCards:
    def test_no_budgets_suggests_setting_one(self, generator):
        cards = generator._generate_budget_cards(
            {
                "budgets": [],
                "transactions": [_debit(5000, category="SHOPPING")],
            }
        )

        assert len(cards) == 1
        assert cards[0]["type"] == ActionType.SET_BUDGET.value
        # Suggested categories come from spending history.
        assert cards[0]["action_data"]["suggested_categories"]

    def test_over_budget_emits_urgent_card(self, generator):
        cards = generator._generate_budget_cards(
            {
                "budgets": [{"categoryId": "FOOD_DINING", "amountLimit": 5000}],
                "transactions": [_debit(7000, category="FOOD_DINING")],
            }
        )

        assert cards[0]["priority"] == ActionCardGenerator.PRIORITY_URGENT
        assert cards[0]["impact_amount"] == 2000.0

    def test_warning_band_emits_medium_priority(self, generator):
        cards = generator._generate_budget_cards(
            {
                "budgets": [{"categoryId": "FOOD_DINING", "amountLimit": 5000}],
                "transactions": [_debit(4000, category="FOOD_DINING")],  # 80% used
            }
        )

        assert len(cards) == 1
        assert cards[0]["priority"] == ActionCardGenerator.PRIORITY_MEDIUM
        assert "Slow Down" in cards[0]["title"]

    def test_under_budget_no_card(self, generator):
        cards = generator._generate_budget_cards(
            {
                "budgets": [{"categoryId": "FOOD_DINING", "amountLimit": 5000}],
                "transactions": [_debit(1000, category="FOOD_DINING")],
            }
        )

        assert cards == []


class TestSavingsCards:
    def test_low_savings_rate_emits_high_priority_card(self, generator):
        cards = generator._generate_savings_cards(
            {
                "health_score": {
                    "components": {"savings_rate": {"savings_rate": 5}}
                },
                "transactions": [_debit(10000)],
            }
        )

        types = [c["type"] for c in cards]
        assert ActionType.INCREASE_SAVINGS.value in types
        assert ActionType.EMERGENCY_FUND.value in types

    def test_emergency_fund_uses_3_to_6x_expense(self, generator):
        cards = generator._generate_savings_cards(
            {
                "health_score": {"components": {"savings_rate": {"savings_rate": 25}}},
                "transactions": [_debit(20000)],
            }
        )

        emergency = next(c for c in cards if c["type"] == ActionType.EMERGENCY_FUND.value)
        assert emergency["action_data"]["recommended_minimum"] == 60000
        assert emergency["action_data"]["recommended_target"] == 120000


class TestGoalCards:
    def test_no_goals_suggests_setting_one(self, generator):
        cards = generator._generate_goal_cards({"goals": []})
        assert cards[0]["type"] == ActionType.SET_GOAL.value
        assert cards[0]["action_data"]["suggested_goals"]

    def test_lagging_goal_emits_track_card(self, generator):
        cards = generator._generate_goal_cards(
            {
                "goals": [
                    {
                        "id": "g-1",
                        "name": "Trip",
                        "targetAmount": 100000,
                        "currentAmount": 20000,
                        "targetDate": "2024-12-31",
                    }
                ]
            }
        )

        track = [c for c in cards if c["type"] == ActionType.TRACK_GOAL.value]
        assert len(track) == 1
        assert track[0]["action_data"]["progress"] == 0.2

    def test_goal_above_50pct_no_track_card(self, generator):
        cards = generator._generate_goal_cards(
            {
                "goals": [
                    {
                        "id": "g-1",
                        "name": "Trip",
                        "targetAmount": 100000,
                        "currentAmount": 80000,
                        "targetDate": "2024-12-31",
                    }
                ]
            }
        )

        # Halfway-or-better goals don't get a track card; the empty
        # "set goal" card also doesn't fire because goals is non-empty.
        assert cards == []

    def test_completed_goals_skipped(self, generator):
        cards = generator._generate_goal_cards(
            {
                "goals": [
                    {
                        "id": "g-1",
                        "name": "Done",
                        "targetAmount": 1,
                        "currentAmount": 1,
                        "isCompleted": True,
                    }
                ]
            }
        )
        assert cards == []


class TestGenerateActionCards:
    def test_orders_by_priority_then_impact(self, generator):
        context = {
            "subscriptions": [_sub("Hotstar", 299, isLowUsage=True)],
            "leak_analysis": {
                "leaks": [
                    {
                        "type": "IMPULSE_PURCHASES",
                        "transaction_count": 5,
                        "total_amount": 1500,
                        "monthly_savings": 1500,
                    }
                ]
            },
            "budgets": [{"categoryId": "FOOD_DINING", "amountLimit": 5000}],
            "transactions": [
                _credit(50000),
                _debit(8000, category="FOOD_DINING"),  # over budget -> URGENT
            ],
            "health_score": {
                "components": {"savings_rate": {"savings_rate": 5}}
            },
            "goals": [],
        }

        cards = generator.generate_action_cards("user-1", context)

        # Top card must be URGENT priority.
        assert cards[0]["priority"] == ActionCardGenerator.PRIORITY_URGENT

        priority_order = {
            ActionCardGenerator.PRIORITY_URGENT: 0,
            ActionCardGenerator.PRIORITY_HIGH: 1,
            ActionCardGenerator.PRIORITY_MEDIUM: 2,
            ActionCardGenerator.PRIORITY_LOW: 3,
        }
        ranks = [priority_order[c["priority"]] for c in cards]
        assert ranks == sorted(ranks)

    def test_caps_at_ten_cards(self, generator):
        context = {
            "subscriptions": [
                _sub(f"Sub{i}", 199, isLowUsage=True) for i in range(15)
            ],
            "transactions": [],
            "budgets": [],
            "goals": [],
            "health_score": {"components": {"savings_rate": {"savings_rate": 5}}},
        }

        cards = generator.generate_action_cards("user-1", context)
        assert len(cards) <= 10

    def test_card_metadata_shape(self, generator):
        cards = generator.generate_action_cards(
            "user-1",
            {"subscriptions": [_sub("Hotstar", 299, isLowUsage=True)], "transactions": []},
        )

        card = cards[0]
        assert set(card.keys()) >= {
            "id",
            "type",
            "title",
            "description",
            "priority",
            "impact_amount",
            "impact_type",
            "status",
            "action_data",
            "created_at",
            "expires_at",
        }
        # Created/expires are ISO strings parseable by datetime.
        datetime.fromisoformat(card["created_at"])
        datetime.fromisoformat(card["expires_at"])
        assert card["status"] == "PENDING"


class TestHelpers:
    def test_get_cancel_url_for_known_merchant(self, generator):
        assert "spotify" in (generator._get_cancel_url("Spotify Premium") or "")

    def test_get_cancel_url_unknown_returns_none(self, generator):
        assert generator._get_cancel_url("ObscureSaaS") is None

    def test_get_cancel_url_handles_none_gracefully(self, generator):
        # The helper accepts None merchant names without crashing.
        assert generator._get_cancel_url(None) is None

    def test_get_cancel_steps_default_is_generic(self, generator):
        steps = generator._get_cancel_steps("ObscureSaaS")
        assert isinstance(steps, list) and len(steps) >= 2

    def test_suggest_budget_categories_top_three(self, generator):
        transactions = [
            _debit(10000, category="SHOPPING"),
            _debit(8000, category="FOOD_DINING"),
            _debit(5000, category="TRANSPORT"),
            _debit(2000, category="ENTERTAINMENT"),
        ]

        suggestions = generator._suggest_budget_categories(transactions)

        assert len(suggestions) == 3
        assert suggestions[0]["category"] == "SHOPPING"
        # Suggested budget is 90% of observed spend.
        assert suggestions[0]["suggested_budget"] == 9000.0
