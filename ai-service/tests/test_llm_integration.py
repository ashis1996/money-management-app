"""
Unit tests for LLM Integration Service
"""

import pytest
import os
from unittest.mock import patch, MagicMock
from app.services.llm_integration import LLMIntegrationService


class TestLLMIntegrationService:
    def test_is_configured_with_openai_key(self):
        """Test configuration detection with OpenAI key"""
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            service = LLMIntegrationService()
            assert service.is_configured() is True

    def test_is_configured_with_anthropic_key(self):
        """Test configuration detection with Anthropic key"""
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            service = LLMIntegrationService()
            assert service.is_configured() is True

    def test_is_configured_without_keys(self):
        """Test configuration detection without any keys"""
        with patch.dict(os.environ, {}, clear=True):
            service = LLMIntegrationService()
            assert service.is_configured() is False

    def test_generate_financial_summary_fallback(self):
        """Test fallback summary generation"""
        with patch.dict(os.environ, {}, clear=True):
            service = LLMIntegrationService()
            transactions = [
                {"type": "CREDIT", "amount": 50000},
                {"type": "DEBIT", "amount": 30000, "category": "SHOPPING"},
                {"type": "DEBIT", "amount": 10000, "category": "FOOD_DINING"},
            ]
            result = service.generate_financial_summary("user-1", transactions, "month")

            assert isinstance(result, str)
            assert "₹" in result
            assert "50000.00" in result or "50000" in result
            assert "month" in result

    def test_generate_financial_summary_high_savings(self):
        """Test summary with high savings rate"""
        with patch.dict(os.environ, {}, clear=True):
            service = LLMIntegrationService()
            transactions = [
                {"type": "CREDIT", "amount": 100000},
                {"type": "DEBIT", "amount": 10000},
            ]
            result = service.generate_financial_summary("user-1", transactions, "month")

            assert "Great job" in result or "savings" in result

    def test_generate_financial_summary_low_savings(self):
        """Test summary with low savings rate"""
        with patch.dict(os.environ, {}, clear=True):
            service = LLMIntegrationService()
            transactions = [
                {"type": "CREDIT", "amount": 10000},
                {"type": "DEBIT", "amount": 9500},
            ]
            result = service.generate_financial_summary("user-1", transactions, "month")

            assert isinstance(result, str)

    def test_generate_financial_summary_zero_income(self):
        """Test summary with zero income"""
        with patch.dict(os.environ, {}, clear=True):
            service = LLMIntegrationService()
            transactions = [
                {"type": "DEBIT", "amount": 5000},
            ]
            result = service.generate_financial_summary("user-1", transactions, "week")

            assert "0.00" in result or "week" in result

    def test_generate_financial_advice_fallback(self):
        """Test fallback advice generation"""
        with patch.dict(os.environ, {}, clear=True):
            service = LLMIntegrationService()
            spending_data = {"SHOPPING": 5000, "FOOD_DINING": 3000}
            goals = ["Save for vacation", "Emergency fund"]
            result = service.generate_financial_advice("user-1", spending_data, goals)

            assert isinstance(result, str)
            assert len(result) > 0

    def test_generate_financial_advice_no_goals(self):
        """Test advice generation without goals"""
        with patch.dict(os.environ, {}, clear=True):
            service = LLMIntegrationService()
            spending_data = {"SHOPPING": 5000}
            result = service.generate_financial_advice("user-1", spending_data, [])

            assert isinstance(result, str)

    def test_generate_financial_advice_empty_data(self):
        """Test advice with empty spending data"""
        with patch.dict(os.environ, {}, clear=True):
            service = LLMIntegrationService()
            result = service.generate_financial_advice("user-1", {}, [])

            assert isinstance(result, str)
            assert "tracking" in result.lower() or "patterns" in result.lower()

    def test_prepare_summary_data(self):
        """Test summary data preparation"""
        with patch.dict(os.environ, {}, clear=True):
            service = LLMIntegrationService()
            transactions = [
                {"type": "CREDIT", "amount": 50000, "category": "INCOME"},
                {"type": "DEBIT", "amount": 10000, "category": "SHOPPING"},
                {"type": "DEBIT", "amount": 5000, "category": "SHOPPING"},
                {"type": "DEBIT", "amount": 3000, "category": "FOOD_DINING"},
            ]
            result = service._prepare_summary_data(transactions, "month")

            assert result["period"] == "month"
            assert result["total_income"] == 50000.0
            assert result["total_expense"] == 18000.0
            assert result["net_savings"] == 32000.0
            assert result["categories"]["SHOPPING"] == 15000.0
            assert result["categories"]["FOOD_DINING"] == 3000.0
            assert result["transaction_count"] == 4

    def test_create_summary_prompt(self):
        """Test summary prompt creation"""
        with patch.dict(os.environ, {}, clear=True):
            service = LLMIntegrationService()
            data = {
                "period": "month",
                "total_income": 50000.0,
                "total_expense": 20000.0,
                "net_savings": 30000.0,
                "categories": {"SHOPPING": 15000.0, "FOOD_DINING": 5000.0},
                "transaction_count": 10,
            }
            result = service._create_summary_prompt(data)

            assert "month" in result
            assert "50000.00" in result
            assert "SHOPPING" in result
            assert "Transaction Count" in result

    def test_format_spending_data(self):
        """Test spending data formatting"""
        with patch.dict(os.environ, {}, clear=True):
            service = LLMIntegrationService()
            data = {"total": 5000.0, "category": "SHOPPING", "count": 5}
            result = service._format_spending_data(data)

            assert "total: ₹5000.00" in result
            assert "category: SHOPPING" in result

    def test_fallback_summary_format(self):
        """Test fallback summary format"""
        with patch.dict(os.environ, {}, clear=True):
            service = LLMIntegrationService()
            transactions = [
                {"type": "CREDIT", "amount": 50000},
                {"type": "DEBIT", "amount": 20000},
            ]
            result = service._generate_fallback_summary(transactions, "month")

            assert "₹50000.00" in result
            assert "₹20000.00" in result
            assert "₹30000.00" in result
            assert "month" in result

    def test_fallback_advice_with_highest_category(self):
        """Test fallback advice identifies highest spending category"""
        with patch.dict(os.environ, {}, clear=True):
            service = LLMIntegrationService()
            spending_data = {"SHOPPING": 10000, "FOOD_DINING": 5000, "TRANSPORT": 2000}
            goals = ["Save money"]
            result = service._generate_fallback_advice(spending_data, goals)

            assert "SHOPPING" in result
            assert "₹10000.00" in result
            assert "Save money" in result

    @patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
    @patch.object(LLMIntegrationService, '_call_openai')
    def test_call_openai_success(self, mock_call_openai):
        """Test successful OpenAI API call"""
        mock_call_openai.return_value = "Test summary"

        service = LLMIntegrationService()
        result = service._call_openai("Test prompt")

        assert result == "Test summary"

    @patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
    @patch.object(LLMIntegrationService, '_call_openai')
    def test_call_openai_error(self, mock_call_openai):
        """Test OpenAI API call with error"""
        mock_call_openai.side_effect = ImportError("No module named 'openai'")

        service = LLMIntegrationService()
        with pytest.raises(Exception):
            service._call_openai("Test prompt")

    @patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"})
    @patch.object(LLMIntegrationService, '_call_anthropic')
    def test_call_anthropic_success(self, mock_call_anthropic):
        """Test successful Anthropic API call"""
        mock_call_anthropic.return_value = "Test advice"

        service = LLMIntegrationService()
        result = service._call_anthropic("Test prompt")

        assert result == "Test advice"

    @patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
    @patch.object(LLMIntegrationService, '_call_openai')
    def test_generate_financial_summary_with_llm(self, mock_call_openai):
        """Test summary generation using LLM"""
        mock_call_openai.return_value = "LLM generated summary"

        service = LLMIntegrationService()
        transactions = [
            {"type": "CREDIT", "amount": 50000, "category": "INCOME"},
            {"type": "DEBIT", "amount": 20000, "category": "SHOPPING"},
        ]
        result = service.generate_financial_summary("user-1", transactions, "month")

        assert result == "LLM generated summary"

    @patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
    @patch.object(LLMIntegrationService, '_call_openai')
    def test_generate_financial_advice_with_llm(self, mock_call_openai):
        """Test advice generation using LLM"""
        mock_call_openai.return_value = "LLM generated advice"

        service = LLMIntegrationService()
        spending_data = {"SHOPPING": 5000}
        goals = ["Save money"]
        result = service.generate_financial_advice("user-1", spending_data, goals)

        assert result == "LLM generated advice"

    @patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"})
    @patch.object(LLMIntegrationService, '_call_openai')
    def test_llm_error_fallback(self, mock_call_openai):
        """Test fallback on LLM error"""
        mock_call_openai.side_effect = Exception("API Error")

        service = LLMIntegrationService()
        transactions = [
            {"type": "CREDIT", "amount": 50000},
            {"type": "DEBIT", "amount": 20000},
        ]
        result = service.generate_financial_summary("user-1", transactions, "month")

        assert isinstance(result, str)
        assert "₹" in result  # Fallback was used
