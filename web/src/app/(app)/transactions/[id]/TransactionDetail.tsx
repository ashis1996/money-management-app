'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Zap, Edit3, Tag, Building, Sparkles, X, Check } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useDeleteTransaction,
  useTransaction,
  useUpdateTransaction,
} from '@/hooks/useTransactions';
import { CATEGORIES, categoryFor } from '@/lib/categories';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

interface DetailVm {
  id: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  categoryId: string;
  merchant: string;
  description: string;
  date: string;
  source: string;
  account: string;
  rawSms?: string;
  isImpulse: boolean;
  isLateNight: boolean;
  isWeekend: boolean;
  isSubscription: boolean;
}

function project(t: unknown): DetailVm | null {
  if (!t) return null;
  const r = t as Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    amount: Number(r.amount ?? 0),
    type: (r.type ?? 'DEBIT') as 'DEBIT' | 'CREDIT',
    categoryId: String(r.categoryId ?? r.category ?? 'other'),
    merchant: String(r.merchantName ?? r.merchant ?? 'Unknown'),
    description: String(r.description ?? ''),
    date: String(r.transactionDate ?? r.date ?? new Date().toISOString()),
    source: String(r.source ?? 'MANUAL'),
    account:
      ((r.account as { accountName?: string })?.accountName as string) ?? String(r.accountId ?? ''),
    rawSms: (r.rawSmsText as string) ?? undefined,
    isImpulse: !!r.isImpulse,
    isLateNight: !!r.isLateNight,
    isWeekend: !!r.isWeekend,
    isSubscription: !!r.isSubscription,
  };
}

export function TransactionDetail({ id }: { id: string }) {
  const router = useRouter();
  const txQuery = useTransaction(id);
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const tx = useMemo(() => project(txQuery.data), [txQuery.data]);

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    if (tx?.description !== undefined) setNoteDraft(tx.description);
  }, [tx?.id, tx?.description]);

  if (txQuery.isLoading || !tx) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton h={48} rounded="md" />
        <Skeleton h={240} rounded="lg" />
        <Skeleton h={80} rounded="lg" />
        <Skeleton h={80} rounded="lg" />
      </div>
    );
  }

  const cat = categoryFor(tx.categoryId);
  const CatIcon = cat.icon;

  const handleChangeCategory = (catId: string) => {
    updateTx.mutate({ id: tx.id, data: { category: catId } as Record<string, unknown> as never });
    setShowCategoryPicker(false);
  };

  const handleSaveNote = () => {
    updateTx.mutate({
      id: tx.id,
      data: { description: noteDraft } as Record<string, unknown> as never,
    });
    setEditingNote(false);
  };

  const handleToggleImpulse = () => {
    updateTx.mutate({
      id: tx.id,
      data: { isImpulse: !tx.isImpulse } as Record<string, unknown> as never,
    });
  };

  const handleDelete = async () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Delete this transaction? This action cannot be undone.')
    )
      return;
    try {
      await deleteTx.mutateAsync(tx.id);
      router.push('/transactions');
    } catch {
      /* React Query surfaces the error */
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/transactions"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-default)] bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Back to transactions"
        >
          <ArrowLeft size={18} strokeWidth={1.75} />
        </Link>
        <h1 className="text-headline-md text-on-surface">Transaction</h1>
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Delete transaction"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-accent-error/30 bg-accent-error/10 text-accent-error hover:bg-accent-error/20 transition-colors"
        >
          <Trash2 size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Hero */}
      <Card variant="hero" padding="xl" className="text-center">
        <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
          {tx.type === 'CREDIT' ? 'Received from' : 'Spent at'}
        </p>
        <p className="mt-1 truncate text-headline-md text-on-surface">{tx.merchant}</p>
        <p
          className={cn(
            'mt-3 text-display-lg tabular-nums',
            tx.type === 'CREDIT' ? 'text-accent-success' : 'text-on-surface',
          )}
        >
          {tx.type === 'CREDIT' ? '+' : '−'}
          {formatCurrency(tx.amount)}
        </p>
        <p className="mt-2 text-body-sm text-on-surface-variant tabular-nums">
          {formatDate(tx.date, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
        {(tx.isImpulse || tx.isLateNight || tx.isWeekend || tx.isSubscription) && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {tx.isImpulse && (
              <Badge variant="warning" size="sm">
                Impulse
              </Badge>
            )}
            {tx.isLateNight && (
              <Badge variant="ai" size="sm">
                Late night
              </Badge>
            )}
            {tx.isWeekend && (
              <Badge variant="primary" size="sm">
                Weekend
              </Badge>
            )}
            {tx.isSubscription && (
              <Badge variant="primary" size="sm">
                Subscription
              </Badge>
            )}
          </div>
        )}
      </Card>

      {/* Category card */}
      <Card padding="md">
        <button
          type="button"
          onClick={() => setShowCategoryPicker((v) => !v)}
          aria-expanded={showCategoryPicker}
          className="flex w-full items-center gap-3 text-left"
        >
          <div
            className="flex h-9 w-9 flex-none items-center justify-center rounded-md border"
            style={{
              backgroundColor: cat.color + '22',
              borderColor: cat.color + '44',
              color: cat.color,
            }}
          >
            <CatIcon size={18} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
              Category
            </p>
            <p className="mt-0.5 text-body-md font-semibold text-on-surface">{cat.label}</p>
          </div>
          <Edit3 size={14} strokeWidth={2} className="text-outline" />
        </button>

        {showCategoryPicker && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 border-t border-[var(--border-default)] pt-4">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const active = c.id === tx.categoryId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleChangeCategory(c.id)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-body-sm font-medium transition-colors',
                    active
                      ? 'border-current'
                      : 'border-[var(--border-default)] bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high',
                  )}
                  style={
                    active
                      ? { borderColor: c.color, backgroundColor: c.color + '14', color: c.color }
                      : undefined
                  }
                >
                  <Icon size={16} strokeWidth={1.75} />
                  {c.label}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Account */}
      <Card padding="md" className="flex items-center gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-[var(--border-default)] bg-surface-container-high text-on-surface-variant">
          <Building size={18} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">Account</p>
          <p className="mt-0.5 text-body-md font-semibold text-on-surface truncate">
            {tx.account || 'No account'}
          </p>
        </div>
        <Badge variant="neutral" size="sm">
          {tx.source.toLowerCase()}
        </Badge>
      </Card>

      {/* Notes */}
      <Card padding="md">
        {editingNote ? (
          <div className="flex flex-col gap-3">
            <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">Notes</p>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              autoFocus
              className="w-full rounded-md border border-[var(--border-default)] bg-surface-container-lowest p-3 text-body-md text-on-surface placeholder:text-outline focus:border-accent-ai focus:outline-none focus:shadow-focus-ai resize-none"
              placeholder="What was this for?"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setNoteDraft(tx.description);
                  setEditingNote(false);
                }}
                leadingIcon={<X size={14} strokeWidth={2} />}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveNote}
                leadingIcon={<Check size={14} strokeWidth={2} />}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingNote(true)}
            className="flex w-full items-center gap-3 text-left"
          >
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-[var(--border-default)] bg-surface-container-high text-on-surface-variant">
              <Tag size={18} strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                Notes
              </p>
              <p
                className={cn(
                  'mt-0.5 text-body-md font-semibold line-clamp-2',
                  tx.description ? 'text-on-surface' : 'italic text-outline',
                )}
              >
                {tx.description || 'Tap to add a note'}
              </p>
            </div>
            <Edit3 size={14} strokeWidth={2} className="text-outline" />
          </button>
        )}
      </Card>

      {/* Raw SMS */}
      {tx.rawSms && (
        <Card padding="md">
          <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            SMS source
          </p>
          <p className="mt-2 whitespace-pre-wrap font-mono text-body-sm text-on-surface-variant">
            {tx.rawSms}
          </p>
        </Card>
      )}

      {/* AI insight */}
      <Card variant="ai" padding="md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-accent-ai/30 bg-accent-ai/10">
            <Sparkles size={18} strokeWidth={1.75} className="text-accent-ai" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-label-sm uppercase tracking-wider text-accent-ai">AI Assistant</p>
            <p className="mt-0.5 text-body-md font-semibold text-on-surface">
              {tx.isImpulse ? 'Marked as impulse buy' : 'Was this an impulse purchase?'}
            </p>
          </div>
          <Button
            size="sm"
            variant={tx.isImpulse ? 'secondary' : 'ai'}
            onClick={handleToggleImpulse}
            leadingIcon={<Zap size={14} strokeWidth={2} />}
          >
            {tx.isImpulse ? 'Unmark' : 'Mark'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
