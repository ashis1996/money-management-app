# Database Performance Optimization Guide

## Overview

This document outlines performance optimization strategies for the MoneyMind PostgreSQL database, including indexing, partitioning, caching, and query optimization techniques.

---

## 1. Indexing Strategy

### 1.1 B-Tree Indexes (Default)

B-tree indexes are optimal for equality and range queries.

```sql
-- Primary lookup indexes
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);

-- Filter indexes
CREATE INDEX idx_transactions_category ON transactions(user_id, category_id);
CREATE INDEX idx_transactions_type ON transactions(user_id, type);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
```

### 1.2 BRIN Indexes for Time-Series Data

BRIN (Block Range Index) is ideal for time-series data with natural ordering.

```sql
-- Transactions table - date-based queries
CREATE INDEX idx_transactions_date_brin ON transactions USING BRIN(transaction_date);

-- SMS logs - received date
CREATE INDEX idx_sms_logs_received_brin ON sms_logs USING BRIN(received_at);

-- Audit logs - created date
CREATE INDEX idx_audit_logs_created_brin ON audit_logs USING BRIN(created_at);
```

**Benefits:**
- 100x smaller than B-tree for time-series
- Efficient for range queries on monotonically increasing values
- Minimal maintenance overhead

### 1.3 GIN Indexes for JSONB

GIN (Generalized Inverted Index) for JSONB column queries.

```sql
-- Metadata columns
CREATE INDEX idx_transactions_metadata ON transactions USING GIN(metadata);
CREATE INDEX idx_accounts_metadata ON accounts USING GIN(metadata);
CREATE INDEX idx_user_notification_prefs ON users USING GIN(notification_prefs);

-- Full-text search on transaction description
CREATE INDEX idx_transactions_description_gin ON transactions USING GIN(to_tsvector('english', description));
```

### 1.4 Partial Indexes

Partial indexes for commonly filtered subsets.

```sql
-- Active users only
CREATE INDEX idx_users_active ON users(email) WHERE is_active = true AND deleted_at IS NULL;

-- Active subscriptions
CREATE INDEX idx_subscriptions_active ON subscriptions(user_id, next_billing_date)
    WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- Active budgets
CREATE INDEX idx_budgets_active ON budgets(user_id, amount_spent, amount_limit)
    WHERE is_active = true AND deleted_at IS NULL;

-- Unread notifications
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at)
    WHERE is_read = false AND deleted_at IS NULL;

-- Unprocessed SMS logs
CREATE INDEX idx_sms_logs_pending ON sms_logs(user_id, received_at)
    WHERE is_processed = false;
```

### 1.5 Covering Indexes

Covering indexes include all columns needed for a query.

```sql
-- Dashboard balance lookup (avoids table scan)
CREATE INDEX idx_accounts_user_balance_covering
    ON accounts(user_id, is_active) INCLUDE (balance, account_type, currency);

-- Transaction summary (avoids table scan)
CREATE INDEX idx_transactions_user_type_amount
    ON transactions(user_id, type, transaction_date) INCLUDE (amount, category_id);

-- Notification count
CREATE INDEX idx_notifications_user_read_covering
    ON notifications(user_id, is_read) INCLUDE (type, created_at)
    WHERE deleted_at IS NULL;
```

---

## 2. Table Partitioning

### 2.1 Transaction Partitioning by Month

For high-volume transaction tables, partition by date range.

```sql
-- Create partitioned table
CREATE TABLE transactions_partitioned (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    type transaction_type_enum NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL,
    -- other columns...
    PRIMARY KEY (id, transaction_date)
) PARTITION BY RANGE (transaction_date);

-- Create monthly partitions
CREATE TABLE transactions_2024_01 PARTITION OF transactions_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE transactions_2024_02 PARTITION OF transactions_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Future partitions (automate this)
CREATE TABLE transactions_2024_03 PARTITION OF transactions_partitioned
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
```

### 2.2 Partition Maintenance Script

```sql
-- Function to create next month's partition
CREATE OR REPLACE FUNCTION create_transaction_partition()
RETURNS void AS $$
DECLARE
    next_month DATE;
    partition_name TEXT;
BEGIN
    next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    partition_name := 'transactions_' || TO_CHAR(next_month, 'YYYY_MM');

    EXECUTE FORMAT(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF transactions_partitioned
         FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        next_month,
        next_month + INTERVAL '1 month'
    );

    RAISE NOTICE 'Created partition: %', partition_name;
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly (using pg_cron or external scheduler)
-- SELECT cron.schedule('create-tx-partition', '0 0 25 * *', 'SELECT create_transaction_partition()');
```

### 2.3 Partition Benefits

| Benefit | Impact |
|---------|--------|
| Query Performance | 10-100x faster for date-range queries |
| Maintenance | Drop old partitions instead of DELETE |
| Index Size | Smaller indexes per partition |
| Vacuum | Faster VACUUM on smaller tables |

---

## 3. Caching Strategy (Redis)

### 3.1 Cache Keys Design

```
# User data
user:{id}:profile                    # Hash - profile data (1 hour TTL)
user:{id}:accounts                   # List - account summaries (10 min TTL)
user:{id}:dashboard                  # Hash - dashboard stats (5 min TTL)

# Transactions
user:{id}:transactions:recent        # List - last 50 transactions (5 min TTL)
user:{id}:transactions:month:{YYYY-MM} # Hash - monthly summary (1 hour TTL)

# Subscriptions
user:{id}:subscriptions:active       # List - active subscriptions (15 min TTL)
user:{id}:subscriptions:upcoming     # Sorted Set - by next_billing_date (10 min TTL)

# Budgets
user:{id}:budgets:current            # Hash - current month budgets (10 min TTL)
user:{id}:budgets:alert              # Set - budgets exceeding threshold (5 min TTL)

# Categories
categories:system                    # List - system categories (1 hour TTL)
user:{id}:categories                 # List - user custom categories (30 min TTL)

# Notifications
user:{id}:notifications:unread:count # Integer - unread count (2 min TTL)
user:{id}:notifications:recent       # List - last 20 notifications (10 min TTL)

# Sessions
session:{sessionId}                  # Hash - session data (7 days TTL)

# Rate limiting
ratelimit:{userId}:{endpoint}        # Integer - request count (1 min TTL)
```

### 3.2 Cache Invalidation Strategy

```typescript
// Cache-aside pattern with write-through invalidation
class CacheService {
  // Transaction cache invalidation
  async invalidateTransactionCache(userId: string) {
    const keys = [
      `user:${userId}:transactions:recent`,
      `user:${userId}:dashboard`,
      `user:${userId}:budgets:current`,
    ];
    await this.redis.del(...keys);
  }

  // Budget cache invalidation
  async invalidateBudgetCache(userId: string) {
    const keys = [
      `user:${userId}:budgets:current`,
      `user:${userId}:dashboard`,
    ];
    await this.redis.del(...keys);
  }

  // Full user cache invalidation
  async invalidateUserCache(userId: string) {
    const pattern = `user:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### 3.3 Cache Hit Rate Monitoring

```sql
-- Redis stats to monitor
INFO stats

# Key metrics:
# keyspace_hits:1000000
# keyspace_misses:100000
# hit_rate = hits / (hits + misses) = 90.9%
```

**Target hit rates:**
- User profile: >95%
- Recent transactions: >85%
- Dashboard stats: >90%
- Categories: >99%

---

## 4. Query Optimization

### 4.1 Efficient Transaction Queries

```sql
-- ✅ GOOD: Uses covering index
SELECT id, amount, type, transaction_date, category_id
FROM transactions
WHERE user_id = $1
  AND transaction_date >= $2
  AND transaction_date < $3
ORDER BY transaction_date DESC
LIMIT 50;

-- ❌ BAD: SELECT * with no limit
SELECT * FROM transactions WHERE user_id = $1;

-- ✅ GOOD: Aggregation with index
SELECT
    category_id,
    SUM(amount) as total,
    COUNT(*) as count
FROM transactions
WHERE user_id = $1
  AND type = 'DEBIT'
  AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY category_id;
```

### 4.2 Pagination Strategies

```sql
-- Offset pagination (simple but slow for large offsets)
SELECT * FROM transactions
WHERE user_id = $1
ORDER BY transaction_date DESC
LIMIT 20 OFFSET 1000;  -- Slow!

-- Cursor-based pagination (recommended)
SELECT * FROM transactions
WHERE user_id = $1
  AND (transaction_date, id) < ($2, $3)
ORDER BY transaction_date DESC, id DESC
LIMIT 20;

-- Keyset pagination with explicit key
SELECT * FROM transactions
WHERE user_id = $1
  AND transaction_date < $2
ORDER BY transaction_date DESC
LIMIT 20;
```

### 4.3 Materialized Views

```sql
-- Monthly spending summary
CREATE MATERIALIZED VIEW monthly_spending_summary AS
SELECT
    user_id,
    DATE_TRUNC('month', transaction_date) AS month,
    category_id,
    SUM(amount) AS total_spent,
    COUNT(*) AS transaction_count,
    AVG(amount) AS avg_transaction
FROM transactions
WHERE type = 'DEBIT' AND deleted_at IS NULL
GROUP BY user_id, DATE_TRUNC('month', transaction_date), category_id;

-- Index for fast lookup
CREATE UNIQUE INDEX ON monthly_spending_summary(user_id, month, category_id);

-- Refresh strategy (daily or on-demand)
REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_spending_summary;

-- Subscription metrics
CREATE MATERIALIZED VIEW subscription_metrics AS
SELECT
    user_id,
    COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_count,
    SUM(amount) FILTER (WHERE status = 'ACTIVE' AND frequency = 'MONTHLY') AS monthly_total,
    MIN(next_billing_date) FILTER (WHERE status = 'ACTIVE') AS next_billing
FROM subscriptions
WHERE deleted_at IS NULL
GROUP BY user_id;
```

### 4.4 Query Analysis

```sql
-- Enable query logging
SET log_min_duration_statement = 100;  -- Log queries > 100ms

-- Analyze slow queries
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM transactions
WHERE user_id = 'uuid-here'
  AND transaction_date >= '2024-01-01';

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- Find missing indexes (sequential scans on large tables)
SELECT relname, seq_scan, seq_tup_read
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_scan DESC;
```

---

## 5. Connection Pooling

### 5.1 PgBouncer Configuration

```ini
; /etc/pgbouncer/pgbouncer.ini

[databases]
money_management = host=localhost port=5432 dbname=money_management

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Pool settings
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5

; Timeouts
server_lifetime = 3600
server_idle_timeout = 600
client_idle_timeout = 0

; Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
```

### 5.2 Application Pool Settings

```typescript
// Prisma connection pool settings
// DATABASE_URL with pool settings
postgresql://user:pass@localhost:5432/money_management?
  connection_limit=10&
  pool_timeout=30&
  connect_timeout=10
```

---

## 6. Vacuum and Maintenance

### 6.1 Autovacuum Tuning

```sql
-- Check autovacuum status
SELECT
    schemaname,
    relname,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    n_dead_tup,
    n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public';

-- Aggressive autovacuum for high-churn tables
ALTER TABLE transactions SET (
    autovacuum_vacuum_threshold = 50,
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_threshold = 50,
    autovacuum_analyze_scale_factor = 0.05
);

-- Manual vacuum for maintenance windows
VACUUM ANALYZE transactions;
VACUUM FULL transactions;  -- Use sparingly - locks table
```

### 6.2 Statistics Updates

```sql
-- Update statistics manually if needed
ANALYZE transactions;
ANALYZE subscriptions;

-- Check statistics freshness
SELECT
    relname,
    last_analyze,
    last_autoanalyze,
    n_mod_since_analyze
FROM pg_stat_user_tables;
```

---

## 7. Performance Monitoring

### 7.1 Key Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Query p99 latency | <100ms | >500ms |
| Connection pool usage | <70% | >90% |
| Cache hit rate | >90% | <80% |
| Transaction table size | <10GB/partition | N/A |
| Dead tuple ratio | <5% | >20% |
| Index scan ratio | >80% | <50% |

### 7.2 Monitoring Queries

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - pg_stat_activity.query_start > interval '5 minutes';

-- Table sizes
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS data_size,
    pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Cache hit ratio
SELECT
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) AS ratio
FROM pg_statio_user_tables;
```

---

## 8. Scaling Strategies

### 8.1 Read Replicas

```sql
-- Primary: Read-write operations
-- Replica 1: Analytics and reporting queries
-- Replica 2: Backup and exports

-- Application routing
const dbConfig = {
  primary: 'postgresql://primary:5432/money_management',
  replicas: [
    'postgresql://replica1:5432/money_management',
    'postgresql://replica2:5432/money_management',
  ],
};
```

### 8.2 Horizontal Partitioning (Sharding)

For extreme scale, shard by user_id:

```sql
-- Using Citus extension or application-level sharding
-- Shard 1: user_id % 4 = 0
-- Shard 2: user_id % 4 = 1
-- Shard 3: user_id % 4 = 2
-- Shard 4: user_id % 4 = 3
```

---

## 9. Backup and Recovery

### 9.1 Backup Strategy

```bash
# Daily full backup
pg_dump -h localhost -U postgres money_management | gzip > backup_$(date +%Y%m%d).sql.gz

# Point-in-time recovery (WAL archiving)
# postgresql.conf:
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backup/wal/%f'
```

### 9.2 Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Single row delete | <1 min | 0 |
| Table corruption | <1 hour | <5 min |
| Full database recovery | <4 hours | <1 hour |

---

## Summary

### Quick Wins

1. Add BRIN index on `transactions.transaction_date`
2. Add partial index on `subscriptions` for active status
3. Implement Redis caching for dashboard data
4. Switch to cursor-based pagination
5. Create materialized view for monthly summaries

### Medium-Term

1. Implement table partitioning for transactions
2. Set up PgBouncer for connection pooling
3. Create covering indexes for common queries
4. Implement cache invalidation strategy

### Long-Term

1. Set up read replicas for scaling
2. Implement sharding if needed
3. Automated partition management
4. Comprehensive monitoring dashboard
