import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import type {
  Account,
  ActionCard,
  AppNotification,
  AuthResponse,
  Budget,
  CategorySpending,
  CreateTransactionPayload,
  DashboardStats,
  Goal,
  HealthScoreResult,
  Insight,
  MoneyLeaksResult,
  Subscription,
  SubscriptionStatus,
  Transaction,
  TransactionType,
  User,
} from '../types';

// =============================================================
// Base URL resolution
//
// Order: EXPO_PUBLIC_API_URL  ->  expoConfig.extra.apiUrl  ->  fallback
// The fallback is the Android emulator default; we log a warning in dev
// so contributors notice the missing config quickly.
// =============================================================
const FALLBACK_BASE_URL = 'http://10.0.2.2:3000/api/v1';

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv;

  const fromConfig = (Constants?.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (fromConfig) return fromConfig;

  if (__DEV__) {
    console.warn(
      '[api] No EXPO_PUBLIC_API_URL or app.json extra.apiUrl set — falling back to',
      FALLBACK_BASE_URL,
    );
  }
  return FALLBACK_BASE_URL;
}

export const API_BASE_URL = resolveBaseUrl();

// =============================================================
// Envelope: every successful response from the NestJS backend is
// wrapped by ResponseInterceptor with this shape.
// =============================================================
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: unknown;
  timestamp?: string;
}

// =============================================================
// API client (singleton).
//
// Notable behaviour:
//   * Bearer token injected on every outgoing request.
//   * On 401 we attempt /auth/refresh **once** and replay the request.
//     A shared in-flight promise serialises concurrent 401s so we don't
//     fire N refresh calls when N requests fail simultaneously.
// =============================================================
class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string | null> | null = null;
  private static instance: ApiClient;

  private constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30_000,
    });

    this.setupInterceptors();
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await SecureStore.getItemAsync('accessToken');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as
          | (InternalAxiosRequestConfig & { _retried?: boolean })
          | undefined;

        const is401 = error.response?.status === 401;
        const alreadyRetried = originalRequest?._retried === true;

        // Don't recurse on the refresh call itself.
        const isRefreshCall = originalRequest?.url?.includes('/auth/refresh');

        if (!is401 || !originalRequest || alreadyRetried || isRefreshCall) {
          return Promise.reject(error);
        }

        try {
          const newAccessToken = await this.refreshAccessToken();
          if (!newAccessToken) {
            return Promise.reject(error);
          }

          originalRequest._retried = true;
          if (!originalRequest.headers) {
            originalRequest.headers = {} as InternalAxiosRequestConfig['headers'];
          }
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return this.client(originalRequest);
        } catch (refreshError) {
          await SecureStore.deleteItemAsync('accessToken');
          await SecureStore.deleteItemAsync('refreshToken');
          return Promise.reject(refreshError);
        }
      },
    );
  }

  /**
   * Returns a shared in-flight refresh promise so concurrent 401s
   * collapse into a single network round-trip. Resolves to the new
   * access token, or null if there's no refresh token to use.
   */
  private refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) return null;

        // Use a bare axios call to avoid bouncing through interceptors.
        const response = await axios.post<ApiEnvelope<AuthResponse>>(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' }, timeout: 30_000 },
        );

        const tokens = response.data?.data;
        if (!tokens?.accessToken || !tokens?.refreshToken) return null;

        await SecureStore.setItemAsync('accessToken', tokens.accessToken);
        await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);
        return tokens.accessToken;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const api = ApiClient.getInstance();

// Convenience: every endpoint returns ApiEnvelope<T>, so this saves
// a layer of generics at every call-site.
type Env<T> = ApiEnvelope<T>;

// =============================================================
// AUTH
// =============================================================
export const authApi = {
  login: (email: string, password: string) =>
    api.post<Env<AuthResponse>>('/auth/login', { email, password }),

  register: (email: string, password: string, name?: string, phone?: string) =>
    api.post<Env<AuthResponse>>('/auth/register', {
      email,
      password,
      name,
      phone,
    }),

  logout: (refreshToken?: string) => api.post<Env<{ ok: true }>>('/auth/logout', { refreshToken }),

  getProfile: () => api.get<Env<User>>('/users/me'),

  updateProfile: (data: Partial<User>) => api.put<Env<User>>('/users/me', data),
};

// =============================================================
// TRANSACTIONS
// =============================================================
export interface TransactionFilters {
  from?: string;
  to?: string;
  category?: string;
  search?: string;
  type?: TransactionType;
}

export const transactionsApi = {
  getAll: (params?: TransactionFilters) => api.get<Env<Transaction[]>>('/transactions', { params }),

  getById: (id: string) => api.get<Env<Transaction>>(`/transactions/${id}`),

  create: (data: CreateTransactionPayload) => api.post<Env<Transaction>>('/transactions', data),

  update: (id: string, data: Partial<CreateTransactionPayload>) =>
    api.put<Env<Transaction>>(`/transactions/${id}`, data),

  delete: (id: string) => api.delete<Env<{ ok: true }>>(`/transactions/${id}`),

  getCategories: (from?: string, to?: string) =>
    api.get<Env<CategorySpending[]>>('/transactions/analytics/categories', {
      params: { from, to },
    }),

  getMonthlyStats: (year: number, month: number) =>
    api.get<Env<Insight>>('/transactions/analytics/monthly', {
      params: { year, month },
    }),

  search: (query: string) =>
    api.get<Env<Transaction[]>>('/transactions/search', {
      params: { q: query },
    }),
};

// =============================================================
// SMS
// =============================================================
export interface SmsMessage {
  body: string;
  sender: string;
  timestamp: string;
  phoneNumber?: string;
}

export const smsApi = {
  ingest: (message: SmsMessage) => api.post<Env<{ ok: true }>>('/sms/ingest', message),

  ingestBatch: (messages: SmsMessage[]) =>
    api.post<Env<{ processed: number }>>('/sms/ingest/batch', { messages }),

  getHistory: (page?: number, limit?: number) =>
    api.get<Env<{ items: unknown[]; total: number }>>('/sms/history', {
      params: { page, limit },
    }),

  getUnprocessed: (limit?: number) =>
    api.get<Env<unknown[]>>('/sms/unprocessed', { params: { limit } }),
};

// =============================================================
// SUBSCRIPTIONS
// =============================================================
export const subscriptionsApi = {
  getAll: (status?: SubscriptionStatus | string) =>
    api.get<Env<Subscription[]>>('/subscriptions', { params: { status } }),

  getById: (id: string) => api.get<Env<Subscription>>(`/subscriptions/${id}`),

  create: (data: Partial<Subscription>) => api.post<Env<Subscription>>('/subscriptions', data),

  update: (id: string, data: Partial<Subscription>) =>
    api.put<Env<Subscription>>(`/subscriptions/${id}`, data),

  delete: (id: string) => api.delete<Env<{ ok: true }>>(`/subscriptions/${id}`),

  detect: () => api.post<Env<{ created: number }>>('/subscriptions/detect'),

  getSummary: () =>
    api.get<Env<{ active: number; monthlyTotal: number; upcomingDues: number }>>(
      '/subscriptions/summary',
    ),

  getUpcoming: (days?: number) =>
    api.get<Env<Subscription[]>>('/subscriptions/upcoming', {
      params: { days },
    }),

  cancel: (id: string) => api.post<Env<Subscription>>(`/subscriptions/${id}/cancel`),

  pause: (id: string) => api.post<Env<Subscription>>(`/subscriptions/${id}/pause`),

  resume: (id: string) => api.post<Env<Subscription>>(`/subscriptions/${id}/resume`),
};

// =============================================================
// INSIGHTS
// =============================================================
export const insightsApi = {
  getAll: () => api.get<Env<Insight & Record<string, unknown>>>('/insights'),

  getSpending: (period?: string) =>
    api.get<Env<Insight & Record<string, unknown>>>('/insights/spending', {
      params: { period },
    }),

  getRecommendations: () =>
    api.get<Env<Array<{ id: string; title: string; body: string }>>>('/insights/recommendations'),

  getPredictions: () =>
    api.get<Env<{ nextMonthSpend?: number; categories?: CategorySpending[] }>>(
      '/insights/predictions',
    ),

  getAnomalies: () =>
    api.get<Env<Array<{ id: string; title: string; description: string; amount: number }>>>(
      '/insights/anomalies',
    ),
};

// =============================================================
// NOTIFICATIONS
// =============================================================
export const notificationsApi = {
  getAll: (unread?: boolean) =>
    api.get<Env<AppNotification[]>>('/notifications', { params: { unread } }),

  getUnreadCount: () => api.get<Env<{ count: number }>>('/notifications/unread/count'),

  markAsRead: (id: string) => api.put<Env<AppNotification>>(`/notifications/${id}/read`),

  markAllAsRead: () => api.post<Env<{ updated: number }>>('/notifications/read-all'),

  getPreferences: () => api.get<Env<Record<string, boolean>>>('/notifications/preferences'),

  updatePreferences: (data: Record<string, boolean>) =>
    api.put<Env<Record<string, boolean>>>('/notifications/preferences', data),
};

// =============================================================
// DASHBOARD
// =============================================================
export const dashboardApi = {
  getStats: () => api.get<Env<DashboardStats>>('/users/dashboard'),
};

// =============================================================
// GOALS
// =============================================================
export const goalsApi = {
  getAll: (params?: { isCompleted?: boolean; category?: string }) =>
    api.get<Env<Goal[]>>('/goals', { params }),

  getById: (id: string) => api.get<Env<Goal>>(`/goals/${id}`),

  getSummary: () =>
    api.get<Env<{ active: number; completed: number; totalTarget: number }>>('/goals/summary'),

  create: (data: Partial<Goal>) => api.post<Env<Goal>>('/goals', data),

  update: (id: string, data: Partial<Goal>) => api.put<Env<Goal>>(`/goals/${id}`, data),

  delete: (id: string) => api.delete<Env<{ ok: true }>>(`/goals/${id}`),

  contribute: (id: string, amount: number, note?: string) =>
    api.post<Env<Goal>>(`/goals/${id}/contribute`, { amount, note }),
};

// =============================================================
// BUDGETS
// =============================================================
export const budgetsApi = {
  getAll: (params?: { isActive?: boolean; period?: string }) =>
    api.get<Env<Budget[]>>('/budgets', { params }),

  getById: (id: string) => api.get<Env<Budget>>(`/budgets/${id}`),

  getSummary: () =>
    api.get<Env<{ activeCount: number; totalAllocated: number; totalSpent: number }>>(
      '/budgets/summary',
    ),

  create: (data: Partial<Budget>) => api.post<Env<Budget>>('/budgets', data),

  update: (id: string, data: Partial<Budget>) => api.put<Env<Budget>>(`/budgets/${id}`, data),

  delete: (id: string) => api.delete<Env<{ ok: true }>>(`/budgets/${id}`),
};

// =============================================================
// ACCOUNTS
// =============================================================
export const accountsApi = {
  getAll: (params?: { accountType?: string; isActive?: boolean }) =>
    api.get<Env<Account[]>>('/accounts', { params }),

  getById: (id: string) => api.get<Env<Account>>(`/accounts/${id}`),

  getNetWorth: () =>
    api.get<Env<{ total: number; byType: Record<string, number> }>>('/accounts/net-worth'),

  create: (data: Partial<Account>) => api.post<Env<Account>>('/accounts', data),

  update: (id: string, data: Partial<Account>) => api.put<Env<Account>>(`/accounts/${id}`, data),

  delete: (id: string) => api.delete<Env<{ ok: true }>>(`/accounts/${id}`),

  setPrimary: (id: string) => api.post<Env<Account>>(`/accounts/${id}/set-primary`),

  recompute: (id: string) => api.post<Env<Account>>(`/accounts/${id}/recompute`),
};

// =============================================================
// ACTION CARDS
// =============================================================
export const actionCardsApi = {
  getAll: (params?: { status?: string; priority?: string; type?: string }) =>
    api.get<Env<ActionCard[]>>('/action-cards', { params }),

  getById: (id: string) => api.get<Env<ActionCard>>(`/action-cards/${id}`),

  getSummary: () =>
    api.get<Env<{ pending: number; completed: number; dismissed: number }>>(
      '/action-cards/summary',
    ),

  create: (data: Partial<ActionCard>) => api.post<Env<ActionCard>>('/action-cards', data),

  update: (id: string, data: Partial<ActionCard>) =>
    api.put<Env<ActionCard>>(`/action-cards/${id}`, data),

  delete: (id: string) => api.delete<Env<{ ok: true }>>(`/action-cards/${id}`),

  dismiss: (id: string) => api.post<Env<ActionCard>>(`/action-cards/${id}/dismiss`),

  complete: (id: string) => api.post<Env<ActionCard>>(`/action-cards/${id}/complete`),
};

// =============================================================
// AI PROXY (FastAPI passthrough)
// =============================================================
export interface AiAnswer {
  answer: string;
  sources?: string[];
  meta?: Record<string, unknown>;
}

export const aiApi = {
  health: () => api.get<Env<{ status: string }>>('/ai/health'),

  // Wide return type — the Python AI service evolves field names freely
  // (camelCase vs snake_case, additional behavioural breakdowns), so we
  // let consumers narrow at the access site rather than having TypeScript
  // pretend a stale shape is canonical.
  analyzeBehavior: () => api.post<Env<Record<string, unknown>>>('/ai/behavior/analyze'),

  tagTransactions: () => api.post<Env<{ tagged: number }>>('/ai/behavior/tag-transactions'),

  getHealthScore: () =>
    api.post<Env<HealthScoreResult & Record<string, unknown>>>('/ai/health-score/calculate'),

  detectLeaks: () => api.post<Env<MoneyLeaksResult & Record<string, unknown>>>('/ai/leaks/detect'),

  ask: (query: string, context?: Record<string, unknown>) =>
    api.post<Env<AiAnswer>>('/ai/assistant/query', { query, context }),

  determineArchetype: () =>
    api.post<Env<{ archetype: string; confidence?: number } & Record<string, unknown>>>(
      '/ai/profile/archetype',
    ),

  generateActionCards: () => api.post<Env<{ created: number }>>('/ai/action-cards/generate'),

  getPersonalizedDashboard: () =>
    api.post<Env<Record<string, unknown>>>('/ai/dashboard/personalized'),
};

// =============================================================
// WEEKLY SUMMARY
// =============================================================
export interface WeeklySummary {
  id: string;
  weekStart: string;
  weekEnd: string;
  totalIncome: number;
  totalSpent: number;
  netSavings: number;
  highlights?: string[];
  lowlights?: string[];
  createdAt: string;
}

export const weeklySummaryApi = {
  getList: (limit?: number) =>
    api.get<Env<WeeklySummary[]>>('/weekly-summary', { params: { limit } }),

  getCurrent: () => api.get<Env<WeeklySummary | null>>('/weekly-summary/current'),

  getById: (id: string) => api.get<Env<WeeklySummary>>(`/weekly-summary/${id}`),

  generate: (forDate?: string) =>
    api.post<Env<WeeklySummary>>('/weekly-summary/generate', null, {
      params: { forDate },
    }),

  delete: (id: string) => api.delete<Env<{ ok: true }>>(`/weekly-summary/${id}`),
};
