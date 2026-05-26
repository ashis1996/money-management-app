import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api/v1';

/**
 * NestJS wraps every successful response with the ResponseInterceptor:
 *   { success: true, data: <payload>, message?, errors?, timestamp? }
 * Hooks consume `data` directly so we type the wrapper here.
 */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: any;
  timestamp?: string;
}

class ApiClient {
  private client: AxiosInstance;
  private static instance: ApiClient;

  private constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
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
    // Auth header
    this.client.interceptors.request.use(
      async (config) => {
        const token = await SecureStore.getItemAsync('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Refresh on 401
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest: any = error.config;

        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest.headers?.['X-Retry-Refresh']
        ) {
          try {
            const refreshToken = await SecureStore.getItemAsync('refreshToken');
            if (!refreshToken) throw new Error('No refresh token');

            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken,
            });
            const { accessToken, refreshToken: newRefreshToken } =
              response.data.data;

            await SecureStore.setItemAsync('accessToken', accessToken);
            await SecureStore.setItemAsync('refreshToken', newRefreshToken);

            originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
            originalRequest.headers['X-Retry-Refresh'] = 'true';
            return this.client(originalRequest);
          } catch (refreshError) {
            await SecureStore.deleteItemAsync('accessToken');
            await SecureStore.deleteItemAsync('refreshToken');
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      },
    );
  }

  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const api = ApiClient.getInstance();

// ============================================================
// AUTH
// ============================================================
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiEnvelope<{ user: any; accessToken: string; refreshToken: string }>>(
      '/auth/login',
      { email, password },
    ),

  register: (email: string, password: string, name?: string, phone?: string) =>
    api.post<ApiEnvelope<{ user: any; accessToken: string; refreshToken: string }>>(
      '/auth/register',
      { email, password, name, phone },
    ),

  logout: (refreshToken?: string) =>
    api.post<ApiEnvelope<any>>('/auth/logout', { refreshToken }),

  getProfile: () => api.get<ApiEnvelope<any>>('/users/me'),

  updateProfile: (data: any) =>
    api.put<ApiEnvelope<any>>('/users/me', data),
};

// ============================================================
// TRANSACTIONS
// ============================================================
export const transactionsApi = {
  getAll: (params?: {
    from?: string;
    to?: string;
    category?: string;
    search?: string;
    type?: 'CREDIT' | 'DEBIT';
  }) => api.get<ApiEnvelope<any[]>>('/transactions', { params }),

  getById: (id: string) =>
    api.get<ApiEnvelope<any>>(`/transactions/${id}`),

  create: (data: any) => api.post<ApiEnvelope<any>>('/transactions', data),

  update: (id: string, data: any) =>
    api.put<ApiEnvelope<any>>(`/transactions/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiEnvelope<any>>(`/transactions/${id}`),

  getCategories: (from?: string, to?: string) =>
    api.get<ApiEnvelope<any[]>>('/transactions/analytics/categories', {
      params: { from, to },
    }),

  getMonthlyStats: (year: number, month: number) =>
    api.get<ApiEnvelope<any>>('/transactions/analytics/monthly', {
      params: { year, month },
    }),

  search: (query: string) =>
    api.get<ApiEnvelope<any[]>>('/transactions/search', { params: { q: query } }),
};

// ============================================================
// SMS
// ============================================================
export const smsApi = {
  ingest: (body: string, sender: string, timestamp: string, phoneNumber?: string) =>
    api.post<ApiEnvelope<any>>('/sms/ingest', { body, sender, timestamp, phoneNumber }),

  ingestBatch: (
    messages: Array<{ body: string; sender: string; timestamp: string; phoneNumber?: string }>,
  ) => api.post<ApiEnvelope<any>>('/sms/ingest/batch', { messages }),

  getHistory: (page?: number, limit?: number) =>
    api.get<ApiEnvelope<any>>('/sms/history', { params: { page, limit } }),

  getUnprocessed: (limit?: number) =>
    api.get<ApiEnvelope<any[]>>('/sms/unprocessed', { params: { limit } }),
};

// ============================================================
// SUBSCRIPTIONS
// ============================================================
export const subscriptionsApi = {
  getAll: (status?: string) =>
    api.get<ApiEnvelope<any[]>>('/subscriptions', { params: { status } }),

  getById: (id: string) =>
    api.get<ApiEnvelope<any>>(`/subscriptions/${id}`),

  create: (data: any) =>
    api.post<ApiEnvelope<any>>('/subscriptions', data),

  update: (id: string, data: any) =>
    api.put<ApiEnvelope<any>>(`/subscriptions/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiEnvelope<any>>(`/subscriptions/${id}`),

  detect: () => api.post<ApiEnvelope<any>>('/subscriptions/detect'),

  getSummary: () => api.get<ApiEnvelope<any>>('/subscriptions/summary'),

  getUpcoming: (days?: number) =>
    api.get<ApiEnvelope<any[]>>('/subscriptions/upcoming', { params: { days } }),

  cancel: (id: string) =>
    api.post<ApiEnvelope<any>>(`/subscriptions/${id}/cancel`),

  pause: (id: string) =>
    api.post<ApiEnvelope<any>>(`/subscriptions/${id}/pause`),

  resume: (id: string) =>
    api.post<ApiEnvelope<any>>(`/subscriptions/${id}/resume`),
};

// ============================================================
// INSIGHTS
// ============================================================
export const insightsApi = {
  getAll: () => api.get<ApiEnvelope<any>>('/insights'),

  getSpending: (period?: string) =>
    api.get<ApiEnvelope<any>>('/insights/spending', { params: { period } }),

  getRecommendations: () =>
    api.get<ApiEnvelope<any[]>>('/insights/recommendations'),

  getPredictions: () => api.get<ApiEnvelope<any>>('/insights/predictions'),

  getAnomalies: () => api.get<ApiEnvelope<any[]>>('/insights/anomalies'),
};

// ============================================================
// NOTIFICATIONS
// ============================================================
export const notificationsApi = {
  getAll: (unread?: boolean) =>
    api.get<ApiEnvelope<any[]>>('/notifications', { params: { unread } }),

  getUnreadCount: () =>
    api.get<ApiEnvelope<{ count: number }>>('/notifications/unread/count'),

  markAsRead: (id: string) =>
    api.put<ApiEnvelope<any>>(`/notifications/${id}/read`),

  markAllAsRead: () =>
    api.post<ApiEnvelope<any>>('/notifications/read-all'),

  getPreferences: () =>
    api.get<ApiEnvelope<any>>('/notifications/preferences'),

  updatePreferences: (data: any) =>
    api.put<ApiEnvelope<any>>('/notifications/preferences', data),
};

// ============================================================
// DASHBOARD (user/dashboard summary)
// ============================================================
export const dashboardApi = {
  getStats: () => api.get<ApiEnvelope<any>>('/users/dashboard'),
};

// ============================================================
// GOALS
// ============================================================
export const goalsApi = {
  getAll: (params?: { isCompleted?: boolean; category?: string }) =>
    api.get<ApiEnvelope<any[]>>('/goals', { params }),

  getById: (id: string) => api.get<ApiEnvelope<any>>(`/goals/${id}`),

  getSummary: () => api.get<ApiEnvelope<any>>('/goals/summary'),

  create: (data: any) => api.post<ApiEnvelope<any>>('/goals', data),

  update: (id: string, data: any) =>
    api.put<ApiEnvelope<any>>(`/goals/${id}`, data),

  delete: (id: string) => api.delete<ApiEnvelope<any>>(`/goals/${id}`),

  contribute: (id: string, amount: number, note?: string) =>
    api.post<ApiEnvelope<any>>(`/goals/${id}/contribute`, { amount, note }),
};

// ============================================================
// BUDGETS
// ============================================================
export const budgetsApi = {
  getAll: (params?: { isActive?: boolean; period?: string }) =>
    api.get<ApiEnvelope<any[]>>('/budgets', { params }),

  getById: (id: string) => api.get<ApiEnvelope<any>>(`/budgets/${id}`),

  getSummary: () => api.get<ApiEnvelope<any>>('/budgets/summary'),

  create: (data: any) => api.post<ApiEnvelope<any>>('/budgets', data),

  update: (id: string, data: any) =>
    api.put<ApiEnvelope<any>>(`/budgets/${id}`, data),

  delete: (id: string) => api.delete<ApiEnvelope<any>>(`/budgets/${id}`),
};

// ============================================================
// ACCOUNTS
// ============================================================
export const accountsApi = {
  getAll: (params?: { accountType?: string; isActive?: boolean }) =>
    api.get<ApiEnvelope<any[]>>('/accounts', { params }),

  getById: (id: string) => api.get<ApiEnvelope<any>>(`/accounts/${id}`),

  getNetWorth: () => api.get<ApiEnvelope<any>>('/accounts/net-worth'),

  create: (data: any) => api.post<ApiEnvelope<any>>('/accounts', data),

  update: (id: string, data: any) =>
    api.put<ApiEnvelope<any>>(`/accounts/${id}`, data),

  delete: (id: string) => api.delete<ApiEnvelope<any>>(`/accounts/${id}`),

  setPrimary: (id: string) =>
    api.post<ApiEnvelope<any>>(`/accounts/${id}/set-primary`),

  recompute: (id: string) =>
    api.post<ApiEnvelope<any>>(`/accounts/${id}/recompute`),
};

// ============================================================
// ACTION CARDS
// ============================================================
export const actionCardsApi = {
  getAll: (params?: { status?: string; priority?: string; type?: string }) =>
    api.get<ApiEnvelope<any[]>>('/action-cards', { params }),

  getById: (id: string) =>
    api.get<ApiEnvelope<any>>(`/action-cards/${id}`),

  getSummary: () => api.get<ApiEnvelope<any>>('/action-cards/summary'),

  create: (data: any) => api.post<ApiEnvelope<any>>('/action-cards', data),

  update: (id: string, data: any) =>
    api.put<ApiEnvelope<any>>(`/action-cards/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiEnvelope<any>>(`/action-cards/${id}`),

  dismiss: (id: string) =>
    api.post<ApiEnvelope<any>>(`/action-cards/${id}/dismiss`),

  complete: (id: string) =>
    api.post<ApiEnvelope<any>>(`/action-cards/${id}/complete`),
};

// ============================================================
// AI PROXY (FastAPI passthrough)
// ============================================================
export const aiApi = {
  health: () => api.get<ApiEnvelope<any>>('/ai/health'),

  analyzeBehavior: () =>
    api.post<ApiEnvelope<any>>('/ai/behavior/analyze'),

  tagTransactions: () =>
    api.post<ApiEnvelope<any>>('/ai/behavior/tag-transactions'),

  getHealthScore: () =>
    api.post<ApiEnvelope<any>>('/ai/health-score/calculate'),

  detectLeaks: () => api.post<ApiEnvelope<any>>('/ai/leaks/detect'),

  ask: (query: string, context?: any) =>
    api.post<ApiEnvelope<any>>('/ai/assistant/query', { query, context }),

  determineArchetype: () =>
    api.post<ApiEnvelope<any>>('/ai/profile/archetype'),

  generateActionCards: () =>
    api.post<ApiEnvelope<any>>('/ai/action-cards/generate'),

  getPersonalizedDashboard: () =>
    api.post<ApiEnvelope<any>>('/ai/dashboard/personalized'),
};

// ============================================================
// WEEKLY SUMMARY
// ============================================================
export const weeklySummaryApi = {
  getList: (limit?: number) =>
    api.get<ApiEnvelope<any[]>>('/weekly-summary', { params: { limit } }),

  getCurrent: () =>
    api.get<ApiEnvelope<any>>('/weekly-summary/current'),

  getById: (id: string) =>
    api.get<ApiEnvelope<any>>(`/weekly-summary/${id}`),

  generate: (forDate?: string) =>
    api.post<ApiEnvelope<any>>('/weekly-summary/generate', null, {
      params: { forDate },
    }),

  delete: (id: string) =>
    api.delete<ApiEnvelope<any>>(`/weekly-summary/${id}`),
};
