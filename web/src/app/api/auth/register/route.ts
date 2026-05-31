import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { backendRegister, BackendError } from '@/lib/api-server';
import { setAuthCookies } from '@/lib/auth/cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(256),
  name: z.string().min(1).max(120).optional(),
  phone: z.string().min(6).max(32).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    // For register we DO surface validation errors so the form can
    // show "password too short", "invalid email", etc.
    return NextResponse.json(
      {
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const result = await backendRegister(parsed.data);
    const tokens = result.data;
    if (!tokens?.accessToken || !tokens?.refreshToken || !tokens?.user) {
      return NextResponse.json({ message: 'Unexpected response from server' }, { status: 502 });
    }
    const response = NextResponse.json({ user: tokens.user });
    return setAuthCookies(response, tokens);
  } catch (err) {
    if (err instanceof BackendError) {
      const message = (err.body as { message?: string })?.message ?? 'Registration failed';
      return NextResponse.json({ message }, { status: err.status });
    }
    return NextResponse.json({ message: 'Registration failed' }, { status: 500 });
  }
}
