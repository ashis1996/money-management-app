# SMS Parsing Guide

## Overview

MoneyMind extracts transaction data from bank SMS notifications. This document explains the parsing architecture and how to add support for new banks.

## Supported Banks

Currently supported banks (Indian):

- HDFC Bank
- ICICI Bank
- SBI (State Bank of India)
- Axis Bank

## SMS Format Examples

### HDFC Bank
```
Dear Customer, Rs. 500.00 debited from your account ending 1234 at MERCHANT ABC on 01/01/24 at 19:30. Available balance: Rs. 10,000.00
```

### ICICI Bank
```
INR 500.00 debited from A/C XX1234 on 01-Jan-24 via UPI to MERCHANT ABC. Balance: INR 10,000.00
```

### SBI
```
Dear Customer, INR 500 debited from your A/c XXXX1234 at MERCHANT ABC on 01JAN24. Balance INR 10000. For disputes call 18004253800
```

### Axis Bank
```
Rs.500.00 debited from Axis Bank A/c ending 1234 on 01/01/2024. Merchant: MERCHANT ABC. Balance: Rs.10,000.00
```

## Parsing Architecture

### Backend (Rule-Based)

The backend uses regex patterns for quick parsing:

```python
# Amount patterns
r"(?:INR|₹|Rs\.?)\s*([\d,]+\.?\d*)"
r"(?:debited|credited)[^\d]*([\d,]+\.?\d*)"

# Merchant patterns
r"(?:at|to|from)\s+([A-Za-z0-9\s&.,-]+)"

# Transaction type keywords
CREDIT: ["credited", "received", "inflow", "refund"]
DEBIT: ["debited", "paid", "purchase", "spent"]
```

### AI Service (ML-Based)

The AI service provides more accurate parsing:

1. **Bank Identification** - Identify bank from sender ID
2. **Amount Extraction** - Extract transaction amount
3. **Type Classification** - Credit or debit
4. **Merchant Extraction** - Extract merchant name
5. **Category Prediction** - Classify transaction category
6. **Balance Extraction** - Extract available balance

## Adding a New Bank

### Step 1: Add Bank Patterns

In `shared/src/constants/sms.constants.ts`:

```typescript
export const SMS_PATTERNS = {
  NEW_BANK: {
    senderPatterns: ['NEWBANK', 'NEWBK'],
    transactionPattern: /(?:INR|₹|Rs\.?)\s*([\d,]+\.?\d*)/i,
    merchantPattern: /(?:at|to)\s+([A-Za-z0-9\s&.,-]+)/i,
  },
  // ... other banks
};
```

### Step 2: Add Sender Mapping

```typescript
export const BANK_SENDER_MAPPING = {
  'NEWBANK': 'NEW_BANK',
  'NEWBK': 'NEW_BANK',
  // ... other mappings
};
```

### Step 3: Add AI Service Patterns

In `ai-service/app/services/sms_parser.py`:

```python
BANK_PATTERNS = {
    "NEW_BANK": {
        "senders": ["NEWBANK", "NEWBK"],
        "amount_pattern": r"(?:INR|₹|Rs\.?)\s*([\d,]+\.?\d*)",
        "merchant_pattern": r"(?:at|to)\s+([A-Za-z0-9\s&.,-]+)",
    },
    # ... other banks
}
```

### Step 4: Test

Add test cases in both backend and AI service test files.

## Category Mapping

Transactions are categorized based on merchant names and keywords:

| Category | Keywords |
|----------|----------|
| FOOD_DINING | restaurant, food, dining, cafe, zomato, swiggy |
| SHOPPING | amazon, flipkart, myntra, shopping, store |
| TRANSPORT | uber, ola, taxi, fuel, petrol, metro |
| ENTERTAINMENT | netflix, spotify, cinema, movie, hotstar |
| BILLS_UTILITIES | electricity, water, internet, phone, bill |
| HEALTHCARE | pharmacy, medical, hospital, doctor |
| SUBSCRIPTION | subscription, auto-pay, recurring |
| ATM | atm, cash withdrawal |
| TRANSFER | upi, imps, neft, rtgs, transfer |

## Confidence Scoring

The parser assigns confidence scores:

| Factor | Score |
|--------|-------|
| Amount extracted | +0.3 |
| Transaction type identified | +0.2 |
| Merchant extracted | +0.1 |
| Balance extracted | +0.1 |
| Account number extracted | +0.1 |
| Complete data (amount + type) | +0.2 |

**Confidence Levels:**
- 0.8-1.0: High confidence (auto-categorize)
- 0.5-0.8: Medium confidence (review suggested)
- <0.5: Low confidence (manual review required)

## Error Handling

### Common Issues

1. **Amount not detected**
   - Check if amount format matches pattern
   - Verify currency symbols (₹, Rs, INR)

2. **Wrong transaction type**
   - Add new keywords to CREDIT_KEYWORDS/DEBIT_KEYWORDS
   - Check for negation words ("not debited")

3. **Merchant not extracted**
   - Merchant name format may vary
   - Add new patterns to merchant_pattern

4. **Wrong category**
   - Add merchant name to CATEGORY_KEYWORDS
   - Improve ML model training data

## Testing

### Unit Tests

```python
def test_hdfc_sms_parsing():
    body = "Dear Customer, Rs. 500.00 debited from your account ending 1234 at MERCHANT ABC"
    sender = "HD-BANK"
    timestamp = datetime.now()

    parsed = sms_parser.parse_sms(body, sender, timestamp)

    assert parsed["amount"] == 500.00
    assert parsed["transaction_type"] == "DEBIT"
    assert parsed["merchant"] == "MERCHANT ABC"
    assert parsed["category"] == "SHOPPING"
```

### Integration Tests

Send real SMS messages to test end-to-end flow:
1. Mobile app receives SMS
2. POST to /sms/ingest
3. Verify transaction created
4. Verify category assigned

## Performance

- Backend parsing: <10ms per SMS
- AI service parsing: <100ms per SMS
- Batch processing: 100 SMS in <5 seconds

## Future Enhancements

1. **ML Model Training**
   - Train on real SMS dataset
   - Improve merchant recognition
   - Handle multiple languages

2. **Pattern Learning**
   - Learn from user corrections
   - Auto-update patterns

3. **International Support**
   - Support non-Indian banks
   - Multiple currency formats
   - Date format variations
