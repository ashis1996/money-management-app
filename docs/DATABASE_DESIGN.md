# Database Design Document

## Overview

This document describes the production-grade PostgreSQL database schema for the MoneyMind AI-powered Money Management Application.

## Design Principles

1. **Normalization**: 3NF normalized schemas to minimize redundancy
2. **Scalability**: UUID primary keys, proper indexing, partitioning-ready
3. **Data Integrity**: Foreign key constraints, CHECK constraints, triggers
4. **Auditability**: Created/updated timestamps, soft delete support
5. **Extensibility**: JSONB columns for future fields, event sourcing ready

## Entity Relationship Diagram

```
┌─────────────────┐
│     users       │
└────────┬────────┘
         │ 1:N
         ├──────────────────┬─────────────────┬─────────────────┐
         │                  │                 │                 │
         ▼                  ▼                 ▼                 ▼
┌─────────────────┐ ┌───────────────┐ ┌─────────────┐ ┌─────────────────┐
│   accounts      │ │ transactions  │ │  budgets    │ │  notifications  │
└────────┬────────┘ └───────┬───────┘ └──────┬──────┘ └─────────────────┘
         │                  │                │
         │ 1:N              │ N:1            │ N:1
         │                  ▼                │
         │         ┌─────────────────┐       │
         │         │   categories    │       │
         │         └─────────────────┘       │
         │                                   │
         ▼                                   │
┌─────────────────┐                         │
│  subscriptions  │◄────────────────────────┘
└─────────────────┘
```

## Core Tables

### 1. users

Base user table for authentication and profile management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique user identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email address |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| name | VARCHAR(100) | NULL | User's full name |
| phone_number | VARCHAR(20) | UNIQUE, NULL | User's phone number |
| avatar_url | VARCHAR(500) | NULL | Profile picture URL |
| email_verified | BOOLEAN | DEFAULT FALSE | Email verification status |
| phone_verified | BOOLEAN | DEFAULT FALSE | Phone verification status |
| timezone | VARCHAR(50) | DEFAULT 'Asia/Kolkata' | User's timezone |
| currency | VARCHAR(3) | DEFAULT 'INR' | Preferred currency |
| notification_preferences | JSONB | DEFAULT '{}' | Notification settings |
| last_login_at | TIMESTAMPTZ | NULL | Last login timestamp |
| is_active | BOOLEAN | DEFAULT TRUE | Account status |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update time |

**Indexes:**
- `idx_users_email` (email) - Unique index
- `idx_users_phone` (phone_number) - Unique index
- `idx_users_is_active` (is_active) - For filtering active users

---

### 2. accounts

Multi-account support for bank accounts, wallets, and credit cards.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique account identifier |
| user_id | UUID | FK → users(id), NOT NULL | Owner user |
| account_type | account_type_enum | NOT NULL | BANK, WALLET, CREDIT_CARD, INVESTMENT, LOAN |
| account_name | VARCHAR(100) | NOT NULL | User-defined account name |
| account_number | VARCHAR(50) | NULL | Full account number (encrypted) |
| masked_account_number | VARCHAR(20) | NULL | Last 4 digits (e.g., "****1234") |
| provider_name | VARCHAR(100) | NULL | Bank/provider name (HDFC, SBI, etc.) |
| ifsc_code | VARCHAR(11) | NULL | IFSC code for Indian banks |
| balance | DECIMAL(15,2) | DEFAULT 0.00 | Current balance |
| currency | VARCHAR(3) | DEFAULT 'INR' | Account currency |
| color | VARCHAR(7) | NULL | UI color (#RRGGBB) |
| icon | VARCHAR(50) | NULL | UI icon identifier |
| is_primary | BOOLEAN | DEFAULT FALSE | Primary account flag |
| is_active | BOOLEAN | DEFAULT TRUE | Account status |
| metadata | JSONB | DEFAULT '{}' | Additional account data |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update time |

**Indexes:**
- `idx_accounts_user_id` (user_id) - For user's accounts lookup
- `idx_accounts_user_primary` (user_id, is_primary) - Find primary account
- `idx_accounts_type` (account_type) - Filter by type

**Constraints:**
- CHECK: balance >= 0 for WALLET accounts (optional enforcement)

---

### 3. transactions

Core transaction table for all financial transactions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique transaction identifier |
| user_id | UUID | FK → users(id), NOT NULL | Owner user |
| account_id | UUID | FK → accounts(id), NULL | Source account (nullable for external) |
| amount | DECIMAL(15,2) | NOT NULL | Transaction amount |
| type | transaction_type_enum | NOT NULL | CREDIT, DEBIT |
| category_id | UUID | FK → categories(id), NULL | Transaction category |
| subcategory_id | UUID | FK → categories(id), NULL | Subcategory |
| merchant_name | VARCHAR(200) | NULL | Merchant/payee name |
| description | TEXT | NULL | Transaction description |
| transaction_date | TIMESTAMPTZ | NOT NULL | When transaction occurred |
| posting_date | TIMESTAMPTZ | NULL | When transaction posted |
| source | transaction_source_enum | NOT NULL | SMS, BANK_API, MANUAL, IMPORT |
| external_reference_id | VARCHAR(255) | NULL | External system ID for deduplication |
| raw_sms_text | TEXT | NULL | Original SMS text (if from SMS) |
| sms_sender_id | VARCHAR(20) | NULL | SMS sender ID |
| is_subscription | BOOLEAN | DEFAULT FALSE | Recurring payment flag |
| subscription_id | UUID | FK → subscriptions(id), NULL | Linked subscription |
| latitude | DECIMAL(10,8) | NULL | Location data |
| longitude | DECIMAL(11,8) | NULL | Location data |
| is_verified | BOOLEAN | DEFAULT FALSE | User verified this transaction |
| tags | TEXT[] | DEFAULT '{}' | User-added tags |
| metadata | JSONB | DEFAULT '{}' | Additional data |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update time |

**Indexes:**
- `idx_transactions_user_date` (user_id, transaction_date DESC) - Primary lookup
- `idx_transactions_user_category` (user_id, category_id) - Category filtering
- `idx_transactions_user_type` (user_id, type) - Credit/debit filtering
- `idx_transactions_merchant` (merchant_name) - Merchant search
- `idx_transactions_source` (source) - Source filtering
- `idx_transactions_subscription` (subscription_id) - Subscription transactions
- `idx_transactions_external_ref` (external_reference_id) - Deduplication
- `idx_transactions_date_range` (transaction_date) USING BRIN - Range queries

**Constraints:**
- CHECK: amount > 0
- CHECK: type IN ('CREDIT', 'DEBIT')
- UNIQUE: (user_id, external_reference_id) - Prevent duplicates

---

### 4. categories

Transaction categories with hierarchical support.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique category identifier |
| user_id | UUID | FK → users(id), NULL | NULL for system categories |
| name | VARCHAR(100) | NOT NULL | Category name |
| parent_id | UUID | FK → categories(id), NULL | Parent category for hierarchy |
| icon | VARCHAR(50) | NULL | UI icon |
| color | VARCHAR(7) | NULL | UI color |
| description | TEXT | NULL | Category description |
| is_system | BOOLEAN | DEFAULT FALSE | System-defined category |
| is_active | BOOLEAN | DEFAULT TRUE | Category status |
| display_order | INTEGER | DEFAULT 0 | Sort order |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update time |

**Indexes:**
- `idx_categories_user` (user_id) - User custom categories
- `idx_categories_parent` (parent_id) - Hierarchy lookup
- `idx_categories_system` (is_system) - System vs custom

**Constraints:**
- UNIQUE: (user_id, name) - No duplicate names per user
- CHECK: parent_id != id (no self-reference)

---

### 5. subscriptions

Detected and managed recurring payments/autopay.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique subscription identifier |
| user_id | UUID | FK → users(id), NOT NULL | Owner user |
| name | VARCHAR(200) | NOT NULL | Subscription name |
| merchant_name | VARCHAR(200) | NOT NULL | Merchant/provider name |
| merchant_pattern | VARCHAR(200) | NULL | Regex pattern for detection |
| amount | DECIMAL(15,2) | NOT NULL | Typical amount |
| currency | VARCHAR(3) | DEFAULT 'INR' | Currency |
| frequency | subscription_frequency_enum | NOT NULL | DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY |
| status | subscription_status_enum | DEFAULT 'ACTIVE' | ACTIVE, PAUSED, CANCELLED, EXPIRED |
| category_id | UUID | FK → categories(id), NULL | Category |
| next_billing_date | DATE | NULL | Next expected payment |
| last_payment_date | DATE | NULL | Last payment date |
| last_payment_amount | DECIMAL(15,2) | NULL | Last payment amount |
| first_detected_date | DATE | NULL | When first detected |
| total_payments_count | INTEGER | DEFAULT 0 | Total payments tracked |
| total_amount_paid | DECIMAL(15,2) | DEFAULT 0.00 | Lifetime amount |
| reminder_days_before | INTEGER | DEFAULT 1 | Days before to notify |
| is_notified | BOOLEAN | DEFAULT FALSE | Notification sent |
| notes | TEXT | NULL | User notes |
| metadata | JSONB | DEFAULT '{}' | Additional data |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update time |

**Indexes:**
- `idx_subscriptions_user` (user_id) - User subscriptions
- `idx_subscriptions_user_status` (user_id, status) - Active subscriptions
- `idx_subscriptions_next_billing` (next_billing_date) - Upcoming payments
- `idx_subscriptions_merchant` (merchant_name) - Merchant lookup

**Constraints:**
- CHECK: amount > 0
- CHECK: reminder_days_before >= 0

---

### 6. budgets

Monthly/category budget tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique budget identifier |
| user_id | UUID | FK → users(id), NOT NULL | Owner user |
| category_id | UUID | FK → categories(id), NULL | NULL for overall budget |
| name | VARCHAR(100) | NOT NULL | Budget name |
| amount_limit | DECIMAL(15,2) | NOT NULL | Budget limit |
| amount_spent | DECIMAL(15,2) | DEFAULT 0.00 | Current spending |
| currency | VARCHAR(3) | DEFAULT 'INR' | Currency |
| period | budget_period_enum | NOT NULL | WEEKLY, MONTHLY, YEARLY |
| start_date | DATE | NOT NULL | Budget period start |
| end_date | DATE | NULL | Budget period end |
| alert_threshold | DECIMAL(5,4) | DEFAULT 0.80 | Alert at 80% |
| is_active | BOOLEAN | DEFAULT TRUE | Budget status |
| rollover | BOOLEAN | DEFAULT FALSE | Rollover unused |
| notes | TEXT | NULL | User notes |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update time |

**Indexes:**
- `idx_budgets_user` (user_id) - User budgets
- `idx_budgets_user_active` (user_id, is_active) - Active budgets
- `idx_budgets_period` (period, start_date) - Period filtering

**Constraints:**
- CHECK: amount_limit > 0
- CHECK: alert_threshold BETWEEN 0 AND 1
- CHECK: end_date > start_date (if both set)

---

### 7. notifications

User notifications for alerts and insights.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique notification identifier |
| user_id | UUID | FK → users(id), NOT NULL | Recipient user |
| type | notification_type_enum | NOT NULL | TRANSACTION, SUBSCRIPTION, BUDGET_ALERT, INSIGHT, REMINDER, SECURITY |
| priority | notification_priority_enum | DEFAULT 'NORMAL' | LOW, NORMAL, HIGH, URGENT |
| title | VARCHAR(200) | NOT NULL | Notification title |
| message | TEXT | NOT NULL | Notification body |
| data | JSONB | DEFAULT '{}' | Additional payload |
| channel | notification_channel_enum | DEFAULT 'IN_APP' | PUSH, EMAIL, SMS, IN_APP |
| is_read | BOOLEAN | DEFAULT FALSE | Read status |
| read_at | TIMESTAMPTZ | NULL | When read |
| sent_at | TIMESTAMPTZ | NULL | When sent |
| delivered_at | TIMESTAMPTZ | NULL | When delivered |
| deleted_at | TIMESTAMPTZ | NULL | Soft delete timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |

**Indexes:**
- `idx_notifications_user` (user_id) - User notifications
- `idx_notifications_user_read` (user_id, is_read) - Unread count
- `idx_notifications_user_created` (user_id, created_at DESC) - Timeline
- `idx_notifications_type` (type) - Type filtering

**Constraints:**
- CHECK: type IN ('TRANSACTION', 'SUBSCRIPTION', 'BUDGET_ALERT', 'INSIGHT', 'REMINDER', 'SECURITY')

---

## Supporting Tables

### 8. sms_logs

Raw SMS ingestion tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique log identifier |
| user_id | UUID | FK → users(id), NOT NULL | Owner user |
| body | TEXT | NOT NULL | SMS message body |
| sender | VARCHAR(20) | NOT NULL | SMS sender ID |
| phone_number | VARCHAR(20) | NULL | Recipient phone |
| received_at | TIMESTAMPTZ | NOT NULL | SMS received timestamp |
| is_processed | BOOLEAN | DEFAULT FALSE | Processing status |
| parsed_data | JSONB | NULL | Parsed transaction data |
| transaction_id | UUID | FK → transactions(id), NULL | Created transaction |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |

**Indexes:**
- `idx_sms_logs_user` (user_id) - User SMS logs
- `idx_sms_logs_sender` (sender) - Sender filtering
- `idx_sms_logs_processed` (is_processed) - Pending processing
- `idx_sms_logs_received` (received_at DESC) - Timeline

---

### 9. refresh_tokens

JWT refresh token management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique token identifier |
| user_id | UUID | FK → users(id), NOT NULL | Token owner |
| token | VARCHAR(500) | UNIQUE, NOT NULL | Hashed refresh token |
| expires_at | TIMESTAMPTZ | NOT NULL | Token expiry |
| revoked_at | TIMESTAMPTZ | NULL | Revocation timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |

**Indexes:**
- `idx_refresh_tokens_user` (user_id) - User tokens
- `idx_refresh_tokens_token` (token) - Unique lookup
- `idx_refresh_tokens_expires` (expires_at) - Cleanup

---

### 10. audit_logs

System audit trail.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique log identifier |
| user_id | UUID | FK → users(id), NULL | Actor (NULL for system) |
| action | VARCHAR(50) | NOT NULL | Action performed |
| entity_type | VARCHAR(50) | NOT NULL | Affected entity type |
| entity_id | UUID | NULL | Affected entity ID |
| old_values | JSONB | NULL | Previous values |
| new_values | JSONB | NULL | New values |
| ip_address | VARCHAR(45) | NULL | Client IP |
| user_agent | VARCHAR(500) | NULL | Client user agent |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Event timestamp |

**Indexes:**
- `idx_audit_logs_user` (user_id) - User actions
- `idx_audit_logs_entity` (entity_type, entity_id) - Entity history
- `idx_audit_logs_created` (created_at DESC) - Timeline
- `idx_audit_logs_action` (action) - Action filtering

---

## Enumerations

```sql
-- Transaction type
CREATE TYPE transaction_type_enum AS ENUM ('CREDIT', 'DEBIT');

-- Transaction source
CREATE TYPE transaction_source_enum AS ENUM ('SMS', 'BANK_API', 'MANUAL', 'IMPORT');

-- Account type
CREATE TYPE account_type_enum AS ENUM ('BANK', 'WALLET', 'CREDIT_CARD', 'INVESTMENT', 'LOAN');

-- Subscription frequency
CREATE TYPE subscription_frequency_enum AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- Subscription status
CREATE TYPE subscription_status_enum AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- Budget period
CREATE TYPE budget_period_enum AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- Notification type
CREATE TYPE notification_type_enum AS ENUM ('TRANSACTION', 'SUBSCRIPTION', 'BUDGET_ALERT', 'INSIGHT', 'REMINDER', 'SECURITY');

-- Notification priority
CREATE TYPE notification_priority_enum AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- Notification channel
CREATE TYPE notification_channel_enum AS ENUM ('PUSH', 'EMAIL', 'SMS', 'IN_APP');
```

---

## Relationships Summary

| Parent Table | Child Table | Relationship | ON DELETE |
|--------------|-------------|--------------|-----------|
| users | accounts | 1:N | CASCADE |
| users | transactions | 1:N | CASCADE |
| users | subscriptions | 1:N | CASCADE |
| users | budgets | 1:N | CASCADE |
| users | notifications | 1:N | CASCADE |
| users | sms_logs | 1:N | CASCADE |
| users | refresh_tokens | 1:N | CASCADE |
| users | audit_logs | 1:N | SET NULL |
| accounts | transactions | 1:N | SET NULL |
| categories | transactions | 1:N | SET NULL |
| categories | budgets | 1:N | SET NULL |
| categories | categories (self) | 1:N | SET NULL |
| subscriptions | transactions | 1:N | SET NULL |

---

## Partitioning Strategy

For high-volume transaction tables, consider partitioning:

```sql
-- Partition transactions by month
CREATE TABLE transactions (
    -- columns
) PARTITION BY RANGE (transaction_date);

-- Create monthly partitions
CREATE TABLE transactions_2024_01 PARTITION OF transactions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE transactions_2024_02 PARTITION OF transactions
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

---

## Performance Considerations

### Indexing Strategy

1. **B-tree indexes** for equality and range queries
2. **BRIN indexes** for time-series data (transactions)
3. **GIN indexes** for JSONB columns
4. **Partial indexes** for filtered queries (e.g., is_active = true)

### Caching Strategy (Redis)

```
user:{id}:transactions:recent     - Last 50 transactions (5 min TTL)
user:{id}:accounts                - User accounts (10 min TTL)
user:{id}:subscriptions:active    - Active subscriptions (15 min TTL)
user:{id}:budgets:current         - Current month budgets (10 min TTL)
user:{id}:notifications:unread    - Unread count (2 min TTL)
categories:system                 - System categories (1 hour TTL)
```

### Query Optimization

1. Use covering indexes where possible
2. Avoid SELECT * in production queries
3. Implement cursor-based pagination for large datasets
4. Use materialized views for complex aggregations
