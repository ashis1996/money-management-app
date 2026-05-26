/**
 * Centralised React Query key factory.
 * Keep keys here so cache invalidation stays consistent across the app.
 */
export const queryKeys = {
  // Transactions
  transactions: {
    all: ['transactions'] as const,
    list: (filters?: any) => ['transactions', 'list', filters] as const,
    detail: (id: string) => ['transactions', 'detail', id] as const,
    categories: (from?: string, to?: string) =>
      ['transactions', 'categories', from, to] as const,
    monthlyStats: (year: number, month: number) =>
      ['transactions', 'monthly', year, month] as const,
  },

  // Subscriptions
  subscriptions: {
    all: ['subscriptions'] as const,
    list: (status?: string) => ['subscriptions', 'list', status] as const,
    detail: (id: string) => ['subscriptions', 'detail', id] as const,
    summary: ['subscriptions', 'summary'] as const,
    upcoming: (days?: number) => ['subscriptions', 'upcoming', days] as const,
  },

  // Insights
  insights: {
    all: ['insights'] as const,
    spending: (period?: string) => ['insights', 'spending', period] as const,
    recommendations: ['insights', 'recommendations'] as const,
    predictions: ['insights', 'predictions'] as const,
    anomalies: ['insights', 'anomalies'] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    list: (unread?: boolean) => ['notifications', 'list', unread] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
    preferences: ['notifications', 'preferences'] as const,
  },

  // Goals
  goals: {
    all: ['goals'] as const,
    list: (filters?: any) => ['goals', 'list', filters] as const,
    detail: (id: string) => ['goals', 'detail', id] as const,
    summary: ['goals', 'summary'] as const,
  },

  // Budgets
  budgets: {
    all: ['budgets'] as const,
    list: (filters?: any) => ['budgets', 'list', filters] as const,
    detail: (id: string) => ['budgets', 'detail', id] as const,
    summary: ['budgets', 'summary'] as const,
  },

  // Accounts
  accounts: {
    all: ['accounts'] as const,
    list: (filters?: any) => ['accounts', 'list', filters] as const,
    detail: (id: string) => ['accounts', 'detail', id] as const,
    netWorth: ['accounts', 'net-worth'] as const,
  },

  // Action cards
  actionCards: {
    all: ['action-cards'] as const,
    list: (filters?: any) => ['action-cards', 'list', filters] as const,
    detail: (id: string) => ['action-cards', 'detail', id] as const,
    summary: ['action-cards', 'summary'] as const,
  },

  // AI
  ai: {
    health: ['ai', 'health'] as const,
    healthScore: ['ai', 'health-score'] as const,
    leaks: ['ai', 'leaks'] as const,
    archetype: ['ai', 'archetype'] as const,
    behavior: ['ai', 'behavior'] as const,
    dashboard: ['ai', 'dashboard'] as const,
  },

  // Weekly summary
  weeklySummary: {
    all: ['weekly-summary'] as const,
    list: (limit?: number) => ['weekly-summary', 'list', limit] as const,
    current: ['weekly-summary', 'current'] as const,
    detail: (id: string) => ['weekly-summary', 'detail', id] as const,
  },

  // Dashboard
  dashboard: ['dashboard'] as const,
} as const;
