"""
Money Leak Detector Service
Identifies hidden money leaks and wasteful spending
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)


class LeakDetectorService:
    """Service for detecting money leaks in user spending"""

    # Leak categories
    LEAK_TYPES = {
        "UNUSED_SUBSCRIPTION": {
            "name": "Unused Subscriptions",
            "description": "Subscriptions with low or no usage",
        },
        "DUPLICATE_SERVICES": {
            "name": "Duplicate Services",
            "description": "Multiple subscriptions for similar services",
        },
        "PRICE_INCREASES": {
            "name": "Silent Price Increases",
            "description": "Subscriptions that increased price without notice",
        },
        "SMALL_FREQUENT": {
            "name": "Small Frequent Expenses",
            "description": "Small purchases that add up significantly",
        },
        "IMPULSE_PURCHASES": {
            "name": "Impulse Purchases",
            "description": "Likely impulse-driven spending",
        },
        "LATE_NIGHT_SPENDING": {
            "name": "Late-Night Spending",
            "description": "Spending during impulse-prone hours",
        },
        "OVERLAPPING_SUBSCRIPTIONS": {
            "name": "Overlapping Subscriptions",
            "description": "Multiple services in same category",
        },
    }

    def __init__(self):
        pass

    def detect_leaks(
        self,
        user_id: str,
        transactions: List[Dict[str, Any]],
        subscriptions: List[Dict[str, Any]] = None,
        period_days: int = 30
    ) -> Dict[str, Any]:
        """
        Detect all money leaks for a user

        Args:
            user_id: User identifier
            transactions: List of transactions
            subscriptions: List of subscriptions
            period_days: Analysis period

        Returns:
            Leak detection results with potential savings
        """
        leaks = []

        # Detect subscription-related leaks
        if subscriptions:
            # 1. Unused subscriptions
            unused = self._detect_unused_subscriptions(subscriptions)
            leaks.extend(unused)

            # 2. Duplicate services
            duplicates = self._detect_duplicate_subscriptions(subscriptions)
            leaks.extend(duplicates)

            # 3. Price increases
            price_increases = self._detect_price_increases(subscriptions)
            leaks.extend(price_increases)

        # Detect transaction-based leaks
        if transactions:
            # 4. Small frequent expenses
            small_frequent = self._detect_small_frequent_expenses(transactions)
            leaks.extend(small_frequent)

            # 5. Impulse purchases
            impulse = self._detect_impulse_leaks(transactions)
            leaks.extend(impulse)

            # 6. Late-night spending
            late_night = self._detect_late_night_leaks(transactions)
            leaks.extend(late_night)

        # Calculate totals
        total_leak_amount = sum(leak.get("amount", 0) for leak in leaks)
        potential_monthly_savings = sum(
            leak.get("monthly_savings", 0) 
            for leak in leaks 
            if leak.get("monthly_savings")
        )

        # Calculate leak score (0-100, higher = more leaks)
        leak_score = self._calculate_leak_score(transactions, total_leak_amount)

        return {
            "leak_score": round(leak_score, 2),
            "total_leak_amount": round(total_leak_amount, 2),
            "potential_monthly_savings": round(potential_monthly_savings, 2),
            "leaks_found": len(leaks),
            "leaks": leaks,
            "summary": self._generate_leak_summary(leaks),
            "period_days": period_days,
            "analyzed_at": datetime.utcnow().isoformat(),
        }

    def _detect_unused_subscriptions(
        self,
        subscriptions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Detect subscriptions with low or no usage"""
        leaks = []

        for sub in subscriptions:
            if sub.get("status") != "ACTIVE":
                continue

            # Check usage score
            usage_score = float(sub.get("usageScore", 1.0))
            is_low_usage = sub.get("isLowUsage", False)

            if is_low_usage or usage_score < 0.3:
                amount = float(sub.get("amount", 0))
                frequency = sub.get("frequency", "MONTHLY")

                # Normalize to monthly
                if frequency == "WEEKLY":
                    monthly_amount = amount * 4
                elif frequency == "YEARLY":
                    monthly_amount = amount / 12
                elif frequency == "QUARTERLY":
                    monthly_amount = amount / 3
                else:
                    monthly_amount = amount

                leaks.append({
                    "type": "UNUSED_SUBSCRIPTION",
                    "severity": "HIGH",
                    "merchant": sub.get("merchantName") or sub.get("name"),
                    "amount": round(amount, 2),
                    "monthly_savings": round(monthly_amount, 2),
                    "usage_score": round(usage_score, 2),
                    "recommendation": f"Cancel {sub.get('name')} - appears unused",
                    "subscription_id": sub.get("id"),
                })

        return leaks

    def _detect_duplicate_subscriptions(
        self,
        subscriptions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Detect overlapping/duplicate service subscriptions"""
        leaks = []

        # Group subscriptions by category
        category_groups = defaultdict(list)

        # Known service categories
        service_categories = {
            "music": ["spotify", "apple music", "youtube music", "gaana", "jiosaavn"],
            "video": ["netflix", "amazon prime video", "hotstar", "zee5", "sony liv"],
            "cloud": ["google one", "icloud", "dropbox", "onedrive"],
            "news": ["the hindu", "times of india", "economic times", "news+"],
        }

        active_subs = [
            s for s in subscriptions
            if s.get("status") == "ACTIVE"
        ]

        # Check each category
        for category, keywords in service_categories.items():
            matched_subs = []
            for sub in active_subs:
                name = (sub.get("merchantName") or sub.get("name") or "").lower()
                if any(kw in name for kw in keywords):
                    matched_subs.append(sub)

            if len(matched_subs) > 1:
                # Found duplicate services
                total_amount = sum(float(s.get("amount", 0)) for s in matched_subs)

                # Keep cheapest
                cheapest = min(matched_subs, key=lambda s: float(s.get("amount", 0)))
                others = [s for s in matched_subs if s != cheapest]
                savings = sum(float(s.get("amount", 0)) for s in others)

                leaks.append({
                    "type": "DUPLICATE_SERVICES",
                    "severity": "MEDIUM",
                    "category": category,
                    "services": [
                        {
                            "name": s.get("name"),
                            "amount": float(s.get("amount", 0))
                        }
                        for s in matched_subs
                    ],
                    "amount": round(total_amount, 2),
                    "monthly_savings": round(savings, 2),
                    "recommendation": f"You have {len(matched_subs)} {category} subscriptions. Keep {cheapest.get('name')} and cancel others.",
                })

        return leaks

    def _detect_price_increases(
        self,
        subscriptions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Detect subscriptions with price increases"""
        leaks = []

        for sub in subscriptions:
            if sub.get("status") != "ACTIVE":
                continue

            if sub.get("priceIncreased"):
                original = float(sub.get("originalAmount", 0) or 0)
                current = float(sub.get("amount", 0))
                increase_percent = float(sub.get("priceIncreasePercent", 0) or 0)

                if original > 0 and current > original:
                    extra_cost = current - original

                    leaks.append({
                        "type": "PRICE_INCREASES",
                        "severity": "LOW",
                        "merchant": sub.get("merchantName") or sub.get("name"),
                        "original_amount": round(original, 2),
                        "current_amount": round(current, 2),
                        "increase_percent": round(increase_percent, 2),
                        "extra_monthly_cost": round(extra_cost, 2),
                        "monthly_savings": round(extra_cost, 2),  # Could cancel
                        "recommendation": f"{sub.get('name')} increased from ₹{original:.0f} to ₹{current:.0f}. Consider if you still need it.",
                        "subscription_id": sub.get("id"),
                    })

        return leaks

    def _detect_small_frequent_expenses(
        self,
        transactions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Detect small frequent expenses that add up"""
        leaks = []

        # Group small expenses by merchant
        small_expenses = defaultdict(list)
        small_threshold = 200  # Under ₹200

        for tx in transactions:
            if tx.get("type") != "DEBIT":
                continue

            amount = float(tx.get("amount", 0))
            if amount <= small_threshold and amount > 0:
                merchant = tx.get("merchantName") or tx.get("merchant", "Unknown")
                small_expenses[merchant].append({
                    "amount": amount,
                    "date": tx.get("transactionDate") or tx.get("date"),
                })

        # Find merchants with frequent small purchases
        for merchant, expenses in small_expenses.items():
            if len(expenses) >= 5:  # At least 5 transactions
                total = sum(e["amount"] for e in expenses)
                avg = total / len(expenses)

                leaks.append({
                    "type": "SMALL_FREQUENT",
                    "severity": "MEDIUM",
                    "merchant": merchant,
                    "transaction_count": len(expenses),
                    "average_amount": round(avg, 2),
                    "total_amount": round(total, 2),
                    "monthly_savings": round(total, 2),  # Potential savings if stopped
                    "recommendation": f"Your ₹{avg:.0f} purchases at {merchant} add up to ₹{total:.0f}",
                })

        # Sort by total amount
        leaks.sort(key=lambda x: x["total_amount"], reverse=True)

        return leaks[:5]  # Top 5

    def _detect_impulse_leaks(
        self,
        transactions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Detect impulse purchase leaks"""
        impulse_txns = []

        for tx in transactions:
            if tx.get("type") != "DEBIT":
                continue

            if tx.get("isImpulse"):
                impulse_txns.append(tx)

        if not impulse_txns:
            return []

        total_impulse = sum(float(tx.get("amount", 0)) for tx in impulse_txns)

        return [{
            "type": "IMPULSE_PURCHASES",
            "severity": "HIGH",
            "transaction_count": len(impulse_txns),
            "total_amount": round(total_impulse, 2),
            "monthly_savings": round(total_impulse, 2),
            "recommendation": f"{len(impulse_txns)} potential impulse purchases totaling ₹{total_impulse:.0f}",
        }]

    def _detect_late_night_leaks(
        self,
        transactions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Detect late-night spending leaks"""
        late_night_txns = []

        for tx in transactions:
            if tx.get("type") != "DEBIT":
                continue

            if tx.get("isLateNight"):
                late_night_txns.append(tx)

        if not late_night_txns:
            return []

        total_late_night = sum(float(tx.get("amount", 0)) for tx in late_night_txns)

        return [{
            "type": "LATE_NIGHT_SPENDING",
            "severity": "MEDIUM",
            "transaction_count": len(late_night_txns),
            "total_amount": round(total_late_night, 2),
            "monthly_savings": round(total_late_night * 0.5, 2),  # Assume 50% avoidable
            "recommendation": f"₹{total_late_night:.0f} spent after 10 PM - often impulse purchases",
        }]

    def _calculate_leak_score(
        self,
        transactions: List[Dict[str, Any]],
        total_leak_amount: float
    ) -> float:
        """
        Calculate leak score (0-100)

        Higher score = more leaks = worse
        """
        total_spent = sum(
            float(tx.get("amount", 0))
            for tx in transactions
            if tx.get("type") == "DEBIT"
        )

        if total_spent == 0:
            return 0

        leak_ratio = total_leak_amount / total_spent

        # Convert to score (higher leak ratio = higher score)
        # 0-10% leaks = 0-30 score
        # 10-20% leaks = 30-50 score
        # 20-30% leaks = 50-70 score
        # 30%+ leaks = 70-100 score

        if leak_ratio <= 0.05:
            score = leak_ratio * 6  # 0-30
        elif leak_ratio <= 0.15:
            score = 30 + (leak_ratio - 0.05) * 200  # 30-50
        elif leak_ratio <= 0.25:
            score = 50 + (leak_ratio - 0.15) * 200  # 50-70
        else:
            score = 70 + min((leak_ratio - 0.25) * 120, 30)  # 70-100

        return min(max(score, 0), 100)

    def _generate_leak_summary(self, leaks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate summary of leaks by type"""
        summary = defaultdict(lambda: {"count": 0, "total": 0})

        for leak in leaks:
            leak_type = leak.get("type")
            summary[leak_type]["count"] += 1
            summary[leak_type]["total"] += leak.get("amount", 0)

        return {
            leak_type: {
                "name": self.LEAK_TYPES.get(leak_type, {}).get("name", leak_type),
                "count": data["count"],
                "total": round(data["total"], 2),
            }
            for leak_type, data in summary.items()
        }
