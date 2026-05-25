"""
LLM Integration Service
Integrates with LLM APIs for advanced financial insights
"""

import logging
import os
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class LLMIntegrationService:
    """Service for LLM-powered financial insights"""

    def __init__(self):
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        self._configured = bool(self.openai_key or self.anthropic_key)

        if self._configured:
            logger.info("LLM integration is configured")
        else:
            logger.info("LLM integration not configured - using fallback responses")

    def is_configured(self) -> bool:
        """Check if LLM is configured"""
        return self._configured

    def generate_financial_summary(
        self,
        user_id: str,
        transactions: List[Dict[str, Any]],
        period: str
    ) -> str:
        """
        Generate natural language summary of finances

        Args:
            user_id: User identifier
            transactions: Transaction data
            period: Time period

        Returns:
            Natural language summary
        """
        if not self._configured:
            return self._generate_fallback_summary(transactions, period)

        # Prepare data for LLM
        summary_data = self._prepare_summary_data(transactions, period)

        # Generate prompt
        prompt = self._create_summary_prompt(summary_data)

        try:
            # Try OpenAI first
            if self.openai_key:
                return self._call_openai(prompt)

            # Try Anthropic
            if self.anthropic_key:
                return self._call_anthropic(prompt)

        except Exception as e:
            logger.error(f"LLM API call failed: {str(e)}")
            return self._generate_fallback_summary(transactions, period)

        return self._generate_fallback_summary(transactions, period)

    def generate_financial_advice(
        self,
        user_id: str,
        spending_data: Dict[str, Any],
        goals: List[str]
    ) -> str:
        """
        Generate personalized financial advice

        Args:
            user_id: User identifier
            spending_data: Spending breakdown
            goals: Financial goals

        Returns:
            Personalized advice
        """
        if not self._configured:
            return self._generate_fallback_advice(spending_data, goals)

        prompt = f"""
        Based on the following spending data and financial goals, provide personalized financial advice:

        Spending Data:
        {self._format_spending_data(spending_data)}

        Financial Goals:
        {', '.join(goals) if goals else 'No specific goals mentioned'}

        Provide actionable, specific advice in a friendly tone. Keep it under 200 words.
        """

        try:
            if self.openai_key:
                return self._call_openai(prompt)
            if self.anthropic_key:
                return self._call_anthropic(prompt)
        except Exception as e:
            logger.error(f"LLM API call failed: {str(e)}")
            return self._generate_fallback_advice(spending_data, goals)

        return self._generate_fallback_advice(spending_data, goals)

    def _prepare_summary_data(self, transactions: List[Dict[str, Any]], period: str) -> Dict[str, Any]:
        """Prepare transaction data for summary"""
        total_income = sum(float(tx.get("amount", 0)) for tx in transactions if tx.get("type") == "CREDIT")
        total_expense = sum(float(tx.get("amount", 0)) for tx in transactions if tx.get("type") == "DEBIT")

        # Category breakdown
        categories = {}
        for tx in transactions:
            if tx.get("type") == "DEBIT":
                cat = tx.get("category", "OTHER")
                categories[cat] = categories.get(cat, 0) + float(tx.get("amount", 0))

        return {
            "period": period,
            "total_income": total_income,
            "total_expense": total_expense,
            "net_savings": total_income - total_expense,
            "categories": categories,
            "transaction_count": len(transactions),
        }

    def _create_summary_prompt(self, data: Dict[str, Any]) -> str:
        """Create prompt for LLM summary"""
        return f"""
        Generate a friendly, insightful financial summary based on this data:

        Period: {data['period']}
        Total Income: ₹{data['total_income']:.2f}
        Total Expenses: ₹{data['total_expense']:.2f}
        Net Savings: ₹{data['net_savings']:.2f}
        Savings Rate: {(data['net_savings'] / data['total_income'] * 100) if data['total_income'] > 0 else 0:.1f}%

        Top Categories:
        {chr(10).join([f"  - {cat}: ₹{amt:.2f}" for cat, amt in sorted(data['categories'].items(), key=lambda x: x[1], reverse=True)[:5]])}

        Transaction Count: {data['transaction_count']}

        Write a 3-4 sentence summary in a friendly, encouraging tone. Highlight positive behaviors and gently suggest areas for improvement.
        """

    def _format_spending_data(self, data: Dict[str, Any]) -> str:
        """Format spending data for prompt"""
        lines = []
        for key, value in data.items():
            if isinstance(value, float):
                lines.append(f"  {key}: ₹{value:.2f}")
            else:
                lines.append(f"  {key}: {value}")
        return chr(10).join(lines)

    def _call_openai(self, prompt: str) -> str:
        """Call OpenAI API"""
        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.openai_key)

            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful financial assistant."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.7,
            )

            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            raise

    def _call_anthropic(self, prompt: str) -> str:
        """Call Anthropic API"""
        try:
            from anthropic import Anthropic
            client = Anthropic(api_key=self.anthropic_key)

            response = client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=300,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Anthropic API error: {str(e)}")
            raise

    def _generate_fallback_summary(self, transactions: List[Dict[str, Any]], period: str) -> str:
        """Generate fallback summary without LLM"""
        total_income = sum(float(tx.get("amount", 0)) for tx in transactions if tx.get("type") == "CREDIT")
        total_expense = sum(float(tx.get("amount", 0)) for tx in transactions if tx.get("type") == "DEBIT")
        net_savings = total_income - total_expense

        savings_rate = (net_savings / total_income * 100) if total_income > 0 else 0

        if savings_rate >= 20:
            feedback = "Great job on maintaining a healthy savings rate!"
        elif savings_rate >= 10:
            feedback = "You're on the right track. Try to increase your savings rate."
        else:
            feedback = "Consider reviewing your expenses to find areas where you can save more."

        return (
            f"Over the past {period}, you earned ₹{total_income:.2f} and spent ₹{total_expense:.2f}, "
            f"resulting in net savings of ₹{net_savings:.2f} ({savings_rate:.1f}%). "
            f"{feedback} You had {len(transactions)} transactions during this period."
        )

    def _generate_fallback_advice(self, spending_data: Dict[str, Any], goals: List[str]) -> str:
        """Generate fallback advice without LLM"""
        advice_parts = []

        # Basic advice based on spending data
        total = sum(v for v in spending_data.values() if isinstance(v, (int, float)))

        if total > 0:
            # Find highest spending category
            max_cat = max(
                [(k, v) for k, v in spending_data.items() if isinstance(v, (int, float))],
                key=lambda x: x[1],
                default=(None, 0)
            )

            if max_cat[0]:
                advice_parts.append(
                    f"Your largest expense category is {max_cat[0]} (₹{max_cat[1]:.2f}). "
                    f"Consider reviewing this category for potential savings."
                )

        # Goal-based advice
        if goals:
            advice_parts.append(f"For your goals ({', '.join(goals)}), consider setting up automatic transfers to a dedicated savings account.")

        return " ".join(advice_parts) if advice_parts else "Keep tracking your expenses to gain better insights into your spending patterns."
