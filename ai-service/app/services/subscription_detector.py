"""
Subscription Detection Service
Identifies recurring payments and subscriptions from transaction history
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)


class SubscriptionDetectorService:
    """Service for detecting subscriptions and recurring payments"""

    # Minimum occurrences to detect a subscription
    MIN_OCCURRENCES = 2

    # Frequency tolerance in days
    FREQUENCY_TOLERANCE_DAYS = 3

    # Minimum confidence threshold
    MIN_CONFIDENCE = 0.5

    def __init__(self):
        pass

    def detect(self, user_id: str, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Detect subscriptions from transaction history

        Args:
            user_id: User identifier
            transactions: List of user transactions

        Returns:
            List of detected subscriptions
        """
        # Group transactions by merchant
        merchant_groups = defaultdict(list)
        for tx in transactions:
            merchant = tx.get("merchant") or ""
            merchant = merchant.lower().strip()
            if merchant:
                merchant_groups[merchant].append(tx)

        detected = []

        for merchant, txns in merchant_groups.items():
            # Skip if not enough occurrences
            if len(txns) < self.MIN_OCCURRENCES:
                continue

            # Analyze frequency pattern
            frequency = self._analyze_frequency(txns)
            if not frequency:
                continue

            # Calculate average amount
            amounts = [float(tx.get("amount", 0)) for tx in txns]
            avg_amount = statistics.mean(amounts)

            # Calculate confidence
            confidence = self._calculate_confidence(txns, frequency)

            if confidence < self.MIN_CONFIDENCE:
                continue

            # Create subscription entry
            detected.append({
                "merchant": merchant.title(),
                "amount": round(avg_amount, 2),
                "frequency": frequency,
                "confidence": round(confidence, 2),
                "transaction_ids": [tx.get("id") for tx in txns],
                "first_transaction_date": txns[0].get("date"),
                "last_transaction_date": txns[-1].get("date"),
                "transaction_count": len(txns),
            })

        # Sort by confidence
        detected.sort(key=lambda x: x["confidence"], reverse=True)

        return detected

    def _analyze_frequency(self, transactions: List[Dict[str, Any]]) -> Optional[str]:
        """
        Analyze transaction frequency to determine subscription type

        Args:
            transactions: List of transactions for a merchant

        Returns:
            Frequency string (DAILY, WEEKLY, MONTHLY, etc.) or None
        """
        if len(transactions) < 2:
            return None

        # Parse dates and calculate intervals
        dates = []
        for tx in transactions:
            date_str = tx.get("date")
            if isinstance(date_str, str):
                try:
                    dates.append(datetime.fromisoformat(date_str))
                except ValueError:
                    continue
            elif isinstance(date_str, datetime):
                dates.append(date_str)

        if len(dates) < 2:
            return None

        dates.sort()

        # Calculate intervals in days
        intervals = []
        for i in range(1, len(dates)):
            delta = dates[i] - dates[i - 1]
            intervals.append(delta.days)

        if not intervals:
            return None

        avg_interval = statistics.mean(intervals)

        # Determine frequency based on average interval
        if avg_interval <= 2:
            return "DAILY"
        elif avg_interval <= 10:
            return "WEEKLY"
        elif avg_interval <= 40:
            return "MONTHLY"
        elif avg_interval <= 100:
            return "QUARTERLY"
        else:
            return "YEARLY"

    def _calculate_confidence(self, transactions: List[Dict[str, Any]], frequency: str) -> float:
        """
        Calculate confidence score for subscription detection

        Args:
            transactions: List of transactions
            frequency: Detected frequency

        Returns:
            Confidence score between 0 and 1
        """
        confidence = 0.5  # Base confidence

        # More transactions = higher confidence
        tx_count = len(transactions)
        confidence += min(tx_count * 0.05, 0.2)

        # Check amount consistency
        amounts = [float(tx.get("amount", 0)) for tx in transactions]
        if len(amounts) >= 2:
            avg_amount = statistics.mean(amounts)
            if avg_amount > 0:
                std_dev = statistics.stdev(amounts) if len(amounts) > 1 else 0
                cv = std_dev / avg_amount  # Coefficient of variation

                if cv < 0.1:  # Very consistent
                    confidence += 0.2
                elif cv < 0.2:  # Moderately consistent
                    confidence += 0.1
                elif cv > 0.5:  # Very inconsistent
                    confidence -= 0.1

        # Check date regularity
        dates = []
        for tx in transactions:
            date_str = tx.get("date")
            if isinstance(date_str, str):
                try:
                    dates.append(datetime.fromisoformat(date_str))
                except ValueError:
                    continue

        if len(dates) >= 3:
            dates.sort()
            intervals = [(dates[i] - dates[i-1]).days for i in range(1, len(dates))]

            if len(intervals) >= 2:
                interval_std = statistics.stdev(intervals)

                if interval_std < 3:  # Very regular
                    confidence += 0.15
                elif interval_std < 7:  # Moderately regular
                    confidence += 0.05

        return min(max(confidence, 0.0), 1.0)

    def analyze_merchant_pattern(self, merchant: str, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze if a specific merchant follows a subscription pattern

        Args:
            merchant: Merchant name
            transactions: Transactions for this merchant

        Returns:
            Pattern analysis results
        """
        if len(transactions) < 2:
            return {
                "merchant": merchant,
                "is_subscription": False,
                "reason": "Insufficient transactions",
                "confidence": 0.0,
            }

        # Analyze frequency
        frequency = self._analyze_frequency(transactions)

        if not frequency:
            return {
                "merchant": merchant,
                "is_subscription": False,
                "reason": "No clear pattern detected",
                "confidence": 0.0,
            }

        # Calculate confidence
        confidence = self._calculate_confidence(transactions, frequency)

        # Calculate statistics
        amounts = [float(tx.get("amount", 0)) for tx in transactions]
        avg_amount = statistics.mean(amounts)
        min_amount = min(amounts)
        max_amount = max(amounts)

        # Determine if it's a subscription
        is_subscription = confidence >= self.MIN_CONFIDENCE

        # Calculate next expected payment
        next_payment = self._calculate_next_payment(frequency, transactions)

        return {
            "merchant": merchant,
            "is_subscription": is_subscription,
            "frequency": frequency,
            "confidence": round(confidence, 2),
            "average_amount": round(avg_amount, 2),
            "min_amount": round(min_amount, 2),
            "max_amount": round(max_amount, 2),
            "transaction_count": len(transactions),
            "next_expected_payment": next_payment.isoformat() if next_payment else None,
        }

    def _calculate_next_payment(self, frequency: str, transactions: List[Dict[str, Any]]) -> Optional[datetime]:
        """Calculate next expected payment date"""
        if not transactions:
            return None

        # Get last transaction date
        last_date = None
        for tx in reversed(transactions):
            date_str = tx.get("date")
            if isinstance(date_str, str):
                try:
                    last_date = datetime.fromisoformat(date_str)
                    break
                except ValueError:
                    continue
            elif isinstance(date_str, datetime):
                last_date = date_str
                break

        if not last_date:
            return None

        # Calculate next date based on frequency
        if frequency == "DAILY":
            return last_date + timedelta(days=1)
        elif frequency == "WEEKLY":
            return last_date + timedelta(weeks=1)
        elif frequency == "MONTHLY":
            # Handle month end cases
            try:
                return last_date.replace(month=last_date.month + 1)
            except ValueError:
                # Handle month overflow
                if last_date.month == 12:
                    return last_date.replace(year=last_date.year + 1, month=1)
                return last_date.replace(month=last_date.month + 1)
        elif frequency == "QUARTERLY":
            try:
                return last_date.replace(month=last_date.month + 3)
            except ValueError:
                if last_date.month >= 10:
                    return last_date.replace(year=last_date.year + 1, month=last_date.month - 9)
                return last_date.replace(month=last_date.month + 3)
        elif frequency == "YEARLY":
            try:
                return last_date.replace(year=last_date.year + 1)
            except ValueError:
                return None

        return None
