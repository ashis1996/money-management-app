import { NextResponse } from 'next/server';
import { backendMe, BackendError } from '@/lib/api-server';
import { readAuthCookies, clearAuthCookies } from '@/lib/auth/cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Used by the auth store on first paint to rehydrate the user.
 * 401 -> clear cookies and tell the client.
 */
export async function GET() {
  const { accessToken } = readAuthCookies();
  if (!accessToken) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  try {
    const result = await backendMe(accessToken);
    return NextResponse.json({ user: result.data });
  } catch (err) {
    if (err instanceof BackendError && err.status === 401) {
      const response = NextResponse.json({ user: null }, { status: 401 });
      return clearAuthCookies(response);
    }
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
