/**
 * Server-side API client. Used inside route handlers (`/api/...`),
 * server components, and middleware (excluding edge — see note).
 *
 * The browser NEVER imports this. Browser code talks to /api/proxy/*
 * which delegates here. Keeping the network boundary one-way means:
 *   - JWTs only ever exist server-side
 *   - we can later add per-request observability without touching
 *     every screen
 *   - the backend URL is server-only env, never leaked to the client
 */
import { ServerEnv } from './env';
import type { ApiEnvelope, AuthResponse } from '@/types';

interface FetchOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Bearer token forwarded to the backend. */
  accessToken?: string;
  /** Forwarded query params. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /**
   * Tag for Next.js fetch cache invalidation. Most authenticated
   * requests should pass `cache: 'no-store'` instead — see helpers
   * below.
   */
  next?: RequestInit['next'];
  cache?: RequestInit['cache'];
}

export class BackendError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

function buildUrl(path: string, query?: FetchOpts['query']): string {
  const base = ServerEnv.internalApiUrl.replace(/\/+$/, '');
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${safePath}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Low-level fetch against the backend. Returns the parsed JSON body
 * on 2xx, throws `BackendError` on 4xx/5xx with the body attached.
 */
export async function backendFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (opts.accessToken) {
    headers.Authorization = `Bearer ${opts.accessToken}`;
  }

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    // Authenticated calls should never be cached at the framework
    // layer — each user has their own data. Callers can override
    // for genuinely public, immutable endpoints (rare).
    cache: opts.cache ?? 'no-store',
    next: opts.next,
  });

  // Try to parse JSON body even for errors so we can forward NestJS's
  // structured error envelope.
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
    throw new BackendError(`Backend ${res.status}: ${res.statusText}`, res.status, body);
  }

  return body as T;
}

// =============================================================
// High-level helpers — only the pieces the route handlers need.
// =============================================================

export async function backendLogin(
  email: string,
  password: string,
): Promise<ApiEnvelope<AuthResponse>> {
  return backendFetch<ApiEnvelope<AuthResponse>>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function backendRegister(payload: {
  email: string;
  password: string;
  name?: string;
  phone?: string;
}): Promise<ApiEnvelope<AuthResponse>> {
  return backendFetch<ApiEnvelope<AuthResponse>>('/auth/register', {
    method: 'POST',
    body: payload,
  });
}

export async function backendRefresh(refreshToken: string): Promise<ApiEnvelope<AuthResponse>> {
  return backendFetch<ApiEnvelope<AuthResponse>>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export async function backendLogout(refreshToken?: string): Promise<void> {
  // Best-effort — if the backend rejects (e.g. token already expired)
  // we still clear local cookies. Don't throw to the caller.
  try {
    await backendFetch('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    });
  } catch {
    /* ignore */
  }
}

export async function backendMe(accessToken: string): Promise<ApiEnvelope<unknown>> {
  return backendFetch<ApiEnvelope<unknown>>('/users/me', {
    method: 'GET',
    accessToken,
  });
}
