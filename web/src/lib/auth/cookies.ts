import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ServerEnv } from '@/lib/env';

/**
 * Cookie names. Picked short (`mm_*`) so they don't crowd the cookie
 * jar and don't collide with anything else the user might be running
 * on the same dev origin.
 */
export const COOKIE_AT = 'mm_at'; // access token
export const COOKIE_RT = 'mm_rt'; // refresh token

/**
 * Cookie max-age (seconds). Backend issues a 15m access token + 7d
 * refresh token; we mirror that so the cookie is gone once the
 * refresh window closes.
 */
const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

interface CookieJarLike {
  set(opts: {
    name: string;
    value: string;
    httpOnly: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    secure: boolean;
    path: string;
    maxAge: number;
  }): void;
  delete(name: string): void;
}

/**
 * Apply auth cookies to a NextResponse. The same shape works whether
 * we're inside a route handler (`NextResponse.json()`) or a redirect.
 *
 * Cookies are httpOnly so JavaScript can't read them — the only path
 * to using them is via /api/proxy/* which runs on the server.
 */
export function setAuthCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
): NextResponse {
  applyAuthCookies(response.cookies, tokens);
  return response;
}

/** Internal: write both cookies into a CookieJar-like object. */
export function applyAuthCookies(
  jar: CookieJarLike,
  tokens: { accessToken: string; refreshToken: string },
): void {
  const baseOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: ServerEnv.isProd,
    path: '/',
  };

  jar.set({
    name: COOKIE_AT,
    value: tokens.accessToken,
    ...baseOpts,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  jar.set({
    name: COOKIE_RT,
    value: tokens.refreshToken,
    ...baseOpts,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.delete(COOKIE_AT);
  response.cookies.delete(COOKIE_RT);
  return response;
}

/**
 * Read auth tokens from the incoming request's cookie jar.
 * Returns nullish entries when the cookie is missing — the caller
 * decides how to respond (401, redirect, etc.).
 */
export function readAuthCookies(): {
  accessToken?: string;
  refreshToken?: string;
} {
  const jar = cookies();
  return {
    accessToken: jar.get(COOKIE_AT)?.value,
    refreshToken: jar.get(COOKIE_RT)?.value,
  };
}
