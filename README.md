# MoneyMind - AI-Powered Money Management Application

A production-grade, microservices-based financial management platform with SMS-based transaction extraction, autopay detection, and AI-powered insights.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MONEY MIND ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐             │
│  │   Mobile     │     │   Web App    │     │  Third Party │             │
│  │   (React     │     │   (Future)   │     │  Integrations│             │
│  │   Native)    │     │              │     │              │             │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘             │
│         │                    │                     │                     │
│         └────────────────────┼─────────────────────┘                     │
│                              │                                            │
│                              ▼                                            │
│                    ┌─────────────────┐                                   │
│                    │   API Gateway   │                                   │
│                    │   (NestJS)      │                                   │
│                    └────────┬────────┘                                   │
│                             │                                             │
│         ┌───────────────────┼───────────────────┐                        │
│         │                   │                   │                        │
│         ▼                   ▼                   ▼                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │   User      │    │ Transaction │    │    SMS      │                  │
│  │   Service   │    │   Service   │    │  Ingestion  │                  │
│  │             │    │             │    │   Service   │                  │
│  └─────────────┘    └─────────────┘    └─────────────┘                  │
│         │                   │                   │                        │
│         └───────────────────┼───────────────────┘                        │
│                             │                                            │
│              ┌──────────────┴──────────────┐                            │
│              │                             │                            │
│              ▼                             ▼                            │
│       ┌─────────────┐            ┌─────────────┐                        │
│       │Subscription │            │     AI      │                        │
│       │  Detection  │            │   Service   │                        │
│       │   Engine    │            │  (FastAPI)  │                        │
│       └─────────────┘            └─────────────┘                        │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ PostgreSQL  │  │   Redis     │  │  RabbitMQ   │  │  Firebase   │     │
│  │ (Database)  │  │  (Cache)    │  │  (Queue)    │  │  (Push)     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
money-management-app/
├── mobile/                 # React Native mobile application
│   ├── src/
│   │   ├── screens/       # App screens (Home, Transactions, etc.)
│   │   ├── components/    # Reusable UI components
│   │   ├── services/      # API clients and services
│   │   ├── store/         # State management (Zustand)
│   │   ├── utils/         # Utility functions
│   │   ├── hooks/         # Custom React hooks
│   │   ├── types/         # TypeScript types
│   │   └── App.tsx        # App entry point
│   └── assets/            # Images, fonts, icons
│
├── backend/               # NestJS backend API
│   ├── src/
│   │   ├── modules/       # Feature modules
│   │   │   ├── user/      # User management & auth
│   │   │   ├── transaction/ # Transaction CRUD
│   │   │   ├── sms/       # SMS ingestion
│   │   │   ├── subscription/ # Subscription detection
│   │   │   ├── insights/  # Financial insights
│   │   │   └── notification/ # Push notifications
│   │   ├── common/        # Shared utilities
│   │   │   ├── guards/    # Auth guards
│   │   │   ├── decorators/ # Custom decorators
│   │   │   ├── filters/   # Exception filters
│   │   │   ├── interceptors/ # Response interceptors
│   │   │   └── pipes/     # Validation pipes
│   │   ├── config/        # Configuration
│   │   └── main.ts        # Entry point
│   ├── prisma/            # Database schema & migrations
│   └── test/              # Test files
│
├── ai-service/            # Python AI/ML microservice
│   ├── app/
│   │   ├── routes/        # API routes
│   │   ├── models/        # ML models
│   │   ├── services/      # Business logic
│   │   │   ├── sms_parser.py         # SMS parsing
│   │   │   ├── subscription_detector.py # Subscription detection
│   │   │   ├── insights_generator.py  # Insights generation
│   │   │   └── llm_integration.py     # LLM integration
│   │   ├── utils/         # Utilities
│   │   └── main.py        # FastAPI entry point
│   └── tests/             # Test files
│
├── shared/                # Shared code between services
│   ├── dto/               # Data Transfer Objects
│   ├── constants/         # Shared constants
│   ├── types/             # TypeScript types
│   └── schemas/           # Validation schemas
│
├── infra/                 # Infrastructure as Code
│   ├── docker/            # Dockerfiles
│   ├── k8s/               # Kubernetes manifests
│   └── terraform/         # Terraform configs (future)
│
├── docs/                  # Documentation
└── scripts/               # DevOps scripts
```

## 🚀 Tech Stack

### Frontend (Mobile)

- **React Native** with TypeScript
- **Expo** for development and deployment
- **Zustand** for state management
- **React Query** for data fetching
- **SecureStore** for secure token storage
- **React Navigation** for routing

### Backend

- **NestJS** (TypeScript) - Modular server framework
- **Prisma** - Type-safe ORM
- **PostgreSQL** - Primary database
- **Redis** - Caching layer
- **RabbitMQ** - Message queue
- **JWT** - Authentication
- **bcrypt** - Password hashing

### AI Service

- **FastAPI** (Python) - High-performance API
- **spaCy** - NLP processing
- **Transformers** - ML models
- **OpenAI/Anthropic** - LLM integration (optional)

### Infrastructure

- **Docker** - Containerization
- **Kubernetes** - Orchestration
- **AWS** (target):
  - RDS (PostgreSQL)
  - ElastiCache (Redis)
  - SQS (optional queue)
  - S3 (storage)

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Docker and Docker Compose
- Git

### Quick Start (Docker)

1. **Clone the repository**

```bash
git clone <repository-url>
cd money-management-app
```

2. **Set up environment variables**

```bash
cp .env.example .env
# Edit .env with your values
```

3. **Start all services**

```bash
docker-compose up -d
```

4. **Access services**

- Backend API: http://localhost:3000
- API Documentation: http://localhost:3000/docs
- AI Service: http://localhost:8000
- PGAdmin: http://localhost:5050 (admin@moneymind.local / admin)
- Redis Commander: http://localhost:8081
- RabbitMQ Management: http://localhost:15672 (guest / guest)

### Manual Setup

#### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run dev
```

#### AI Service

```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

#### Mobile App

```bash
cd mobile
npm install
npm start
# Press 'a' for Android or 'i' for iOS
```

## 📡 API Endpoints

The complete API is documented via Swagger at `/docs` once the backend is
running. The table below covers the surfaces that mobile / external
integrators are expected to hit; admin-only and AI-internal routes are
omitted for brevity (they're in the Swagger doc).

### Authentication

| Method | Endpoint                | Description                              |
| ------ | ----------------------- | ---------------------------------------- |
| POST   | `/api/v1/auth/register` | Register a new user                      |
| POST   | `/api/v1/auth/login`    | Log in (returns access + refresh tokens) |
| POST   | `/api/v1/auth/refresh`  | Refresh the access token                 |
| POST   | `/api/v1/auth/logout`   | Log out (single device or everywhere)    |

### Users / Profile

| Method | Endpoint                  | Description                                |
| ------ | ------------------------- | ------------------------------------------ |
| GET    | `/api/v1/users/me`        | Get the caller's profile                   |
| PUT    | `/api/v1/users/me`        | Update the caller's profile                |
| GET    | `/api/v1/users/me/export` | GDPR/DPDP right-to-access (full JSON dump) |
| DELETE | `/api/v1/users/me`        | GDPR/DPDP right-to-erasure (cascades)      |
| GET    | `/api/v1/users/dashboard` | Aggregated dashboard stats                 |

### Accounts

| Method | Endpoint                       | Description                   |
| ------ | ------------------------------ | ----------------------------- |
| GET    | `/api/v1/accounts`             | List the user's accounts      |
| POST   | `/api/v1/accounts`             | Add an account                |
| GET    | `/api/v1/accounts/net-worth`   | Total balance across accounts |
| PUT    | `/api/v1/accounts/:id`         | Update an account             |
| DELETE | `/api/v1/accounts/:id`         | Soft-delete an account        |
| POST   | `/api/v1/accounts/:id/primary` | Mark an account as primary    |

### Transactions

| Method | Endpoint                                    | Description                               |
| ------ | ------------------------------------------- | ----------------------------------------- |
| GET    | `/api/v1/transactions`                      | Paginated list (`page`, `limit`, filters) |
| POST   | `/api/v1/transactions`                      | Create a transaction                      |
| GET    | `/api/v1/transactions/:id`                  | Get a transaction by ID                   |
| PUT    | `/api/v1/transactions/:id`                  | Update a transaction                      |
| DELETE | `/api/v1/transactions/:id`                  | Soft-delete a transaction                 |
| GET    | `/api/v1/transactions/analytics/categories` | Spend by category                         |
| GET    | `/api/v1/transactions/analytics/monthly`    | Monthly income/expense                    |
| GET    | `/api/v1/transactions/search`               | Free-text search                          |

### SMS

| Method | Endpoint                   | Description                                    |
| ------ | -------------------------- | ---------------------------------------------- |
| POST   | `/api/v1/sms/ingest`       | Ingest one SMS (idempotent via dedup hash)     |
| POST   | `/api/v1/sms/ingest/batch` | Ingest multiple SMS                            |
| GET    | `/api/v1/sms/history`      | Paginated SMS history with linked transactions |

### Subscriptions

| Method | Endpoint                       | Description                     |
| ------ | ------------------------------ | ------------------------------- |
| GET    | `/api/v1/subscriptions`        | List subscriptions              |
| POST   | `/api/v1/subscriptions`        | Create a subscription           |
| POST   | `/api/v1/subscriptions/detect` | Run pattern detection on demand |
| PUT    | `/api/v1/subscriptions/:id`    | Update a subscription           |
| DELETE | `/api/v1/subscriptions/:id`    | Cancel a subscription           |

### Budgets / Goals

| Method | Endpoint                       | Description                   |
| ------ | ------------------------------ | ----------------------------- |
| GET    | `/api/v1/budgets`              | List budgets                  |
| POST   | `/api/v1/budgets`              | Create a budget               |
| GET    | `/api/v1/goals`                | List goals                    |
| POST   | `/api/v1/goals`                | Create a goal                 |
| POST   | `/api/v1/goals/:id/contribute` | Record progress toward a goal |

### Insights (rule-based)

| Method | Endpoint                           | Description                       |
| ------ | ---------------------------------- | --------------------------------- |
| GET    | `/api/v1/insights`                 | All insights for the user         |
| GET    | `/api/v1/insights/spending`        | Spending analysis (period-scoped) |
| GET    | `/api/v1/insights/recommendations` | Recommendations                   |
| GET    | `/api/v1/insights/predictions`     | Forecasted spend                  |
| GET    | `/api/v1/insights/anomalies`       | Outliers in recent transactions   |

### AI (LLM-backed)

| Method | Endpoint                           | Description                        |
| ------ | ---------------------------------- | ---------------------------------- |
| GET    | `/api/v1/ai/dashboard`             | Personalized dashboard (cached)    |
| GET    | `/api/v1/ai/health-score`          | Financial health score (cached)    |
| GET    | `/api/v1/ai/leaks`                 | Money leaks (cached)               |
| GET    | `/api/v1/ai/behavior`              | Behavioral analysis                |
| GET    | `/api/v1/ai/archetype`             | User spending archetype            |
| POST   | `/api/v1/ai/action-cards/generate` | Refresh action cards               |
| POST   | `/api/v1/ai/ask`                   | Free-form Q&A over the user's data |

### Notifications

| Method | Endpoint                             | Description        |
| ------ | ------------------------------------ | ------------------ |
| GET    | `/api/v1/notifications`              | List notifications |
| GET    | `/api/v1/notifications/unread/count` | Unread count       |
| GET    | `/api/v1/notifications/preferences`  | Preferences        |
| PUT    | `/api/v1/notifications/preferences`  | Update preferences |
| PUT    | `/api/v1/notifications/:id/read`     | Mark one as read   |
| POST   | `/api/v1/notifications/read-all`     | Mark all as read   |

### Health

| Method | Endpoint               | Description                                    |
| ------ | ---------------------- | ---------------------------------------------- |
| GET    | `/api/v1/health`       | Liveness probe                                 |
| GET    | `/api/v1/health/ready` | Readiness probe (checks DB / Redis / RabbitMQ) |

## 🗄️ Database Schema

### Core Tables

- **users** - User accounts and authentication
- **accounts** - Bank accounts and wallets
- **transactions** - Financial transactions
- **subscriptions** - Recurring payments
- **categories** - Transaction categories
- **budgets** - Budget tracking
- **notifications** - User notifications
- **sms_logs** - Raw SMS ingestion logs

See `backend/prisma/schema.prisma` for full schema definition.

## 🔄 Event Flow

```
SMS Received (Mobile)
       │
       ▼
POST /sms/ingest (Backend)
       │
       ├─ dedup hash check (userId+sender+body+ts)
       ├─ Transaction.upsert  (idempotent)
       └─ publish: transaction.created
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
RabbitMQ:           RabbitMQ:           RabbitMQ:
transaction.events  subscription.events notification.events
       │                  │                  │
       ▼                  ▼                  ▼
- Behavior tag     - Subscription      - Push notification
- Cache invalidate   pattern detect    - Persist to DB
- Health score       (rate-limited)
- Action cards
  (cooldown-throttled)
```

Notes:

- The legacy `sms.processing` queue and the duplicate consumer that
  re-created transactions from `sms.received` events were removed.
  `SmsService.ingestSms` is the single source of truth for "SMS →
  Transaction"; the consumer side only does fan-out work.
- All three queues are independent — a slow handler on
  `transaction.events` (the heavy AI fan-out path) can no longer
  starve `notification.events`. Per-queue prefetch is tuned for
  workload (5 / 20 / 50).
  Subscription AI Insights Notification
  Detector Engine Service

````

## 🔒 Security

- JWT-based authentication with refresh tokens
- Password hashing with bcrypt (10 rounds)
- Input validation with class-validator
- Rate limiting (100 requests/minute)
- CORS protection
- Helmet.js security headers
- Secure token storage (Keychain/SecureStore)

## 📊 Monitoring

- Health check endpoints: `/health`
- Swagger documentation: `/docs`
- Structured logging with Winston
- Database query logging via Prisma

## 🚀 Deployment

### Kubernetes

```bash
# Create namespace
kubectl apply -f infra/k8s/namespace.yaml

# Create secrets
kubectl apply -f infra/k8s/secrets.yaml

# Deploy services
kubectl apply -f infra/k8s/postgres-statefulset.yaml
kubectl apply -f infra/k8s/redis-deployment.yaml
kubectl apply -f infra/k8s/rabbitmq-deployment.yaml
kubectl apply -f infra/k8s/backend-deployment.yaml
kubectl apply -f infra/k8s/ai-service-deployment.yaml
kubectl apply -f infra/k8s/ingress.yaml
````

## 🧪 Testing

```bash
# Backend tests
cd backend
npm run test
npm run test:e2e

# AI Service tests
cd ai-service
pytest

# Mobile tests
cd mobile
npm test
```

## 📱 Mobile App Features

- **Home Dashboard** - Balance overview, quick stats, upcoming payments
- **Transactions** - List, filter, search transactions
- **Subscriptions** - Track recurring payments
- **Insights** - Spending analysis, recommendations
- **Settings** - Profile, notifications, preferences

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support, email support@moneymind.app or open an issue in the repository.
