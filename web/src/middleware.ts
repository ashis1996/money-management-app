import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_AT, COOKIE_RT } from '@/lib/auth/cookies';

/**
 * Edge middleware. Runs before every matched request and gates the
 * authenticated app shell.
 *
 * Logic:
 *   - If the visitor has neither cookie, redirect to /login (with
 *     ?next= so we can bounce back after login — Phase 6 will wire
 *     the redirect-back).
 *   - If they have at least one cookie (even an expired access
 *     token + valid refresh token), let them through. The proxy will
 *     refresh on the next data call.
 *
 * We do NOT attempt token refresh in middleware:
 *   - Edge runtime can't set httpOnly cookies the same way the
 *     route handler does (`NextResponse.cookies.set` works, but the
 *     refresh logic involves error handling we'd rather keep in one
 *     place: the proxy).
 *   - Refresh in middleware would run on every navigation; refresh
 *     in the proxy only runs when actually needed.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const at = req.cookies.get(COOKIE_AT)?.value;
  const rt = req.cookies.get(COOKIE_RT)?.value;

  if (at || rt) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

/**
 * Match every authenticated route (those that live in (app) group)
 * by listing them explicitly. Route groups don't appear in URLs, so
 * the matcher works at the URL level.
 *
 * NOTE: keep this list in sync with the (app)/* directories. A
 * missing entry leaks an authenticated screen to anonymous visitors.
 */
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/transactions/:path*',
    '/subscriptions/:path*',
    '/insights/:path*',
    '/health-score/:path*',
    '/money-leaks/:path*',
    '/ai-coach/:path*',
    '/settings/:path*',
  ],
};
