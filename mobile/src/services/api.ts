import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { AuthTokens } from '@/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api/v1';

class ApiClient {
  private client: AxiosInstance;
  private static instance: ApiClient;

  private constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
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
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await SecureStore.getItemAsync('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest?.headers['X-Retry-Refresh']) {
          try {
            const refreshToken = await SecureStore.getItemAsync('refreshToken');
            if (!refreshToken) {
              throw new Error('No refresh token');
            }

            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken,
            });

            const { accessToken, refreshToken: newRefreshToken } = response.data.data;

            await SecureStore.setItemAsync('accessToken', accessToken);
            await SecureStore.setItemAsync('refreshToken', newRefreshToken);

            originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
            originalRequest.headers['X-Retry-Refresh'] = 'true';

            return this.client(originalRequest);
          } catch (refreshError) {
            // Clear tokens and redirect to login
            await SecureStore.deleteItemAsync('accessToken');
            await SecureStore.deleteItemAsync('refreshToken');
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
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

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ success: boolean; data: { user: any; accessToken: string; refreshToken: string } }>('/auth/login', {
      email,
      password,
    }),

  register: (email: string, password: string, name?: string, phone?: string) =>
    api.post<{ success: boolean; data: { user: any; accessToken: string; refreshToken: string } }>('/auth/register', {
      email,
      password,
      name,
      phone,
    }),

  logout: (refreshToken?: string) =>
    api.post('/auth/logout', { refreshToken }),

  getProfile: () => api.get('/users/me'),

  updateProfile: (data: any) => api.put('/users/me', data),
};

// Transactions API
export const transactionsApi = {
  getAll: (params?: { from?: string; to?: string; category?: string; search?: string }) =>
    api.get('/transactions', { params }),

  getById: (id: string) => api.get(`/transactions/${id}`),

  create: (data: any) => api.post('/transactions', data),

  update: (id: string, data: any) => api.put(`/transactions/${id}`, data),

  delete: (id: string) => api.delete(`/transactions/${id}`),

  getCategories: (from?: string, to?: string) =>
    api.get('/transactions/analytics/categories', { params: { from, to } }),

  search: (query: string) => api.get('/transactions/search', { params: { q: query } }),
};

// SMS API
export const smsApi = {
  ingest: (body: string, sender: string, timestamp: string, phoneNumber?: string) =>
    api.post('/sms/ingest', { body, sender, timestamp, phoneNumber }),

  ingestBatch: (messages: Array<{ body: string; sender: string; timestamp: string; phoneNumber?: string }>) =>
    api.post('/sms/ingest/batch', { messages }),

  getHistory: (page?: number, limit?: number) =>
    api.get('/sms/history', { params: { page, limit } }),

  getUnprocessed: (limit?: number) =>
    api.get('/sms/unprocessed', { params: { limit } }),
};

// Subscriptions API
export const subscriptionsApi = {
  getAll: (status?: string) => api.get('/subscriptions', { params: { status } }),

  getById: (id: string) => api.get(`/subscriptions/${id}`),

  create: (data: any) => api.post('/subscriptions', data),

  update: (id: string, data: any) => api.put(`/subscriptions/${id}`, data),

  delete: (id: string) => api.delete(`/subscriptions/${id}`),

  detect: () => api.post('/subscriptions/detect'),

  getSummary: () => api.get('/subscriptions/summary'),

  getUpcoming: (days?: number) => api.get('/subscriptions/upcoming', { params: { days } }),

  cancel: (id: string) => api.post(`/subscriptions/${id}/cancel`),
};

// Insights API
export const insightsApi = {
  getAll: () => api.get('/insights'),

  getSpending: (period?: string) => api.get('/insights/spending', { params: { period } }),

  getRecommendations: () => api.get('/insights/recommendations'),

  getPredictions: () => api.get('/insights/predictions'),
};

// Notifications API
export const notificationsApi = {
  getAll: (unread?: boolean) => api.get('/notifications', { params: { unread } }),

  getUnreadCount: () => api.get('/notifications/unread/count'),

  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),

  markAllAsRead: () => api.post('/notifications/read-all'),

  getPreferences: () => api.get('/notifications/preferences'),

  updatePreferences: (data: any) => api.put('/notifications/preferences', data),
};

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get('/users/dashboard'),
};
