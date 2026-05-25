# AI Features Implementation Guide

## Overview

This document describes the AI-powered features implemented in the Money Management application.

## Core Architecture

### Multi-Mode Transaction Capture

The app supports three capture modes:

1. **Auto-Capture Mode**
   - SMS parsing (bank, credit card, UPI notifications)
   - Email parsing (subscriptions, invoices)
   - Bank API integration (future)
   - Automatic categorization and merchant detection

2. **Manual Mode**
   - For cash transactions
   - Missed SMS/email transactions
   - Shared expenses
   - Corrections to auto-captured data

3. **Assisted Mode** (AI-Powered)
   - AI suggests category, merchant, recurrence
   - User confirms or modifies suggestions
   - Learns from user corrections

### User Archetype System

Users are classified into financial archetypes:

| Archetype | Characteristics | Dashboard Priority |
|-----------|----------------|-------------------|
| SPEND_HEAVY | High discretionary spending, low savings rate | Leak alerts, impulse detection |
| SAVINGS_FOCUSED | High savings rate, controlled spending | Goal progress, investment tips |
| CREDIT_USER | Heavy credit card usage | Due dates, EMI tracking, interest alerts |
| SUBSCRIPTION_HEAVY | Multiple subscriptions | Renewal calendar, cancel suggestions |
| BALANCED | Moderate across all metrics | General financial health |

### Financial Health Score

A comprehensive 0-100 score based on:

| Component | Weight | Description |
|-----------|--------|-------------|
| Savings Rate | 25% | Percentage of income saved |
| Budget Adherence | 20% | How well budgets are followed |
| Subscription Health | 15% | Unused/duplicate subscriptions |
| Spending Consistency | 15% | Variance in daily spending |
| Impulse Control | 10% | Ratio of impulse purchases |
| Goal Progress | 10% | Progress toward savings goals |
| Credit Utilization | 5% | Credit card usage (future) |

### Money Leak Score

Detects and quantifies money leaks:

- **Unused Subscriptions**: Low-usage services still being paid
- **Duplicate Services**: Multiple subscriptions for same category (e.g., 3 music services)
- **Price Increases**: Silent price hikes on subscriptions
- **Small Frequent Expenses**: Small purchases that add up (e.g., ₹99 x 20 = ₹1,980)
- **Impulse Purchases**: Emotional/late-night spending
- **Late-Night Spending**: Purchases after 10 PM (high impulse correlation)

### Behavioral Analysis

Detects spending patterns:

- **Time-based patterns**: Late-night, weekend spending
- **Impulse detection**: Based on amount, category, time, merchant
- **Emotional triggers**: Stress shopping, celebration spending
- **Habit loops**: Recurring unnecessary expenses

## API Endpoints

### Behavioral Analysis

```
POST /api/v1/behavior/analyze
POST /api/v1/behavior/tag-transactions
```

### Financial Health

```
POST /api/v1/health-score/calculate
```

### Leak Detection

```
POST /api/v1/leaks/detect
```

### AI Assistant

```
POST /api/v1/assistant/query
```

Natural language queries supported:
- "Where did I waste money this month?"
- "Can I afford ₹50,000 for a phone?"
- "How can I save ₹10,000/month?"
- "What subscriptions should I cancel?"

### User Profiling

```
POST /api/v1/profile/archetype
```

### Action Cards

```
POST /api/v1/action-cards/generate
```

### Personalized Dashboard

```
POST /api/v1/dashboard/personalized
```

Returns a comprehensive dashboard tailored to the user's archetype.

## Database Models

### New Enums

- `CaptureMode`: AUTO, MANUAL, ASSISTED
- `UserArchetype`: SPEND_HEAVY, SAVINGS_FOCUSED, CREDIT_USER, SUBSCRIPTION_HEAVY, BALANCED

### User Model Extensions

- `archetype`: User's financial archetype
- `financialHealthScore`: 0-100 score
- `moneyLeakScore`: 0-100 leak score
- `behaviorProfile`: JSON with spending patterns
- `dashboardPrefs`: Customized dashboard configuration
- `preferredCaptureMode`: Default capture mode

### Transaction Model Extensions

- `captureMode`: How the transaction was captured
- `aiSuggestedCategory`: AI-suggested category
- `aiConfidence`: Confidence score for AI suggestions
- `isUserConfirmed`: User confirmation flag
- `isImpulse`: Impulse purchase flag
- `isLateNight`: Late-night purchase flag
- `isWeekend`: Weekend purchase flag
- `emotionTag`: Emotional state if detected

### New Models

- **Goal**: Savings goals with progress tracking
- **ActionCard**: Personalized action items
- **WeeklySummary**: Personalized weekly summaries
- **BehavioralPattern**: Stored behavior patterns

## Implementation Notes

### AI Service Communication

The backend NestJS service communicates with the AI FastAPI service via HTTP. Key integration points:

1. Transaction ingestion → AI categorization
2. Subscription detection → AI pattern analysis
3. Dashboard generation → AI personalization
4. Natural language queries → AI assistant

### Caching Strategy

- Financial health score: Calculate daily, cache for 24 hours
- Leak detection: Calculate on demand, cache for 1 hour
- Archetype: Calculate weekly, cache until recalculation

### Future Enhancements

1. **Voice Entry**: "Spent ₹200 on chai"
2. **Split Expenses**: Group payment tracking
3. **UPI Pattern Detection**: Better GPay/PhonePe/Paytm parsing
4. **Account Aggregator Integration**: Indian financial data sharing
5. **Gamification**: Challenges, streaks, achievements
