import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, backendRefresh, BackendError } from '@/lib/api-server';
import { applyAuthCookies, clearAuthCookies, COOKIE_AT, COOKIE_RT } from '@/lib/auth/cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProxyContext {
  params: { path: string[] };
}

const PROXIED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const);
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Single shared in-flight refresh promise per request handler is not
 * useful — each request runs in its own handler instance. The mobile
 * app needs serialisation across simultaneous fetches; the web app
 * doesn't because each browser request is independent and refresh is
 * scoped per-request here.
 */
async function attemptRefresh(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    const result = await backendRefresh(refreshToken);
    const tokens = result.data;
    if (tokens?.accessToken && tokens?.refreshToken) {
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function readBody(req: NextRequest): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'DELETE') return undefined;
  const text = await req.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    // Forward as raw string for non-JSON bodies. Most of our backend
    // is JSON; this is just for safety.
    return text;
  }
}

async function handle(req: NextRequest, context: ProxyContext) {
  const method = req.method as Method;
  if (!PROXIED_METHODS.has(method)) {
    return NextResponse.json({ message: `Method ${method} not allowed` }, { status: 405 });
  }

  const path = '/' + (context.params.path?.join('/') ?? '');
  const search = req.nextUrl.search; // includes leading "?"
  const targetPath = path + search;
  const body = await readBody(req);

  const accessToken = req.cookies.get(COOKIE_AT)?.value;
  const refreshToken = req.cookies.get(COOKIE_RT)?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  // First attempt with the access token (or refresh-only if access is missing).
  let tokenForCall = accessToken;
  let refreshedTokens: { accessToken: string; refreshToken: string } | null = null;

  if (!tokenForCall && refreshToken) {
    refreshedTokens = await attemptRefresh(refreshToken);
    if (!refreshedTokens) {
      const r = NextResponse.json({ message: 'Session expired' }, { status: 401 });
      return clearAuthCookies(r);
    }
    tokenForCall = refreshedTokens.accessToken;
  }

  try {
    const data = await backendFetch<unknown>(targetPath, {
      method,
      body,
      accessToken: tokenForCall,
    });
    const response = NextResponse.json(data);
    if (refreshedTokens) applyAuthCookies(response.cookies, refreshedTokens);
    return response;
  } catch (err) {
    // 401 from backend -> attempt refresh, retry once.
    if (err instanceof BackendError && err.status === 401 && refreshToken && !refreshedTokens) {
      refreshedTokens = await attemptRefresh(refreshToken);
      if (!refreshedTokens) {
        const r = NextResponse.json({ message: 'Session expired' }, { status: 401 });
        return clearAuthCookies(r);
      }

      try {
        const data = await backendFetch<unknown>(targetPath, {
          method,
          body,
          accessToken: refreshedTokens.accessToken,
        });
        const response = NextResponse.json(data);
        applyAuthCookies(response.cookies, refreshedTokens);
        return response;
      } catch (retryErr) {
        if (retryErr instanceof BackendError) {
          const r = NextResponse.json(retryErr.body ?? { message: retryErr.message }, {
            status: retryErr.status,
          });
          // Even though the retry failed, the new tokens may be valid
          // — keep them so subsequent calls don't refresh again.
          applyAuthCookies(r.cookies, refreshedTokens);
          return r;
        }
        return NextResponse.json({ message: 'Backend request failed' }, { status: 502 });
      }
    }

    if (err instanceof BackendError) {
      return NextResponse.json(err.body ?? { message: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ message: 'Backend request failed' }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: ProxyContext) {
  return handle(req, ctx);
}
export async function POST(req: NextRequest, ctx: ProxyContext) {
  return handle(req, ctx);
}
export async function PUT(req: NextRequest, ctx: ProxyContext) {
  return handle(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: ProxyContext) {
  return handle(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: ProxyContext) {
  return handle(req, ctx);
}
