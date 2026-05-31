// =============================================================
// Domain types shared with the backend.
//
// These mirror the Prisma schema closely, but stay loose where the
// backend may extend a payload (e.g. analytics blobs). Use the
// `*Payload` aliases for create/update bodies — the response types
// are the canonical source of truth for a record once persisted.
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

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  color?: string;
  icon?: string;
  isActive: boolean;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progressPercent: number;
  category?: string;
  targetDate?: string;
  isCompleted: boolean;
  createdAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  category: string;
  amount: number;
  spent: number;
  period: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  isActive: boolean;
  startDate: string;
  endDate?: string;
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
  /** Legacy alias used by some consumers; mirrors `score`. */
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

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
  phone?: string;
}

export interface CreateTransactionPayload {
  accountId?: string;
  amount: number;
  type: TransactionType;
  category: string;
  description?: string;
  merchant?: string;
  date: string;
}

// =============================================================
// Navigation types (mobile only)
// =============================================================

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  TransactionDetail: { id: string };
  SubscriptionDetail: { id: string };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Transactions: undefined;
  Subscriptions: undefined;
  Insights: undefined;
  Settings: undefined;
};
