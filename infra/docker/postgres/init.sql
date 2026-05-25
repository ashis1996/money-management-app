-- Initial database setup for Money Management Application
-- This runs automatically when the PostgreSQL container starts

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('CREDIT', 'DEBIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_frequency AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('TRANSACTION', 'SUBSCRIPTION', 'BUDGET_ALERT', 'INSIGHT', 'REMINDER', 'SECURITY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for common queries (Prisma will create tables)
-- These are additional performance optimizations

-- Comment out if using Prisma migrations
-- The following are examples of additional indexes you might want

-- Index for transaction date range queries
-- CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON "Transaction"("userId", "date");

-- Index for subscription status filtering
-- CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON "Subscription"("userId", "status");

-- Index for notification read status
-- CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON "Notification"("userId", "read");

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE money_management TO postgres;
