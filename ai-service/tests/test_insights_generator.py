"""
Unit tests for Insights Generator Service
"""

import pytest
from datetime import datetime, timedelta
from app.services.insights_generator import InsightsGeneratorService


@pytest.fixture
def generator():
    return InsightsGeneratorService()


@pytest.fixture
def sample_transactions():
    """Sample transaction data for testing"""
    return [
        {"id": "tx-1", "type": "DEBIT", "amount": 500, "category": "FOOD_DINING", "merchant": "Zomato", "date": (datetime.utcnow() - timedelta(days=5)).isoformat()},
        {"id": "tx-2", "type": "DEBIT", "amount": 1000, "category": "SHOPPING", "merchant": "Amazon", "date": (datetime.utcnow() - timedelta(days=10)).isoformat()},
        {"id": "tx-3", "type": "CREDIT", "amount": 50000, "category": "INCOME", "merchant": "Employer", "date": (datetime.utcnow() - timedelta(days=15)).isoformat()},
        {"id": "tx-4", "type": "DEBIT", "amount": 300, "category": "TRANSPORT", "merchant": "Uber", "date": (datetime.utcnow() - timedelta(days=2)).isoformat()},
        {"id": "tx-5", "type": "DEBIT", "amount": 2000, "category": "BILLS_UTILITIES", "merchant": "Electricity", "date": (datetime.utcnow() - timedelta(days=20)).isoformat()},
    ]


class TestInsightsGeneratorService:
    def test_generate_spending_insights(self, generator, sample_transactions):
        """Test generating spending insights"""
        result = generator.generate_spending_insights("user-1", sample_transactions, "month")

        assert "spending_analysis" in result
        analysis = result["spending_analysis"]
        assert analysis["period"] == "month"
        assert analysis["total_spent"] == 3800.0
        assert analysis["total_income"] == 50000.0
        assert analysis["net_savings"] == 46200.0
        assert analysis["savings_rate"] == 92.4
        assert "by_category" in analysis
        assert "top_merchants" in analysis

    def test_generate_spending_insights_empty(self, generator):
        """Test generating insights with no transactions"""
        result = generator.generate_spending_insights("user-1", [], "month")

        analysis = result["spending_analysis"]
        assert analysis["total_spent"] == 0
        assert analysis["total_income"] == 0
        assert analysis["net_savings"] == 0
        assert analysis["savings_rate"] == 0

    def test_category_breakdown(self, generator, sample_transactions):
        """Test category breakdown calculation"""
        result = generator._get_category_breakdown(sample_transactions)

        assert len(result) == 4
        categories = [cat["category"] for cat in result]
        assert "FOOD_DINING" in categories
        assert "SHOPPING" in categories
        assert "TRANSPORT" in categories
        assert "BILLS_UTILITIES" in categories

        total_percentage = sum(cat["percentage"] for cat in result)
        assert total_percentage == 100.0

    def test_top_merchants(self, generator, sample_transactions):
        """Test top merchants calculation"""
        result = generator._get_top_merchants(sample_transactions, limit=3)

        assert len(result) <= 3
        # Electricity (2000) should be first among DEBIT transactions
        assert result[0]["merchant"] == "Electricity"
        assert result[0]["amount"] == 2000.0

    def test_analyze_trends_increasing(self, generator):
        """Test detecting increasing trend"""
        current = [
            {"type": "DEBIT", "amount": 1000, "category": "FOOD_DINING", "date": datetime.utcnow().isoformat()},
        ]
        previous = [
            {"type": "DEBIT", "amount": 500, "category": "FOOD_DINING", "date": (datetime.utcnow() - timedelta(days=60)).isoformat()},
        ]
        result = generator._analyze_trends(current, previous)

        assert len(result) == 1
        assert result[0]["trend"] == "INCREASING"
        assert "FOOD_DINING" in result[0]["description"]

    def test_analyze_trends_decreasing(self, generator):
        """Test detecting decreasing trend"""
        current = [
            {"type": "DEBIT", "amount": 500, "category": "SHOPPING", "date": datetime.utcnow().isoformat()},
        ]
        previous = [
            {"type": "DEBIT", "amount": 1000, "category": "SHOPPING", "date": (datetime.utcnow() - timedelta(days=60)).isoformat()},
        ]
        result = generator._analyze_trends(current, previous)

        assert len(result) == 1
        assert result[0]["trend"] == "DECREASING"

    def test_analyze_trends_no_significant_change(self, generator):
        """Test no trend when change is small"""
        current = [
            {"type": "DEBIT", "amount": 1000, "category": "FOOD_DINING", "date": datetime.utcnow().isoformat()},
        ]
        previous = [
            {"type": "DEBIT", "amount": 950, "category": "FOOD_DINING", "date": (datetime.utcnow() - timedelta(days=60)).isoformat()},
        ]
        result = generator._analyze_trends(current, previous)

        assert len(result) == 0

    def test_generate_recommendations_high_spending(self, generator):
        """Test recommendations for high spending categories"""
        category_breakdown = [
            {"category": "FOOD_DINING", "amount": 5000, "percentage": 50},
            {"category": "SHOPPING", "amount": 3000, "percentage": 30},
        ]
        transactions = [
            {"type": "CREDIT", "amount": 20000},
            {"type": "DEBIT", "amount": 10000},
        ]
        result = generator._generate_recommendations(transactions, category_breakdown)

        assert len(result) >= 1
        assert result[0]["type"] == "SPENDING_ANALYSIS"
        assert result[0]["priority"] == "HIGH"

    def test_generate_recommendations_low_savings(self, generator):
        """Test recommendations for low savings rate"""
        category_breakdown = []
        transactions = [
            {"type": "CREDIT", "amount": 10000},
            {"type": "DEBIT", "amount": 9000},
        ]
        result = generator._generate_recommendations(transactions, category_breakdown)

        assert any(rec["type"] == "RECOMMENDATION" for rec in result)

    def test_generate_basic_predictions(self, generator, sample_transactions):
        """Test basic spending predictions"""
        result = generator._generate_basic_predictions(sample_transactions, "month")

        assert "next_period_spending" in result
        assert result["confidence"] == 0.6
        assert result["next_period_spending"] == 3990.0  # 3800 * 1.05

    def test_detect_anomalies_normal_transactions(self, generator):
        """Test anomaly detection with normal transactions"""
        transactions = [
            {"id": "tx-1", "type": "DEBIT", "amount": 100, "merchant": "Store"},
            {"id": "tx-2", "type": "DEBIT", "amount": 120, "merchant": "Store"},
            {"id": "tx-3", "type": "DEBIT", "amount": 110, "merchant": "Store"},
            {"id": "tx-4", "type": "DEBIT", "amount": 105, "merchant": "Store"},
            {"id": "tx-5", "type": "DEBIT", "amount": 115, "merchant": "Store"},
        ]
        result = generator.detect_anomalies("user-1", transactions, "month")

        assert len(result) == 0

    def test_detect_anomalies_with_outlier(self, generator):
        """Test detecting anomalous transaction"""
        transactions = [
            {"id": "tx-1", "type": "DEBIT", "amount": 100, "merchant": "Store"},
            {"id": "tx-2", "type": "DEBIT", "amount": 120, "merchant": "Store"},
            {"id": "tx-3", "type": "DEBIT", "amount": 110, "merchant": "Store"},
            {"id": "tx-4", "type": "DEBIT", "amount": 105, "merchant": "Store"},
            {"id": "tx-5", "type": "DEBIT", "amount": 115, "merchant": "Store"},
            {"id": "tx-6", "type": "DEBIT", "amount": 5000, "merchant": "Luxury Store"},
        ]
        result = generator.detect_anomalies("user-1", transactions, "month")

        assert len(result) == 1
        assert result[0]["type"] == "UNUSUAL_SPENDING"
        assert result[0]["severity"] == "HIGH"
        assert result[0]["amount"] == 5000

    def test_detect_anomalies_insufficient_data(self, generator):
        """Test anomaly detection with insufficient data"""
        transactions = [
            {"id": "tx-1", "type": "DEBIT", "amount": 100},
            {"id": "tx-2", "type": "DEBIT", "amount": 120},
        ]
        result = generator.detect_anomalies("user-1", transactions, "month")

        assert len(result) == 0

    def test_get_date_range_month(self, generator):
        """Test date range for month period"""
        now = datetime(2024, 1, 15, 12, 0, 0)
        start, prev_start = generator._get_date_range("month", now)

        assert (now - start).days == 30
        assert (now - prev_start).days == 60

    def test_get_date_range_week(self, generator):
        """Test date range for week period"""
        now = datetime(2024, 1, 15, 12, 0, 0)
        start, prev_start = generator._get_date_range("week", now)

        assert (now - start).days == 7
        assert (now - prev_start).days == 14

    def test_get_date_range_quarter(self, generator):
        """Test date range for quarter period"""
        now = datetime(2024, 1, 15, 12, 0, 0)
        start, prev_start = generator._get_date_range("quarter", now)

        assert (now - start).days == 90
        assert (now - prev_start).days == 180

    def test_get_date_range_year(self, generator):
        """Test date range for year period"""
        now = datetime(2024, 1, 15, 12, 0, 0)
        start, prev_start = generator._get_date_range("year", now)

        assert (now - start).days == 365
        assert (now - prev_start).days == 730

    def test_parse_date_datetime_object(self, generator):
        """Test parsing datetime object"""
        now = datetime.utcnow()
        result = generator._parse_date(now)

        assert result == now

    def test_parse_date_string(self, generator):
        """Test parsing ISO date string"""
        date_str = "2024-01-15T10:30:00"
        result = generator._parse_date(date_str)

        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15

    def test_parse_date_invalid(self, generator):
        """Test parsing invalid date"""
        result = generator._parse_date("invalid")

        assert result == datetime.min

    def test_generate_recommendations(self, generator, sample_transactions):
        """Test generating recommendations"""
        result = generator.generate_recommendations("user-1", sample_transactions, "month")

        assert isinstance(result, list)

    def test_generate_predictions(self, generator, sample_transactions):
        """Test generating predictions"""
        result = generator.generate_predictions("user-1", "month", sample_transactions)

        assert "next_period_spending" in result
        assert result["confidence"] == 0.6

    def test_generate_predictions_no_data(self, generator):
        """Test predictions with no historical data"""
        result = generator.generate_predictions("user-1", "month", None)

        assert result["next_period_spending"] == 0
        assert result["confidence"] == 0.5
        assert "message" in result

    def test_category_breakdown_sorting(self, generator):
        """Test category breakdown is sorted by amount descending"""
        transactions = [
            {"type": "DEBIT", "amount": 100, "category": "A", "date": datetime.utcnow().isoformat()},
            {"type": "DEBIT", "amount": 500, "category": "B", "date": datetime.utcnow().isoformat()},
            {"type": "DEBIT", "amount": 300, "category": "C", "date": datetime.utcnow().isoformat()},
        ]
        result = generator._get_category_breakdown(transactions)

        assert result[0]["category"] == "B"
        assert result[1]["category"] == "C"
        assert result[2]["category"] == "A"

    def test_top_merchants_limit(self, generator):
        """Test top merchants respects limit"""
        transactions = [
            {"type": "DEBIT", "amount": 100, "merchant": "A", "date": datetime.utcnow().isoformat()},
            {"type": "DEBIT", "amount": 200, "merchant": "B", "date": datetime.utcnow().isoformat()},
            {"type": "DEBIT", "amount": 300, "merchant": "C", "date": datetime.utcnow().isoformat()},
            {"type": "DEBIT", "amount": 400, "merchant": "D", "date": datetime.utcnow().isoformat()},
        ]
        result = generator._get_top_merchants(transactions, limit=2)

        assert len(result) == 2
