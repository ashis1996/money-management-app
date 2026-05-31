import { redirect } from 'next/navigation';
import { readAuthCookies } from '@/lib/auth/cookies';

/**
 * Root URL — redirect to /dashboard if signed in, /login otherwise.
 * Server component, no client hydration needed for the bounce.
 */
export default function RootPage() {
  const { accessToken, refreshToken } = readAuthCookies();
  if (accessToken || refreshToken) {
    redirect('/dashboard');
  }
  redirect('/login');
}
