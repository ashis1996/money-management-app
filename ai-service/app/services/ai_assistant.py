"""
AI Assistant Service
Natural language financial assistant for user queries
"""

import logging
import os
import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class QueryIntent(Enum):
    """Types of user queries"""
    SPENDING_SUMMARY = "spending_summary"
    WASTE_ANALYSIS = "waste_analysis"
    AFFORDABILITY_CHECK = "affordability_check"
    SAVINGS_ADVICE = "savings_advice"
    SUBSCRIPTION_HELP = "subscription_help"
    BUDGET_HELP = "budget_help"
    GOAL_HELP = "goal_help"
    PREDICTION = "prediction"
    COMPARISON = "comparison"
    GENERAL_ADVICE = "general_advice"
    UNKNOWN = "unknown"


class AIAssistantService:
    """Service for AI-powered financial assistant"""

    def __init__(self):
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        self._configured = bool(self.openai_key or self.anthropic_key)

        # Intent patterns for classification
        self.intent_patterns = {
            QueryIntent.SPENDING_SUMMARY: [
                r"where (did|do) i (spend|spent)",
                r"how much (did|do) i spend",
                r"what did i spend",
                r"spending summary",
                r"expense.*summary",
                r"show.*spending",
            ],
            QueryIntent.WASTE_ANALYSIS: [
                r"where.*waste",
                r"waste.*money",
                r"money leak",
                r"unnecessary.*spend",
                r"where.*losing.*money",
                r"save.*money",
            ],
            QueryIntent.AFFORDABILITY_CHECK: [
                r"can i afford",
                r"afford.*to buy",
                r"should i buy",
                r"can.*purchase",
            ],
            QueryIntent.SAVINGS_ADVICE: [
                r"how.*save",
                r"save.*\d+",  # "save 10000"
                r"savings.*advice",
                r"reduce.*spending",
            ],
            QueryIntent.SUBSCRIPTION_HELP: [
                r"subscription",
                r"recurring.*payment",
                r"cancel.*subscription",
                r"autopay",
            ],
            QueryIntent.BUDGET_HELP: [
                r"budget",
                r"set.*budget",
                r"budget.*advice",
            ],
            QueryIntent.GOAL_HELP: [
                r"goal",
                r"save for",
                r"saving.*for",
            ],
            QueryIntent.PREDICTION: [
                r"will i have",
                r"predict",
                r"forecast",
                r"end.*month.*balance",
                r"runway",
            ],
            QueryIntent.COMPARISON: [
                r"compare.*month",
                r"last month",
                r"previous.*month",
                r"vs last",
            ],
        }

    def process_query(
        self,
        user_id: str,
        query: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process natural language query

        Args:
            user_id: User identifier
            query: User's natural language query
            context: Context data (transactions, budgets, etc.)

        Returns:
            Response with answer and data
        """
        # Classify intent
        intent = self._classify_intent(query)

        # Generate response based on intent
        if intent == QueryIntent.SPENDING_SUMMARY:
            return self._handle_spending_summary(query, context)
        elif intent == QueryIntent.WASTE_ANALYSIS:
            return self._handle_waste_analysis(query, context)
        elif intent == QueryIntent.AFFORDABILITY_CHECK:
            return self._handle_affordability_check(query, context)
        elif intent == QueryIntent.SAVINGS_ADVICE:
            return self._handle_savings_advice(query, context)
        elif intent == QueryIntent.PREDICTION:
            return self._handle_prediction(query, context)
        elif intent == QueryIntent.SUBSCRIPTION_HELP:
            return self._handle_subscription_help(query, context)
        elif intent == QueryIntent.COMPARISON:
            return self._handle_comparison(query, context)
        else:
            return self._handle_general(query, context)

    def _classify_intent(self, query: str) -> QueryIntent:
        """Classify user query intent"""
        query_lower = query.lower().strip()

        for intent, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, query_lower):
                    return intent

        return QueryIntent.UNKNOWN

    def _handle_spending_summary(
        self,
        query: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle spending summary queries"""
        transactions = context.get("transactions", [])

        # Calculate totals
        total_spent = sum(
            float(tx.get("amount", 0))
            for tx in transactions
            if tx.get("type") == "DEBIT"
        )

        total_income = sum(
            float(tx.get("amount", 0))
            for tx in transactions
            if tx.get("type") == "CREDIT"
        )

        # Category breakdown
        categories = {}
        for tx in transactions:
            if tx.get("type") == "DEBIT":
                cat = tx.get("category", "OTHER")
                categories[cat] = categories.get(cat, 0) + float(tx.get("amount", 0))

        # Sort categories
        sorted_cats = sorted(categories.items(), key=lambda x: x[1], reverse=True)

        # Generate response
        if self._configured:
            answer = self._generate_llm_response(
                query=query,
                data={
                    "total_spent": total_spent,
                    "total_income": total_income,
                    "categories": sorted_cats[:5],
                },
                prompt_template=self._spending_summary_prompt
            )
        else:
            answer = self._generate_fallback_spending_summary(
                total_spent, total_income, sorted_cats
            )

        return {
            "intent": QueryIntent.SPENDING_SUMMARY.value,
            "answer": answer,
            "data": {
                "total_spent": round(total_spent, 2),
                "total_income": round(total_income, 2),
                "categories": [
                    {"category": cat, "amount": round(amt, 2)}
                    for cat, amt in sorted_cats[:10]
                ],
            },
        }

    def _handle_waste_analysis(
        self,
        query: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle waste/money leak queries"""
        leak_data = context.get("leak_analysis", {})
        transactions = context.get("transactions", [])

        # Calculate potential savings
        potential_savings = leak_data.get("potential_monthly_savings", 0)
        leaks = leak_data.get("leaks", [])

        # Find biggest waste categories
        waste_areas = []
        for leak in leaks[:3]:
            waste_areas.append({
                "area": leak.get("merchant") or leak.get("type"),
                "amount": leak.get("amount", 0),
                "savings": leak.get("monthly_savings", 0),
            })

        if self._configured:
            answer = self._generate_llm_response(
                query=query,
                data={"leaks": leaks, "potential_savings": potential_savings},
                prompt_template=self._waste_analysis_prompt
            )
        else:
            answer = self._generate_fallback_waste_analysis(
                potential_savings, waste_areas
            )

        return {
            "intent": QueryIntent.WASTE_ANALYSIS.value,
            "answer": answer,
            "data": {
                "potential_monthly_savings": round(potential_savings, 2),
                "top_waste_areas": waste_areas,
                "leaks": leaks,
            },
        }

    def _handle_affordability_check(
        self,
        query: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle 'Can I afford X?' queries"""
        # Extract amount from query
        amount_match = re.search(r"₹?\s*(\d[\d,]*)", query)
        if not amount_match:
            return {
                "intent": QueryIntent.AFFORDABILITY_CHECK.value,
                "answer": "I couldn't understand the amount. Please specify like 'Can I afford ₹50,000?'",
                "data": None,
            }

        try:
            amount = float(amount_match.group(1).replace(",", ""))
        except ValueError:
            amount = 0

        # Get financial context
        transactions = context.get("transactions", [])
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

        # Determine affordability
        savings_rate = (savings / total_income * 100) if total_income > 0 else 0
        months_to_save = (amount / savings) if savings > 0 else float("inf")

        can_afford = savings >= amount
        can_afford_with_savings = savings_rate >= 20 and savings * 3 >= amount

        if can_afford:
            answer = f"Yes, you can afford ₹{amount:,.0f}! You have ₹{savings:,.0f} in savings this period."
        elif can_afford_with_savings:
            answer = f"With your current savings rate of {savings_rate:.1f}%, you could save ₹{amount:,.0f} in about {months_to_save:.1f} months."
        else:
            answer = f"Buying ₹{amount:,.0f} would use {amount/savings*100:.0f}% of your current savings. Consider if this is a need or want."

        return {
            "intent": QueryIntent.AFFORDABILITY_CHECK.value,
            "answer": answer,
            "data": {
                "amount": amount,
                "can_afford": can_afford,
                "current_savings": round(savings, 2),
                "savings_rate": round(savings_rate, 2),
                "months_to_save": round(months_to_save, 1) if months_to_save != float("inf") else None,
            },
        }

    def _handle_savings_advice(
        self,
        query: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle savings advice queries"""
        # Extract target savings if mentioned
        target_match = re.search(r"save\s+(?:₹?\s*)?(\d[\d,]*)", query.lower())
        target_savings = None
        if target_match:
            try:
                target_savings = float(target_match.group(1).replace(",", ""))
            except ValueError:
                pass

        transactions = context.get("transactions", [])
        leak_data = context.get("leak_analysis", {})

        # Calculate current savings
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
        current_savings = total_income - total_expense
        savings_rate = (current_savings / total_income * 100) if total_income > 0 else 0

        # Generate recommendations
        recommendations = []

        # From leaks
        potential_from_leaks = leak_data.get("potential_monthly_savings", 0)
        if potential_from_leaks > 0:
            recommendations.append({
                "action": "Fix money leaks",
                "potential_savings": potential_from_leaks,
                "details": "Cancel unused subscriptions and reduce impulse spending",
            })

        # Category-based
        categories = {}
        for tx in transactions:
            if tx.get("type") == "DEBIT":
                cat = tx.get("category", "OTHER")
                categories[cat] = categories.get(cat, 0) + float(tx.get("amount", 0))

        for cat, amount in sorted(categories.items(), key=lambda x: x[1], reverse=True)[:3]:
            if amount > total_expense * 0.15:
                recommendations.append({
                    "action": f"Reduce {cat.replace('_', ' ').title()} spending",
                    "potential_savings": amount * 0.2,
                    "details": f"You spent ₹{amount:,.0f} on {cat.replace('_', ' ').lower()}",
                })

        if self._configured:
            answer = self._generate_llm_response(
                query=query,
                data={
                    "current_savings": current_savings,
                    "savings_rate": savings_rate,
                    "recommendations": recommendations,
                    "target": target_savings,
                },
                prompt_template=self._savings_advice_prompt
            )
        else:
            answer = self._generate_fallback_savings_advice(
                current_savings, savings_rate, recommendations, target_savings
            )

        return {
            "intent": QueryIntent.SAVINGS_ADVICE.value,
            "answer": answer,
            "data": {
                "current_savings": round(current_savings, 2),
                "savings_rate": round(savings_rate, 2),
                "recommendations": recommendations,
                "target": target_savings,
            },
        }

    def _handle_prediction(
        self,
        query: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle prediction queries"""
        transactions = context.get("transactions", [])

        # Calculate daily average spending
        daily_spending = {}
        for tx in transactions:
            if tx.get("type") == "DEBIT":
                date_str = tx.get("transactionDate") or tx.get("date")
                if isinstance(date_str, str):
                    date_key = date_str[:10]
                elif isinstance(date_str, datetime):
                    date_key = date_str.strftime("%Y-%m-%d")
                else:
                    continue
                daily_spending[date_key] = daily_spending.get(date_key, 0) + float(tx.get("amount", 0))

        if not daily_spending:
            return {
                "intent": QueryIntent.PREDICTION.value,
                "answer": "I don't have enough transaction data to make predictions.",
                "data": None,
            }

        # Calculate averages
        amounts = list(daily_spending.values())
        avg_daily = sum(amounts) / len(amounts) if amounts else 0

        # Predict end of month
        today = datetime.utcnow()
        days_left = (30 - today.day) if today.day < 30 else 30
        predicted_spending = avg_daily * days_left

        # Current balance (estimate)
        total_income = sum(float(tx.get("amount", 0)) for tx in transactions if tx.get("type") == "CREDIT")
        total_spent = sum(float(tx.get("amount", 0)) for tx in transactions if tx.get("type") == "DEBIT")
        current_balance = total_income - total_spent

        predicted_end_balance = current_balance - predicted_spending

        # Runway calculation
        if avg_daily > 0 and current_balance > 0:
            runway_days = int(current_balance / avg_daily)
        else:
            runway_days = 0

        answer = f"Based on your spending patterns:\n"
        answer += f"• Current balance: ₹{current_balance:,.0f}\n"
        answer += f"• Daily average: ₹{avg_daily:,.0f}\n"
        answer += f"• Predicted end-of-month balance: ₹{predicted_end_balance:,.0f}\n"
        answer += f"• Runway: Your balance would last ~{runway_days} days at current spending rate"

        return {
            "intent": QueryIntent.PREDICTION.value,
            "answer": answer,
            "data": {
                "current_balance": round(current_balance, 2),
                "daily_average": round(avg_daily, 2),
                "predicted_end_balance": round(predicted_end_balance, 2),
                "runway_days": runway_days,
            },
        }

    def _handle_subscription_help(
        self,
        query: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle subscription queries"""
        subscriptions = context.get("subscriptions", [])

        active_subs = [s for s in subscriptions if s.get("status") == "ACTIVE"]
        monthly_total = sum(
            float(s.get("amount", 0))
            for s in active_subs
            if s.get("frequency") == "MONTHLY"
        )

        # Categorize
        issues = []
        for sub in active_subs:
            if sub.get("isLowUsage"):
                issues.append({
                    "subscription": sub.get("name"),
                    "issue": "Low usage",
                    "amount": float(sub.get("amount", 0)),
                })
            if sub.get("priceIncreased"):
                issues.append({
                    "subscription": sub.get("name"),
                    "issue": "Price increased",
                    "amount": float(sub.get("amount", 0)),
                })

        answer = f"You have {len(active_subs)} active subscriptions totaling ₹{monthly_total:,.0f}/month.\n"
        if issues:
            answer += f"\nIssues detected:\n"
            for issue in issues:
                answer += f"• {issue['subscription']}: {issue['issue']} (₹{issue['amount']:,.0f})\n"

        return {
            "intent": QueryIntent.SUBSCRIPTION_HELP.value,
            "answer": answer,
            "data": {
                "active_count": len(active_subs),
                "monthly_total": round(monthly_total, 2),
                "subscriptions": [
                    {
                        "name": s.get("name"),
                        "amount": float(s.get("amount", 0)),
                        "frequency": s.get("frequency"),
                    }
                    for s in active_subs
                ],
                "issues": issues,
            },
        }

    def _handle_comparison(
        self,
        query: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle comparison queries"""
        # This would compare current vs previous period
        return {
            "intent": QueryIntent.COMPARISON.value,
            "answer": "Comparison feature coming soon!",
            "data": None,
        }

    def _handle_general(
        self,
        query: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle general queries"""
        if self._configured:
            answer = self._generate_llm_response(query, context, self._general_prompt)
        else:
            answer = "I can help you understand your spending, find money leaks, check affordability, and more. Try asking 'Where did I waste money this month?' or 'Can I afford ₹50,000?'"

        return {
            "intent": QueryIntent.GENERAL_ADVICE.value,
            "answer": answer,
            "data": None,
        }

    def _generate_llm_response(
        self,
        query: str,
        data: Dict[str, Any],
        prompt_template: str
    ) -> str:
        """Generate response using LLM"""
        try:
            if self.openai_key:
                return self._call_openai(query, data)
            if self.anthropic_key:
                return self._call_anthropic(query, data)
        except Exception as e:
            logger.error(f"LLM API error: {e}")

        return "I'm having trouble processing your request right now."

    def _call_openai(self, query: str, data: Dict[str, Any]) -> str:
        """Call OpenAI API"""
        from openai import OpenAI
        client = OpenAI(api_key=self.openai_key)

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful financial assistant. Be concise and actionable."
                },
                {
                    "role": "user",
                    "content": f"Query: {query}\nData: {data}"
                }
            ],
            max_tokens=300,
            temperature=0.7,
        )

        return response.choices[0].message.content.strip()

    def _call_anthropic(self, query: str, data: Dict[str, Any]) -> str:
        """Call Anthropic API"""
        from anthropic import Anthropic
        client = Anthropic(api_key=self.anthropic_key)

        response = client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=300,
            messages=[
                {
                    "role": "user",
                    "content": f"You are a financial assistant. Query: {query}\nData: {data}"
                }
            ]
        )

        return response.content[0].text.strip()

    # Fallback response generators
    def _generate_fallback_spending_summary(self, total_spent, total_income, categories):
        cat_text = "\n".join([f"• {cat}: ₹{amt:,.0f}" for cat, amt in categories[:5]])
        return f"This period you spent ₹{total_spent:,.0f} out of ₹{total_income:,.0f} income.\n\nTop categories:\n{cat_text}"

    def _generate_fallback_waste_analysis(self, potential_savings, waste_areas):
        areas_text = "\n".join([f"• {w['area']}: ₹{w['savings']:,.0f}/month" for w in waste_areas])
        return f"You could potentially save ₹{potential_savings:,.0f}/month by addressing:\n\n{areas_text}"

    def _generate_fallback_savings_advice(self, current_savings, savings_rate, recommendations, target):
        rec_text = "\n".join([f"• {r['action']}: ₹{r['potential_savings']:,.0f}" for r in recommendations])
        base = f"Your current savings rate is {savings_rate:.1f}% (₹{current_savings:,.0f}).\n\nRecommendations:\n{rec_text}"
        if target:
            base += f"\n\nTo reach ₹{target:,.0f}, save ₹{target/12:,.0f}/month."
        return base

    @property
    def _spending_summary_prompt(self):
        return "Analyze the spending data and provide a friendly summary."

    @property
    def _waste_analysis_prompt(self):
        return "Identify money leaks and suggest specific actions to save money."

    @property
    def _savings_advice_prompt(self):
        return "Provide personalized savings advice based on spending patterns."

    @property
    def _general_prompt(self):
        return "Provide helpful financial guidance."
