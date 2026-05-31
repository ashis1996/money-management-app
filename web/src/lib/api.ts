/**
 * Browser-facing API client. Every call goes to /api/proxy/* which
 * runs on the Next.js server, attaches the bearer token from the
 * httpOnly cookie, and forwards to the NestJS backend.
 *
 * This split is deliberate:
 *   - Browser code never imports server env or backend URLs.
 *   - JWTs live in httpOnly cookies; XSS can't exfiltrate them.
 *   - Switching to a different backend is a one-line change in
 *     `lib/env.ts`, no rewrites in 100 hooks.
 */
import type {
  Account,
  ActionCard,
  ApiEnvelope,
  AppNotification,
  Budget,
  CategorySpending,
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
} from '@/types';

const PROXY_BASE = '/api/proxy';

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, unknown>;
  body?: unknown;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * On 401 we redirect to /login. We do this once per page-load via
 * a module-level guard so concurrent failures don't stack redirects.
 */
let redirectingToLogin = false;
function handleUnauthorized() {
  if (typeof window === 'undefined') return;
  if (redirectingToLogin) return;
  redirectingToLogin = true;
  // Preserve the path so we can bounce back after login (Phase 6+).
  const next = encodeURIComponent(window.location.pathname);
  window.location.href = `/login?next=${next}`;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const safe = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${PROXY_BASE}${safe}`, window.location.origin);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString().replace(window.location.origin, ''), {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
    signal: opts.signal,
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new ApiError('Unauthorized', 401);
  }

  let body: unknown = undefined;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message = (body as { message?: string })?.message ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body);
  }

  return body as T;
}

type Env<T> = ApiEnvelope<T>;

// =============================================================
// AUTH (these go to /api/auth/*, not /api/proxy/*)
// =============================================================
export const authApi = {
  login: (email: string, password: string) =>
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'same-origin',
    }).then(handleAuthResponse),

  register: (payload: { email: string; password: string; name?: string; phone?: string }) =>
    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
    }).then(handleAuthResponse),

  logout: () =>
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }),

  me: () => request<Env<User>>('/users/me'),
};

async function handleAuthResponse(res: Response): Promise<{ user: User }> {
  let body: unknown;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const message = (body as { message?: string })?.message ?? `Login failed (${res.status})`;
    throw new ApiError(message, res.status, body);
  }
  return body as { user: User };
}

// =============================================================
// DOMAIN APIs — stable subset, mirrors mobile.
// Phase 6+ will extend as we wire up more screens.
// =============================================================

export const dashboardApi = {
  getStats: () => request<Env<DashboardStats>>('/users/dashboard'),
};

export interface TransactionFilters {
  from?: string;
  to?: string;
  category?: string;
  search?: string;
  type?: TransactionType;
}

export const transactionsApi = {
  getAll: (filters?: TransactionFilters) =>
    request<Env<Transaction[]>>('/transactions', {
      query: filters as Record<string, unknown> | undefined,
    }),
  getById: (id: string) => request<Env<Transaction>>(`/transactions/${id}`),
  getCategories: (from?: string, to?: string) =>
    request<Env<CategorySpending[]>>('/transactions/analytics/categories', {
      query: { from, to },
    }),
};

export const subscriptionsApi = {
  getAll: (status?: SubscriptionStatus | string) =>
    request<Env<Subscription[]>>('/subscriptions', { query: { status } }),
  getSummary: () =>
    request<Env<{ active: number; monthlyTotal: number; upcomingDues: number }>>(
      '/subscriptions/summary',
    ),
  getUpcoming: (days?: number) =>
    request<Env<Subscription[]>>('/subscriptions/upcoming', {
      query: { days },
    }),
};

export const insightsApi = {
  getAll: () => request<Env<Insight & Record<string, unknown>>>('/insights'),
  getSpending: (period?: string) =>
    request<Env<Insight & Record<string, unknown>>>('/insights/spending', {
      query: { period },
    }),
};

export const goalsApi = {
  getAll: (params?: { isCompleted?: boolean }) => request<Env<Goal[]>>('/goals', { query: params }),
};

export const budgetsApi = {
  getAll: (params?: { isActive?: boolean }) =>
    request<Env<Budget[]>>('/budgets', { query: params }),
};

export const accountsApi = {
  getAll: () => request<Env<Account[]>>('/accounts'),
};

export const actionCardsApi = {
  getAll: (params?: { status?: string }) =>
    request<Env<ActionCard[]>>('/action-cards', { query: params }),
};

export const notificationsApi = {
  getAll: (unread?: boolean) =>
    request<Env<AppNotification[]>>('/notifications', { query: { unread } }),
  getUnreadCount: () => request<Env<{ count: number }>>('/notifications/unread/count'),
};

export const aiApi = {
  health: () => request<Env<{ status: string }>>('/ai/health'),
  getHealthScore: () =>
    request<Env<HealthScoreResult & Record<string, unknown>>>('/ai/health-score/calculate', {
      method: 'POST',
    }),
  detectLeaks: () =>
    request<Env<MoneyLeaksResult & Record<string, unknown>>>('/ai/leaks/detect', {
      method: 'POST',
    }),
  determineArchetype: () =>
    request<Env<{ archetype: string; confidence?: number } & Record<string, unknown>>>(
      '/ai/profile/archetype',
      { method: 'POST' },
    ),
};
