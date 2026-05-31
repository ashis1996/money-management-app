'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/store/auth';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    startTransition(async () => {
      try {
        await register({ email, password, name: name || undefined });
        router.replace('/dashboard');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        setError(message);
      }
    });
  }

  return (
    <Card variant="glass" padding="xl" className="shadow-modal">
      <div className="text-center mb-6">
        <div className="ai-orb mx-auto h-12 w-12 mb-4" />
        <h1 className="text-headline-lg text-on-surface">Create account</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Take control of your money in 60 seconds
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          leadingIcon={<User size={16} strokeWidth={1.75} />}
          placeholder="Jane Doe"
        />
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
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters."
          leadingIcon={<Lock size={16} strokeWidth={1.75} />}
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
          Create account
        </Button>
      </form>

      <p className="text-center text-body-sm text-on-surface-variant mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-accent-primary hover:underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
