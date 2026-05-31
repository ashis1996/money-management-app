'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Repeat,
  Copy,
  TrendingUp,
  Zap,
  Moon,
  Coins,
  Sparkles,
  CheckCircle2,
  Trash2,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMoneyLeaks } from '@/hooks/useDashboard';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';

type LeakType =
  | 'UNUSED_SUBSCRIPTION'
  | 'DUPLICATE_SERVICE'
  | 'PRICE_INCREASE'
  | 'IMPULSE_PURCHASE'
  | 'LATE_NIGHT'
  | 'SMALL_FREQUENT';

type LeakSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

interface LeakVm {
  id: string;
  type: LeakType;
  severity: LeakSeverity;
  title: string;
  description: string;
  monthlySavings: number;
  yearlySavings: number;
  merchant?: string;
  recommendation: string;
  isFixed: boolean;
}

const ICON_FOR_TYPE: Record<LeakType, LucideIcon> = {
  UNUSED_SUBSCRIPTION: Repeat,
  DUPLICATE_SERVICE: Copy,
  PRICE_INCREASE: TrendingUp,
  IMPULSE_PURCHASE: Zap,
  LATE_NIGHT: Moon,
  SMALL_FREQUENT: Coins,
};

const TYPE_LABEL: Record<LeakType, string> = {
  UNUSED_SUBSCRIPTION: 'Unused',
  DUPLICATE_SERVICE: 'Duplicate',
  PRICE_INCREASE: 'Price hike',
  IMPULSE_PURCHASE: 'Impulse',
  LATE_NIGHT: 'Late night',
  SMALL_FREQUENT: 'Small & frequent',
};

function severityColor(severity: LeakSeverity): string {
  if (severity === 'HIGH') return 'var(--accent-error)';
  if (severity === 'MEDIUM') return 'var(--accent-warning)';
  return 'var(--outline)';
}

function severityVariant(s: LeakSeverity): 'error' | 'warning' | 'neutral' {
  if (s === 'HIGH') return 'error';
  if (s === 'MEDIUM') return 'warning';
  return 'neutral';
}

type FilterType = 'all' | LeakSeverity;

export default function MoneyLeaksPage() {
  const leaksQuery = useMoneyLeaks();
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');

  const leaks: LeakVm[] = useMemo(() => {
    const raw = (leaksQuery.data ?? {}) as Record<string, unknown>;
    const items = Array.isArray(raw.leaks) ? (raw.leaks as Array<Record<string, unknown>>) : [];
    return items.map((l, i) => {
      const monthly = Number(l.monthlySavings ?? l.monthly_savings ?? l.potential_savings ?? 0);
      return {
        id: String(l.id ?? `leak-${i}`),
        type: (l.type ?? 'IMPULSE_PURCHASE') as LeakType,
        severity: (l.severity ?? 'MEDIUM') as LeakSeverity,
        title: String(l.title ?? 'Leak detected'),
        description: String(l.description ?? ''),
        monthlySavings: monthly,
        yearlySavings: Number(l.yearlySavings ?? l.yearly_savings ?? monthly * 12),
        merchant: l.merchant ? String(l.merchant) : undefined,
        recommendation: String(l.recommendation ?? 'Review this spending pattern'),
        isFixed: !!l.isFixed,
      };
    });
  }, [leaksQuery.data]);

  const visible = useMemo(
    () =>
      leaks
        .filter((l) => !dismissedIds.has(l.id))
        .map((l) => ({ ...l, isFixed: fixedIds.has(l.id) || l.isFixed })),
    [leaks, fixedIds, dismissedIds],
  );

  const stats = useMemo(() => {
    const active = visible.filter((l) => !l.isFixed);
    const monthly = active.reduce((s, l) => s + l.monthlySavings, 0);
    const yearly = active.reduce((s, l) => s + l.yearlySavings, 0);
    const fixed = visible.filter((l) => l.isFixed);
    const fixedSavings = fixed.reduce((s, l) => s + l.monthlySavings, 0);
    return {
      activeCount: active.length,
      monthlySavings: monthly,
      yearlySavings: yearly,
      fixedCount: fixed.length,
      fixedSavings,
    };
  }, [visible]);

  const filtered = useMemo(() => {
    if (filter === 'all') return visible.filter((l) => !l.isFixed);
    return visible.filter((l) => !l.isFixed && l.severity === filter);
  }, [visible, filter]);

  const topLeak = useMemo(
    () => visible.reduce((max, l) => (l.monthlySavings > max ? l.monthlySavings : max), 0),
    [visible],
  );

  const handleFix = (id: string) => setFixedIds((prev) => new Set(prev).add(id));
  const handleDismiss = (id: string) => setDismissedIds((prev) => new Set(prev).add(id));

  if (leaksQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton h={48} rounded="md" />
        <Skeleton h={200} rounded="lg" />
        <Skeleton h={400} rounded="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/insights"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-default)] bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Back to insights"
        >
          <ArrowLeft size={18} strokeWidth={1.75} />
        </Link>
        <div>
          <h1 className="text-headline-lg text-on-surface">Money Leaks</h1>
          <p className="text-body-sm text-on-surface-variant">
            Hidden spending hurting your savings
          </p>
        </div>
      </div>

      {/* Hero — potential savings */}
      <Card variant="hero" padding="xl">
        <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
          Potential monthly savings
        </p>
        <p className="mt-1 text-display-xl tabular-nums text-accent-success">
          {formatCurrency(stats.monthlySavings)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--border-default)] pt-4">
          <div>
            <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
              Yearly impact
            </p>
            <p className="mt-1 text-headline-sm tabular-nums text-on-surface">
              {formatCurrency(stats.yearlySavings)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
              Active leaks
            </p>
            <p className="mt-1 text-headline-sm tabular-nums text-on-surface">
              {stats.activeCount}
            </p>
          </div>
        </div>
      </Card>

      {/* AI summary */}
      {stats.activeCount > 0 && topLeak > 0 && (
        <Card variant="ai" padding="md" className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-accent-ai/30 bg-accent-ai/10">
            <Sparkles size={16} strokeWidth={1.75} className="text-accent-ai" />
          </div>
          <p className="flex-1 text-body-sm text-on-surface">
            Fixing your top leak alone could save{' '}
            <span className="font-bold tabular-nums text-accent-success">
              {formatCurrency(topLeak, { compact: true })}/mo
            </span>{' '}
            — start with the high-priority items below.
          </p>
        </Card>
      )}

      {/* Fixed celebration */}
      {stats.fixedCount > 0 && (
        <Card
          padding="md"
          className="border-accent-success/30 bg-accent-success/8 flex items-center gap-3"
          style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)' }}
        >
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md border border-accent-success/30 bg-accent-success/15">
            <CheckCircle2 size={20} strokeWidth={1.75} className="text-accent-success" />
          </div>
          <div className="flex-1">
            <p className="text-body-md font-bold text-accent-success">
              {stats.fixedCount} {stats.fixedCount === 1 ? 'leak' : 'leaks'} fixed!
            </p>
            <p className="text-body-sm text-accent-success">
              Saving {formatCurrency(stats.fixedSavings)}/month
            </p>
          </div>
        </Card>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'HIGH', 'MEDIUM', 'LOW'] as FilterType[]).map((f) => {
          const active = filter === f;
          const label = f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase();
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 text-label-md transition-colors',
                active
                  ? 'border-accent-primary bg-accent-primary text-white'
                  : 'border-[var(--border-default)] bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={48} strokeWidth={1.5} />}
          title="No leaks here"
          description={
            stats.activeCount > 0
              ? 'No leaks match this severity filter.'
              : 'Nothing is leaking. Run an analysis from the Insights screen to scan for new patterns.'
          }
        />
      ) : (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-headline-md text-on-surface">Active leaks</h2>
            <p className="text-body-sm text-on-surface-variant">
              {filtered.length} {filtered.length === 1 ? 'leak' : 'leaks'} found
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {filtered.map((leak) => (
              <LeakCard
                key={leak.id}
                leak={leak}
                onFix={() => handleFix(leak.id)}
                onDismiss={() => handleDismiss(leak.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function LeakCard({
  leak,
  onFix,
  onDismiss,
}: {
  leak: LeakVm;
  onFix: () => void;
  onDismiss: () => void;
}) {
  const Icon = ICON_FOR_TYPE[leak.type];
  const tone = severityColor(leak.severity);

  return (
    <Card padding="md" style={{ borderColor: tone + '40' }}>
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 flex-none items-center justify-center rounded-md border"
          style={{ backgroundColor: tone + '22', borderColor: tone + '44', color: tone }}
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-body-md font-bold text-on-surface">{leak.title}</p>
            <Badge variant={severityVariant(leak.severity)} size="sm">
              {TYPE_LABEL[leak.type]}
            </Badge>
          </div>
          {leak.merchant && (
            <p className="mt-0.5 text-label-sm tracking-wider text-on-surface-variant">
              {leak.merchant}
            </p>
          )}
          {leak.description && (
            <p className="mt-1 text-body-sm text-on-surface-variant">{leak.description}</p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-y border-[var(--border-default)] py-3">
        <div>
          <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            Saves per month
          </p>
          <p className="mt-1 text-headline-sm tabular-nums" style={{ color: tone }}>
            {formatCurrency(leak.monthlySavings)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">Yearly</p>
          <p className="mt-1 text-headline-sm tabular-nums text-on-surface">
            {formatCurrency(leak.yearlySavings)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-md border border-accent-ai/20 bg-accent-ai/8 px-3 py-2">
        <Sparkles size={12} strokeWidth={2} className="mt-0.5 flex-none text-accent-ai" />
        <p className="flex-1 text-body-sm text-on-surface">{leak.recommendation}</p>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onDismiss}
          leadingIcon={<Trash2 size={14} strokeWidth={2} />}
          className="flex-1"
        >
          Dismiss
        </Button>
        <Button
          size="sm"
          onClick={onFix}
          trailingIcon={<ArrowRight size={14} strokeWidth={2} />}
          className="flex-1"
        >
          Fix it
        </Button>
      </div>
    </Card>
  );
}
