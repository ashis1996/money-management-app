'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Building,
  Wallet as WalletIcon,
  Coins,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAccounts } from '@/hooks/useAccounts';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { CATEGORIES, type CategoryOption } from '@/lib/categories';
import { cn } from '@/lib/cn';
import type { TransactionType } from '@/types';

function iconForAccount(type: string): LucideIcon {
  const t = (type ?? '').toLowerCase();
  if (t.includes('wallet') || t.includes('paytm') || t.includes('upi')) return WalletIcon;
  if (t.includes('cash')) return Coins;
  if (t.includes('mobile') || t.includes('phone')) return Smartphone;
  return Building;
}

interface AccountLite {
  id: string;
  name: string;
  mask: string;
  type: string;
  balance: number;
}

function localAISuggestion(merchant: string): {
  category: CategoryOption['id'];
  confidence: number;
  isRecurring: boolean;
} {
  const m = merchant.toLowerCase();
  if (/swiggy|zomato|domino|kfc|mcd|food|cafe|restaurant/.test(m))
    return { category: 'food', confidence: 0.94, isRecurring: false };
  if (/amazon|flipkart|myntra|ajio|nykaa/.test(m))
    return { category: 'shopping', confidence: 0.91, isRecurring: false };
  if (/uber|ola|metro|petrol|fuel|cab/.test(m))
    return { category: 'transport', confidence: 0.9, isRecurring: false };
  if (/netflix|spotify|prime|hotstar|youtube/.test(m))
    return { category: 'subscription', confidence: 0.96, isRecurring: true };
  if (/electric|water|gas|bsnl|airtel|jio|vi/.test(m))
    return { category: 'bills', confidence: 0.92, isRecurring: true };
  if (/bms|pvr|inox|cinema|gaming/.test(m))
    return { category: 'entertainment', confidence: 0.85, isRecurring: false };
  if (/hospital|pharmacy|apollo|medplus/.test(m))
    return { category: 'health', confidence: 0.93, isRecurring: false };
  return { category: 'other', confidence: 0.6, isRecurring: false };
}

export default function NewTransactionPage() {
  const router = useRouter();
  // The new accounts hook fetches an `isActive: true` filter
  // server-side already (the backend's findAll filters out inactive
  // and soft-deleted rows), so passing a type filter here is no longer
  // necessary.
  const accountsQuery = useAccounts();
  const createTx = useCreateTransaction();

  const accounts: AccountLite[] = useMemo(() => {
    const list = (accountsQuery.data ?? []) as unknown as Array<Record<string, unknown>>;
    return list.map((a) => ({
      id: String(a.id),
      name: String(a.accountName ?? a.name ?? 'Account'),
      mask: String(a.maskedAccountNumber ?? a.mask ?? ''),
      type: String(a.accountType ?? a.type ?? ''),
      balance: Number(a.balance ?? 0),
    }));
  }, [accountsQuery.data]);

  const [type, setType] = useState<TransactionType>('DEBIT');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Local AI suggestion (mirrors mobile). Replaced by the AI proxy
  // once the backend wires it up.
  const [aiSuggestion, setAiSuggestion] = useState<ReturnType<typeof localAISuggestion> | null>(
    null,
  );
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (merchant.length < 3 || !amount) {
      setAiSuggestion(null);
      return;
    }
    setAnalyzing(true);
    const timer = setTimeout(() => {
      setAiSuggestion(localAISuggestion(merchant));
      setAnalyzing(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [merchant, amount]);

  // Auto-pick AI category if user hasn't picked one
  useEffect(() => {
    if (aiSuggestion && !category) {
      setCategory(aiSuggestion.category);
    }
  }, [aiSuggestion, category]);

  // Default to first account once it loads
  useEffect(() => {
    if (!accountId && accounts[0]?.id) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const value = Number(amount.replace(/[^0-9.]/g, ''));
    if (!value || value <= 0) return setSubmitError('Enter a positive amount.');
    if (!category) return setSubmitError('Pick a category.');

    startTransition(async () => {
      try {
        await createTx.mutateAsync({
          type,
          amount: value,
          merchant: merchant || undefined,
          description: notes || undefined,
          category,
          accountId: accountId || undefined,
          date: new Date().toISOString(),
        } as never);
        router.push('/transactions');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not save.';
        setSubmitError(msg);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/transactions"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-default)] bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Cancel"
        >
          <ArrowLeft size={18} strokeWidth={1.75} />
        </Link>
        <h1 className="text-headline-md text-on-surface">New transaction</h1>
        <div className="w-9" aria-hidden />
      </div>

      {/* Hero amount */}
      <Card variant="hero" padding="xl">
        <div className="mx-auto flex w-fit gap-2">
          <TypePill
            label="Spent"
            active={type === 'DEBIT'}
            tone="error"
            onClick={() => setType('DEBIT')}
          />
          <TypePill
            label="Received"
            active={type === 'CREDIT'}
            tone="success"
            onClick={() => setType('CREDIT')}
          />
        </div>

        <div className="mt-6 flex items-baseline justify-center gap-1">
          <span className="text-headline-lg text-on-surface-variant tabular-nums">
            {type === 'CREDIT' ? '+' : '−'}
          </span>
          <span className="text-headline-lg text-on-surface-variant">₹</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            aria-label="Amount"
            className={cn(
              'min-w-[140px] bg-transparent text-display-xl tabular-nums focus:outline-none',
              type === 'CREDIT' ? 'text-accent-success' : 'text-on-surface',
              'placeholder:text-outline',
            )}
            autoFocus
          />
        </div>
      </Card>

      {/* Merchant */}
      <Card padding="md" className="flex flex-col gap-2">
        <label
          htmlFor="merchant-input"
          className="text-label-sm uppercase tracking-wider text-on-surface-variant"
        >
          Merchant
        </label>
        <input
          id="merchant-input"
          type="text"
          placeholder="e.g. Swiggy, Amazon"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          className="rounded-md border border-[var(--border-default)] bg-surface-container-lowest px-3 py-2.5 text-body-md text-on-surface placeholder:text-outline focus:border-accent-ai focus:outline-none focus:shadow-focus-ai"
        />
      </Card>

      {/* AI suggestion */}
      {(analyzing || aiSuggestion) && (
        <Card variant="ai" padding="md" className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-accent-ai/30 bg-accent-ai/10">
            <Sparkles size={16} strokeWidth={1.75} className="text-accent-ai" />
          </div>
          <div className="min-w-0 flex-1">
            {analyzing ? (
              <p className="text-body-sm text-on-surface-variant">Analysing pattern…</p>
            ) : aiSuggestion ? (
              <>
                <p className="text-body-sm text-on-surface">
                  Looks like a{' '}
                  <span className="text-accent-ai font-semibold">{aiSuggestion.category}</span>{' '}
                  transaction
                  {aiSuggestion.isRecurring && ' (recurring)'}
                </p>
                <p className="mt-0.5 text-label-sm uppercase tracking-wider text-on-surface-variant tabular-nums">
                  {Math.round(aiSuggestion.confidence * 100)}% confident
                </p>
              </>
            ) : null}
          </div>
        </Card>
      )}

      {/* Category */}
      <section className="flex flex-col gap-2">
        <h2 className="text-label-sm uppercase tracking-wider text-on-surface-variant">Category</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                aria-pressed={active}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-3 text-body-sm font-semibold transition-colors',
                  active
                    ? ''
                    : 'border-[var(--border-default)] bg-surface-container text-on-surface-variant hover:bg-surface-container-high',
                )}
                style={
                  active
                    ? { borderColor: c.color, backgroundColor: c.color + '14', color: c.color }
                    : undefined
                }
              >
                <Icon size={18} strokeWidth={1.75} />
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Account */}
      {accounts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            Account
          </h2>
          <Card padding="none">
            {accounts.map((a, i) => {
              const Icon = iconForAccount(a.type);
              const active = accountId === a.id;
              const isLast = i === accounts.length - 1;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccountId(a.id)}
                  aria-pressed={active}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-high',
                    !isLast && 'border-b border-[var(--border-default)]',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 flex-none items-center justify-center rounded-md border',
                      active
                        ? 'border-accent-ai/40 bg-accent-ai/10 text-accent-ai'
                        : 'border-[var(--border-default)] bg-surface-container-high text-on-surface-variant',
                    )}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md font-semibold text-on-surface truncate">{a.name}</p>
                    {a.mask && (
                      <p className="mt-0.5 text-body-sm text-on-surface-variant tabular-nums">
                        {a.mask}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </Card>
        </section>
      )}

      {/* Notes */}
      <Card padding="md" className="flex flex-col gap-2">
        <label
          htmlFor="notes-input"
          className="text-label-sm uppercase tracking-wider text-on-surface-variant"
        >
          Notes (optional)
        </label>
        <textarea
          id="notes-input"
          placeholder="What was this for?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="resize-none rounded-md border border-[var(--border-default)] bg-surface-container-lowest px-3 py-2.5 text-body-md text-on-surface placeholder:text-outline focus:border-accent-ai focus:outline-none focus:shadow-focus-ai"
        />
      </Card>

      {submitError && (
        <p
          role="alert"
          className="rounded-md border border-accent-error/30 bg-accent-error/10 px-3 py-2 text-body-sm text-accent-error"
        >
          {submitError}
        </p>
      )}

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        loading={pending}
        fullWidth
        trailingIcon={<ArrowRight size={16} strokeWidth={2} />}
      >
        Save transaction
      </Button>
    </form>
  );
}

function TypePill({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: 'success' | 'error';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-5 py-2 text-body-sm font-medium transition-colors',
        active
          ? tone === 'success'
            ? 'border-accent-success bg-accent-success/15 text-accent-success'
            : 'border-accent-error bg-accent-error/15 text-accent-error'
          : 'border-[var(--border-default)] bg-surface-container-low text-on-surface-variant hover:bg-surface-container',
      )}
    >
      {label}
    </button>
  );
}
