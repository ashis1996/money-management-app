"""
AI Service for Money Management Application
Handles SMS parsing, transaction categorization, subscription detection, and financial insights
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

from app.services.sms_parser import SmsParserService
from app.services.subscription_detector import SubscriptionDetectorService
from app.services.insights_generator import InsightsGeneratorService
from app.services.llm_integration import LLMIntegrationService
from app.services.behavioral_analyzer import BehavioralAnalyzerService
from app.services.health_score import FinancialHealthService
from app.services.leak_detector import LeakDetectorService
from app.services.ai_assistant import AIAssistantService
from app.services.user_profiler import UserProfilerService
from app.services.action_card_generator import ActionCardGenerator
from app.utils.response import ApiResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Money Management AI Service",
    description="AI-powered financial insights and SMS parsing service",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
sms_parser = SmsParserService()
subscription_detector = SubscriptionDetectorService()
insights_generator = InsightsGeneratorService()
llm_integration = LLMIntegrationService()
behavioral_analyzer = BehavioralAnalyzerService()
health_score_service = FinancialHealthService()
leak_detector = LeakDetectorService()
ai_assistant = AIAssistantService()
user_profiler = UserProfilerService()
action_card_generator = ActionCardGenerator()


# ==================== REQUEST/RESPONSE MODELS ====================

class SmsParseRequest(BaseModel):
    body: str
    sender: str
    timestamp: datetime
    phone_number: Optional[str] = None


class SmsParseResponse(BaseModel):
    success: bool
    parsed: Dict[str, Any]
    confidence: float


class TransactionData(BaseModel):
    transaction_id: str
    user_id: str
    amount: float
    category: str
    date: datetime


class SubscriptionDetectRequest(BaseModel):
    user_id: str
    transactions: List[Dict[str, Any]]


class SubscriptionDetectResponse(BaseModel):
    detected_subscriptions: List[Dict[str, Any]]
    count: int


class InsightsRequest(BaseModel):
    user_id: str
    transactions: List[Dict[str, Any]]
    period: str = "month"


class InsightsResponse(BaseModel):
    spending_analysis: Dict[str, Any]
    trends: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    predictions: Dict[str, Any]


class PredictionRequest(BaseModel):
    user_id: str
    period: str = "next_month"
    historical_data: Optional[List[Dict[str, Any]]] = None


# ==================== HEALTH CHECK ====================

@app.get("/")
async def root():
    """Health check endpoint"""
    return ApiResponse(
        success=True,
        message="AI Service is running",
        data={
            "service": "money-management-ai",
            "version": "1.0.0",
            "timestamp": datetime.utcnow(),
        }
    )


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return ApiResponse(
        success=True,
        data={
            "status": "healthy",
            "services": {
                "sms_parser": "active",
                "subscription_detector": "active",
                "insights_generator": "active",
                "llm_integration": llm_integration.is_configured(),
                "behavioral_analyzer": "active",
                "health_score": "active",
                "leak_detector": "active",
                "ai_assistant": "active",
                "user_profiler": "active",
                "action_card_generator": "active",
            }
        }
    )


# ==================== SMS PARSING ENDPOINTS ====================

@app.post("/api/v1/sms/parse", response_model=SmsParseResponse)
async def parse_sms(request: SmsParseRequest):
    """
    Parse SMS message to extract transaction details

    Args:
        request: SmsParseRequest with SMS body, sender, timestamp

    Returns:
        Parsed transaction data with confidence score
    """
    try:
        parsed = sms_parser.parse_sms(request.body, request.sender, request.timestamp)

        return SmsParseResponse(
            success=True,
            parsed=parsed,
            confidence=parsed.get("confidence", 0.0)
        )
    except Exception as e:
        logger.error(f"Error parsing SMS: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to parse SMS: {str(e)}")


@app.post("/api/v1/sms/parse/batch")
async def parse_sms_batch(messages: List[SmsParseRequest]):
    """
    Parse multiple SMS messages in batch

    Args:
        messages: List of SMS parse requests

    Returns:
        List of parsed transactions
    """
    results = []
    for msg in messages:
        try:
            parsed = sms_parser.parse_sms(msg.body, msg.sender, msg.timestamp)
            results.append({
                "success": True,
                "parsed": parsed,
                "confidence": parsed.get("confidence", 0.0)
            })
        except Exception as e:
            logger.error(f"Error parsing SMS in batch: {str(e)}")
            results.append({
                "success": False,
                "error": str(e),
                "parsed": None,
                "confidence": 0.0
            })

    return ApiResponse(
        success=True,
        message=f"Processed {len(results)} messages",
        data={"results": results}
    )


@app.post("/api/v1/sms/classify")
async def classify_transaction(request: SmsParseRequest):
    """
    Classify transaction from SMS using ML model

    Args:
        request: SmsParseRequest

    Returns:
        Classification with category and confidence
    """
    try:
        classification = sms_parser.classify_transaction(request.body)

        return ApiResponse(
            success=True,
            data=classification
        )
    except Exception as e:
        logger.error(f"Error classifying transaction: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to classify: {str(e)}")


# ==================== SUBSCRIPTION DETECTION ENDPOINTS ====================

@app.post("/api/v1/subscriptions/detect", response_model=SubscriptionDetectResponse)
async def detect_subscriptions(request: SubscriptionDetectRequest):
    """
    Detect subscriptions from transaction history

    Args:
        request: SubscriptionDetectRequest with user transactions

    Returns:
        List of detected subscriptions
    """
    try:
        detected = subscription_detector.detect(request.user_id, request.transactions)

        return SubscriptionDetectResponse(
            detected_subscriptions=detected,
            count=len(detected)
        )
    except Exception as e:
        logger.error(f"Error detecting subscriptions: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to detect subscriptions: {str(e)}")


@app.post("/api/v1/subscriptions/analyze-pattern")
async def analyze_subscription_pattern(request: Dict[str, Any]):
    """
    Analyze if a merchant follows a subscription pattern

    Args:
        merchant: Merchant name
        transactions: List of transactions for this merchant

    Returns:
        Pattern analysis with frequency and confidence
    """
    try:
        merchant = request.get("merchant", "Unknown")
        transactions = request.get("transactions", [])

        analysis = subscription_detector.analyze_merchant_pattern(merchant, transactions)

        return ApiResponse(
            success=True,
            data=analysis
        )
    except Exception as e:
        logger.error(f"Error analyzing pattern: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to analyze pattern: {str(e)}")


# ==================== INSIGHTS ENDPOINTS ====================

@app.post("/api/v1/insights/spending", response_model=InsightsResponse)
async def get_spending_insights(request: InsightsRequest):
    """
    Generate spending insights from transaction data

    Args:
        request: InsightsRequest with transactions and period

    Returns:
        Comprehensive spending analysis
    """
    try:
        insights = insights_generator.generate_spending_insights(
            request.user_id,
            request.transactions,
            request.period
        )

        return InsightsResponse(
            spending_analysis=insights.get("spending_analysis", {}),
            trends=insights.get("trends", []),
            recommendations=insights.get("recommendations", []),
            predictions=insights.get("predictions", {})
        )
    except Exception as e:
        logger.error(f"Error generating insights: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to generate insights: {str(e)}")


@app.post("/api/v1/insights/recommendations")
async def get_recommendations(request: InsightsRequest):
    """
    Generate personalized financial recommendations

    Args:
        request: InsightsRequest

    Returns:
        List of actionable recommendations
    """
    try:
        recommendations = insights_generator.generate_recommendations(
            request.user_id,
            request.transactions,
            request.period
        )

        return ApiResponse(
            success=True,
            data={"recommendations": recommendations}
        )
    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to generate recommendations: {str(e)}")


class WeeklySummaryRequest(BaseModel):
    """
    Request model for the weekly summary endpoint.

    The backend builds this payload before forwarding to the AI service so
    the heavy lifting (transactions/subs/budgets/goals fetch) stays in NestJS.
    """
    user_id: str
    week_start: datetime
    week_end: datetime
    transactions: List[Dict[str, Any]] = []
    previous_transactions: List[Dict[str, Any]] = []
    subscriptions: List[Dict[str, Any]] = []
    budgets: List[Dict[str, Any]] = []
    goals: List[Dict[str, Any]] = []
    archetype: Optional[str] = None


@app.post("/api/v1/insights/weekly-summary")
async def generate_weekly_summary(request: WeeklySummaryRequest):
    """
    Generate a personalized weekly money summary.

    Combines insights, behavior signals, and an LLM-generated narrative into
    a single response shape consumed by the backend's WeeklySummary module.

    Returns:
        - aiSummary: natural-language summary (LLM if configured, otherwise
          a deterministic fallback)
        - stats: totals, savings rate, week-over-week deltas
        - topCategories / topMerchants: top 5 by spend
        - behaviorInsights: late-night / weekend / impulse counts and amounts
        - unusualSpending: outliers vs the user's typical spending
        - recommendations: actionable suggestions
        - winsAndImprovements: highlights for the share-card UI
    """
    try:
        txns = request.transactions
        prev_txns = request.previous_transactions

        # Aggregate current week
        total_spent = sum(
            float(t.get("amount", 0)) for t in txns if t.get("type") == "DEBIT"
        )
        total_income = sum(
            float(t.get("amount", 0)) for t in txns if t.get("type") == "CREDIT"
        )
        savings = total_income - total_spent
        savings_rate = (savings / total_income) if total_income > 0 else 0.0

        # Aggregate previous week (for deltas)
        prev_spent = sum(
            float(t.get("amount", 0)) for t in prev_txns if t.get("type") == "DEBIT"
        )
        prev_income = sum(
            float(t.get("amount", 0)) for t in prev_txns if t.get("type") == "CREDIT"
        )
        spent_delta_pct = (
            ((total_spent - prev_spent) / prev_spent) * 100 if prev_spent > 0 else None
        )
        income_delta_pct = (
            ((total_income - prev_income) / prev_income) * 100 if prev_income > 0 else None
        )

        # Top categories (DEBIT only)
        cat_totals: Dict[str, Dict[str, float]] = {}
        for t in txns:
            if t.get("type") != "DEBIT":
                continue
            key = (t.get("category") or t.get("categoryName") or t.get("categoryId") or "OTHER")
            entry = cat_totals.setdefault(key, {"amount": 0.0, "count": 0})
            entry["amount"] += float(t.get("amount", 0))
            entry["count"] += 1
        top_categories = [
            {"name": k, "amount": round(v["amount"], 2), "count": int(v["count"])}
            for k, v in sorted(cat_totals.items(), key=lambda i: i[1]["amount"], reverse=True)
        ][:5]

        # Top merchants (DEBIT only)
        merch_totals: Dict[str, Dict[str, float]] = {}
        for t in txns:
            if t.get("type") != "DEBIT":
                continue
            key = (t.get("merchant") or t.get("merchantName") or "Unknown")
            entry = merch_totals.setdefault(key, {"amount": 0.0, "count": 0})
            entry["amount"] += float(t.get("amount", 0))
            entry["count"] += 1
        top_merchants = [
            {"name": k, "amount": round(v["amount"], 2), "count": int(v["count"])}
            for k, v in sorted(merch_totals.items(), key=lambda i: i[1]["amount"], reverse=True)
        ][:5]

        # Behavior signals from transaction flags
        debit_txns = [t for t in txns if t.get("type") == "DEBIT"]
        late_night = [t for t in debit_txns if t.get("isLateNight") or t.get("is_late_night")]
        weekend = [t for t in debit_txns if t.get("isWeekend") or t.get("is_weekend")]
        impulse = [t for t in debit_txns if t.get("isImpulse") or t.get("is_impulse")]

        behavior_insights = {
            "lateNightCount": len(late_night),
            "lateNightAmount": round(sum(float(t.get("amount", 0)) for t in late_night), 2),
            "weekendCount": len(weekend),
            "weekendAmount": round(sum(float(t.get("amount", 0)) for t in weekend), 2),
            "impulseCount": len(impulse),
            "impulseAmount": round(sum(float(t.get("amount", 0)) for t in impulse), 2),
        }

        # Unusual spending: > 4x the average DEBIT
        avg_amount = (
            total_spent / len(debit_txns) if debit_txns else 0.0
        )
        unusual = [
            {
                "id": t.get("id"),
                "merchant": t.get("merchant") or t.get("merchantName") or "Unknown",
                "amount": round(float(t.get("amount", 0)), 2),
                "date": t.get("date") or t.get("transactionDate"),
                "reason": "Unusually large compared to your typical spending",
            }
            for t in debit_txns
            if avg_amount > 0 and float(t.get("amount", 0)) > avg_amount * 4
        ][:3]

        # Wins & improvements (lightweight heuristics)
        wins: List[str] = []
        improvements: List[str] = []
        if savings_rate >= 0.20:
            wins.append(
                f"You saved {savings_rate * 100:.0f}% of your income this week"
            )
        if spent_delta_pct is not None and spent_delta_pct < -10:
            wins.append(
                f"Spending dropped {abs(spent_delta_pct):.0f}% versus last week"
            )
        if behavior_insights["impulseCount"] == 0 and behavior_insights["lateNightCount"] == 0:
            wins.append("No impulse or late-night purchases this week")

        if behavior_insights["impulseAmount"] > 0:
            improvements.append(
                f"You spent ₹{behavior_insights['impulseAmount']:.0f} on "
                f"{behavior_insights['impulseCount']} impulse purchase(s)"
            )
        if savings_rate < 0.10 and total_income > 0:
            improvements.append(
                "Savings rate is below 10%. Try cutting one discretionary category"
            )
        if spent_delta_pct is not None and spent_delta_pct > 20:
            improvements.append(
                f"Spending climbed {spent_delta_pct:.0f}% versus last week"
            )

        # Build recommendations using existing service
        try:
            recs = insights_generator.generate_recommendations(
                request.user_id, txns, "week"
            )
        except Exception as e:
            logger.warning(f"Could not generate recommendations: {e}")
            recs = []

        # AI narrative (LLM if configured, fallback otherwise)
        try:
            ai_summary = llm_integration.generate_financial_summary(
                request.user_id, txns, "week"
            )
        except Exception as e:
            logger.warning(f"AI summary failed, using fallback: {e}")
            ai_summary = _local_summary_fallback(
                total_spent, total_income, savings_rate, top_categories
            )

        return ApiResponse(
            success=True,
            data={
                "weekStart": request.week_start.isoformat(),
                "weekEnd": request.week_end.isoformat(),
                "stats": {
                    "totalSpent": round(total_spent, 2),
                    "totalIncome": round(total_income, 2),
                    "savingsAmount": round(savings, 2),
                    "savingsRate": round(savings_rate, 4),
                    "transactionCount": len(txns),
                    "previousWeek": {
                        "totalSpent": round(prev_spent, 2),
                        "totalIncome": round(prev_income, 2),
                        "spentDeltaPercent": (
                            round(spent_delta_pct, 2) if spent_delta_pct is not None else None
                        ),
                        "incomeDeltaPercent": (
                            round(income_delta_pct, 2) if income_delta_pct is not None else None
                        ),
                    },
                },
                "topCategories": top_categories,
                "topMerchants": top_merchants,
                "behaviorInsights": behavior_insights,
                "unusualSpending": unusual,
                "winsAndImprovements": {
                    "wins": wins,
                    "improvements": improvements,
                },
                "aiSummary": ai_summary,
                "recommendations": recs,
            },
        )
    except Exception as e:
        logger.error(f"Error generating weekly summary: {str(e)}")
        raise HTTPException(
            status_code=400, detail=f"Failed to generate weekly summary: {str(e)}"
        )


def _local_summary_fallback(
    total_spent: float,
    total_income: float,
    savings_rate: float,
    top_categories: List[Dict[str, Any]],
) -> str:
    """Deterministic, LLM-free narrative used when no API key is configured."""
    rate_pct = round(savings_rate * 100)
    top_cat = top_categories[0]["name"] if top_categories else "general spending"
    if savings_rate >= 0.20:
        sentiment = "Strong week — you saved a healthy chunk."
    elif savings_rate >= 0.10:
        sentiment = "Decent week — savings are positive but there's room to grow."
    elif savings_rate >= 0:
        sentiment = "Tight week — most of your income went out the door."
    else:
        sentiment = "Heads up — you spent more than you earned this week."
    return (
        f"This week you spent ₹{total_spent:,.0f} and earned ₹{total_income:,.0f}, "
        f"saving {rate_pct}% of income. Most went toward {top_cat}. {sentiment}"
    )


@app.post("/api/v1/insights/anomalies")
async def detect_anomalies(request: InsightsRequest):
    """
    Detect anomalies in spending patterns

    Args:
        request: InsightsRequest

    Returns:
        List of detected anomalies
    """
    try:
        anomalies = insights_generator.detect_anomalies(
            request.user_id,
            request.transactions,
            request.period
        )

        return ApiResponse(
            success=True,
            data={"anomalies": anomalies}
        )
    except Exception as e:
        logger.error(f"Error detecting anomalies: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to detect anomalies: {str(e)}")


# ==================== PREDICTION ENDPOINTS ====================

@app.post("/api/v1/predict", response_model=Dict[str, Any])
async def predict_spending(request: PredictionRequest):
    """
    Predict future spending using ML models

    Args:
        request: PredictionRequest with historical data

    Returns:
        Spending predictions
    """
    try:
        predictions = insights_generator.generate_predictions(
            request.user_id,
            request.period,
            request.historical_data
        )

        return ApiResponse(
            success=True,
            data=predictions
        )
    except Exception as e:
        logger.error(f"Error generating predictions: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to generate predictions: {str(e)}")


# ==================== LLM-POWERED ENDPOINTS ====================

@app.post("/api/v1/insights/ai-summary")
async def generate_ai_summary(request: InsightsRequest):
    """
    Generate AI-powered natural language summary of finances

    Args:
        request: InsightsRequest

    Returns:
        Natural language summary
    """
    try:
        summary = llm_integration.generate_financial_summary(
            request.user_id,
            request.transactions,
            request.period
        )

        return ApiResponse(
            success=True,
            data={"summary": summary}
        )
    except Exception as e:
        logger.error(f"Error generating AI summary: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to generate summary: {str(e)}")


@app.post("/api/v1/insights/ai-advice")
async def get_ai_financial_advice(request: Dict[str, Any]):
    """
    Get personalized financial advice from LLM

    Args:
        user_id: User identifier
        spending_data: Spending breakdown
        goals: Financial goals

    Returns:
        Personalized financial advice
    """
    try:
        user_id = request.get("user_id")
        spending_data = request.get("spending_data", {})
        goals = request.get("goals", [])

        advice = llm_integration.generate_financial_advice(
            user_id,
            spending_data,
            goals
        )

        return ApiResponse(
            success=True,
            data={"advice": advice}
        )
    except Exception as e:
        logger.error(f"Error generating AI advice: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to generate advice: {str(e)}")


# ==================== UTILITY ENDPOINTS ====================

@app.post("/api/v1/categorize")
async def categorize_transactions(request: Dict[str, Any]):
    """
    Categorize multiple transactions

    Args:
        transactions: List of transactions to categorize

    Returns:
        Transactions with predicted categories
    """
    try:
        transactions = request.get("transactions", [])
        categorized = sms_parser.categorize_batch(transactions)

        return ApiResponse(
            success=True,
            data={"transactions": categorized}
        )
    except Exception as e:
        logger.error(f"Error categorizing transactions: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to categorize: {str(e)}")


@app.get("/api/v1/categories")
async def get_categories():
    """
    Get all available transaction categories

    Returns:
        List of categories with descriptions
    """
    return ApiResponse(
        success=True,
        data={"categories": sms_parser.get_all_categories()}
    )


# ==================== BEHAVIORAL ANALYSIS ENDPOINTS ====================

@app.post("/api/v1/behavior/analyze")
async def analyze_behavior(request: Dict[str, Any]):
    """
    Analyze spending behavior patterns

    Args:
        user_id: User identifier
        transactions: List of transactions
        period_days: Analysis period (default 30)

    Returns:
        Behavioral analysis with patterns and insights
    """
    try:
        user_id = request.get("user_id")
        transactions = request.get("transactions", [])
        period_days = request.get("period_days", 30)

        analysis = behavioral_analyzer.analyze_patterns(
            user_id,
            transactions,
            period_days
        )

        return ApiResponse(
            success=True,
            data=analysis
        )
    except Exception as e:
        logger.error(f"Error analyzing behavior: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to analyze behavior: {str(e)}")


@app.post("/api/v1/behavior/tag-transactions")
async def tag_transactions_behavior(request: Dict[str, Any]):
    """
    Tag transactions with behavioral flags

    Args:
        transactions: List of transactions to tag

    Returns:
        Transactions with behavioral tags added
    """
    try:
        transactions = request.get("transactions", [])
        tagged = behavioral_analyzer.tag_transactions(transactions)

        return ApiResponse(
            success=True,
            data={"transactions": tagged}
        )
    except Exception as e:
        logger.error(f"Error tagging transactions: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to tag transactions: {str(e)}")


# ==================== FINANCIAL HEALTH ENDPOINTS ====================

@app.post("/api/v1/health-score/calculate")
async def calculate_health_score(request: Dict[str, Any]):
    """
    Calculate comprehensive financial health score

    Args:
        user_id: User identifier
        transactions: List of transactions
        budgets: List of budgets (optional)
        subscriptions: List of subscriptions (optional)
        goals: List of goals (optional)
        period_days: Analysis period (default 30)

    Returns:
        Financial health score with component breakdown
    """
    try:
        user_id = request.get("user_id")
        transactions = request.get("transactions", [])
        budgets = request.get("budgets", [])
        subscriptions = request.get("subscriptions", [])
        goals = request.get("goals", [])
        period_days = request.get("period_days", 30)

        health_score = health_score_service.calculate_health_score(
            user_id,
            transactions,
            budgets,
            subscriptions,
            goals,
            period_days
        )

        return ApiResponse(
            success=True,
            data=health_score
        )
    except Exception as e:
        logger.error(f"Error calculating health score: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to calculate health score: {str(e)}")


# ==================== LEAK DETECTION ENDPOINTS ====================

@app.post("/api/v1/leaks/detect")
async def detect_money_leaks(request: Dict[str, Any]):
    """
    Detect money leaks in user spending

    Args:
        user_id: User identifier
        transactions: List of transactions
        subscriptions: List of subscriptions (optional)
        period_days: Analysis period (default 30)

    Returns:
        Leak detection results with potential savings
    """
    try:
        user_id = request.get("user_id")
        transactions = request.get("transactions", [])
        subscriptions = request.get("subscriptions", [])
        period_days = request.get("period_days", 30)

        leaks = leak_detector.detect_leaks(
            user_id,
            transactions,
            subscriptions,
            period_days
        )

        return ApiResponse(
            success=True,
            data=leaks
        )
    except Exception as e:
        logger.error(f"Error detecting leaks: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to detect leaks: {str(e)}")


# ==================== AI ASSISTANT ENDPOINTS ====================

class AIQueryRequest(BaseModel):
    user_id: str
    query: str
    context: Dict[str, Any] = {}


@app.post("/api/v1/assistant/query")
async def process_ai_query(request: AIQueryRequest):
    """
    Process natural language financial query

    Args:
        user_id: User identifier
        query: Natural language query
        context: Context data (transactions, budgets, etc.)

    Returns:
        Response with answer and supporting data
    """
    try:
        response = ai_assistant.process_query(
            request.user_id,
            request.query,
            request.context
        )

        return ApiResponse(
            success=True,
            data=response
        )
    except Exception as e:
        logger.error(f"Error processing AI query: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to process query: {str(e)}")


# ==================== USER PROFILING ENDPOINTS ====================

@app.post("/api/v1/profile/archetype")
async def determine_user_archetype(request: Dict[str, Any]):
    """
    Determine user's financial archetype

    Args:
        user_id: User identifier
        transactions: List of transactions
        subscriptions: List of subscriptions (optional)

    Returns:
        Archetype determination with dashboard priorities
    """
    try:
        user_id = request.get("user_id")
        transactions = request.get("transactions", [])
        subscriptions = request.get("subscriptions", [])

        profile = user_profiler.determine_archetype(
            user_id,
            transactions,
            subscriptions
        )

        return ApiResponse(
            success=True,
            data=profile
        )
    except Exception as e:
        logger.error(f"Error determining archetype: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to determine archetype: {str(e)}")


# ==================== ACTION CARDS ENDPOINTS ====================

@app.post("/api/v1/action-cards/generate")
async def generate_action_cards(request: Dict[str, Any]):
    """
    Generate personalized action cards

    Args:
        user_id: User identifier
        context: Context data (transactions, subscriptions, leaks, etc.)

    Returns:
        List of personalized action cards
    """
    try:
        user_id = request.get("user_id")
        context = request.get("context", {})

        cards = action_card_generator.generate_action_cards(
            user_id,
            context
        )

        return ApiResponse(
            success=True,
            data={
                "cards": cards,
                "count": len(cards)
            }
        )
    except Exception as e:
        logger.error(f"Error generating action cards: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to generate action cards: {str(e)}")


# ==================== COMPREHENSIVE DASHBOARD ENDPOINT ====================

@app.post("/api/v1/dashboard/personalized")
async def get_personalized_dashboard(request: Dict[str, Any]):
    """
    Get personalized dashboard data based on user archetype

    Args:
        user_id: User identifier
        transactions: List of transactions
        subscriptions: List of subscriptions (optional)
        budgets: List of budgets (optional)
        goals: List of goals (optional)

    Returns:
        Personalized dashboard data with prioritized widgets
    """
    try:
        user_id = request.get("user_id")
        transactions = request.get("transactions", [])
        subscriptions = request.get("subscriptions", [])
        budgets = request.get("budgets", [])
        goals = request.get("goals", [])

        # Determine archetype
        profile = user_profiler.determine_archetype(
            user_id,
            transactions,
            subscriptions
        )

        # Get dashboard priorities
        dashboard_priority = profile.get("dashboard_priority", [])

        # Calculate key metrics
        health_score = health_score_service.calculate_health_score(
            user_id,
            transactions,
            budgets,
            subscriptions,
            goals
        )

        # Detect leaks
        leaks = leak_detector.detect_leaks(
            user_id,
            transactions,
            subscriptions
        )

        # Analyze behavior
        behavior = behavioral_analyzer.analyze_patterns(
            user_id,
            transactions
        )

        # Generate action cards
        action_cards = action_card_generator.generate_action_cards(
            user_id,
            {
                "transactions": transactions,
                "subscriptions": subscriptions,
                "budgets": budgets,
                "goals": goals,
                "leak_analysis": leaks,
                "health_score": health_score,
                "archetype": profile,
            }
        )

        # Generate insights
        insights = insights_generator.generate_spending_insights(
            user_id,
            transactions
        )

        return ApiResponse(
            success=True,
            data={
                "archetype": profile.get("archetype"),
                "dashboard_priority": dashboard_priority,
                "health_score": health_score,
                "leak_score": leaks.get("leak_score"),
                "behavioral_score": behavior.get("behavioral_score"),
                "action_cards": action_cards,
                "insights": insights,
                "leaks": {
                    "total": leaks.get("total_leak_amount"),
                    "potential_savings": leaks.get("potential_monthly_savings"),
                    "count": leaks.get("leaks_found"),
                },
            }
        )
    except Exception as e:
        logger.error(f"Error generating dashboard: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to generate dashboard: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
