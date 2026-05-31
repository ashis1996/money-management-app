import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { backendLogin, BackendError } from '@/lib/api-server';
import { setAuthCookies } from '@/lib/auth/cookies';

export const runtime = 'nodejs';
// Auth endpoints are never cached.
export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: 'Invalid credentials format',
        // We deliberately don't echo Zod issues back to the browser
        // for an auth endpoint — minimises information leakage.
      },
      { status: 400 },
    );
  }

  try {
    const result = await backendLogin(parsed.data.email, parsed.data.password);
    const tokens = result.data;
    if (!tokens?.accessToken || !tokens?.refreshToken || !tokens?.user) {
      // Backend returned 200 but malformed body. Treat as 502.
      return NextResponse.json({ message: 'Unexpected response from server' }, { status: 502 });
    }

    const response = NextResponse.json({ user: tokens.user });
    return setAuthCookies(response, tokens);
  } catch (err) {
    if (err instanceof BackendError) {
      // Forward backend's status (commonly 401) but a flat message.
      const message = (err.body as { message?: string })?.message ?? 'Login failed';
      return NextResponse.json({ message }, { status: err.status });
    }
    return NextResponse.json({ message: 'Login failed' }, { status: 500 });
  }
}
