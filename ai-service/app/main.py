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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
