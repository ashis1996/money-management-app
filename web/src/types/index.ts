// =============================================================
// Domain types — mirrored from mobile/src/types/index.ts.
//
// We keep a hand-maintained copy rather than reaching across the
// monorepo because the mobile types include React Navigation typings
// that are irrelevant on web. When backend DTOs evolve, both copies
// must be updated; long term this should consolidate into
// `shared/dto` once the backend's DTOs cover every domain object.
// =============================================================

export type Archetype =
  | 'SPEND_HEAVY'
  | 'SAVINGS_FOCUSED'
  | 'CREDIT_USER'
  | 'SUBSCRIPTION_HEAVY'
  | 'BALANCED';

export type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TransactionType = 'CREDIT' | 'DEBIT';
export type SubscriptionFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  archetype?: Archetype;
  createdAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  userId: string;
  amount: number;
  type: TransactionType;
  category: string;
  subCategory?: string;
  description?: string;
  merchant?: string;
  date: string;
  rawSms?: string;
  isSubscription: boolean;
  subscriptionId?: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: number;
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  merchant: string;
  nextBillingDate?: string;
  lastPaymentDate?: string;
  category?: string;
  isNotified: boolean;
}

export type AccountType = 'BANK' | 'WALLET' | 'CREDIT_CARD' | 'INVESTMENT' | 'LOAN';

export interface Account {
  id: string;
  userId: string;
  // Backend exposes both legacy `name`/`type` and the canonical
  // `accountName`/`accountType`. We mirror the canonical form here so
  // mutations don't need a translation layer; the API serialiser is
  // responsible for keeping the two in lockstep.
  accountName: string;
  accountType: AccountType;
  providerName?: string;
  maskedAccountNumber?: string;
  ifscCode?: string;
  balance: number;
  currency: string;
  color?: string;
  icon?: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NetWorth {
  assets: number;
  liabilities: number;
  netWorth: number;
  breakdown: {
    bank: number;
    wallet: number;
    creditCard: number;
    investment: number;
    loan: number;
  };
  accountCount: number;
}

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  /**
   * Backend stores the body as `message` (the DTO field is `body` but
   * Prisma maps to `message`). We use `message` here so list rendering
   * doesn't need a translation step. UI components fall back to `body`
   * if a future endpoint returns it under that key.
   */
  message: string;
  body?: string;
  isRead: boolean;
  readAt?: string | null;
  sentAt?: string | null;
  priority?: NotificationPriority;
  channel?: string;
  data?: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  transactionAlerts: boolean;
  subscriptionAlerts: boolean;
  budgetAlerts: boolean;
  insightAlerts: boolean;
  securityAlerts: boolean;
  minAmountForAlert: number;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progressPercent: number;
  category?: string;
  icon?: string;
  color?: string;
  targetDate?: string;
  isCompleted: boolean;
  monthsToGoal?: number | null;
  autoAllocate?: boolean;
  allocationPercent?: number;
  priority?: number;
  currency?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  name?: string;
  category?: string;
  categoryId?: string;
  amount?: number;
  amountLimit?: number;
  /** Mirror of `amountLimit` for display layers. */
  limit?: number;
  spent: number;
  period: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  isActive: boolean;
  startDate: string;
  endDate?: string;
  alertThreshold?: number;
  rollover?: boolean;
  notes?: string;
  daysLeft?: number;
}

// =============================================================
// Weekly summary (mirrors backend WeeklySummaryService output)
// =============================================================
export interface WeeklyTopCategory {
  name: string;
  amount: number;
  count?: number;
}

export interface WeeklyBehaviorInsights {
  lateNightCount?: number;
  lateNightAmount?: number;
  weekendCount?: number;
  weekendAmount?: number;
  impulseCount?: number;
  impulseAmount?: number;
  winsAndImprovements?: {
    wins?: Array<{ title: string; description: string }>;
    improvements?: Array<{ title: string; description: string; amount?: number }>;
  } | null;
  aiStats?: Record<string, unknown> | null;
}

export interface WeeklyRecommendation {
  text: string;
  impact?: number;
}

export interface WeeklySummary {
  id: string;
  userId: string;
  weekStartDate: string;
  weekEndDate: string;
  totalSpent: number;
  totalIncome: number;
  savingsAmount: number;
  /** Backend stores 0..1; UIs scale to 0..100. */
  savingsRate: number;
  topCategories?: WeeklyTopCategory[];
  topMerchants?: WeeklyTopCategory[];
  unusualSpending?: {
    items?: Array<{ merchant: string; amount: number; reason: string }>;
  } | null;
  behaviorInsights?: WeeklyBehaviorInsights;
  aiSummary?: string | null;
  recommendations?: WeeklyRecommendation[];
  createdAt?: string;
}

export interface ActionCard {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: string;
  priority: Priority;
  status: 'PENDING' | 'COMPLETED' | 'DISMISSED';
  impactAmount?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface HealthScoreFactor {
  label: string;
  value: number;
  color?: string;
  weight?: number;
}

export interface HealthScoreResult {
  score: number;
  healthScore?: number;
  grade?: string;
  factors?: HealthScoreFactor[];
  recommendations?: string[];
  computedAt?: string;
}

export interface MoneyLeak {
  type: string;
  title?: string;
  merchant?: string;
  description?: string;
  monthly_savings?: number;
  amount?: number;
}

export interface MoneyLeaksResult {
  score?: number;
  leak_score?: number;
  potential_monthly_savings?: number;
  monthly_savings?: number;
  leaks?: MoneyLeak[];
}

export interface DashboardStats {
  totalBalance?: number;
  monthlyIncome?: number;
  monthlyExpense?: number;
  netSavings?: number;
  savingsRate?: number;
  topCategory?: string;
  upcomingDues?: number;
  activeSubscriptions?: number;
}

export interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface MerchantSpending {
  merchant: string;
  amount: number;
  transactionCount: number;
}

export interface Insight {
  period: string;
  totalSpent: number;
  totalIncome: number;
  netSavings: number;
  savingsRate: number;
  byCategory: CategorySpending[];
  topMerchants: MerchantSpending[];
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: unknown;
  timestamp?: string;
}
