"""
Unit tests for AI Assistant Service

These tests focus on the deterministic intent classification and
fallback response paths. The LLM-backed branches (`_call_openai`,
`_call_anthropic`) are intentionally excluded — they run only when an
API key is configured, and exercising them in CI would couple the tests
to network providers and to the live model versions. Instead we verify
the assistant *behaves correctly when no key is set*, which is the
production fallback path.
"""

import pytest

from app.services.ai_assistant import AIAssistantService, QueryIntent


@pytest.fixture
def assistant(monkeypatch):
    """
    Build the assistant with no API keys so every code path exercises
    the deterministic fallback responses.
    """
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    return AIAssistantService()


def _credit(amount):
    return {"type": "CREDIT", "amount": amount}


def _debit(amount, category="OTHER", merchant=None, **extra):
    tx = {"type": "DEBIT", "amount": amount, "category": category}
    if merchant:
        tx["merchantName"] = merchant
    tx.update(extra)
    return tx


class TestIntentClassification:
    @pytest.mark.parametrize(
        "query,expected",
        [
            ("Where did I spend last month?", QueryIntent.SPENDING_SUMMARY),
            ("show my spending", QueryIntent.SPENDING_SUMMARY),
            ("how much did I spend on food", QueryIntent.SPENDING_SUMMARY),
            ("Where did I waste money?", QueryIntent.WASTE_ANALYSIS),
            ("How can I save money?", QueryIntent.WASTE_ANALYSIS),
            ("Can I afford a 50000 phone?", QueryIntent.AFFORDABILITY_CHECK),
            ("Should I buy this?", QueryIntent.AFFORDABILITY_CHECK),
            ("How can I save more?", QueryIntent.SAVINGS_ADVICE),
            ("Save 25000 next month", QueryIntent.SAVINGS_ADVICE),
            ("Cancel my subscriptions", QueryIntent.SUBSCRIPTION_HELP),
            ("How is my budget?", QueryIntent.BUDGET_HELP),
            ("Predict my end of month balance", QueryIntent.PREDICTION),
            ("What's my runway?", QueryIntent.PREDICTION),
            ("Compare with last month", QueryIntent.COMPARISON),
            ("Hello there!", QueryIntent.UNKNOWN),
        ],
    )
    def test_classification(self, assistant, query, expected):
        assert assistant._classify_intent(query) == expected


class TestSpendingSummary:
    def test_returns_total_and_top_categories(self, assistant):
        context = {
            "transactions": [
                _credit(50000),
                _debit(2000, category="FOOD_DINING"),
                _debit(3000, category="SHOPPING"),
                _debit(1000, category="TRANSPORT"),
            ]
        }

        result = assistant.process_query("user-1", "where did I spend?", context)

        assert result["intent"] == QueryIntent.SPENDING_SUMMARY.value
        assert result["data"]["total_spent"] == 6000.0
        assert result["data"]["total_income"] == 50000.0
        # Largest category should sort first.
        assert result["data"]["categories"][0]["category"] == "SHOPPING"
        assert isinstance(result["answer"], str) and result["answer"]

    def test_empty_context_does_not_crash(self, assistant):
        result = assistant.process_query("u", "show my spending", {})
        assert result["intent"] == QueryIntent.SPENDING_SUMMARY.value
        assert result["data"]["total_spent"] == 0


class TestWasteAnalysis:
    def test_uses_leak_analysis_from_context(self, assistant):
        leaks = [
            {"type": "UNUSED_SUBSCRIPTION", "merchant": "Hotstar", "amount": 299, "monthly_savings": 299},
            {"type": "IMPULSE_PURCHASES", "amount": 500, "monthly_savings": 500},
        ]
        context = {
            "leak_analysis": {
                "potential_monthly_savings": 799,
                "leaks": leaks,
            }
        }

        result = assistant.process_query("u", "where did I waste money?", context)

        assert result["intent"] == QueryIntent.WASTE_ANALYSIS.value
        assert result["data"]["potential_monthly_savings"] == 799
        assert "Hotstar" in result["answer"] or "Hotstar" in str(result["data"])

    def test_no_leaks_still_responds(self, assistant):
        result = assistant.process_query(
            "u", "money leak?", {"leak_analysis": {}}
        )
        assert result["intent"] == QueryIntent.WASTE_ANALYSIS.value
        assert result["answer"]


class TestAffordabilityCheck:
    def test_can_afford_when_savings_exceed_amount(self, assistant):
        context = {"transactions": [_credit(100000), _debit(20000)]}

        result = assistant.process_query(
            "u", "can I afford 50000?", context
        )

        assert result["intent"] == QueryIntent.AFFORDABILITY_CHECK.value
        assert result["data"]["can_afford"] is True
        assert result["data"]["amount"] == 50000

    def test_savings_path_when_short_term(self, assistant):
        # Income 100k, expense 75k -> savings 25k, rate 25%.
        # 60k can't be afforded outright, but at this rate is reachable.
        context = {"transactions": [_credit(100000), _debit(75000)]}

        result = assistant.process_query("u", "can I afford 60000?", context)

        assert result["data"]["can_afford"] is False
        assert result["data"]["months_to_save"] is not None
        assert result["data"]["savings_rate"] == 25.0

    def test_no_amount_in_query_asks_for_clarification(self, assistant):
        result = assistant.process_query(
            "u", "can I afford this?", {"transactions": [_credit(1000)]}
        )

        assert result["intent"] == QueryIntent.AFFORDABILITY_CHECK.value
        assert result["data"] is None
        assert "amount" in result["answer"].lower()

    def test_amount_with_thousands_separator(self, assistant):
        context = {"transactions": [_credit(1_000_000), _debit(0)]}

        result = assistant.process_query(
            "u", "can I afford ₹50,000?", context
        )

        assert result["data"]["amount"] == 50000


class TestSavingsAdvice:
    def test_generates_recommendations(self, assistant):
        context = {
            "transactions": [_credit(100000), _debit(80000, category="SHOPPING")],
            "leak_analysis": {"potential_monthly_savings": 1500},
        }

        result = assistant.process_query("u", "how can I save?", context)

        assert result["intent"] == QueryIntent.SAVINGS_ADVICE.value
        assert result["data"]["savings_rate"] == 20.0
        assert result["data"]["recommendations"]
        # The leak-fix recommendation should appear first when leaks
        # exist.
        assert any(
            "leak" in r["action"].lower() for r in result["data"]["recommendations"]
        )

    def test_target_amount_extracted_from_query(self, assistant):
        context = {"transactions": [_credit(50000), _debit(40000)]}

        result = assistant.process_query("u", "save 25000 this year", context)

        assert result["data"]["target"] == 25000


class TestPrediction:
    def test_no_data_explains_to_user(self, assistant):
        result = assistant.process_query(
            "u", "predict end of month balance", {"transactions": []}
        )
        assert result["data"] is None
        assert "data" in result["answer"].lower()

    def test_returns_runway_and_balance(self, assistant):
        context = {
            "transactions": [
                _credit(50000),
                {
                    "type": "DEBIT",
                    "amount": 1000,
                    "transactionDate": "2024-01-10T00:00:00",
                },
                {
                    "type": "DEBIT",
                    "amount": 1000,
                    "transactionDate": "2024-01-11T00:00:00",
                },
            ]
        }

        result = assistant.process_query(
            "u", "predict my end of month balance", context
        )

        assert result["intent"] == QueryIntent.PREDICTION.value
        assert result["data"]["current_balance"] == 48000.0
        assert result["data"]["daily_average"] == 1000.0
        assert result["data"]["runway_days"] == 48


class TestSubscriptionHelp:
    def test_summarises_active_subs_and_issues(self, assistant):
        context = {
            "subscriptions": [
                {
                    "status": "ACTIVE",
                    "name": "Netflix",
                    "amount": 499,
                    "frequency": "MONTHLY",
                    "isLowUsage": True,
                },
                {
                    "status": "ACTIVE",
                    "name": "Hotstar",
                    "amount": 299,
                    "frequency": "MONTHLY",
                    "priceIncreased": True,
                },
                {"status": "CANCELLED", "name": "Zee5", "amount": 199, "frequency": "MONTHLY"},
            ]
        }

        result = assistant.process_query("u", "subscription audit", context)

        assert result["intent"] == QueryIntent.SUBSCRIPTION_HELP.value
        assert result["data"]["active_count"] == 2
        assert result["data"]["monthly_total"] == 798.0
        assert len(result["data"]["issues"]) == 2


class TestComparisonAndGeneral:
    def test_comparison_returns_placeholder(self, assistant):
        result = assistant.process_query("u", "compare with last month", {})
        assert result["intent"] == QueryIntent.COMPARISON.value
        assert "soon" in result["answer"].lower()

    def test_unknown_query_general_fallback(self, assistant):
        result = assistant.process_query("u", "hello!", {})
        assert result["intent"] == QueryIntent.GENERAL_ADVICE.value
        assert result["answer"]
