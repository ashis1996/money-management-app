"""
Insights Generator Service
Generates financial insights, trends, and predictions
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict
import statistics
import math

logger = logging.getLogger(__name__)


class InsightsGeneratorService:
    """Service for generating financial insights"""

    def __init__(self):
        pass

    def generate_spending_insights(
        self,
        user_id: str,
        transactions: List[Dict[str, Any]],
        period: str = "month"
    ) -> Dict[str, Any]:
        """
        Generate comprehensive spending insights

        Args:
            user_id: User identifier
            transactions: List of transactions
            period: Time period (week, month, quarter, year)

        Returns:
            Spending insights dictionary
        """
        # Get date range
        now = datetime.utcnow()
        start_date, prev_start_date = self._get_date_range(period, now)

        # Filter transactions for current period
        current_txns = [
            tx for tx in transactions
            if self._parse_date(tx.get("date")) >= start_date
        ]

        # Filter transactions for previous period
        prev_txns = [
            tx for tx in transactions
            if start_date > self._parse_date(tx.get("date")) >= prev_start_date
        ]

        # Calculate totals
        current_income = sum(
            float(tx.get("amount", 0)) for tx in current_txns
            if tx.get("type") == "CREDIT"
        )
        current_expense = sum(
            float(tx.get("amount", 0)) for tx in current_txns
            if tx.get("type") == "DEBIT"
        )

        prev_income = sum(
            float(tx.get("amount", 0)) for tx in prev_txns
            if tx.get("type") == "CREDIT"
        )
        prev_expense = sum(
            float(tx.get("amount", 0)) for tx in prev_txns
            if tx.get("type") == "DEBIT"
        )

        # Category breakdown
        category_breakdown = self._get_category_breakdown(current_txns)

        # Top merchants
        top_merchants = self._get_top_merchants(current_txns)

        # Calculate daily average
        days_in_period = (now - start_date).days or 1
        daily_average = current_expense / days_in_period

        # Calculate trends
        trends = self._analyze_trends(current_txns, prev_txns)

        return {
            "spending_analysis": {
                "period": period,
                "total_spent": round(current_expense, 2),
                "total_income": round(current_income, 2),
                "net_savings": round(current_income - current_expense, 2),
                "savings_rate": round((current_income - current_expense) / current_income * 100, 2) if current_income > 0 else 0,
                "by_category": category_breakdown,
                "top_merchants": top_merchants,
                "daily_average": round(daily_average, 2),
                "monthly_average": round(current_expense, 2),
                "comparison_to_previous": {
                    "spent_change": round((current_expense - prev_expense) / prev_expense * 100, 2) if prev_expense > 0 else 0,
                    "income_change": round((current_income - prev_income) / prev_income * 100, 2) if prev_income > 0 else 0,
                    "savings_change": round(
                        ((current_income - current_expense) - (prev_income - prev_expense)) /
                        abs(prev_income - prev_expense) * 100 if prev_income - prev_expense != 0 else 0,
                        2
                    ),
                }
            },
            "trends": trends,
            "recommendations": self._generate_recommendations(current_txns, category_breakdown),
            "predictions": self._generate_basic_predictions(current_txns, period),
        }

    def _get_date_range(self, period: str, now: datetime) -> tuple:
        """Get date range for period"""
        if period == "week":
            start = now - timedelta(days=7)
            prev_start = now - timedelta(days=14)
        elif period == "month":
            start = now - timedelta(days=30)
            prev_start = now - timedelta(days=60)
        elif period == "quarter":
            start = now - timedelta(days=90)
            prev_start = now - timedelta(days=180)
        elif period == "year":
            start = now - timedelta(days=365)
            prev_start = now - timedelta(days=730)
        else:
            start = now - timedelta(days=30)
            prev_start = now - timedelta(days=60)

        return start, prev_start

    def _parse_date(self, date_str: Any) -> datetime:
        """Parse date string to datetime"""
        if isinstance(date_str, datetime):
            return date_str
        if isinstance(date_str, str):
            try:
                return datetime.fromisoformat(date_str)
            except ValueError:
                pass
        return datetime.min

    def _get_category_breakdown(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Get spending breakdown by category"""
        category_totals = defaultdict(float)
        category_counts = defaultdict(int)

        for tx in transactions:
            if tx.get("type") == "DEBIT":
                category = tx.get("category", "OTHER")
                amount = float(tx.get("amount", 0))
                category_totals[category] += amount
                category_counts[category] += 1

        total = sum(category_totals.values())

        breakdown = []
        for category, amount in category_totals.items():
            breakdown.append({
                "category": category,
                "amount": round(amount, 2),
                "percentage": round((amount / total * 100) if total > 0 else 0, 2),
                "transaction_count": category_counts[category],
                "average_transaction": round(amount / category_counts[category], 2) if category_counts[category] > 0 else 0,
            })

        # Sort by amount
        breakdown.sort(key=lambda x: x["amount"], reverse=True)

        return breakdown

    def _get_top_merchants(self, transactions: List[Dict[str, Any]], limit: int = 5) -> List[Dict[str, Any]]:
        """Get top merchants by spending"""
        merchant_totals = defaultdict(float)
        merchant_counts = defaultdict(int)

        for tx in transactions:
            if tx.get("type") == "DEBIT" and tx.get("merchant"):
                merchant = tx.get("merchant", "Unknown")
                amount = float(tx.get("amount", 0))
                merchant_totals[merchant] += amount
                merchant_counts[merchant] += 1

        top = []
        for merchant, amount in merchant_totals.items():
            top.append({
                "merchant": merchant,
                "amount": round(amount, 2),
                "transaction_count": merchant_counts[merchant],
            })

        # Sort and limit
        top.sort(key=lambda x: x["amount"], reverse=True)
        return top[:limit]

    def _analyze_trends(self, current_txns: List[Dict[str, Any]], prev_txns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Analyze spending trends"""
        trends = []

        # Compare category spending
        current_cats = defaultdict(float)
        prev_cats = defaultdict(float)

        for tx in current_txns:
            if tx.get("type") == "DEBIT":
                current_cats[tx.get("category", "OTHER")] += float(tx.get("amount", 0))

        for tx in prev_txns:
            if tx.get("type") == "DEBIT":
                prev_cats[tx.get("category", "OTHER")] += float(tx.get("amount", 0))

        for category in set(current_cats.keys()) | set(prev_cats.keys()):
            current = current_cats.get(category, 0)
            prev = prev_cats.get(category, 0)

            if prev > 0:
                change = ((current - prev) / prev) * 100

                if change > 15:
                    trends.append({
                        "trend": "INCREASING",
                        "category": category,
                        "percentage": round(change, 2),
                        "description": f"{category} spending increased by {change:.1f}%",
                    })
                elif change < -15:
                    trends.append({
                        "trend": "DECREASING",
                        "category": category,
                        "percentage": round(abs(change), 2),
                        "description": f"{category} spending decreased by {abs(change):.1f}%",
                    })

        return trends

    def _generate_recommendations(self, transactions: List[Dict[str, Any]], category_breakdown: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate financial recommendations"""
        recommendations = []

        # Check for high spending categories
        high_spend = [cat for cat in category_breakdown if cat["percentage"] > 25]
        if high_spend:
            categories = ", ".join([cat["category"] for cat in high_spend])
            recommendations.append({
                "id": f"rec-{datetime.utcnow().timestamp()}-1",
                "type": "SPENDING_ANALYSIS",
                "title": "Review High Spending Categories",
                "description": f"You're spending more than 25% on {categories}. Consider setting budgets.",
                "priority": "HIGH",
                "potential_savings": sum([cat["amount"] * 0.1 for cat in high_spend]),
            })

        # Calculate savings rate
        total_income = sum(float(tx.get("amount", 0)) for tx in transactions if tx.get("type") == "CREDIT")
        total_expense = sum(float(tx.get("amount", 0)) for tx in transactions if tx.get("type") == "DEBIT")

        if total_income > 0:
            savings_rate = (total_income - total_expense) / total_income * 100

            if savings_rate < 20:
                recommendations.append({
                    "id": f"rec-{datetime.utcnow().timestamp()}-2",
                    "type": "RECOMMENDATION",
                    "title": "Improve Savings Rate",
                    "description": f"Your current savings rate is {savings_rate:.1f}%. Aim for at least 20%.",
                    "priority": "MEDIUM",
                    "action": "Set up automatic transfers to savings",
                })

        return recommendations

    def _generate_basic_predictions(self, transactions: List[Dict[str, Any]], period: str) -> Dict[str, Any]:
        """Generate basic spending predictions"""
        total_expense = sum(float(tx.get("amount", 0)) for tx in transactions if tx.get("type") == "DEBIT")

        # Simple 5% growth prediction
        predicted = total_expense * 1.05

        return {
            "next_period_spending": round(predicted, 2),
            "confidence": 0.6,
            "category_predictions": [
                {
                    "category": cat["category"],
                    "predicted_amount": round(cat["amount"] * 1.05, 2),
                    "confidence": 0.5,
                }
                for cat in self._get_category_breakdown(transactions)
            ],
        }

    def generate_recommendations(self, user_id: str, transactions: List[Dict[str, Any]], period: str) -> List[Dict[str, Any]]:
        """Generate only recommendations"""
        insights = self.generate_spending_insights(user_id, transactions, period)
        return insights.get("recommendations", [])

    def detect_anomalies(self, user_id: str, transactions: List[Dict[str, Any]], period: str) -> List[Dict[str, Any]]:
        """Detect spending anomalies"""
        anomalies = []

        # Get debit transactions
        debits = [tx for tx in transactions if tx.get("type") == "DEBIT"]

        if len(debits) < 5:
            return anomalies

        # Calculate statistics
        amounts = [float(tx.get("amount", 0)) for tx in debits]
        avg = statistics.mean(amounts)
        std_dev = statistics.stdev(amounts) if len(amounts) > 1 else 0

        # Find anomalies (> 2 standard deviations)
        for tx in debits:
            amount = float(tx.get("amount", 0))
            if std_dev > 0 and amount > avg + 2 * std_dev:
                anomalies.append({
                    "type": "UNUSUAL_SPENDING",
                    "severity": "HIGH",
                    "description": f"Unusually high transaction of ₹{amount:.2f} at {tx.get('merchant', 'Unknown')}",
                    "amount": amount,
                    "transaction_id": tx.get("id"),
                    "detected_at": datetime.utcnow().isoformat(),
                })

        return anomalies

    def generate_predictions(self, user_id: str, period: str, historical_data: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Generate spending predictions"""
        if not historical_data:
            return {
                "next_period_spending": 0,
                "confidence": 0.5,
                "message": "Insufficient historical data",
            }

        return self._generate_basic_predictions(historical_data, period)
