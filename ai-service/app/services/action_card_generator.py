"""
Action Card Generator Service
Generates personalized "Fix My Finances" action cards
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class ActionType(Enum):
    """Types of action cards"""
    CANCEL_SUBSCRIPTION = "CANCEL_SUBSCRIPTION"
    REDUCE_SPENDING = "REDUCE_SPENDING"
    SET_BUDGET = "SET_BUDGET"
    PAY_CREDIT_CARD = "PAY_CREDIT_CARD"
    AVOID_IMPULSE = "AVOID_IMPULSE"
    INCREASE_SAVINGS = "INCREASE_SAVINGS"
    REVIEW_SUBSCRIPTION = "REVIEW_SUBSCRIPTION"
    SET_GOAL = "SET_GOAL"
    TRACK_GOAL = "TRACK_GOAL"
    UPDATING_BUDGET = "UPDATE_BUDGET"
    EMERGENCY_FUND = "EMERGENCY_FUND"


class ActionCardGenerator:
    """Service for generating personalized action cards"""

    # Priority levels
    PRIORITY_URGENT = "URGENT"
    PRIORITY_HIGH = "HIGH"
    PRIORITY_MEDIUM = "MEDIUM"
    PRIORITY_LOW = "LOW"

    def __init__(self):
        pass

    def generate_action_cards(
        self,
        user_id: str,
        context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Generate personalized action cards for a user

        Args:
            user_id: User identifier
            context: Context data (transactions, subscriptions, leaks, etc.)

        Returns:
            List of action cards
        """
        cards = []

        # Generate cards from different sources
        cards.extend(self._generate_subscription_cards(context))
        cards.extend(self._generate_leak_cards(context))
        cards.extend(self._generate_budget_cards(context))
        cards.extend(self._generate_savings_cards(context))
        cards.extend(self._generate_goal_cards(context))

        # Sort by priority and impact
        priority_order = {
            self.PRIORITY_URGENT: 0,
            self.PRIORITY_HIGH: 1,
            self.PRIORITY_MEDIUM: 2,
            self.PRIORITY_LOW: 3,
        }

        cards.sort(
            key=lambda c: (
                priority_order.get(c.get("priority", self.PRIORITY_MEDIUM), 2),
                -c.get("impact_amount", 0)
            )
        )

        return cards[:10]  # Top 10 most relevant

    def _generate_subscription_cards(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate subscription-related action cards"""
        cards = []
        subscriptions = context.get("subscriptions", [])

        for sub in subscriptions:
            if sub.get("status") != "ACTIVE":
                continue

            # Low usage subscription
            if sub.get("isLowUsage"):
                cards.append(self._create_card(
                    card_type=ActionType.CANCEL_SUBSCRIPTION.value,
                    title=f"Cancel {sub.get('name')}",
                    description=f"You haven't used {sub.get('name')} much recently. Canceling could save ₹{float(sub.get('amount', 0)):,.0f}/month.",
                    priority=self.PRIORITY_HIGH,
                    impact_amount=float(sub.get("amount", 0)),
                    impact_type="SAVINGS",
                    action_data={
                        "subscription_id": sub.get("id"),
                        "merchant": sub.get("merchantName"),
                        "cancel_url": self._get_cancel_url(sub.get("merchantName")),
                        "cancel_steps": self._get_cancel_steps(sub.get("merchantName")),
                    },
                    expires_in_days=7,
                ))

            # Price increased
            if sub.get("priceIncreased"):
                original = float(sub.get("originalAmount", 0) or 0)
                current = float(sub.get("amount", 0))
                increase = current - original

                cards.append(self._create_card(
                    card_type=ActionType.REVIEW_SUBSCRIPTION.value,
                    title=f"Review {sub.get('name')} Price Hike",
                    description=f"{sub.get('name')} increased from ₹{original:.0f} to ₹{current:.0f}. Still worth it?",
                    priority=self.PRIORITY_MEDIUM,
                    impact_amount=increase,
                    impact_type="SAVINGS",
                    action_data={
                        "subscription_id": sub.get("id"),
                        "price_increase_percent": float(sub.get("priceIncreasePercent", 0) or 0),
                    },
                    expires_in_days=30,
                ))

        # Duplicate subscriptions
        duplicate_groups = self._find_duplicate_subscriptions(subscriptions)
        for group in duplicate_groups:
            savings = sum(float(s.get("amount", 0)) for s in group["others"])

            cards.append(self._create_card(
                card_type=ActionType.CANCEL_SUBSCRIPTION.value,
                title=f"Duplicate {group['category']} Services",
                description=f"You have {len(group['all'])} {group['category']} subscriptions. Keep {group['cheapest'].get('name')} and save ₹{savings:.0f}/month.",
                priority=self.PRIORITY_HIGH,
                impact_amount=savings,
                impact_type="SAVINGS",
                action_data={
                    "category": group["category"],
                    "subscriptions": [
                        {"name": s.get("name"), "amount": float(s.get("amount", 0))}
                        for s in group["all"]
                    ],
                    "recommended": group["cheapest"].get("name"),
                },
                expires_in_days=14,
            ))

        return cards

    def _generate_leak_cards(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate money leak action cards"""
        cards = []
        leak_analysis = context.get("leak_analysis", {})
        leaks = leak_analysis.get("leaks", [])

        for leak in leaks[:5]:  # Top 5 leaks
            leak_type = leak.get("type")

            if leak_type == "IMPULSE_PURCHASES":
                cards.append(self._create_card(
                    card_type=ActionType.AVOID_IMPULSE.value,
                    title="Reduce Impulse Spending",
                    description=f"You made {leak.get('transaction_count', 0)} impulse purchases totaling ₹{leak.get('total_amount', 0):,.0f}. Try the 24-hour rule.",
                    priority=self.PRIORITY_HIGH,
                    impact_amount=leak.get("monthly_savings", 0),
                    impact_type="SAVINGS",
                    action_data={
                        "transaction_count": leak.get("transaction_count"),
                        "total_amount": leak.get("total_amount"),
                    },
                    expires_in_days=30,
                ))

            elif leak_type == "LATE_NIGHT_SPENDING":
                cards.append(self._create_card(
                    card_type=ActionType.AVOID_IMPULSE.value,
                    title="Avoid Late-Night Spending",
                    description=f"₹{leak.get('total_amount', 0):,.0f} spent after 10 PM - often impulse purchases. Consider a spending curfew.",
                    priority=self.PRIORITY_MEDIUM,
                    impact_amount=leak.get("monthly_savings", 0),
                    impact_type="SAVINGS",
                    action_data={
                        "total_amount": leak.get("total_amount"),
                    },
                    expires_in_days=30,
                ))

            elif leak_type == "SMALL_FREQUENT":
                cards.append(self._create_card(
                    card_type=ActionType.REDUCE_SPENDING.value,
                    title=f"Watch {leak.get('merchant', 'Small')} Purchases",
                    description=f"Your small purchases at {leak.get('merchant', 'Unknown')} add up to ₹{leak.get('total_amount', 0):,.0f}/month.",
                    priority=self.PRIORITY_MEDIUM,
                    impact_amount=leak.get("monthly_savings", 0),
                    impact_type="SAVINGS",
                    action_data={
                        "merchant": leak.get("merchant"),
                        "transaction_count": leak.get("transaction_count"),
                    },
                    expires_in_days=14,
                ))

        return cards

    def _generate_budget_cards(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate budget-related action cards"""
        cards = []
        budgets = context.get("budgets", [])
        transactions = context.get("transactions", [])

        # Check if user has budgets
        if not budgets:
            cards.append(self._create_card(
                card_type=ActionType.SET_BUDGET.value,
                title="Set Your First Budget",
                description="Start with a budget for your biggest spending category. Budgets help you stay on track.",
                priority=self.PRIORITY_MEDIUM,
                impact_amount=0,
                impact_type="HEALTH_SCORE",
                action_data={
                    "suggested_categories": self._suggest_budget_categories(transactions),
                },
                expires_in_days=30,
            ))
            return cards

        # Check budget adherence
        category_spending = {}
        for tx in transactions:
            if tx.get("type") == "DEBIT":
                cat = tx.get("category", "OTHER")
                category_spending[cat] = category_spending.get(cat, 0) + float(tx.get("amount", 0))

        for budget in budgets:
            category = budget.get("categoryId") or budget.get("category")
            limit = float(budget.get("amountLimit", budget.get("limit", 0)))
            spent = category_spending.get(category, 0)
            utilization = spent / limit if limit > 0 else 0

            if utilization > 0.9:
                cards.append(self._create_card(
                    card_type=ActionType.REDUCE_SPENDING.value,
                    title=f"Stop {category} Spending",
                    description=f"You've used {utilization*100:.0f}% of your {category} budget. Pause spending in this category.",
                    priority=self.PRIORITY_URGENT if utilization > 1 else self.PRIORITY_HIGH,
                    impact_amount=spent - limit if utilization > 1 else 0,
                    impact_type="BUDGET",
                    action_data={
                        "category": category,
                        "limit": limit,
                        "spent": spent,
                        "utilization": utilization,
                    },
                    expires_in_days=7,
                ))

            elif utilization > 0.75:
                cards.append(self._create_card(
                    card_type=ActionType.REDUCE_SPENDING.value,
                    title=f"Slow Down {category} Spending",
                    description=f"You've used {utilization*100:.0f}% of your {category} budget. Only ₹{limit - spent:,.0f} left.",
                    priority=self.PRIORITY_MEDIUM,
                    impact_amount=0,
                    impact_type="BUDGET",
                    action_data={
                        "category": category,
                        "limit": limit,
                        "remaining": limit - spent,
                    },
                    expires_in_days=14,
                ))

        return cards

    def _generate_savings_cards(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate savings-related action cards"""
        cards = []
        health_score = context.get("health_score", {})
        archetype = context.get("archetype", {})

        savings_rate = health_score.get("components", {}).get("savings_rate", {}).get("savings_rate", 0)

        if savings_rate < 10:
            cards.append(self._create_card(
                card_type=ActionType.INCREASE_SAVINGS.value,
                title="Boost Your Savings Rate",
                description=f"Your savings rate is {savings_rate:.1f}%. Aim for at least 20% to build financial security.",
                priority=self.PRIORITY_HIGH,
                impact_amount=0,
                impact_type="HEALTH_SCORE",
                action_data={
                    "current_rate": savings_rate,
                    "target_rate": 20,
                    "suggested_actions": [
                        "Set up auto-transfer to savings",
                        "Review subscriptions",
                        "Reduce discretionary spending",
                    ],
                },
                expires_in_days=30,
            ))

        # Emergency fund check
        transactions = context.get("transactions", [])
        monthly_expense = sum(
            float(tx.get("amount", 0))
            for tx in transactions
            if tx.get("type") == "DEBIT"
        )

        # Would check if user has emergency fund goal
        cards.append(self._create_card(
            card_type=ActionType.EMERGENCY_FUND.value,
            title="Build Emergency Fund",
            description=f"An emergency fund should cover 3-6 months of expenses (₹{monthly_expense * 3:,.0f} - ₹{monthly_expense * 6:,.0f}).",
            priority=self.PRIORITY_MEDIUM,
            impact_amount=0,
            impact_type="GOAL_PROGRESS",
            action_data={
                "monthly_expense": monthly_expense,
                "recommended_minimum": monthly_expense * 3,
                "recommended_target": monthly_expense * 6,
            },
            expires_in_days=30,
        ))

        return cards

    def _generate_goal_cards(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate goal-related action cards"""
        cards = []
        goals = context.get("goals", [])

        if not goals:
            cards.append(self._create_card(
                card_type=ActionType.SET_GOAL.value,
                title="Set a Savings Goal",
                description="Whether it's a trip, gadget, or emergency fund, goals help you save with purpose.",
                priority=self.PRIORITY_LOW,
                impact_amount=0,
                impact_type="GOAL_PROGRESS",
                action_data={
                    "suggested_goals": [
                        {"name": "Emergency Fund", "icon": "🛡️"},
                        {"name": "Vacation", "icon": "✈️"},
                        {"name": "New Gadget", "icon": "📱"},
                    ],
                },
                expires_in_days=30,
            ))
            return cards

        for goal in goals:
            if goal.get("isCompleted"):
                continue

            target = float(goal.get("targetAmount", 0))
            current = float(goal.get("currentAmount", 0))
            progress = current / target if target > 0 else 0

            # Behind schedule detection would go here
            if progress < 0.5 and goal.get("targetDate"):
                cards.append(self._create_card(
                    card_type=ActionType.TRACK_GOAL.value,
                    title=f"Accelerate {goal.get('name')}",
                    description=f"You're {progress*100:.0f}% towards {goal.get('name')}. Consider increasing your savings allocation.",
                    priority=self.PRIORITY_MEDIUM,
                    impact_amount=0,
                    impact_type="GOAL_PROGRESS",
                    action_data={
                        "goal_id": goal.get("id"),
                        "goal_name": goal.get("name"),
                        "current": current,
                        "target": target,
                        "progress": progress,
                    },
                    expires_in_days=14,
                ))

        return cards

    def _create_card(
        self,
        card_type: str,
        title: str,
        description: str,
        priority: str,
        impact_amount: float,
        impact_type: str,
        action_data: Dict[str, Any],
        expires_in_days: int = 30
    ) -> Dict[str, Any]:
        """Create an action card"""
        now = datetime.utcnow()
        return {
            "id": f"card-{now.timestamp()}-{card_type}",
            "type": card_type,
            "title": title,
            "description": description,
            "priority": priority,
            "impact_amount": round(impact_amount, 2),
            "impact_type": impact_type,
            "status": "PENDING",
            "action_data": action_data,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(days=expires_in_days)).isoformat(),
        }

    def _find_duplicate_subscriptions(
        self,
        subscriptions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Find duplicate/overlapping subscriptions"""
        duplicates = []

        service_categories = {
            "music": ["spotify", "apple music", "youtube music", "gaana"],
            "video": ["netflix", "amazon prime", "hotstar", "zee5"],
            "cloud": ["google one", "icloud", "dropbox"],
        }

        active = [s for s in subscriptions if s.get("status") == "ACTIVE"]

        for category, keywords in service_categories.items():
            matched = []
            for sub in active:
                name = (sub.get("merchantName") or sub.get("name") or "").lower()
                if any(kw in name for kw in keywords):
                    matched.append(sub)

            if len(matched) > 1:
                cheapest = min(matched, key=lambda s: float(s.get("amount", 0)))
                others = [s for s in matched if s != cheapest]

                duplicates.append({
                    "category": category,
                    "all": matched,
                    "cheapest": cheapest,
                    "others": others,
                })

        return duplicates

    def _get_cancel_url(self, merchant: str) -> Optional[str]:
        """Get subscription cancel URL"""
        cancel_urls = {
            "netflix": "https://www.netflix.com/account/cancel",
            "spotify": "https://www.spotify.com/account/subscription/",
            "amazon prime": "https://www.amazon.in/gp/primecentral",
            "hotstar": "https://www.hotstar.com/in/subscription/my-account",
        }

        merchant_lower = (merchant or "").lower()
        for key, url in cancel_urls.items():
            if key in merchant_lower:
                return url

        return None

    def _get_cancel_steps(self, merchant: str) -> List[str]:
        """Get cancel steps for subscription"""
        steps = {
            "netflix": [
                "Go to Netflix.com and sign in",
                "Click profile icon → Account",
                "Click 'Cancel Membership'",
                "Confirm cancellation",
            ],
            "spotify": [
                "Go to Spotify.com/account",
                "Click 'Subscription'",
                "Click 'Change or Cancel'",
                "Click 'Cancel Premium'",
            ],
        }

        merchant_lower = (merchant or "").lower()
        for key, step_list in steps.items():
            if key in merchant_lower:
                return step_list

        return ["Visit the service's website", "Find subscription settings", "Cancel subscription"]

    def _suggest_budget_categories(
        self,
        transactions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Suggest categories for budgeting based on spending"""
        category_spending = {}

        for tx in transactions:
            if tx.get("type") == "DEBIT":
                cat = tx.get("category", "OTHER")
                category_spending[cat] = category_spending.get(cat, 0) + float(tx.get("amount", 0))

        sorted_cats = sorted(category_spending.items(), key=lambda x: x[1], reverse=True)

        return [
            {"category": cat, "suggested_budget": round(amt * 0.9, 0)}
            for cat, amt in sorted_cats[:3]
        ]
