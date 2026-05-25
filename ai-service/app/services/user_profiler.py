"""
User Profiler Service
Analyzes user behavior and determines financial archetype
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)


class UserArchetype:
    """User financial archetype constants"""
    SPEND_HEAVY = "SPEND_HEAVY"
    SAVINGS_FOCUSED = "SAVINGS_FOCUSED"
    CREDIT_USER = "CREDIT_USER"
    SUBSCRIPTION_HEAVY = "SUBSCRIPTION_HEAVY"
    BALANCED = "BALANCED"


class UserProfilerService:
    """Service for profiling user financial behavior"""

    # Archetype thresholds
    ARCHETYPE_THRESHOLDS = {
        UserArchetype.SPEND_HEAVY: {
            "discretionary_ratio": 0.4,  # >40% on discretionary
            "savings_rate": 0.1,  # <10% savings rate
        },
        UserArchetype.SAVINGS_FOCUSED: {
            "savings_rate": 0.25,  # >25% savings rate
        },
        UserArchetype.CREDIT_USER: {
            "credit_transaction_ratio": 0.3,  # >30% via credit
        },
        UserArchetype.SUBSCRIPTION_HEAVY: {
            "subscription_to_income_ratio": 0.1,  # >10% income on subscriptions
        },
    }

    # Discretionary categories
    DISCRETIONARY_CATEGORIES = [
        "ENTERTAINMENT",
        "FOOD_DINING",
        "SHOPPING",
        "SUBSCRIPTION",
        "GAMING",
        "TRAVEL",
        "HOBBIES",
    ]

    # Essential categories
    ESSENTIAL_CATEGORIES = [
        "RENT",
        "UTILITIES",
        "GROCERIES",
        "HEALTHCARE",
        "TRANSPORT",
        "EDUCATION",
        "INSURANCE",
    ]

    def __init__(self):
        pass

    def determine_archetype(
        self,
        user_id: str,
        transactions: List[Dict[str, Any]],
        subscriptions: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Determine user's financial archetype

        Args:
            user_id: User identifier
            transactions: List of transactions
            subscriptions: List of subscriptions

        Returns:
            Archetype determination with scores
        """
        if not transactions:
            return {
                "archetype": UserArchetype.BALANCED,
                "confidence": 0.0,
                "reason": "No transaction data",
            }

        # Calculate key metrics
        metrics = self._calculate_metrics(transactions, subscriptions or [])

        # Score each archetype
        scores = {
            UserArchetype.SPEND_HEAVY: self._score_spend_heavy(metrics),
            UserArchetype.SAVINGS_FOCUSED: self._score_savings_focused(metrics),
            UserArchetype.CREDIT_USER: self._score_credit_user(metrics),
            UserArchetype.SUBSCRIPTION_HEAVY: self._score_subscription_heavy(metrics),
            UserArchetype.BALANCED: self._score_balanced(metrics),
        }

        # Determine primary archetype
        primary_archetype = max(scores, key=lambda k: scores[k]["score"])

        return {
            "archetype": primary_archetype,
            "confidence": scores[primary_archetype]["score"],
            "scores": scores,
            "metrics": metrics,
            "dashboard_priority": self._get_dashboard_priority(primary_archetype),
            "recommendations": self._get_archetype_recommendations(primary_archetype, metrics),
        }

    def _calculate_metrics(
        self,
        transactions: List[Dict[str, Any]],
        subscriptions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate key financial metrics"""
        # Income and expenses
        total_income = sum(
            float(tx.get("amount", 0))
            for tx in transactions
            if tx.get("type") == "CREDIT"
        )

        total_expense = sum(
            float(tx.get("amount", 0))
            for tx in transactions
            if tx.get("type") == "DEBIT"
        )

        # Category spending
        category_spending = defaultdict(float)
        for tx in transactions:
            if tx.get("type") == "DEBIT":
                cat = tx.get("category", "OTHER")
                category_spending[cat] += float(tx.get("amount", 0))

        # Discretionary vs essential
        discretionary_spending = sum(
            amount for cat, amount in category_spending.items()
            if cat in self.DISCRETIONARY_CATEGORIES
        )

        essential_spending = sum(
            amount for cat, amount in category_spending.items()
            if cat in self.ESSENTIAL_CATEGORIES
        )

        # Subscription costs
        monthly_subscription_cost = sum(
            float(s.get("amount", 0))
            for s in subscriptions
            if s.get("status") == "ACTIVE" and s.get("frequency") == "MONTHLY"
        )

        # Credit transactions (placeholder - would need account type)
        credit_transactions = []  # Would filter by credit card accounts
        credit_total = 0

        # Savings rate
        savings_rate = (total_income - total_expense) / total_income if total_income > 0 else 0

        # Discretionary ratio
        discretionary_ratio = discretionary_spending / total_expense if total_expense > 0 else 0

        # Subscription to income ratio
        subscription_ratio = monthly_subscription_cost / total_income if total_income > 0 else 0

        return {
            "total_income": round(total_income, 2),
            "total_expense": round(total_expense, 2),
            "savings": round(total_income - total_expense, 2),
            "savings_rate": round(savings_rate, 4),
            "discretionary_spending": round(discretionary_spending, 2),
            "essential_spending": round(essential_spending, 2),
            "discretionary_ratio": round(discretionary_ratio, 4),
            "category_spending": dict(category_spending),
            "subscription_count": len([s for s in subscriptions if s.get("status") == "ACTIVE"]),
            "monthly_subscription_cost": round(monthly_subscription_cost, 2),
            "subscription_to_income_ratio": round(subscription_ratio, 4),
        }

    def _score_spend_heavy(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Score for spend-heavy archetype"""
        score = 0.0
        reasons = []

        # High discretionary ratio
        disc_ratio = metrics.get("discretionary_ratio", 0)
        if disc_ratio > 0.4:
            score += 40
            reasons.append(f"High discretionary spending ({disc_ratio*100:.1f}%)")
        elif disc_ratio > 0.3:
            score += 25
            reasons.append(f"Moderate discretionary spending ({disc_ratio*100:.1f}%)")

        # Low savings rate
        savings_rate = metrics.get("savings_rate", 0)
        if savings_rate < 0.1:
            score += 35
            reasons.append(f"Low savings rate ({savings_rate*100:.1f}%)")
        elif savings_rate < 0.15:
            score += 20
            reasons.append(f"Below-average savings rate ({savings_rate*100:.1f}%)")

        # Impulse spending (if available)
        # Would add impulse purchase ratio

        return {
            "score": min(score / 100, 1.0),
            "reasons": reasons,
        }

    def _score_savings_focused(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Score for savings-focused archetype"""
        score = 0.0
        reasons = []

        savings_rate = metrics.get("savings_rate", 0)

        if savings_rate >= 0.3:
            score += 50
            reasons.append(f"Excellent savings rate ({savings_rate*100:.1f}%)")
        elif savings_rate >= 0.2:
            score += 40
            reasons.append(f"Good savings rate ({savings_rate*100:.1f}%)")
        elif savings_rate >= 0.15:
            score += 25
            reasons.append(f"Above-average savings rate ({savings_rate*100:.1f}%)")

        # Low discretionary ratio
        disc_ratio = metrics.get("discretionary_ratio", 0)
        if disc_ratio < 0.2:
            score += 30
            reasons.append(f"Controlled discretionary spending ({disc_ratio*100:.1f}%)")

        return {
            "score": min(score / 100, 1.0),
            "reasons": reasons,
        }

    def _score_credit_user(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Score for credit-user archetype"""
        # Placeholder - would need credit card transaction data
        return {
            "score": 0.0,
            "reasons": ["Credit card data not available"],
        }

    def _score_subscription_heavy(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Score for subscription-heavy archetype"""
        score = 0.0
        reasons = []

        sub_count = metrics.get("subscription_count", 0)
        sub_ratio = metrics.get("subscription_to_income_ratio", 0)
        sub_cost = metrics.get("monthly_subscription_cost", 0)

        # Number of subscriptions
        if sub_count >= 10:
            score += 30
            reasons.append(f"Many subscriptions ({sub_count})")
        elif sub_count >= 5:
            score += 20
            reasons.append(f"Several subscriptions ({sub_count})")

        # Subscription cost ratio
        if sub_ratio > 0.15:
            score += 40
            reasons.append(f"High subscription spending ({sub_ratio*100:.1f}% of income)")
        elif sub_ratio > 0.1:
            score += 25
            reasons.append(f"Notable subscription spending ({sub_ratio*100:.1f}% of income)")

        return {
            "score": min(score / 100, 1.0),
            "reasons": reasons,
        }

    def _score_balanced(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Score for balanced archetype"""
        # High score if no other archetype matches strongly
        savings_rate = metrics.get("savings_rate", 0)
        disc_ratio = metrics.get("discretionary_ratio", 0)
        sub_ratio = metrics.get("subscription_to_income_ratio", 0)

        score = 50  # Base score

        # Moderate savings rate
        if 0.15 <= savings_rate <= 0.25:
            score += 20

        # Moderate discretionary
        if 0.2 <= disc_ratio <= 0.35:
            score += 15

        # Moderate subscriptions
        if sub_ratio < 0.1:
            score += 15

        return {
            "score": min(score / 100, 1.0),
            "reasons": ["Balanced spending profile"],
        }

    def _get_dashboard_priority(self, archetype: str) -> List[str]:
        """Get dashboard widget priority based on archetype"""
        priorities = {
            UserArchetype.SPEND_HEAVY: [
                "leak_alerts",
                "spending_breakdown",
                "impulse_detection",
                "budget_tracking",
                "savings_tips",
            ],
            UserArchetype.SAVINGS_FOCUSED: [
                "goal_progress",
                "savings_rate",
                "investment_opportunities",
                "net_worth",
                "goal_timeline",
            ],
            UserArchetype.CREDIT_USER: [
                "credit_card_due_dates",
                "emi_tracking",
                "interest_optimization",
                "credit_utilization",
                "payment_reminders",
            ],
            UserArchetype.SUBSCRIPTION_HEAVY: [
                "subscription_calendar",
                "renewal_alerts",
                "duplicate_detection",
                "usage_analysis",
                "cancel_suggestions",
            ],
            UserArchetype.BALANCED: [
                "spending_summary",
                "budget_progress",
                "savings_rate",
                "goal_progress",
                "financial_health_score",
            ],
        }

        return priorities.get(archetype, priorities[UserArchetype.BALANCED])

    def _get_archetype_recommendations(
        self,
        archetype: str,
        metrics: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Get personalized recommendations based on archetype"""
        recommendations = []

        if archetype == UserArchetype.SPEND_HEAVY:
            recommendations.extend([
                {
                    "type": "BUDGET",
                    "title": "Set Spending Limits",
                    "description": "Create budgets for discretionary categories",
                    "priority": "HIGH",
                },
                {
                    "type": "AUTOMATION",
                    "title": "Auto-Save First",
                    "description": "Set up automatic transfer to savings on payday",
                    "priority": "HIGH",
                },
                {
                    "type": "ALERT",
                    "title": "Spending Alerts",
                    "description": "Get notified when approaching budget limits",
                    "priority": "MEDIUM",
                },
            ])

        elif archetype == UserArchetype.SAVINGS_FOCUSED:
            recommendations.extend([
                {
                    "type": "INVESTMENT",
                    "title": "Grow Your Savings",
                    "description": "Consider investment options for idle savings",
                    "priority": "MEDIUM",
                },
                {
                    "type": "GOAL",
                    "title": "Set Financial Goals",
                    "description": "Create specific savings goals with timelines",
                    "priority": "LOW",
                },
            ])

        elif archetype == UserArchetype.SUBSCRIPTION_HEAVY:
            recommendations.extend([
                {
                    "type": "REVIEW",
                    "title": "Audit Subscriptions",
                    "description": "Review all subscriptions for value",
                    "priority": "HIGH",
                },
                {
                    "type": "CANCEL",
                    "title": "Cancel Unused",
                    "description": "Cancel low-usage subscriptions",
                    "priority": "HIGH",
                },
            ])

        elif archetype == UserArchetype.CREDIT_USER:
            recommendations.extend([
                {
                    "type": "PAYMENT",
                    "title": "Pay Full Balance",
                    "description": "Pay credit card bills in full to avoid interest",
                    "priority": "HIGH",
                },
                {
                    "type": "ALERT",
                    "title": "Due Date Reminders",
                    "description": "Set up payment reminders",
                    "priority": "MEDIUM",
                },
            ])

        return recommendations

    def update_user_profile(
        self,
        user_id: str,
        current_profile: Dict[str, Any],
        new_transactions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Update user profile with new transaction data

        Args:
            user_id: User identifier
            current_profile: Current user profile
            new_transactions: New transactions to incorporate

        Returns:
            Updated profile
        """
        # Merge with existing data and recalculate
        # This would integrate with the existing profile

        return self.determine_archetype(user_id, new_transactions)
