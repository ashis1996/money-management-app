# API Documentation

## Base URL

- Development: `http://localhost:3000/api/v1`
- Production: `https://api.moneymind.app/api/v1`

## Authentication

All endpoints (except auth endpoints) require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Token Lifecycle

1. Access tokens expire after 15 minutes
2. Use refresh token to get new access token
3. Refresh tokens expire after 7 days

---

## Authentication Endpoints

### POST /auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "phone": "+1234567890"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "phone": "+1234567890",
      "emailVerified": false,
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

### POST /auth/login

Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

### POST /auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_eyJhbGc...",
    "refreshToken": "new_eyJhbGc...",
    "expiresIn": 900
  }
}
```

### POST /auth/logout

Logout user and invalidate tokens.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

---

## User Endpoints

### GET /users/me

Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+1234567890",
    "emailVerified": false,
    "avatarUrl": "https://...",
    "lastLoginAt": "2024-01-01T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### PUT /users/me

Update current user profile.

**Request Body:**
```json
{
  "name": "Jane Doe",
  "phone": "+1234567890"
}
```

### GET /users/dashboard

Get dashboard statistics.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalBalance": 50000.00,
    "monthlyIncome": 80000.00,
    "monthlyExpense": 45000.00,
    "netSavings": 35000.00,
    "accountCount": 2,
    "activeSubscriptions": 5,
    "unreadNotifications": 3
  }
}
```

---

## Transaction Endpoints

### GET /transactions

Get all transactions with optional filtering.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| from | string | Start date (ISO 8601) |
| to | string | End date (ISO 8601) |
| category | string | Filter by category |
| search | string | Search in description/merchant |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "accountId": "uuid",
      "userId": "uuid",
      "amount": 500.00,
      "type": "DEBIT",
      "category": "FOOD_DINING",
      "merchant": "Restaurant ABC",
      "description": "Dinner",
      "date": "2024-01-01T19:30:00Z",
      "isSubscription": false,
      "createdAt": "2024-01-01T19:30:00Z"
    }
  ]
}
```

### POST /transactions

Create a new transaction.

**Request Body:**
```json
{
  "accountId": "uuid",
  "amount": 500.00,
  "type": "DEBIT",
  "category": "FOOD_DINING",
  "merchant": "Restaurant ABC",
  "description": "Dinner",
  "date": "2024-01-01T19:30:00Z"
}
```

### GET /transactions/analytics/categories

Get spending breakdown by category.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| from | string | Start date |
| to | string | End date |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "category": "FOOD_DINING",
      "totalAmount": 5000.00,
      "transactionCount": 15
    }
  ]
}
```

### GET /transactions/analytics/monthly

Get monthly statistics.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| year | number | Year (e.g., 2024) |
| month | number | Month (1-12) |

---

## SMS Endpoints

### POST /sms/ingest

Ingest an SMS message for transaction extraction.

**Request Body:**
```json
{
  "body": "Dear Customer, Rs. 500.00 debited from your account ending 1234 at MERCHANT ABC. Available balance: Rs. 10,000.00",
  "sender": "HD-BANK",
  "timestamp": "2024-01-01T19:30:00Z",
  "phoneNumber": "+1234567890"
}
```

**Response (200):**
```json
{
  "success": true,
  "parsed": {
    "rawSms": "Dear Customer...",
    "sender": "HD-BANK",
    "amount": 500.00,
    "merchant": "MERCHANT ABC",
    "transactionType": "DEBIT",
    "category": "SHOPPING",
    "balance": 10000.00,
    "accountLast4": "1234",
    "confidence": 0.95
  },
  "transactionCreated": true,
  "transactionId": "uuid"
}
```

### POST /sms/ingest/batch

Ingest multiple SMS messages.

**Request Body:**
```json
{
  "messages": [
    {
      "body": "...",
      "sender": "HD-BANK",
      "timestamp": "2024-01-01T19:30:00Z"
    }
  ]
}
```

---

## Subscription Endpoints

### GET /subscriptions

Get all subscriptions.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (ACTIVE, PAUSED, CANCELLED) |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "name": "Netflix",
      "amount": 799.00,
      "frequency": "MONTHLY",
      "status": "ACTIVE",
      "merchant": "Netflix",
      "nextBillingDate": "2024-02-01T00:00:00Z",
      "isNotified": false,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /subscriptions/detect

Detect subscriptions from transaction history.

**Response (200):**
```json
{
  "detected": 5,
  "saved": 3,
  "subscriptions": [...]
}
```

### GET /subscriptions/summary

Get subscription summary.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalSubscriptions": 5,
    "activeSubscriptions": 5,
    "totalMonthlySpend": 3500.00,
    "upcomingPayments": [
      {
        "name": "Netflix",
        "amount": 799.00,
        "dueDate": "2024-02-01T00:00:00Z"
      }
    ]
  }
}
```

---

## Insights Endpoints

### GET /insights

Get all insights (spending, trends, recommendations, predictions).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "spending": {
      "period": "MONTH",
      "totalSpent": 45000.00,
      "totalIncome": 80000.00,
      "netSavings": 35000.00,
      "savingsRate": 43.75,
      "byCategory": [...],
      "topMerchants": [...]
    },
    "trends": [...],
    "anomalies": [...],
    "recommendations": [...],
    "predictions": {...},
    "generatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### GET /insights/spending

Get spending analysis.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| period | string | WEEK, MONTH, QUARTER, YEAR |

---

## Notifications Endpoints

### GET /notifications

Get all notifications.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| unread | boolean | Filter unread only |

### PUT /notifications/:id/read

Mark notification as read.

### POST /notifications/read-all

Mark all notifications as read.

### GET /notifications/preferences

Get notification preferences.

### PUT /notifications/preferences

Update notification preferences.

**Request Body:**
```json
{
  "pushEnabled": true,
  "emailEnabled": false,
  "transactionAlerts": true,
  "subscriptionAlerts": true,
  "budgetAlerts": true,
  "minAmountForAlert": 1000
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00Z",
  "path": "/api/v1/transactions"
}
```

### Common Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 500 | Internal Server Error |
