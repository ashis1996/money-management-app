"""
Financial Health Score Service
Calculates comprehensive financial health score similar to CIBIL for spending
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)


class FinancialHealthService:
    """Service for calculating financial health score"""

    # Score components and weights
    COMPONENT_WEIGHTS = {
        "savings_rate": 0.25,           # 25% weight
        "budget_adherence": 0.20,       # 20% weight
        "subscription_health": 0.15,    # 15% weight
        "spending_consistency": 0.15,   # 15% weight
        "impulse_control": 0.10,        # 10% weight
        "goal_progress": 0.10,          # 10% weight
        "credit_utilization": 0.05,     # 5% weight
    }

    def __init__(self):
        pass

    def calculate_health_score(
        self,
        user_id: str,
        transactions: List[Dict[str, Any]],
        budgets: List[Dict[str, Any]] = None,
        subscriptions: List[Dict[str, Any]] = None,
        goals: List[Dict[str, Any]] = None,
        period_days: int = 30
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive financial health score

        Args:
            user_id: User identifier
            transactions: List of transactions
            budgets: List of budgets
            subscriptions: List of subscriptions
            goals: List of savings goals
            period_days: Analysis period

        Returns:
            Financial health score with breakdown
        """
        # Calculate each component
        components = {}

        # 1. Savings Rate Score (0-100)
        savings_score = self._calculate_savings_rate_score(transactions)
        components["savings_rate"] = savings_score

        # 2. Budget Adherence Score (0-100)
        budget_score = self._calculate_budget_adherence_score(transactions, budgets or [])
        components["budget_adherence"] = budget_score

        # 3. Subscription Health Score (0-100)
        subscription_score = self._calculate_subscription_health_score(subscriptions or [])
        components["subscription_health"] = subscription_score

        # 4. Spending Consistency Score (0-100)
        consistency_score = self._calculate_spending_consistency_score(transactions)
        components["spending_consistency"] = consistency_score

        # 5. Impulse Control Score (0-100)
        impulse_score = self._calculate_impulse_control_score(transactions)
        components["impulse_control"] = impulse_score

        # 6. Goal Progress Score (0-100)
        goal_score = self._calculate_goal_progress_score(goals or [])
        components["goal_progress"] = goal_score

        # 7. Credit Utilization Score (placeholder)
        components["credit_utilization"] = {"score": 75, "data": "Not tracked yet"}

        # Calculate weighted total
        total_score = sum(
            components[key]["score"] * self.COMPONENT_WEIGHTS[key]
            for key in self.COMPONENT_WEIGHTS
        )

        # Determine rating
        rating = self._get_rating(total_score)

        # Generate insights
        insights = self._generate_insights(components, total_score)

        return {
            "score": round(total_score, 2),
            "rating": rating,
            "max_score": 100,
            "components": components,
            "insights": insights,
            "calculated_at": datetime.utcnow().isoformat(),
            "period_days": period_days,
        }

    def _calculate_savings_rate_score(
        self,
        transactions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculate savings rate score

        Ideal: 20%+ savings rate = 100 points
        10-20% = 70 points
        5-10% = 50 points
        0-5% = 30 points
        Negative = 0 points
        """
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

        savings = total_income - total_expense
        savings_rate = (savings / total_income * 100) if total_income > 0 else 0

        if savings_rate >= 20:
            score = 100
        elif savings_rate >= 15:
            score = 85
        elif savings_rate >= 10:
            score = 70
        elif savings_rate >= 5:
            score = 50
        elif savings_rate >= 0:
            score = 30
        else:
            score = 0

        return {
            "score": score,
            "savings_rate": round(savings_rate, 2),
            "total_income": round(total_income, 2),
            "total_expense": round(total_expense, 2),
            "net_savings": round(savings, 2),
            "target": "20%+",
            "status": "EXCELLENT" if score >= 85 else "GOOD" if score >= 70 else "NEEDS_IMPROVEMENT",
        }

    def _calculate_budget_adherence_score(
        self,
        transactions: List[Dict[str, Any]],
        budgets: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate how well user adheres to budgets"""
        if not budgets:
            return {
                "score": 70,  # Neutral score if no budgets set
                "status": "NO_BUDGETS",
                "message": "Set budgets to track adherence",
            }

        # Calculate spending by category
        category_spending = defaultdict(float)
        for tx in transactions:
            if tx.get("type") == "DEBIT":
                cat = tx.get("category", "OTHER")
                category_spending[cat] += float(tx.get("amount", 0))

        # Check budget adherence
        budgets_on_track = 0
        budgets_exceeded = 0
        budget_details = []

        for budget in budgets:
            category = budget.get("categoryId") or budget.get("category")
            limit = float(budget.get("amountLimit", budget.get("limit", 0)))
            spent = category_spending.get(category, 0)

            utilization = (spent / limit * 100) if limit > 0 else 0
            is_on_track = spent <= limit

            if is_on_track:
                budgets_on_track += 1
            else:
                budgets_exceeded += 1

            budget_details.append({
                "category": category,
                "limit": limit,
                "spent": round(spent, 2),
                "utilization": round(utilization, 2),
                "on_track": is_on_track,
            })

        # Calculate score
        if len(budgets) > 0:
            adherence_ratio = budgets_on_track / len(budgets)
            score = int(adherence_ratio * 100)
        else:
            score = 70

        return {
            "score": score,
            "budgets_on_track": budgets_on_track,
            "budgets_exceeded": budgets_exceeded,
            "total_budgets": len(budgets),
            "details": budget_details,
        }

    def _calculate_subscription_health_score(
        self,
        subscriptions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculate subscription health score

        Factors:
        - Total subscription cost vs income
        - Unused/low-usage subscriptions
        - Price increases
        - Duplicate services
        """
        if not subscriptions:
            return {
                "score": 100,
                "status": "NO_SUBSCRIPTIONS",
                "message": "No subscriptions detected",
            }

        active_subs = [s for s in subscriptions if s.get("status") == "ACTIVE"]

        monthly_total = sum(
            float(s.get("amount", 0))
            for s in active_subs
            if s.get("frequency") == "MONTHLY"
        )

        # Check for issues
        issues = []

        # Low usage subscriptions
        low_usage = [s for s in active_subs if s.get("isLowUsage")]
        if low_usage:
            issues.append({
                "type": "LOW_USAGE",
                "count": len(low_usage),
                "potential_savings": sum(float(s.get("amount", 0)) for s in low_usage),
            })

        # Price increased subscriptions
        price_increased = [s for s in active_subs if s.get("priceIncreased")]
        if price_increased:
            issues.append({
                "type": "PRICE_INCREASED",
                "count": len(price_increased),
            })

        # Calculate score
        base_score = 100
        for issue in issues:
            if issue["type"] == "LOW_USAGE":
                base_score -= min(issue["count"] * 10, 30)
            elif issue["type"] == "PRICE_INCREASED":
                base_score -= min(issue["count"] * 5, 15)

        return {
            "score": max(base_score, 0),
            "active_subscriptions": len(active_subs),
            "monthly_total": round(monthly_total, 2),
            "issues": issues,
            "warnings": [i for i in issues if i["type"] == "LOW_USAGE"],
        }

    def _calculate_spending_consistency_score(
        self,
        transactions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculate spending consistency score

        Lower variance = higher score
        """
        # Group by day
        daily_spending = defaultdict(float)

        for tx in transactions:
            if tx.get("type") == "DEBIT":
                date_str = tx.get("transactionDate") or tx.get("date")
                if isinstance(date_str, str):
                    date_key = date_str[:10]  # YYYY-MM-DD
                elif isinstance(date_str, datetime):
                    date_key = date_str.strftime("%Y-%m-%d")
                else:
                    continue

                daily_spending[date_key] += float(tx.get("amount", 0))

        if len(daily_spending) < 7:
            return {
                "score": 70,
                "status": "INSUFFICIENT_DATA",
                "message": "Need more data for consistency analysis",
            }

        amounts = list(daily_spending.values())
        avg = statistics.mean(amounts)

        if len(amounts) > 1:
            std_dev = statistics.stdev(amounts)
            cv = (std_dev / avg) if avg > 0 else 0  # Coefficient of variation
        else:
            cv = 0

        # Score based on coefficient of variation
        # Lower CV = more consistent = higher score
        if cv < 0.3:
            score = 100
        elif cv < 0.5:
            score = 85
        elif cv < 0.7:
            score = 70
        elif cv < 1.0:
            score = 50
        else:
            score = 30

        return {
            "score": score,
            "daily_average": round(avg, 2),
            "std_deviation": round(std_dev, 2) if len(amounts) > 1 else 0,
            "coefficient_of_variation": round(cv, 2),
            "days_analyzed": len(daily_spending),
        }

    def _calculate_impulse_control_score(
        self,
        transactions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate impulse control score based on spending behavior"""
        total_transactions = len([tx for tx in transactions if tx.get("type") == "DEBIT"])

        impulse_transactions = len([tx for tx in transactions if tx.get("isImpulse")])

        if total_transactions == 0:
            return {"score": 100, "impulse_ratio": 0}

        impulse_ratio = impulse_transactions / total_transactions

        # Score: lower impulse ratio = higher score
        if impulse_ratio <= 0.05:
            score = 100
        elif impulse_ratio <= 0.10:
            score = 90
        elif impulse_ratio <= 0.20:
            score = 75
        elif impulse_ratio <= 0.30:
            score = 50
        else:
            score = 30

        return {
            "score": score,
            "impulse_transactions": impulse_transactions,
            "total_transactions": total_transactions,
            "impulse_ratio": round(impulse_ratio * 100, 2),
        }

    def _calculate_goal_progress_score(
        self,
        goals: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate goal progress score"""
        if not goals:
            return {
                "score": 70,
                "status": "NO_GOALS",
                "message": "Set savings goals to track progress",
            }

        active_goals = [g for g in goals if not g.get("isCompleted")]

        if not active_goals:
            return {"score": 100, "status": "ALL_GOALS_COMPLETED"}

        # Calculate average progress
        progress_scores = []
        for goal in active_goals:
            target = float(goal.get("targetAmount", 1))
            current = float(goal.get("currentAmount", 0))
            progress = (current / target * 100) if target > 0 else 0
            progress_scores.append(min(progress, 100))

        avg_progress = statistics.mean(progress_scores) if progress_scores else 0

        # Score based on average progress
        if avg_progress >= 75:
            score = 100
        elif avg_progress >= 50:
            score = 85
        elif avg_progress >= 25:
            score = 70
        else:
            score = 50

        return {
            "score": score,
            "active_goals": len(active_goals),
            "average_progress": round(avg_progress, 2),
            "goal_details": [
                {
                    "name": g.get("name"),
                    "progress": round(
                        float(g.get("currentAmount", 0)) / 
                        float(g.get("targetAmount", 1)) * 100, 2
                    ) if float(g.get("targetAmount", 1)) > 0 else 0
                }
                for g in active_goals
            ],
        }

    def _get_rating(self, score: float) -> str:
        """Get rating based on score"""
        if score >= 85:
            return "EXCELLENT"
        elif score >= 70:
            return "GOOD"
        elif score >= 55:
            return "FAIR"
        elif score >= 40:
            return "NEEDS_ATTENTION"
        else:
            return "CRITICAL"

    def _generate_insights(
        self,
        components: Dict[str, Any],
        total_score: float
    ) -> List[Dict[str, Any]]:
        """Generate actionable insights based on scores"""
        insights = []

        # Savings rate insight
        savings = components.get("savings_rate", {})
        if savings.get("score", 100) < 70:
            insights.append({
                "type": "SAVINGS_RATE",
                "priority": "HIGH",
                "title": "Improve Your Savings Rate",
                "description": f"Your savings rate is {savings.get('savings_rate', 0)}%. Aim for at least 20%.",
                "current_value": f"{savings.get('savings_rate', 0)}%",
                "target_value": "20%+",
            })

        # Budget adherence insight
        budget = components.get("budget_adherence", {})
        if budget.get("budgets_exceeded", 0) > 0:
            insights.append({
                "type": "BUDGET_ADHERENCE",
                "priority": "MEDIUM",
                "title": f"{budget['budgets_exceeded']} Budgets Exceeded",
                "description": "Review your spending in categories where budgets were exceeded.",
            })

        # Subscription health insight
        subs = components.get("subscription_health", {})
        if subs.get("issues"):
            for issue in subs["issues"]:
                if issue["type"] == "LOW_USAGE":
                    insights.append({
                        "type": "SUBSCRIPTION_HEALTH",
                        "priority": "HIGH",
                        "title": "Unused Subscriptions Detected",
                        "description": f"You have {issue['count']} low-usage subscriptions. Potential savings: ₹{issue['potential_savings']:.2f}/month",
                        "potential_savings": issue["potential_savings"],
                    })

        # Impulse control insight
        impulse = components.get("impulse_control", {})
        if impulse.get("impulse_ratio", 0) > 0.15:
            insights.append({
                "type": "IMPULSE_CONTROL",
                "priority": "MEDIUM",
                "title": "High Impulse Spending",
                "description": f"{impulse['impulse_ratio']}% of your transactions appear to be impulse purchases.",
            })

        return insights
