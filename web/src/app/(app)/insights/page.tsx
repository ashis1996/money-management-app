'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Moon,
  PartyPopper,
  Zap,
  Tag,
  Heart,
  Droplet,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useBehaviorAnalysis, useSpendingInsights } from '@/hooks/useInsights';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';

type Period = 'week' | 'month' | 'quarter' | 'year';

interface CategoryRow {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

interface BehavioralPattern {
  type: 'late_night' | 'weekend' | 'impulse';
  title: string;
  description: string;
  amount: number;
  percentage: number;
  severity: 'high' | 'medium' | 'low';
  icon: LucideIcon;
}

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

const CATEGORY_PALETTE = [
  '#EF4444',
  '#A78BFA',
  '#3B82F6',
  '#fbbf24',
  '#F472B6',
  '#10B981',
  '#909096',
  '#22D3EE',
  '#F97316',
];

export default function InsightsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const insightsQuery = useSpendingInsights(period);
  const behaviorQuery = useBehaviorAnalysis();

  const data = useMemo(() => {
    const empty = {
      totalSpent: 0,
      totalIncome: 0,
      savings: 0,
      savingsRate: 0,
      spentChange: 0,
      savingsChange: 0,
      topMerchants: [] as Array<{ name: string; amount: number; count: number }>,
      categories: [] as CategoryRow[],
      patterns: [] as BehavioralPattern[],
    };
    const insights = insightsQuery.data as Record<string, unknown> | undefined;
    if (!insights) return empty;

    const spending = (insights.spending ?? insights) as Record<string, unknown>;
    const totalSpent = Number(spending.totalSpent ?? 0);
    const totalIncome = Number(spending.totalIncome ?? 0);
    const savings = Number(spending.netSavings ?? totalIncome - totalSpent);
    const savingsRate = Number(spending.savingsRate ?? 0);
    const cmp = (spending.comparisonToPrevious ?? {}) as Record<string, unknown>;

    const topMerchants = ((spending.topMerchants ?? []) as unknown[]).map((raw) => {
      const m = raw as Record<string, unknown>;
      return {
        name: String(m.merchantName ?? m.name ?? 'Unknown'),
        amount: Number(m.amount ?? 0),
        count: Number(m.transactionCount ?? m.count ?? 0),
      };
    });

    const categories: CategoryRow[] = ((spending.byCategory ?? []) as unknown[]).map((raw, idx) => {
      const c = raw as Record<string, unknown>;
      return {
        category: String(c.categoryId ?? c.category ?? 'Other'),
        amount: Number(c.amount ?? 0),
        percentage: Number(c.percentage ?? 0),
        color: CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length],
      };
    });

    const behavior = behaviorQuery.data as Record<string, unknown> | undefined;
    const patterns: BehavioralPattern[] = [];
    if (behavior) {
      const late = Number(behavior.lateNightSpending ?? behavior.late_night_spending ?? 0);
      if (late > 0)
        patterns.push({
          type: 'late_night',
          title: 'Late-night spending',
          description: `${formatCurrency(late)} spent after 10 PM. Often impulse purchases.`,
          amount: late,
          percentage: totalSpent ? (late / totalSpent) * 100 : 0,
          severity: late > totalSpent * 0.05 ? 'high' : 'medium',
          icon: Moon,
        });
      const weekend = Number(behavior.weekendSpending ?? behavior.weekend_spending ?? 0);
      if (weekend > 0)
        patterns.push({
          type: 'weekend',
          title: 'Weekend spending',
          description: `${formatCurrency(weekend)} spent on weekends.`,
          amount: weekend,
          percentage: totalSpent ? (weekend / totalSpent) * 100 : 0,
          severity: 'medium',
          icon: PartyPopper,
        });
      const impulse = Number(behavior.impulseSpending ?? behavior.impulse_spending ?? 0);
      if (impulse > 0)
        patterns.push({
          type: 'impulse',
          title: 'Impulse purchases',
          description: `${formatCurrency(impulse)} flagged as impulse buys.`,
          amount: impulse,
          percentage: totalSpent ? (impulse / totalSpent) * 100 : 0,
          severity: 'high',
          icon: Zap,
        });
    }

    return {
      totalSpent,
      totalIncome,
      savings,
      savingsRate,
      spentChange: Number(cmp.spentChange ?? 0),
      savingsChange: Number(cmp.savingsChange ?? 0),
      topMerchants,
      categories,
      patterns,
    };
  }, [insightsQuery.data, behaviorQuery.data]);

  if (insightsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton h={48} rounded="md" />
        <Skeleton h={220} rounded="lg" />
        <Skeleton h={300} rounded="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-headline-lg text-on-surface">Insights</h1>
        <div className="flex gap-2">
          <Link
            href="/health-score"
            className="inline-flex items-center gap-1.5 rounded-full border border-accent-success/30 bg-accent-success/10 px-3 py-1.5 text-label-md font-medium text-accent-success transition-colors hover:bg-accent-success/20"
          >
            <Heart size={14} strokeWidth={1.75} />
            Health Score
          </Link>
          <Link
            href="/money-leaks"
            className="inline-flex items-center gap-1.5 rounded-full border border-accent-error/30 bg-accent-error/10 px-3 py-1.5 text-label-md font-medium text-accent-error transition-colors hover:bg-accent-error/20"
          >
            <Droplet size={14} strokeWidth={1.75} />
            Money Leaks
          </Link>
        </div>
      </div>

      {/* Period chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              aria-pressed={active}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 text-label-md transition-colors duration-snappy',
                active
                  ? 'border-accent-primary bg-accent-primary text-white'
                  : 'border-[var(--border-default)] bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* AI summary hero */}
      <Card variant="ai" padding="xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-accent-ai/30 bg-accent-ai/10">
            <Sparkles size={16} strokeWidth={1.75} className="text-accent-ai" />
          </div>
          <h2 className="text-headline-md text-ai-gradient">AI summary</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <HeroFigure
            label="Spent"
            value={formatCurrency(data.totalSpent, { compact: true })}
            delta={-data.spentChange}
            invert
          />
          <HeroFigure
            label="Saved"
            value={formatCurrency(data.savings, { compact: true })}
            delta={data.savingsChange}
            valueClass="text-accent-success"
          />
        </div>

        <div className="mt-6 mb-1.5 flex justify-between">
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            Savings rate
          </span>
          <span className="text-body-sm font-bold tabular-nums text-accent-success">
            {Math.round(data.savingsRate)}%
          </span>
        </div>
        <ProgressBar value={data.savingsRate} color="var(--accent-success)" />
      </Card>

      {/* Categories */}
      {data.categories.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-headline-md text-on-surface">By category</h2>
            <p className="text-body-sm text-on-surface-variant">
              Top categories driving your spend this {period}
            </p>
          </div>
          <Card padding="lg" className="flex flex-col gap-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container-high">
              {data.categories.slice(0, 6).map((c, i) => (
                <div
                  key={c.category + i}
                  style={{
                    flex: c.percentage,
                    backgroundColor: c.color,
                  }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {data.categories.slice(0, 6).map((c) => (
                <div key={c.category} className="flex items-center gap-3">
                  <span
                    className="h-2 w-2 flex-none rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="flex-1 truncate text-body-sm text-on-surface">{c.category}</span>
                  <span className="tabular-nums text-body-sm font-semibold text-on-surface">
                    {formatCurrency(c.amount, { compact: true })}
                  </span>
                  <span className="w-12 text-right tabular-nums text-body-sm text-on-surface-variant">
                    {Math.round(c.percentage)}%
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Behavioural patterns */}
      {data.patterns.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-headline-md text-ai-gradient">Behavioural patterns</h2>
            <p className="text-body-sm text-on-surface-variant">When and how you tend to spend</p>
          </div>
          <div className="flex flex-col gap-2">
            {data.patterns.map((p) => (
              <PatternCard key={p.type} pattern={p} />
            ))}
          </div>
        </section>
      )}

      {/* Top merchants */}
      {data.topMerchants.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-headline-md text-on-surface">Top merchants</h2>
          <Card padding="md">
            <ul className="flex flex-col">
              {data.topMerchants.slice(0, 5).map((m, i) => (
                <li
                  key={m.name + i}
                  className={cn(
                    'flex items-center gap-3 py-3',
                    i < Math.min(4, data.topMerchants.length - 1) &&
                      'border-b border-[var(--border-default)]',
                  )}
                >
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-surface-container-high text-label-sm font-bold tabular-nums text-on-surface-variant">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-md font-semibold text-on-surface">{m.name}</p>
                    <p className="text-body-sm text-on-surface-variant">
                      {m.count} {m.count === 1 ? 'transaction' : 'transactions'}
                    </p>
                  </div>
                  <span className="tabular-nums text-body-md font-bold text-on-surface">
                    {formatCurrency(m.amount, { compact: true })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* Empty fallback */}
      {data.totalSpent === 0 && data.categories.length === 0 && (
        <Card padding="xl" className="text-center">
          <Tag size={32} strokeWidth={1.5} className="mx-auto text-outline" />
          <p className="mt-3 text-headline-sm text-on-surface">Nothing to insight yet</p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Add transactions or wait for SMS auto-capture to fill in.
          </p>
        </Card>
      )}
    </div>
  );
}

// =============================================================
// Pieces
// =============================================================
function HeroFigure({
  label,
  value,
  delta,
  invert,
  valueClass,
}: {
  label: string;
  value: string;
  delta?: number;
  invert?: boolean;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className={cn('mt-1 text-display-lg tabular-nums', valueClass ?? 'text-on-surface')}>
        {value}
      </p>
      {delta !== undefined && Math.abs(delta) >= 0.5 && <DeltaPill value={delta} invert={invert} />}
    </div>
  );
}

function DeltaPill({ value, invert }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'mt-1 inline-flex items-center gap-1 text-body-sm font-bold tabular-nums',
        positive ? 'text-accent-success' : 'text-accent-error',
      )}
    >
      <Icon size={12} strokeWidth={2} />
      {Math.abs(value).toFixed(0)}%{' '}
      <span className="font-normal text-on-surface-variant">vs prev</span>
    </span>
  );
}

function PatternCard({ pattern }: { pattern: BehavioralPattern }) {
  const Icon = pattern.icon;
  const tone =
    pattern.severity === 'high'
      ? 'var(--accent-error)'
      : pattern.severity === 'medium'
        ? 'var(--accent-warning)'
        : 'var(--outline)';
  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 flex-none items-center justify-center rounded-md border"
          style={{ backgroundColor: tone + '22', borderColor: tone + '44', color: tone }}
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body-md font-semibold text-on-surface">{pattern.title}</p>
            <Badge variant={pattern.severity === 'high' ? 'error' : 'warning'} size="sm">
              {Math.round(pattern.percentage)}%
            </Badge>
          </div>
          <p className="text-body-sm text-on-surface-variant">{pattern.description}</p>
        </div>
      </div>
    </Card>
  );
}
