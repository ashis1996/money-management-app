import { NextResponse } from 'next/server';
import { backendLogout } from '@/lib/api-server';
import { clearAuthCookies, readAuthCookies } from '@/lib/auth/cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const { refreshToken } = readAuthCookies();
  // Best-effort backend logout — even if the backend rejects (token
  // already revoked, network hiccup), we still clear local cookies
  // so the user is logged out client-side.
  if (refreshToken) {
    await backendLogout(refreshToken);
  }
  const response = NextResponse.json({ ok: true });
  return clearAuthCookies(response);
}
