"""
SMS Parser Service
Extracts transaction details from SMS messages using regex patterns and NLP
"""

import re
from datetime import datetime
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)


class SmsParserService:
    """Service for parsing bank SMS messages"""

    # Bank sender patterns
    BANK_PATTERNS = {
        "HDFC": {
            "senders": ["HD-BANK", "HDFCBK", "HDFC"],
            "amount_pattern": r"(?:INR|₹|Rs\.?)\s*([\d,]+\.?\d*)",
            "merchant_pattern": r"(?:at|to|from)\s+([A-Za-z0-9\s&.,-]+)",
        },
        "ICICI": {
            "senders": ["ICICIB", "ICICI"],
            "amount_pattern": r"(?:INR|₹|Rs\.?)\s*([\d,]+\.?\d*)",
            "merchant_pattern": r"(?:at|to)\s+([A-Za-z0-9\s&.,-]+)",
        },
        "SBI": {
            "senders": ["SBIBNK", "SBI"],
            "amount_pattern": r"(?:INR|₹|Rs\.?)\s*([\d,]+\.?\d*)",
            "merchant_pattern": r"(?:at|to)\s+([A-Za-z0-9\s&.,-]+)",
        },
        "AXIS": {
            "senders": ["AXISBK", "AXIS"],
            "amount_pattern": r"(?:INR|₹|Rs\.?)\s*([\d,]+\.?\d*)",
            "merchant_pattern": r"(?:at|to)\s+([A-Za-z0-9\s&.,-]+)",
        },
    }

    # Transaction type keywords
    CREDIT_KEYWORDS = [
        "credited", "credited to", "received", "inflow",
        "refund", "cashback", "reward", "added"
    ]

    DEBIT_KEYWORDS = [
        "debited", "debited from", "paid", "purchase",
        "spent", "outflow", "charged"
    ]

    # Category mappings
    CATEGORY_KEYWORDS = {
        "FOOD_DINING": [
            "restaurant", "food", "dining", "cafe", "coffee",
            "pizza", "burger", "kitchen", "zomato", "swiggy"
        ],
        "SHOPPING": [
            "amazon", "flipkart", "myntra", "shopping",
            "store", "mart", "retail", "ajio"
        ],
        "TRANSPORT": [
            "uber", "ola", "taxi", "fuel", "petrol",
            "parking", "metro", "bus", "rapido"
        ],
        "ENTERTAINMENT": [
            "netflix", "spotify", "cinema", "movie",
            "theatre", "game", "entertainment", "hotstar"
        ],
        "BILLS_UTILITIES": [
            "electricity", "water", "gas", "internet",
            "phone", "bill", "utility", "jio", "airtel"
        ],
        "HEALTHCARE": [
            "pharmacy", "medical", "hospital", "clinic",
            "doctor", "health", "medicine", "apollo"
        ],
        "SUBSCRIPTION": [
            "subscription", "auto-pay", "autopay",
            "recurring", "monthly", "yearly", "annual"
        ],
        "ATM": ["atm", "cash withdrawal", "cash deposited"],
        "TRANSFER": ["transfer", "upi", "imps", "neft", "rtgs", "sent to", "received from"],
    }

    def __init__(self):
        self.category_list = list(self.CATEGORY_KEYWORDS.keys())

    def parse_sms(self, body: str, sender: str, timestamp: datetime) -> Dict[str, Any]:
        """
        Parse SMS message and extract transaction details

        Args:
            body: SMS message body
            sender: SMS sender ID
            timestamp: Message timestamp

        Returns:
            Parsed transaction data
        """
        parsed = {
            "raw_sms": body,
            "sender": sender,
            "timestamp": timestamp.isoformat(),
            "amount": None,
            "merchant": None,
            "transaction_type": None,
            "category": "OTHER",
            "account_last_4": None,
            "balance": None,
            "confidence": 0.0,
        }

        # Identify bank
        bank = self._identify_bank(sender)
        if bank:
            logger.debug(f"Identified bank: {bank}")
            parsed["bank"] = bank

        # Extract amount
        amount = self._extract_amount(body)
        if amount:
            parsed["amount"] = amount
            parsed["confidence"] += 0.3

        # Determine transaction type
        tx_type = self._determine_transaction_type(body)
        if tx_type:
            parsed["transaction_type"] = tx_type
            parsed["confidence"] += 0.2

        # Extract merchant
        merchant = self._extract_merchant(body)
        if merchant:
            parsed["merchant"] = merchant
            parsed["confidence"] += 0.1

        # Categorize transaction
        category = self._categorize_transaction(body, merchant)
        parsed["category"] = category

        # Extract balance if available
        balance = self._extract_balance(body)
        if balance:
            parsed["balance"] = balance
            parsed["confidence"] += 0.1

        # Extract account last 4 digits
        account = self._extract_account_number(body)
        if account:
            parsed["account_last_4"] = account
            parsed["confidence"] += 0.1

        # Boost confidence for complete data
        if parsed["amount"] and parsed["transaction_type"]:
            parsed["confidence"] = min(parsed["confidence"] + 0.2, 1.0)

        return parsed

    def _identify_bank(self, sender: str) -> Optional[str]:
        """Identify bank from sender ID"""
        normalized = sender.upper().strip()
        for bank, config in self.BANK_PATTERNS.items():
            if normalized in config["senders"]:
                return bank
        return None

    def _extract_amount(self, body: str) -> Optional[float]:
        """Extract amount from SMS body"""
        # Try various amount patterns
        patterns = [
            r"(?:INR|₹|Rs\.?)\s*([\d,]+\.?\d*)",
            r"(?:debited|credited)[^\d]*([\d,]+\.?\d*)",
            r"Rs\.?\s*([\d,]+\.?\d*)",
            r"([\d,]+\.?\d*)\s*(?:only)",
        ]

        for pattern in patterns:
            match = re.search(pattern, body, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(",", "")
                try:
                    return float(amount_str)
                except ValueError:
                    continue

        return None

    def _determine_transaction_type(self, body: str) -> Optional[str]:
        """Determine if transaction is credit or debit"""
        lower_body = body.lower()

        for keyword in self.CREDIT_KEYWORDS:
            if keyword in lower_body:
                return "CREDIT"

        for keyword in self.DEBIT_KEYWORDS:
            if keyword in lower_body:
                return "DEBIT"

        return None

    def _extract_merchant(self, body: str) -> Optional[str]:
        """Extract merchant name from SMS"""
        patterns = [
            r"(?:at|to|from)\s+([A-Za-z0-9\s&.,-]+)",
            r"(?:merchant|store)[:\s]+([A-Za-z0-9\s&.,-]+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, body, re.IGNORECASE)
            if match:
                return match.group(1).strip()

        return None

    def _categorize_transaction(self, body: str, merchant: Optional[str] = None) -> str:
        """Categorize transaction based on keywords"""
        lower_body = body.lower()
        lower_merchant = (merchant or "").lower()

        for category, keywords in self.CATEGORY_KEYWORDS.items():
            for keyword in keywords:
                if keyword in lower_body or keyword in lower_merchant:
                    return category

        return "OTHER"

    def _extract_balance(self, body: str) -> Optional[float]:
        """Extract available balance from SMS"""
        patterns = [
            r"(?:balance|avail)[^\d]*([\d,]+\.?\d*)",
            r"(?:closing|opening)\s+balance[:\s]*([\d,]+\.?\d*)",
        ]

        for pattern in patterns:
            match = re.search(pattern, body, re.IGNORECASE)
            if match:
                try:
                    return float(match.group(1).replace(",", ""))
                except ValueError:
                    continue

        return None

    def _extract_account_number(self, body: str) -> Optional[str]:
        """Extract last 4 digits of account/card"""
        patterns = [
            r"(?:ending|card)[^\d]*(\d{4})",
            r"X{4}(\d{4})",
            r"\*{4}(\d{4})",
        ]

        for pattern in patterns:
            match = re.search(pattern, body, re.IGNORECASE)
            if match:
                return match.group(1)

        return None

    def classify_transaction(self, body: str) -> Dict[str, Any]:
        """
        Classify transaction type and category

        Args:
            body: SMS message body

        Returns:
            Classification with type and category
        """
        tx_type = self._determine_transaction_type(body)
        merchant = self._extract_merchant(body)
        category = self._categorize_transaction(body, merchant)
        amount = self._extract_amount(body)

        return {
            "transaction_type": tx_type,
            "category": category,
            "merchant": merchant,
            "amount": amount,
            "confidence": 0.8 if tx_type and category else 0.5,
        }

    def categorize_batch(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Categorize multiple transactions

        Args:
            transactions: List of transactions with description/merchant

        Returns:
            Transactions with added categories
        """
        categorized = []

        for tx in transactions:
            description = tx.get("description", "") or ""
            merchant = tx.get("merchant", "") or ""

            category = self._categorize_transaction(description, merchant)

            categorized.append({
                **tx,
                "category": category,
            })

        return categorized

    def get_all_categories(self) -> List[Dict[str, str]]:
        """Get all available categories with descriptions"""
        descriptions = {
            "FOOD_DINING": "Restaurants, food delivery, cafes",
            "SHOPPING": "Retail purchases, online shopping",
            "TRANSPORT": "Taxi, fuel, public transport",
            "ENTERTAINMENT": "Movies, streaming, gaming",
            "BILLS_UTILITIES": "Electricity, water, internet, phone bills",
            "HEALTHCARE": "Medical, pharmacy, hospital",
            "SUBSCRIPTION": "Recurring payments, memberships",
            "ATM": "Cash withdrawals and deposits",
            "TRANSFER": "UPI, IMPS, NEFT transfers",
            "INCOME": "Salary, refunds, cashback",
            "OTHER": "Uncategorized transactions",
        }

        return [
            {"key": cat, "name": cat.replace("_", " ").title(), "description": descriptions.get(cat, "")}
            for cat in self.category_list + ["INCOME", "OTHER"]
        ]
