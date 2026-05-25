"""
Behavioral Analyzer Service
Detects spending patterns, impulse purchases, and behavioral insights
"""

import logging
from datetime import datetime, timedelta, time
from typing import Dict, Any, List, Optional
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)


class BehavioralAnalyzerService:
    """Service for analyzing spending behavior patterns"""

    # Late night hours (10 PM - 6 AM)
    LATE_NIGHT_START = time(22, 0)  # 10 PM
    LATE_NIGHT_END = time(6, 0)     # 6 AM

    # Thresholds
    IMPULSE_AMOUNT_THRESHOLD = 500  # Amount below which might be impulse
    WEEKEND_DAYS = [5, 6]  # Saturday=5, Sunday=6

    def __init__(self):
        pass

    def analyze_patterns(
        self,
        user_id: str,
        transactions: List[Dict[str, Any]],
        period_days: int = 30
    ) -> Dict[str, Any]:
        """
        Analyze spending patterns for behavioral insights

        Args:
            user_id: User identifier
            transactions: List of transactions
            period_days: Analysis period in days

        Returns:
            Behavioral analysis results
        """
        if not transactions:
            return self._empty_result()

        # Categorize transactions by behavior
        late_night_txns = []
        weekend_txns = []
        impulse_candidates = []
        emotional_spending = []

        for tx in transactions:
            if tx.get("type") != "DEBIT":
                continue

            tx_date = self._parse_datetime(tx.get("transactionDate") or tx.get("date"))
            if not tx_date:
                continue

            amount = float(tx.get("amount", 0))
            merchant = tx.get("merchantName") or tx.get("merchant", "Unknown")
            category = tx.get("category", "OTHER")

            # Late night spending
            if self._is_late_night(tx_date):
                late_night_txns.append({
                    "transaction": tx,
                    "time": tx_date.time().isoformat(),
                    "amount": amount,
                    "merchant": merchant,
                })

            # Weekend spending
            if tx_date.weekday() in self.WEEKEND_DAYS:
                weekend_txns.append({
                    "transaction": tx,
                    "amount": amount,
                    "merchant": merchant,
                })

            # Impulse purchase detection
            impulse_score = self._calculate_impulse_score(tx, tx_date, amount, category)
            if impulse_score > 0.6:
                impulse_candidates.append({
                    "transaction": tx,
                    "impulse_score": impulse_score,
                    "amount": amount,
                    "merchant": merchant,
                })

        # Calculate totals
        late_night_total = sum(tx["amount"] for tx in late_night_txns)
        weekend_total = sum(tx["amount"] for tx in weekend_txns)
        impulse_total = sum(tx["amount"] for tx in impulse_candidates)

        total_spent = sum(
            float(tx.get("amount", 0))
            for tx in transactions
            if tx.get("type") == "DEBIT"
        )

        # Generate insights
        insights = self._generate_insights(
            late_night_txns=late_night_txns,
            weekend_txns=weekend_txns,
            impulse_candidates=impulse_candidates,
            total_spent=total_spent,
        )

        return {
            "period_days": period_days,
            "total_analyzed": len([tx for tx in transactions if tx.get("type") == "DEBIT"]),
            "patterns": {
                "late_night": {
                    "transaction_count": len(late_night_txns),
                    "total_amount": round(late_night_total, 2),
                    "percentage_of_spending": round(late_night_total / total_spent * 100, 2) if total_spent > 0 else 0,
                    "examples": late_night_txns[:5],
                },
                "weekend": {
                    "transaction_count": len(weekend_txns),
                    "total_amount": round(weekend_total, 2),
                    "percentage_of_spending": round(weekend_total / total_spent * 100, 2) if total_spent > 0 else 0,
                },
                "impulse": {
                    "transaction_count": len(impulse_candidates),
                    "total_amount": round(impulse_total, 2),
                    "percentage_of_spending": round(impulse_total / total_spent * 100, 2) if total_spent > 0 else 0,
                    "examples": sorted(impulse_candidates, key=lambda x: x["impulse_score"], reverse=True)[:5],
                },
            },
            "insights": insights,
            "behavioral_score": self._calculate_behavioral_score(
                late_night_total=late_night_total,
                weekend_total=weekend_total,
                impulse_total=impulse_total,
                total_spent=total_spent,
            ),
        }

    def _is_late_night(self, dt: datetime) -> bool:
        """Check if datetime is during late night hours"""
        t = dt.time()
        return t >= self.LATE_NIGHT_START or t <= self.LATE_NIGHT_END

    def _calculate_impulse_score(
        self,
        transaction: Dict[str, Any],
        tx_date: datetime,
        amount: float,
        category: str
    ) -> float:
        """
        Calculate impulse purchase likelihood score

        Factors:
        - Time of day (late night = higher impulse)
        - Amount (smaller = higher impulse)
        - Category (entertainment, food = higher impulse)
        - Merchant type
        """
        score = 0.0

        # Time factor: late night purchases more likely impulse
        if self._is_late_night(tx_date):
            score += 0.3

        # Amount factor: smaller amounts more likely impulse
        if amount <= 100:
            score += 0.3
        elif amount <= 500:
            score += 0.2
        elif amount <= 1000:
            score += 0.1

        # Category factor
        impulse_categories = [
            "ENTERTAINMENT", "FOOD_DINING", "SHOPPING", 
            "SUBSCRIPTION", "GAMING"
        ]
        if category in impulse_categories:
            score += 0.2

        # Merchant patterns
        merchant = (transaction.get("merchantName") or transaction.get("merchant") or "").lower()
        impulse_merchants = [
            "zomato", "swiggy", "uber", "ola", "netflix", "spotify",
            "amazon", "flipkart", "myntra", "bookmyshow"
        ]
        if any(m in merchant for m in impulse_merchants):
            score += 0.2

        return min(score, 1.0)

    def _generate_insights(
        self,
        late_night_txns: List[Dict],
        weekend_txns: List[Dict],
        impulse_candidates: List[Dict],
        total_spent: float
    ) -> List[Dict[str, Any]]:
        """Generate behavioral insights"""
        insights = []

        # Late night spending insight
        if late_night_txns:
            late_night_total = sum(tx["amount"] for tx in late_night_txns)
            percentage = late_night_total / total_spent * 100 if total_spent > 0 else 0

            if percentage > 10:
                insights.append({
                    "type": "LATE_NIGHT_SPENDING",
                    "severity": "HIGH" if percentage > 20 else "MEDIUM",
                    "title": "Late-Night Spending Detected",
                    "description": f"You spend {percentage:.1f}% (₹{late_night_total:.2f}) after 10 PM. These are often impulse purchases.",
                    "recommendation": "Consider setting a 'cool-down' period for late-night purchases.",
                    "affected_amount": round(late_night_total, 2),
                })

        # Weekend spending insight
        if weekend_txns:
            weekend_total = sum(tx["amount"] for tx in weekend_txns)
            avg_weekend = weekend_total / 8 if len(weekend_txns) > 0 else 0  # ~8 weekend days in a month

            insights.append({
                "type": "WEEKEND_SPENDING",
                "severity": "INFO",
                "title": "Weekend Spending Pattern",
                "description": f"You spent ₹{weekend_total:.2f} on weekends (avg ₹{avg_weekend:.2f} per weekend day).",
                "recommendation": None,
                "affected_amount": round(weekend_total, 2),
            })

        # Impulse spending insight
        if impulse_candidates:
            impulse_total = sum(tx["amount"] for tx in impulse_candidates)

            insights.append({
                "type": "IMPULSE_SPENDING",
                "severity": "HIGH" if len(impulse_candidates) > 5 else "MEDIUM",
                "title": f"{len(impulse_candidates)} Potential Impulse Purchases",
                "description": f"₹{impulse_total:.2f} may have been spent impulsively. These small purchases add up.",
                "recommendation": "Try the 24-hour rule: wait a day before non-essential purchases.",
                "affected_amount": round(impulse_total, 2),
            })

        return insights

    def _calculate_behavioral_score(
        self,
        late_night_total: float,
        weekend_total: float,
        impulse_total: float,
        total_spent: float
    ) -> Dict[str, Any]:
        """Calculate overall behavioral score (higher = worse spending habits)"""
        if total_spent == 0:
            return {"score": 0, "rating": "NO_DATA"}

        # Weight factors
        late_night_weight = 0.4
        impulse_weight = 0.4
        weekend_weight = 0.2

        late_night_ratio = late_night_total / total_spent
        impulse_ratio = impulse_total / total_spent
        weekend_ratio = weekend_total / total_spent

        # Calculate score (0-100, lower is better)
        score = (
            (late_night_ratio * 100 * late_night_weight) +
            (impulse_ratio * 100 * impulse_weight) +
            (weekend_ratio * 50 * weekend_weight)  # Weekend is neutral
        )

        rating = "EXCELLENT"
        if score > 40:
            rating = "NEEDS_ATTENTION"
        elif score > 25:
            rating = "MODERATE"
        elif score > 10:
            rating = "GOOD"

        return {
            "score": round(score, 2),
            "rating": rating,
            "components": {
                "late_night_impact": round(late_night_ratio * 100, 2),
                "impulse_impact": round(impulse_ratio * 100, 2),
                "weekend_impact": round(weekend_ratio * 100, 2),
            },
        }

    def _parse_datetime(self, date_val: Any) -> Optional[datetime]:
        """Parse datetime from various formats"""
        if isinstance(date_val, datetime):
            return date_val
        if isinstance(date_val, str):
            try:
                return datetime.fromisoformat(date_val.replace("Z", "+00:00"))
            except ValueError:
                pass
        return None

    def _empty_result(self) -> Dict[str, Any]:
        """Return empty result structure"""
        return {
            "period_days": 0,
            "total_analyzed": 0,
            "patterns": {
                "late_night": {"transaction_count": 0, "total_amount": 0, "percentage_of_spending": 0},
                "weekend": {"transaction_count": 0, "total_amount": 0, "percentage_of_spending": 0},
                "impulse": {"transaction_count": 0, "total_amount": 0, "percentage_of_spending": 0},
            },
            "insights": [],
            "behavioral_score": {"score": 0, "rating": "NO_DATA"},
        }

    def tag_transactions(
        self,
        transactions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Tag transactions with behavioral flags

        Args:
            transactions: List of transactions to tag

        Returns:
            Transactions with added behavioral tags
        """
        tagged = []

        for tx in transactions:
            tagged_tx = tx.copy()

            tx_date = self._parse_datetime(tx.get("transactionDate") or tx.get("date"))
            if not tx_date:
                tagged.append(tagged_tx)
                continue

            # Add time-based tags
            tagged_tx["isLateNight"] = self._is_late_night(tx_date)
            tagged_tx["isWeekend"] = tx_date.weekday() in self.WEEKEND_DAYS

            # Calculate impulse score
            amount = float(tx.get("amount", 0))
            category = tx.get("category", "OTHER")
            impulse_score = self._calculate_impulse_score(tx, tx_date, amount, category)
            tagged_tx["isImpulse"] = impulse_score > 0.6
            tagged_tx["impulseScore"] = round(impulse_score, 2)

            tagged.append(tagged_tx)

        return tagged
