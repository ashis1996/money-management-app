/**
 * Centralised React Query keys.
 *
 * Mirrors mobile/src/hooks/queryKeys.ts so when we eventually share
 * domain types, the cache shapes line up too. Keys are strings + tuples
 * (rather than nested objects) so DevTools renders them legibly.
 */
export const QK = {
  dashboard: ['dashboard'] as const,
  health: ['ai', 'health-score'] as const,
  archetype: ['ai', 'archetype'] as const,
  leaks: ['ai', 'leaks'] as const,

  transactions: (filters?: Record<string, unknown>) => ['transactions', filters ?? {}] as const,
  transactionsCategories: (range?: Record<string, unknown>) =>
    ['transactions', 'categories', range ?? {}] as const,
  transactionById: (id: string) => ['transactions', id] as const,

  subscriptions: (status?: string) => ['subscriptions', { status }] as const,
  subscriptionsSummary: ['subscriptions', 'summary'] as const,
  subscriptionsUpcoming: (days?: number) => ['subscriptions', 'upcoming', { days }] as const,

  insights: ['insights'] as const,
  insightsSpending: (period?: string) => ['insights', 'spending', { period }] as const,

  goals: (params?: Record<string, unknown>) => ['goals', params ?? {}] as const,
  budgets: (params?: Record<string, unknown>) => ['budgets', params ?? {}] as const,
  accounts: ['accounts'] as const,
  actionCards: (params?: Record<string, unknown>) => ['action-cards', params ?? {}] as const,

  notifications: (unread?: boolean) => ['notifications', { unread }] as const,
  notificationsUnreadCount: ['notifications', 'unread-count'] as const,
  notificationPreferences: ['notifications', 'preferences'] as const,

  weeklySummaryCurrent: ['weekly-summary', 'current'] as const,
  weeklySummaryHistory: (limit?: number) => ['weekly-summary', 'history', { limit }] as const,
  weeklySummaryById: (id: string) => ['weekly-summary', id] as const,

  pushTokens: ['push', 'tokens'] as const,
  netWorth: ['accounts', 'net-worth'] as const,
};
