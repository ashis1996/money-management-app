'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Sliders, Plus, Sparkles, TrendingUp, TrendingDown, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTransactions } from '@/hooks/useTransactions';
import { categoryFor, glyphColor } from '@/lib/categories';
import { formatCurrency } from '@/lib/format';
import type { TransactionType } from '@/types';
import { cn } from '@/lib/cn';

type CaptureMode = 'AUTO' | 'MANUAL' | 'ASSISTED';
type FilterTab = 'all' | CaptureMode;

interface TxRow {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  merchant: string;
  description: string;
  date: string;
  source: string;
  captureMode: CaptureMode;
  isImpulse: boolean;
  isLateNight: boolean;
  isWeekend: boolean;
  isUserConfirmed: boolean;
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'AUTO', label: 'Auto' },
  { key: 'ASSISTED', label: 'Assisted' },
  { key: 'MANUAL', label: 'Manual' },
];

export default function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const txQuery = useTransactions({
    type: typeFilter === 'ALL' ? undefined : typeFilter,
    search: search || undefined,
  });

  const rows: TxRow[] = useMemo(() => {
    const list = (txQuery.data ?? []) as unknown as Array<Record<string, unknown>>;
    return list.map((t) => ({
      id: String(t.id),
      amount: Number(t.amount ?? 0),
      type: (t.type ?? 'DEBIT') as TransactionType,
      category: String(t.categoryId ?? t.category ?? 'other'),
      merchant: String(t.merchantName ?? t.merchant ?? 'Unknown'),
      description: String(t.description ?? ''),
      date: String(t.transactionDate ?? t.date ?? new Date().toISOString()),
      source: String(t.source ?? 'MANUAL'),
      captureMode: (t.captureMode ?? 'MANUAL') as CaptureMode,
      isImpulse: !!t.isImpulse,
      isLateNight: !!t.isLateNight,
      isWeekend: !!t.isWeekend,
      isUserConfirmed: !!t.isUserConfirmed,
    }));
  }, [txQuery.data]);

  const visible = useMemo(() => {
    return rows.filter((tx) => {
      if (filter !== 'all' && tx.captureMode !== filter) return false;
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          tx.merchant.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          tx.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, filter, typeFilter, search]);

  const pendingAICount = rows.filter(
    (t) => t.captureMode === 'ASSISTED' && !t.isUserConfirmed,
  ).length;

  // Month-to-date analytics
  const analytics = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let income = 0;
    let spent = 0;
    rows.forEach((t) => {
      if (new Date(t.date).getTime() < monthStart) return;
      if (t.type === 'CREDIT') income += t.amount;
      else spent += t.amount;
    });
    return { income, spent, net: income - spent };
  }, [rows]);

  const grouped = useMemo(() => {
    const groups: Record<string, TxRow[]> = {};
    visible.forEach((tx) => {
      const key = groupKeyFor(tx.date);
      (groups[key] ??= []).push(tx);
    });
    return groups;
  }, [visible]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-headline-lg text-on-surface">Transactions</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {visible.length} {visible.length === 1 ? 'transaction' : 'transactions'}
          </p>
        </div>
        <Link href="/transactions/new">
          <Button leadingIcon={<Plus size={16} strokeWidth={2.5} />}>New</Button>
        </Link>
      </div>

      {/* Search */}
      <div className="flex h-11 items-center gap-2 rounded-md border border-[var(--border-default)] bg-surface-container-lowest px-4 focus-within:border-accent-ai focus-within:shadow-focus-ai transition-shadow duration-snappy">
        <Search size={16} strokeWidth={1.75} className="text-on-surface-variant" />
        <input
          type="search"
          placeholder="Search merchants, categories, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search transactions"
          className="flex-1 bg-transparent text-body-md text-on-surface placeholder:text-outline focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container transition-colors"
          aria-label="Toggle filters"
          aria-expanded={filtersOpen}
        >
          <Sliders size={16} strokeWidth={1.75} />
        </button>
      </div>

      {/* Filters dropdown */}
      {filtersOpen && (
        <Card padding="md" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">Type</p>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="text-on-surface-variant hover:text-on-surface"
              aria-label="Close filters"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
          <div className="flex gap-2">
            {(['ALL', 'CREDIT', 'DEBIT'] as const).map((t) => (
              <TypePill
                key={t}
                active={typeFilter === t}
                onClick={() => setTypeFilter(t)}
                label={t === 'ALL' ? 'All' : t === 'CREDIT' ? 'Credit' : 'Debit'}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Mini analytics + AI nudge */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card padding="md" className="md:col-span-2">
          <div className="flex items-stretch gap-4">
            <AnalyticsCell
              label="Spent this month"
              value={formatCurrency(analytics.spent, { compact: true })}
              tone="error"
              icon={<TrendingDown size={14} strokeWidth={2} />}
            />
            <div className="w-px self-stretch bg-[var(--border-default)]" />
            <AnalyticsCell
              label="Net"
              value={`${analytics.net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(analytics.net), { compact: true })}`}
              tone={analytics.net >= 0 ? 'success' : 'error'}
              icon={
                analytics.net >= 0 ? (
                  <TrendingUp size={14} strokeWidth={2} />
                ) : (
                  <TrendingDown size={14} strokeWidth={2} />
                )
              }
            />
          </div>
        </Card>

        {pendingAICount > 0 ? (
          <Card variant="ai" padding="md" className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-accent-ai/30 bg-accent-ai/10">
              <Sparkles size={16} strokeWidth={1.75} className="text-accent-ai" />
            </div>
            <div className="min-w-0">
              <p className="text-body-sm font-semibold text-on-surface">
                {pendingAICount} AI suggestion{pendingAICount === 1 ? '' : 's'} waiting
              </p>
              <p className="text-body-sm text-on-surface-variant truncate">
                Confirm or recategorise rows below
              </p>
            </div>
          </Card>
        ) : (
          <Card variant="ai" padding="md" className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-accent-ai/30 bg-accent-ai/10">
              <Sparkles size={16} strokeWidth={1.75} className="text-accent-ai" />
            </div>
            <p className="text-body-sm text-on-surface-variant min-w-0">
              All caught up. AI confidence on the latest rows is{' '}
              <span className="text-accent-ai font-semibold">high</span>.
            </p>
          </Card>
        )}
      </div>

      {/* Filter chip rail */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => (
          <FilterChip
            key={tab.key}
            label={tab.label}
            active={filter === tab.key}
            onClick={() => setFilter(tab.key)}
          />
        ))}
      </div>

      {/* List */}
      {txQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} h={72} rounded="lg" />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState
          icon={<EmptyEnvelope />}
          title="No transactions yet"
          description="Add a transaction or wait for SMS auto-capture to fill in your activity."
          action={
            <Link href="/transactions/new">
              <Button leadingIcon={<Plus size={16} strokeWidth={2.5} />}>Add transaction</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([date, items]) => (
            <section key={date} className="flex flex-col gap-2">
              <h2 className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                {date}
              </h2>
              <div className="flex flex-col gap-2">
                {items.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================
// Pieces
// =============================================================
function AnalyticsCell({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: 'success' | 'error' | 'primary';
  icon?: React.ReactNode;
}) {
  const colorClass =
    tone === 'success'
      ? 'text-accent-success'
      : tone === 'error'
        ? 'text-accent-error'
        : 'text-accent-primary';
  return (
    <div className="flex flex-col gap-1 flex-1">
      <span className="text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className={cn('text-headline-sm tabular-nums', colorClass)}>{value}</span>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full border px-4 py-2 text-label-md transition-colors duration-snappy',
        active
          ? 'border-accent-primary bg-accent-primary text-white'
          : 'border-[var(--border-default)] bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
      )}
    >
      {label}
    </button>
  );
}

function TypePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex-1 rounded-md border py-2 text-body-sm font-medium transition-colors',
        active
          ? 'border-accent-primary bg-accent-primary/15 text-accent-primary'
          : 'border-[var(--border-default)] bg-surface-container-low text-on-surface-variant hover:bg-surface-container',
      )}
    >
      {label}
    </button>
  );
}

function TransactionRow({ tx }: { tx: TxRow }) {
  const cat = categoryFor(tx.category);
  const initial = (tx.merchant?.[0] || '?').toUpperCase();
  const tone = glyphColor(tx.merchant);
  const time = new Date(tx.date).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const pendingAi = tx.captureMode === 'ASSISTED' && !tx.isUserConfirmed;

  return (
    <Link
      href={`/transactions/${tx.id}`}
      className={cn(
        'group flex items-center gap-3 rounded-lg border bg-surface-container px-4 py-3 transition-colors duration-snappy hover:bg-surface-container-high',
        pendingAi ? 'border-accent-ai/40' : 'border-[var(--border-default)]',
      )}
    >
      <div
        aria-hidden
        className="flex h-11 w-11 flex-none items-center justify-center rounded-md border text-body-md font-bold tabular-nums"
        style={{ backgroundColor: tone + '22', borderColor: tone + '44', color: tone }}
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-body-md font-semibold text-on-surface">{tx.merchant}</p>
          <p
            className={cn(
              'shrink-0 text-body-md font-bold tabular-nums',
              tx.type === 'CREDIT' ? 'text-accent-success' : 'text-on-surface',
            )}
          >
            {tx.type === 'CREDIT' ? '+' : '−'}
            {formatCurrency(tx.amount)}
          </p>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-body-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: cat.color }}
                aria-hidden
              />
              {cat.label}
            </span>
            {' • '}
            {tx.source.toLowerCase()}
          </p>
          <p className="shrink-0 text-body-sm text-outline tabular-nums">{time}</p>
        </div>
        {(tx.isImpulse || tx.isLateNight || tx.isWeekend || pendingAi) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pendingAi && (
              <Badge variant="ai" size="sm">
                AI suggested
              </Badge>
            )}
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
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptyEnvelope() {
  return (
    <svg
      width={64}
      height={64}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 8l9 6 9-6" />
    </svg>
  );
}

// =============================================================
// Helpers
// =============================================================
function groupKeyFor(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
