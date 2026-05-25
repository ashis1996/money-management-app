# Architecture Documentation

## System Overview

MoneyMind is built on a microservices architecture following clean architecture principles. The system is designed for scalability, maintainability, and high availability.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  Mobile App (React Native)  │  Future: Web App, API Consumers   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                              │
├─────────────────────────────────────────────────────────────────┤
│  NestJS Backend (Modular Monolith)                              │
│  - Authentication & Authorization                               │
│  - Request Validation                                           │
│  - Rate Limiting                                                │
│  - API Documentation                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
┌─────────────────────┐ ┌─────────────┐ ┌─────────────────┐
│  Core Services      │ │  AI Service │ │  Message Queue  │
│  (NestJS Modules)   │ │  (FastAPI)  │ │  (RabbitMQ)     │
│                     │ │             │ │                 │
│  - User Service     │ │  - SMS      │ │  - Async        │
│  - Transaction      │ │    Parser   │ │    Processing   │
│  - SMS Ingestion    │ │  - Sub-     │ │  - Event        │
│  - Subscription     │ │    scription│ │    Publishing   │
│  - Insights         │ │    Detector │ │                 │
│  - Notification     │ │  - Insights │ │                 │
│                     │ │    Gen      │ │                 │
└─────────────────────┘ └─────────────┘ └─────────────────┘
         │                    │                   │
         └────────────────────┼───────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL  │   Redis    │    Future: S3, Elasticsearch       │
│  (Primary)   │  (Cache)   │                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Service Responsibilities

### Backend (NestJS)

The backend is structured as a modular monolith that can be split into microservices when needed.

#### User Module
- User registration and authentication
- JWT token management
- Profile management
- Dashboard statistics

#### Transaction Module
- Transaction CRUD operations
- Category-based filtering
- Search functionality
- Analytics and aggregation

#### SMS Module
- SMS ingestion from mobile app
- Rule-based parsing (fallback)
- AI service integration for advanced parsing
- Transaction creation from parsed SMS

#### Subscription Module
- Manual subscription management
- Automatic subscription detection
- Recurring payment tracking
- Billing date predictions

#### Insights Module
- Spending analysis
- Trend detection
- Anomaly detection
- Basic predictions (fallback to AI service)

#### Notification Module
- Push notification management
- Notification preferences
- In-app notifications
- Email/SMS alerts (future)

### AI Service (FastAPI)

The AI service handles all ML/AI-related processing.

#### SMS Parser Service
- Bank SMS pattern recognition
- Amount extraction
- Merchant identification
- Transaction type classification
- Category prediction

#### Subscription Detector Service
- Pattern recognition for recurring payments
- Frequency analysis
- Confidence scoring
- Next billing date prediction

#### Insights Generator Service
- Spending pattern analysis
- Trend calculation
- Anomaly detection
- Basic predictions

#### LLM Integration Service
- OpenAI integration
- Anthropic integration
- Natural language summaries
- Personalized financial advice

## Data Flow

### SMS Ingestion Flow

```
1. Mobile app receives SMS (Android) or user forwards SMS (iOS)
2. POST /api/v1/sms/ingest
3. Backend saves raw SMS to sms_logs table
4. Publish SMS_RECEIVED event to RabbitMQ
5. AI Service consumes event
6. SMS Parser extracts transaction details
7. Backend creates transaction record
8. Publish TRANSACTION_CREATED event
9. Subscription Detector checks for recurring pattern
10. Notification Service sends confirmation
```

### Subscription Detection Flow

```
1. User triggers detection (or scheduled job)
2. GET all DEBIT transactions grouped by merchant
3. For each merchant with 2+ transactions:
   a. Analyze date intervals
   b. Calculate frequency (DAILY/WEEKLY/MONTHLY/etc.)
   c. Check amount consistency
   d. Calculate confidence score
4. Save detected subscriptions
5. Notify user of new subscriptions
```

### Insights Generation Flow

```
1. User requests insights
2. Backend fetches transactions for period
3. Calculate spending totals by category
4. Compare with previous period
5. Detect trends (increasing/decreasing)
6. Generate recommendations
7. Request predictions from AI service
8. Aggregate and return insights
```

## Database Design

### Entity Relationships

```
User (1) ────── (M) Account
  │
  ├────── (M) Transaction
  │              │
  │              └── (1) Subscription (optional)
  │
  ├────── (M) Subscription
  │
  ├────── (M) Budget
  │
  ├────── (M) Notification
  │
  └────── (M) SmsLog
```

### Key Tables

#### users
- Primary user table
- Authentication credentials (hashed)
- Profile information
- Notification preferences (JSON)

#### transactions
- All financial transactions
- Linked to user and account
- Category and merchant tracking
- SMS origin reference

#### subscriptions
- Recurring payment tracking
- Frequency and billing dates
- Merchant pattern matching

#### sms_logs
- Raw SMS storage
- Parsing results (JSON)
- Processing status

## Caching Strategy

### Redis Cache Keys

```
user:{id}:transactions       - User's recent transactions
user:{id}:subscriptions      - User's subscriptions
user:{id}:insights:{period}  - Cached insights
user:{id}:dashboard          - Dashboard statistics
categories                   - Category list (shared)
```

### Cache Invalidation

- Transactions: Invalidate on create/update/delete
- Subscriptions: Invalidate on detect/update
- Insights: Time-based (5 minutes TTL)
- Dashboard: Invalidate on transaction change

## Message Queue Events

### Published Events

| Event | Publisher | Consumers |
|-------|-----------|-----------|
| SMS_RECEIVED | SMS Module | AI Service, Notification |
| TRANSACTION_CREATED | Transaction Module | Subscription, AI, Notification |
| SUBSCRIPTION_DETECTED | Subscription Module | Notification |
| NOTIFICATION_REQUEST | Any Module | Notification Service |

### Event Format

```json
{
  "type": "TRANSACTION_CREATED",
  "data": {
    "transactionId": "uuid",
    "userId": "uuid",
    "amount": 500.00,
    "category": "FOOD_DINING"
  },
  "timestamp": "2024-01-01T00:00:00Z",
  "metadata": {
    "source": "transaction-service",
    "version": "1.0"
  }
}
```

## Security Architecture

### Authentication Flow

```
1. User submits credentials
2. Backend validates against database
3. Generate JWT access token (15 min)
4. Generate JWT refresh token (7 days)
5. Store refresh token in database
6. Return tokens to client
7. Client stores in SecureStore
8. Access token sent with each request
9. Refresh token used when access expires
```

### Authorization

- JWT-based authentication
- Role-based access control (future)
- Resource ownership validation
- Rate limiting per user

## Scalability Considerations

### Horizontal Scaling

- Backend: Stateless, can scale horizontally
- AI Service: Stateless, can scale horizontally
- Database: Read replicas for scaling reads
- Redis: Cluster mode for high availability
- RabbitMQ: Cluster for high throughput

### Performance Optimizations

1. **Database Indexes**
   - transactions(user_id, date DESC)
   - subscriptions(user_id, status)
   - notifications(user_id, read, created_at DESC)

2. **Query Optimization**
   - Selective column fetching
   - Pagination for large lists
   - Aggregation pipelines

3. **Caching**
   - Frequently accessed data in Redis
   - API response caching
   - Computed insights caching

## Deployment Architecture (AWS)

```
┌─────────────────────────────────────────────────────────┐
│                      CloudFront CDN                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Application Load Balancer                   │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│   EKS Cluster   │ │   EKS       │ │   EKS           │
│   (Backend)     │ │   (AI)      │ │   (Workers)     │
│   - 3+ nodes    │ │   - 2+ nodes│ │   - 2+ nodes    │
└─────────────────┘ └─────────────┘ └─────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────────┐
│ RDS         │  │ ElastiCache │  │ SQS             │
│ PostgreSQL  │  │ Redis       │  │ (Queue)         │
│ Multi-AZ    │  │ Cluster     │  │                 │
└─────────────┘  └─────────────┘  └─────────────────┘
```

## Monitoring & Observability

### Metrics to Track

- API response times (p50, p95, p99)
- Error rates by endpoint
- Database query performance
- Cache hit rates
- Queue depths
- AI service processing time

### Logging Strategy

- Structured JSON logging
- Correlation IDs for request tracing
- Log levels: DEBUG, INFO, WARN, ERROR
- Centralized logging (ELK/DataDog)

### Alerting

- High error rates (>1%)
- Slow response times (p99 > 1s)
- Database connection pool exhaustion
- Queue backup
- Disk space warnings
