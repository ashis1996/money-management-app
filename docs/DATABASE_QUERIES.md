# Common Database Queries

This document provides SQL queries for common operations in the MoneyMind application.

---

## User Operations

### Get User with Accounts Summary

```sql
SELECT
    u.id,
    u.email,
    u.name,
    u.phone,
    u.email_verified,
    u.created_at,
    COUNT(DISTINCT a.id) AS account_count,
    COALESCE(SUM(a.balance) FILTER (WHERE a.is_active = true), 0) AS total_balance
FROM "User" u
LEFT JOIN "Account" a ON a.user_id = u.id AND a.is_active = true
WHERE u.id = $1 AND u.is_active = true AND u.deleted_at IS NULL
GROUP BY u.id;
```

### Update Last Login

```sql
UPDATE "User"
SET last_login_at = NOW()
WHERE id = $1;
```

---

## Account Operations

### Get User's Active Accounts

```sql
SELECT
    id,
    account_type,
    account_name,
    masked_account_number,
    provider_name,
    balance,
    currency,
    color,
    icon,
    is_primary
FROM "Account"
WHERE user_id = $1
  AND is_active = true
  AND deleted_at IS NULL
ORDER BY is_primary DESC, account_name;
```

### Calculate Total Balance by Type

```sql
SELECT
    account_type,
    COUNT(*) AS count,
    SUM(balance) AS total_balance,
    currency
FROM "Account"
WHERE user_id = $1
  AND is_active = true
  AND deleted_at IS NULL
GROUP BY account_type, currency;
```

---

## Transaction Operations

### Get Recent Transactions (with pagination)

```sql
SELECT
    t.id,
    t.account_id,
    t.amount,
    t.type,
    t.category_id,
    c.name AS category_name,
    t.merchant_name,
    t.description,
    t.transaction_date,
    t.source,
    t.is_subscription,
    t.is_verified,
    t.tags
FROM "Transaction" t
LEFT JOIN "Category" c ON c.id = t.category_id
WHERE t.user_id = $1
  AND t.deleted_at IS NULL
ORDER BY t.transaction_date DESC, t.id DESC
LIMIT $2 OFFSET $3;
```

### Get Transactions by Date Range

```sql
SELECT
    id,
    amount,
    type,
    category_id,
    merchant_name,
    transaction_date,
    source
FROM "Transaction"
WHERE user_id = $1
  AND transaction_date >= $2
  AND transaction_date < $3
  AND deleted_at IS NULL
ORDER BY transaction_date DESC;
```

### Get Monthly Spending by Category

```sql
SELECT
    c.id AS category_id,
    c.name AS category_name,
    c.color,
    c.icon,
    COUNT(t.id) AS transaction_count,
    SUM(t.amount) AS total_spent,
    AVG(t.amount) AS avg_transaction,
    MIN(t.transaction_date) AS first_transaction,
    MAX(t.transaction_date) AS last_transaction
FROM "Transaction" t
LEFT JOIN "Category" c ON c.id = t.category_id
WHERE t.user_id = $1
  AND t.type = 'DEBIT'
  AND t.transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND t.transaction_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
  AND t.deleted_at IS NULL
GROUP BY c.id, c.name, c.color, c.icon
ORDER BY total_spent DESC;
```

### Get Income vs Expense Summary

```sql
SELECT
    type,
    COUNT(*) AS transaction_count,
    SUM(amount) AS total_amount,
    AVG(amount) AS avg_amount,
    MIN(transaction_date) AS first_date,
    MAX(transaction_date) AS last_date
FROM "Transaction"
WHERE user_id = $1
  AND transaction_date >= $2
  AND transaction_date < $3
  AND deleted_at IS NULL
GROUP BY type;
```

### Search Transactions

```sql
SELECT
    id,
    merchant_name,
    description,
    amount,
    type,
    transaction_date,
    source
FROM "Transaction"
WHERE user_id = $1
  AND deleted_at IS NULL
  AND (
    merchant_name ILIKE $2
    OR description ILIKE $2
    OR CAST(amount AS TEXT) LIKE $2
  )
ORDER BY transaction_date DESC
LIMIT 20;
```

### Check for Duplicate Transaction (Deduplication)

```sql
SELECT id
FROM "Transaction"
WHERE user_id = $1
  AND external_reference_id = $2
  AND deleted_at IS NULL;
```

### Get Transactions for Subscription Detection

```sql
SELECT
    merchant_name,
    amount,
    transaction_date,
    id
FROM "Transaction"
WHERE user_id = $1
  AND type = 'DEBIT'
  AND merchant_name IS NOT NULL
  AND deleted_at IS NULL
ORDER BY transaction_date ASC;
```

---

## Subscription Operations

### Get Active Subscriptions

```sql
SELECT
    s.id,
    s.name,
    s.merchant_name,
    s.amount,
    s.frequency,
    s.status,
    s.next_billing_date,
    s.last_payment_date,
    s.last_payment_amount,
    s.total_payments_count,
    s.total_amount_paid,
    c.name AS category_name,
    c.color AS category_color
FROM "Subscription" s
LEFT JOIN "Category" c ON c.id = s.category_id
WHERE s.user_id = $1
  AND s.status = 'ACTIVE'
  AND s.deleted_at IS NULL
ORDER BY s.next_billing_date ASC;
```

### Get Upcoming Payments

```sql
SELECT
    id,
    name,
    merchant_name,
    amount,
    frequency,
    next_billing_date,
    reminder_days_before
FROM "Subscription"
WHERE user_id = $1
  AND status = 'ACTIVE'
  AND next_billing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  AND deleted_at IS NULL
ORDER BY next_billing_date ASC;
```

### Get Subscription Summary

```sql
SELECT
    COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_count,
    COUNT(*) FILTER (WHERE status = 'PAUSED') AS paused_count,
    COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_count,
    SUM(amount) FILTER (WHERE status = 'ACTIVE' AND frequency = 'MONTHLY') AS monthly_total,
    SUM(amount) FILTER (WHERE status = 'ACTIVE' AND frequency = 'YEARLY') AS yearly_total,
    MIN(next_billing_date) FILTER (WHERE status = 'ACTIVE') AS next_billing_date
FROM "Subscription"
WHERE user_id = $1
  AND deleted_at IS NULL;
```

### Update Subscription After Payment

```sql
UPDATE "Subscription"
SET
    last_payment_date = $2,
    last_payment_amount = $3,
    total_payments_count = total_payments_count + 1,
    total_amount_paid = total_amount_paid + $3,
    next_billing_date = CASE
        WHEN frequency = 'DAILY' THEN CURRENT_DATE + INTERVAL '1 day'
        WHEN frequency = 'WEEKLY' THEN CURRENT_DATE + INTERVAL '1 week'
        WHEN frequency = 'MONTHLY' THEN CURRENT_DATE + INTERVAL '1 month'
        WHEN frequency = 'QUARTERLY' THEN CURRENT_DATE + INTERVAL '3 months'
        WHEN frequency = 'YEARLY' THEN CURRENT_DATE + INTERVAL '1 year'
    END,
    is_notified = false
WHERE id = $1;
```

---

## Budget Operations

### Get Active Budgets

```sql
SELECT
    b.id,
    b.name,
    b.amount_limit,
    b.amount_spent,
    b.currency,
    b.period,
    b.start_date,
    b.end_date,
    b.alert_threshold,
    c.id AS category_id,
    c.name AS category_name,
    c.color AS category_color,
    (b.amount_spent / NULLIF(b.amount_limit, 0)) AS utilization_ratio
FROM "Budget" b
LEFT JOIN "Category" c ON c.id = b.category_id
WHERE b.user_id = $1
  AND b.is_active = true
  AND b.deleted_at IS NULL
ORDER BY b.created_at DESC;
```

### Update Budget Spending

```sql
UPDATE "Budget" b
SET amount_spent = (
    SELECT COALESCE(SUM(t.amount), 0)
    FROM "Transaction" t
    WHERE t.user_id = b.user_id
      AND t.type = 'DEBIT'
      AND (b.category_id IS NULL OR t.category_id = b.category_id)
      AND t.transaction_date >= b.start_date
      AND (b.end_date IS NULL OR t.transaction_date < b.end_date)
      AND t.deleted_at IS NULL
)
WHERE b.id = $1;
```

### Get Budgets Exceeding Threshold

```sql
SELECT
    b.id,
    b.name,
    b.amount_limit,
    b.amount_spent,
    b.alert_threshold,
    c.name AS category_name,
    (b.amount_spent / NULLIF(b.amount_limit, 0)) AS utilization_ratio
FROM "Budget" b
LEFT JOIN "Category" c ON c.id = b.category_id
WHERE b.user_id = $1
  AND b.is_active = true
  AND b.deleted_at IS NULL
  AND (b.amount_spent / NULLIF(b.amount_limit, 0)) >= b.alert_threshold
ORDER BY utilization_ratio DESC;
```

---

## Notification Operations

### Get Unread Notifications

```sql
SELECT
    id,
    type,
    priority,
    title,
    message,
    data,
    channel,
    created_at
FROM "Notification"
WHERE user_id = $1
  AND is_read = false
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;
```

### Get Unread Count

```sql
SELECT COUNT(*) AS unread_count
FROM "Notification"
WHERE user_id = $1
  AND is_read = false
  AND deleted_at IS NULL;
```

### Mark Notification as Read

```sql
UPDATE "Notification"
SET is_read = true, read_at = NOW()
WHERE id = $1 AND user_id = $2;
```

### Mark All as Read

```sql
UPDATE "Notification"
SET is_read = true, read_at = NOW()
WHERE user_id = $1 AND is_read = false;
```

### Clean Old Notifications

```sql
DELETE FROM "Notification"
WHERE user_id = $1
  AND is_read = true
  AND created_at < CURRENT_DATE - INTERVAL '30 days';
```

---

## SMS Operations

### Get Unprocessed SMS

```sql
SELECT
    id,
    body,
    sender,
    phone_number,
    received_at
FROM "SmsLog"
WHERE user_id = $1
  AND is_processed = false
ORDER BY received_at ASC
LIMIT 100;
```

### Mark SMS as Processed

```sql
UPDATE "SmsLog"
SET
    is_processed = true,
    parsed_data = $2,
    transaction_id = $3
WHERE id = $1;
```

### Get SMS History

```sql
SELECT
    sl.id,
    sl.body,
    sl.sender,
    sl.received_at,
    sl.is_processed,
    sl.parsed_data,
    t.id AS transaction_id,
    t.amount AS transaction_amount
FROM "SmsLog" sl
LEFT JOIN "Transaction" t ON t.id = sl.transaction_id
WHERE sl.user_id = $1
ORDER BY sl.received_at DESC
LIMIT $2 OFFSET $3;
```

---

## Analytics Queries

### Daily Spending Trend (Last 30 Days)

```sql
SELECT
    DATE(transaction_date) AS spending_date,
    COUNT(*) AS transaction_count,
    SUM(amount) AS total_spent,
    AVG(amount) AS avg_transaction,
    MAX(amount) AS max_transaction,
    MIN(amount) AS min_transaction
FROM "Transaction"
WHERE user_id = $1
  AND type = 'DEBIT'
  AND transaction_date >= CURRENT_DATE - INTERVAL '30 days'
  AND deleted_at IS NULL
GROUP BY DATE(transaction_date)
ORDER BY spending_date DESC;
```

### Top Merchants by Spending

```sql
SELECT
    merchant_name,
    COUNT(*) AS transaction_count,
    SUM(amount) AS total_spent,
    AVG(amount) AS avg_transaction,
    MIN(transaction_date) AS first_seen,
    MAX(transaction_date) AS last_seen
FROM "Transaction"
WHERE user_id = $1
  AND type = 'DEBIT'
  AND merchant_name IS NOT NULL
  AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND deleted_at IS NULL
GROUP BY merchant_name
ORDER BY total_spent DESC
LIMIT 10;
```

### Monthly Comparison

```sql
SELECT
    DATE_TRUNC('month', transaction_date) AS month,
    type,
    COUNT(*) AS transaction_count,
    SUM(amount) AS total_amount
FROM "Transaction"
WHERE user_id = $1
  AND deleted_at IS NULL
  AND transaction_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', transaction_date), type
ORDER BY month DESC, type;
```

### Category-wise Monthly Comparison

```sql
SELECT
    c.name AS category_name,
    DATE_TRUNC('month', t.transaction_date) AS month,
    SUM(t.amount) AS total_spent,
    COUNT(*) AS transaction_count
FROM "Transaction" t
LEFT JOIN "Category" c ON c.id = t.category_id
WHERE t.user_id = $1
  AND t.type = 'DEBIT'
  AND t.deleted_at IS NULL
  AND t.transaction_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY c.name, DATE_TRUNC('month', t.transaction_date)
ORDER BY month DESC, total_spent DESC;
```

---

## Audit Operations

### Get User's Audit Trail

```sql
SELECT
    id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address,
    created_at
FROM "AuditLog"
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 100;
```

### Get Entity Change History

```sql
SELECT
    id,
    action,
    old_values,
    new_values,
    created_at
FROM "AuditLog"
WHERE entity_type = $1
  AND entity_id = $2
ORDER BY created_at DESC;
```

---

## Maintenance Queries

### Clean Soft-Deleted Records

```sql
-- Delete soft-deleted records older than 90 days
DELETE FROM "Transaction" WHERE deleted_at < CURRENT_DATE - INTERVAL '90 days';
DELETE FROM "Notification" WHERE deleted_at < CURRENT_DATE - INTERVAL '90 days';
DELETE FROM "SmsLog" WHERE deleted_at < CURRENT_DATE - INTERVAL '90 days';
```

### Expired Refresh Tokens Cleanup

```sql
DELETE FROM "RefreshToken"
WHERE expires_at < CURRENT_TIMESTAMP
   OR revoked_at IS NOT NULL;
```

### Update Budget Spending (Batch)

```sql
-- Update all active budgets with current spending
UPDATE "Budget" b
SET amount_spent = COALESCE(
    (SELECT SUM(t.amount)
     FROM "Transaction" t
     WHERE t.user_id = b.user_id
       AND t.type = 'DEBIT'
       AND (b.category_id IS NULL OR t.category_id = b.category_id)
       AND t.transaction_date >= b.start_date
       AND t.deleted_at IS NULL),
    0
)
WHERE b.is_active = true AND b.deleted_at IS NULL;
```

### Database Statistics

```sql
-- Table sizes
SELECT
    relname AS table_name,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- Index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```
