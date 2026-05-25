"""
Unit tests for Subscription Detector Service
"""

import pytest
from datetime import datetime, timedelta
from app.services.subscription_detector import SubscriptionDetectorService


@pytest.fixture
def detector():
    return SubscriptionDetectorService()


class TestSubscriptionDetectorService:
    def test_detect_monthly_subscription(self, detector):
        """Test detecting a monthly subscription"""
        transactions = [
            {"id": "tx-1", "merchant": "Netflix", "amount": 199, "date": "2024-01-01T00:00:00"},
            {"id": "tx-2", "merchant": "Netflix", "amount": 199, "date": "2024-02-01T00:00:00"},
            {"id": "tx-3", "merchant": "Netflix", "amount": 199, "date": "2024-03-01T00:00:00"},
        ]
        result = detector.detect("user-1", transactions)

        assert len(result) == 1
        assert result[0]["merchant"] == "Netflix"
        assert result[0]["frequency"] == "MONTHLY"
        assert result[0]["amount"] == 199.0
        assert result[0]["confidence"] >= 0.5

    def test_detect_weekly_subscription(self, detector):
        """Test detecting a weekly subscription"""
        transactions = [
            {"id": "tx-1", "merchant": "Uber", "amount": 50, "date": "2024-01-01T00:00:00"},
            {"id": "tx-2", "merchant": "Uber", "amount": 50, "date": "2024-01-08T00:00:00"},
            {"id": "tx-3", "merchant": "Uber", "amount": 50, "date": "2024-01-15T00:00:00"},
        ]
        result = detector.detect("user-1", transactions)

        assert len(result) == 1
        assert result[0]["frequency"] == "WEEKLY"

    def test_detect_daily_subscription(self, detector):
        """Test detecting a daily subscription"""
        transactions = [
            {"id": "tx-1", "merchant": "Coffee", "amount": 10, "date": "2024-01-01T00:00:00"},
            {"id": "tx-2", "merchant": "Coffee", "amount": 10, "date": "2024-01-02T00:00:00"},
            {"id": "tx-3", "merchant": "Coffee", "amount": 10, "date": "2024-01-03T00:00:00"},
        ]
        result = detector.detect("user-1", transactions)

        assert len(result) == 1
        assert result[0]["frequency"] == "DAILY"

    def test_detect_quarterly_subscription(self, detector):
        """Test detecting a quarterly subscription"""
        transactions = [
            {"id": "tx-1", "merchant": "Insurance", "amount": 5000, "date": "2024-01-01T00:00:00"},
            {"id": "tx-2", "merchant": "Insurance", "amount": 5000, "date": "2024-04-01T00:00:00"},
            {"id": "tx-3", "merchant": "Insurance", "amount": 5000, "date": "2024-07-01T00:00:00"},
        ]
        result = detector.detect("user-1", transactions)

        assert len(result) == 1
        assert result[0]["frequency"] == "QUARTERLY"

    def test_detect_yearly_subscription(self, detector):
        """Test detecting a yearly subscription"""
        transactions = [
            {"id": "tx-1", "merchant": "Domain", "amount": 1000, "date": "2023-01-01T00:00:00"},
            {"id": "tx-2", "merchant": "Domain", "amount": 1000, "date": "2024-01-01T00:00:00"},
        ]
        result = detector.detect("user-1", transactions)

        assert len(result) == 1
        assert result[0]["frequency"] == "YEARLY"

    def test_insufficient_occurrences(self, detector):
        """Test not detecting subscription with only one transaction"""
        transactions = [
            {"id": "tx-1", "merchant": "Netflix", "amount": 199, "date": "2024-01-01T00:00:00"},
        ]
        result = detector.detect("user-1", transactions)

        assert len(result) == 0

    def test_low_confidence_boundary(self, detector):
        """Test subscription at confidence boundary (0.5)"""
        transactions = [
            {"id": "tx-1", "merchant": "Random", "amount": 100, "date": "2024-01-01T00:00:00"},
            {"id": "tx-2", "merchant": "Random", "amount": 1000, "date": "2024-06-15T00:00:00"},
        ]
        result = detector.detect("user-1", transactions)

        # With 2 transactions, minimum confidence is 0.5 (threshold is inclusive)
        assert len(result) == 1
        assert result[0]["confidence"] == 0.5

    def test_multiple_subscriptions(self, detector):
        """Test detecting multiple subscriptions"""
        transactions = [
            {"id": "tx-1", "merchant": "Netflix", "amount": 199, "date": "2024-01-01T00:00:00"},
            {"id": "tx-2", "merchant": "Netflix", "amount": 199, "date": "2024-02-01T00:00:00"},
            {"id": "tx-3", "merchant": "Spotify", "amount": 99, "date": "2024-01-01T00:00:00"},
            {"id": "tx-4", "merchant": "Spotify", "amount": 99, "date": "2024-02-01T00:00:00"},
        ]
        result = detector.detect("user-1", transactions)

        assert len(result) == 2
        merchants = [sub["merchant"] for sub in result]
        assert "Netflix" in merchants
        assert "Spotify" in merchants

    def test_skip_null_merchant(self, detector):
        """Test skipping transactions without merchant"""
        transactions = [
            {"id": "tx-1", "merchant": None, "amount": 100, "date": "2024-01-01T00:00:00"},
            {"id": "tx-2", "merchant": "Netflix", "amount": 199, "date": "2024-01-01T00:00:00"},
            {"id": "tx-3", "merchant": "Netflix", "amount": 199, "date": "2024-02-01T00:00:00"},
        ]
        result = detector.detect("user-1", transactions)

        assert len(result) == 1
        assert result[0]["merchant"] == "Netflix"

    def test_analyze_frequency_single_transaction(self, detector):
        """Test frequency analysis with single transaction"""
        transactions = [
            {"id": "tx-1", "date": "2024-01-01T00:00:00"},
        ]
        result = detector._analyze_frequency(transactions)

        assert result is None

    def test_calculate_confidence_amount_consistency(self, detector):
        """Test confidence calculation with consistent amounts"""
        transactions = [
            {"id": "tx-1", "amount": 199, "date": "2024-01-01T00:00:00"},
            {"id": "tx-2", "amount": 199, "date": "2024-02-01T00:00:00"},
            {"id": "tx-3", "amount": 199, "date": "2024-03-01T00:00:00"},
        ]
        confidence = detector._calculate_confidence(transactions, "MONTHLY")

        assert confidence > 0.7  # High confidence for consistent amounts

    def test_calculate_confidence_amount_variance(self, detector):
        """Test confidence calculation with varying amounts"""
        transactions = [
            {"id": "tx-1", "amount": 100, "date": "2024-01-01T00:00:00"},
            {"id": "tx-2", "amount": 200, "date": "2024-02-01T00:00:00"},
            {"id": "tx-3", "amount": 300, "date": "2024-03-01T00:00:00"},
        ]
        confidence = detector._calculate_confidence(transactions, "MONTHLY")

        # Regular dates boost confidence despite moderate amount variance
        assert confidence >= 0.6

    def test_calculate_confidence_date_regularity(self, detector):
        """Test confidence with regular dates"""
        transactions = [
            {"id": "tx-1", "amount": 199, "date": "2024-01-01T00:00:00"},
            {"id": "tx-2", "amount": 199, "date": "2024-02-01T00:00:00"},
            {"id": "tx-3", "amount": 199, "date": "2024-03-01T00:00:00"},
        ]
        confidence = detector._calculate_confidence(transactions, "MONTHLY")

        assert confidence >= 0.5

    def test_analyze_merchant_pattern_subscription(self, detector):
        """Test analyzing merchant pattern for subscription"""
        transactions = [
            {"id": "tx-1", "amount": 199, "date": "2024-01-01T00:00:00"},
            {"id": "tx-2", "amount": 199, "date": "2024-02-01T00:00:00"},
            {"id": "tx-3", "amount": 199, "date": "2024-03-01T00:00:00"},
        ]
        result = detector.analyze_merchant_pattern("Netflix", transactions)

        assert result["is_subscription"] is True
        assert result["frequency"] == "MONTHLY"
        assert result["confidence"] >= 0.5
        assert result["average_amount"] == 199.0
        assert result["transaction_count"] == 3

    def test_analyze_merchant_pattern_not_subscription(self, detector):
        """Test analyzing merchant pattern that's not a subscription"""
        transactions = [
            {"id": "tx-1", "amount": 100, "date": "2024-01-01T00:00:00"},
        ]
        result = detector.analyze_merchant_pattern("Random", transactions)

        assert result["is_subscription"] is False
        assert result["reason"] == "Insufficient transactions"

    def test_calculate_next_payment_monthly(self, detector):
        """Test calculating next payment date for monthly subscription"""
        transactions = [
            {"id": "tx-1", "date": "2024-01-15T00:00:00"},
        ]
        result = detector._calculate_next_payment("MONTHLY", transactions)

        assert result.month == 2
        assert result.day == 15

    def test_calculate_next_payment_weekly(self, detector):
        """Test calculating next payment date for weekly subscription"""
        transactions = [
            {"id": "tx-1", "date": "2024-01-01T00:00:00"},
        ]
        result = detector._calculate_next_payment("WEEKLY", transactions)

        assert result == datetime(2024, 1, 8, 0, 0, 0)

    def test_calculate_next_payment_yearly(self, detector):
        """Test calculating next payment date for yearly subscription"""
        transactions = [
            {"id": "tx-1", "date": "2024-01-01T00:00:00"},
        ]
        result = detector._calculate_next_payment("YEARLY", transactions)

        assert result.year == 2025

    def test_calculate_next_payment_no_transactions(self, detector):
        """Test calculating next payment with no transactions"""
        result = detector._calculate_next_payment("MONTHLY", [])

        assert result is None

    def test_datetime_objects_in_transactions(self, detector):
        """Test handling datetime objects instead of strings"""
        transactions = [
            {"id": "tx-1", "merchant": "Netflix", "amount": 199, "date": datetime(2024, 1, 1)},
            {"id": "tx-2", "merchant": "Netflix", "amount": 199, "date": datetime(2024, 2, 1)},
        ]
        result = detector.detect("user-1", transactions)

        assert len(result) == 1
        assert result[0]["frequency"] == "MONTHLY"

    def test_invalid_date_strings(self, detector):
        """Test handling invalid date strings"""
        transactions = [
            {"id": "tx-1", "merchant": "Netflix", "amount": 199, "date": "invalid-date"},
            {"id": "tx-2", "merchant": "Netflix", "amount": 199, "date": "2024-02-01T00:00:00"},
        ]
        result = detector.detect("user-1", transactions)

        assert len(result) == 0  # Not enough valid dates

    def test_confidence_sorted_descending(self, detector):
        """Test that results are sorted by confidence descending"""
        transactions = [
            {"id": "tx-1", "merchant": "HighConf", "amount": 100, "date": "2024-01-01T00:00:00"},
            {"id": "tx-2", "merchant": "HighConf", "amount": 100, "date": "2024-02-01T00:00:00"},
            {"id": "tx-3", "merchant": "HighConf", "amount": 100, "date": "2024-03-01T00:00:00"},
            {"id": "tx-4", "merchant": "LowConf", "amount": 100, "date": "2024-01-01T00:00:00"},
            {"id": "tx-5", "merchant": "LowConf", "amount": 200, "date": "2024-06-01T00:00:00"},
        ]
        result = detector.detect("user-1", transactions)

        assert len(result) == 2
        assert result[0]["confidence"] >= result[1]["confidence"]
