"""
Unit tests for SMS Parser Service
"""

import pytest
from datetime import datetime
from app.services.sms_parser import SmsParserService


@pytest.fixture
def parser():
    return SmsParserService()


class TestSmsParserService:
    def test_parse_sms_debit(self, parser):
        """Test parsing a debit SMS"""
        body = "Your account has been debited INR 500 at Amazon; Ref: 12345"
        result = parser.parse_sms(body, "HD-BANK", datetime(2024, 1, 15, 10, 30, 0))

        assert result["amount"] == 500.0
        assert result["transaction_type"] == "DEBIT"
        assert result["merchant"] == "Amazon"
        assert result["category"] == "SHOPPING"
        assert result["bank"] == "HDFC"
        assert result["confidence"] >= 0.5

    def test_parse_sms_credit(self, parser):
        """Test parsing a credit SMS"""
        body = "INR 1,000 has been credited to your account from Employer Pvt Ltd."
        result = parser.parse_sms(body, "ICICIB", datetime(2024, 1, 15, 10, 30, 0))

        assert result["amount"] == 1000.0
        assert result["transaction_type"] == "CREDIT"
        assert result["category"] == "OTHER"
        assert result["bank"] == "ICICI"

    def test_parse_sms_with_merchant(self, parser):
        """Test extracting merchant from SMS"""
        body = "Transaction of INR 200 at Zomato"
        result = parser.parse_sms(body, "HDFCBK", datetime.now())

        assert result["amount"] == 200.0
        assert result["merchant"] == "Zomato"
        assert result["category"] == "FOOD_DINING"

    def test_parse_sms_food_category(self, parser):
        """Test categorizing food transactions"""
        body = "Rs. 350 debited at Starbucks Coffee"
        result = parser.parse_sms(body, "SBIBNK", datetime.now())

        assert result["amount"] == 350.0
        assert result["category"] == "FOOD_DINING"

    def test_parse_sms_subscription_category(self, parser):
        """Test categorizing subscription transactions"""
        body = "Monthly subscription of INR 199 charged by AWS"
        result = parser.parse_sms(body, "AXISBK", datetime.now())

        assert result["amount"] == 199.0
        assert result["category"] == "SUBSCRIPTION"

    def test_parse_sms_transport_category(self, parser):
        """Test categorizing transport transactions"""
        body = "INR 150 paid to Uber for ride"
        result = parser.parse_sms(body, "HD-BANK", datetime.now())

        assert result["amount"] == 150.0
        assert result["category"] == "TRANSPORT"

    def test_parse_sms_transfer_category(self, parser):
        """Test categorizing transfer transactions"""
        body = "UPI transfer of INR 500 to John Doe completed"
        result = parser.parse_sms(body, "HDFCBK", datetime.now())

        assert result["amount"] == 500.0
        assert result["category"] == "TRANSFER"

    def test_parse_sms_atm_category(self, parser):
        """Test categorizing ATM transactions"""
        body = "INR 2000 cash withdrawal from ATM"
        result = parser.parse_sms(body, "ICICIB", datetime.now())

        assert result["amount"] == 2000.0
        assert result["category"] == "ATM"

    def test_parse_sms_utility_category(self, parser):
        """Test categorizing utility transactions"""
        body = "Electricity bill payment of INR 1200 successful"
        result = parser.parse_sms(body, "SBIBNK", datetime.now())

        assert result["amount"] == 1200.0
        assert result["category"] == "BILLS_UTILITIES"

    def test_parse_sms_healthcare_category(self, parser):
        """Test categorizing healthcare transactions"""
        body = "INR 500 paid at Apollo Pharmacy"
        result = parser.parse_sms(body, "AXISBK", datetime.now())

        assert result["amount"] == 500.0
        assert result["category"] == "HEALTHCARE"

    def test_parse_sms_entertainment_category(self, parser):
        """Test categorizing entertainment transactions"""
        body = "Rs. 299 charged by Hotstar for subscription"
        result = parser.parse_sms(body, "HD-BANK", datetime.now())

        assert result["amount"] == 299.0
        assert result["category"] == "ENTERTAINMENT"

    def test_parse_sms_extract_account_number(self, parser):
        """Test extracting account last 4 digits"""
        body = "Transaction on card ending 4242 for INR 1000"
        result = parser.parse_sms(body, "HDFCBK", datetime.now())

        assert result["account_last_4"] == "4242"

    def test_parse_sms_no_amount(self, parser):
        """Test parsing SMS without amount"""
        body = "Your OTP is 123456. Do not share it with anyone."
        result = parser.parse_sms(body, "HD-BANK", datetime.now())

        assert result["amount"] is None
        assert result["transaction_type"] is None
        assert result["confidence"] == 0.0

    def test_parse_sms_unknown_sender(self, parser):
        """Test parsing SMS from unknown sender"""
        body = "INR 500 debited at Amazon"
        result = parser.parse_sms(body, "UNKNOWN", datetime.now())

        assert result["amount"] == 500.0
        assert "bank" not in result or result.get("bank") is None

    def test_parse_sms_with_comma_amount(self, parser):
        """Test parsing amount with comma separators"""
        body = "Your account has been debited INR 1,23,456.78 at Store"
        result = parser.parse_sms(body, "HDFCBK", datetime.now())

        assert result["amount"] == 123456.78

    def test_identify_bank(self, parser):
        """Test bank identification"""
        assert parser._identify_bank("HD-BANK") == "HDFC"
        assert parser._identify_bank("HDFCBK") == "HDFC"
        assert parser._identify_bank("ICICIB") == "ICICI"
        assert parser._identify_bank("SBIBNK") == "SBI"
        assert parser._identify_bank("AXISBK") == "AXIS"
        assert parser._identify_bank("UNKNOWN") is None

    def test_extract_amount_various_formats(self, parser):
        """Test amount extraction with different formats"""
        assert parser._extract_amount("INR 500") == 500.0
        assert parser._extract_amount("Rs. 1,000") == 1000.0
        assert parser._extract_amount("₹ 2500") == 2500.0
        assert parser._extract_amount("debited 500 from account") == 500.0
        assert parser._extract_amount("500 only") == 500.0
        assert parser._extract_amount("no amount here") is None

    def test_determine_transaction_type(self, parser):
        """Test transaction type determination"""
        assert parser._determine_transaction_type("amount credited") == "CREDIT"
        assert parser._determine_transaction_type("amount debited") == "DEBIT"
        assert parser._determine_transaction_type("received payment") == "CREDIT"
        assert parser._determine_transaction_type("paid for purchase") == "DEBIT"
        assert parser._determine_transaction_type("random text") is None

    def test_extract_merchant(self, parser):
        """Test merchant extraction"""
        assert parser._extract_merchant("at Amazon") == "Amazon"
        assert parser._extract_merchant("to Flipkart") == "Flipkart"
        assert parser._extract_merchant("from Employer") == "Employer"
        assert parser._extract_merchant("just a simple text") is None

    def test_categorize_transaction(self, parser):
        """Test transaction categorization"""
        assert parser._categorize_transaction("paid at restaurant") == "FOOD_DINING"
        assert parser._categorize_transaction("", "zomato") == "FOOD_DINING"
        assert parser._categorize_transaction("shopping at amazon") == "SHOPPING"
        assert parser._categorize_transaction("uber ride") == "TRANSPORT"
        assert parser._categorize_transaction("netflix streaming") == "ENTERTAINMENT"
        assert parser._categorize_transaction("electricity bill") == "BILLS_UTILITIES"
        assert parser._categorize_transaction("random purchase") == "OTHER"

    def test_extract_balance(self, parser):
        """Test balance extraction"""
        assert parser._extract_balance("Available balance is 5000") == 5000.0
        assert parser._extract_balance("Closing balance: 1,23,456.78") == 123456.78
        assert parser._extract_balance("no balance info") is None

    def test_extract_account_number(self, parser):
        """Test account number extraction"""
        assert parser._extract_account_number("card ending 4242") == "4242"
        assert parser._extract_account_number("XXXX4242") == "4242"
        assert parser._extract_account_number("****4242") == "4242"
        assert parser._extract_account_number("no account info") is None

    def test_classify_transaction(self, parser):
        """Test transaction classification"""
        result = parser.classify_transaction("INR 500 debited at Amazon")

        assert result["transaction_type"] == "DEBIT"
        assert result["category"] == "SHOPPING"
        assert result["amount"] == 500.0
        assert result["confidence"] == 0.8

    def test_categorize_batch(self, parser):
        """Test batch categorization"""
        transactions = [
            {"description": "paid at restaurant", "merchant": "Zomato"},
            {"description": "shopping", "merchant": "Amazon"},
            {"description": "random", "merchant": ""},
        ]
        result = parser.categorize_batch(transactions)

        assert len(result) == 3
        assert result[0]["category"] == "FOOD_DINING"
        assert result[1]["category"] == "SHOPPING"
        assert result[2]["category"] == "OTHER"

    def test_get_all_categories(self, parser):
        """Test getting all categories"""
        categories = parser.get_all_categories()

        assert len(categories) > 0
        assert all("key" in cat and "name" in cat and "description" in cat for cat in categories)

    def test_parse_sms_confidence_high(self, parser):
        """Test high confidence parsing"""
        body = "Your account has been debited INR 500 at Amazon. Available balance: INR 9500. Card ending 4242"
        result = parser.parse_sms(body, "HD-BANK", datetime.now())

        assert result["confidence"] >= 0.8

    def test_parse_sms_confidence_low(self, parser):
        """Test low confidence parsing"""
        body = "INR 500"
        result = parser.parse_sms(body, "HD-BANK", datetime.now())

        assert result["confidence"] < 0.5
