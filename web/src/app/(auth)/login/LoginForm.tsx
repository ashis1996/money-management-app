'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/store/auth';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';

  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await login(email, password);
        router.replace(safeRedirect(next));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
      }
    });
  }

  return (
    <Card variant="glass" padding="xl" className="shadow-modal">
      <div className="text-center mb-6">
        <div className="ai-orb mx-auto h-12 w-12 mb-4" />
        <h1 className="text-headline-lg text-on-surface">Welcome back</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Sign in to your MoneyMind account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leadingIcon={<Mail size={16} strokeWidth={1.75} />}
          placeholder="you@example.com"
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leadingIcon={<Lock size={16} strokeWidth={1.75} />}
          placeholder="••••••••"
        />

        {error && (
          <p
            role="alert"
            className="text-body-sm text-accent-error bg-accent-error/10 border border-accent-error/30 rounded-md px-3 py-2"
          >
            {error}
          </p>
        )}

        <Button type="submit" loading={pending} fullWidth size="lg" className="mt-2">
          Sign in
        </Button>
      </form>

      <p className="text-center text-body-sm text-on-surface-variant mt-6">
        New to MoneyMind?{' '}
        <Link href="/register" className="text-accent-primary hover:underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </Card>
  );
}

/** Reject open-redirects: only allow same-origin paths. */
function safeRedirect(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return '/dashboard';
  return path;
}
