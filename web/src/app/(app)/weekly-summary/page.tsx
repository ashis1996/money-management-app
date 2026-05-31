'use client';

import { useMemo, useState } from 'react';
import {
  Sparkles,
  Trophy,
  AlertTriangle,
  TrendingDown,
  Lightbulb,
  RefreshCw,
  Tag,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useCurrentWeeklySummary,
  useGenerateWeeklySummary,
  useWeeklySummaryHistory,
} from '@/hooks/useWeeklySummary';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { WeeklySummary } from '@/types';

interface WeekVm {
  id: string;
  weekStart: string;
  weekEnd: string;
  totalSpent: number;
  totalIncome: number;
  netSavings: number;
  /** 0..100 — UIs scale the backend's 0..1 ratio. */
  savingsRate: number;
  topCategories: Array<{ name: string; amount: number; count?: number }>;
  topMerchants: Array<{ name: string; amount: number; count?: number }>;
  unusual: Array<{ merchant: string; amount: number; reason: string }>;
  wins: Array<{ title: string; description: string }>;
  improvements: Array<{ title: string; description: string; amount?: number }>;
  recommendations: Array<{ text: string; impact?: number }>;
  aiSummary?: string | null;
  behavior: {
    lateNightAmount: number;
    lateNightCount: number;
    weekendAmount: number;
    weekendCount: number;
    impulseAmount: number;
    impulseCount: number;
  };
}

function backendToVm(summary: WeeklySummary | null | undefined): WeekVm | null {
  if (!summary) return null;
  const behaviorRaw = summary.behaviorInsights ?? {};
  const winsImps = behaviorRaw.winsAndImprovements ?? null;
  const unusual = (summary.unusualSpending?.items ?? []) as WeekVm['unusual'];
  return {
    id: summary.id,
    weekStart: summary.weekStartDate,
    weekEnd: summary.weekEndDate,
    totalSpent: Number(summary.totalSpent ?? 0),
    totalIncome: Number(summary.totalIncome ?? 0),
    netSavings: Number(summary.savingsAmount ?? 0),
    // Backend stores savingsRate as a 0..1 ratio. Clamp + scale for UI.
    savingsRate: Math.max(0, Math.min(100, Number(summary.savingsRate ?? 0) * 100)),
    topCategories: (summary.topCategories ?? []).map((c) => ({
      name: String(c.name ?? 'Other'),
      amount: Number(c.amount ?? 0),
      count: c.count,
    })),
    topMerchants: (summary.topMerchants ?? []).map((m) => ({
      name: String(m.name ?? 'Unknown'),
      amount: Number(m.amount ?? 0),
      count: m.count,
    })),
    unusual,
    wins: winsImps?.wins ?? [],
    improvements: winsImps?.improvements ?? [],
    recommendations: summary.recommendations ?? [],
    aiSummary: summary.aiSummary ?? null,
    behavior: {
      lateNightAmount: Number(behaviorRaw.lateNightAmount ?? 0),
      lateNightCount: Number(behaviorRaw.lateNightCount ?? 0),
      weekendAmount: Number(behaviorRaw.weekendAmount ?? 0),
      weekendCount: Number(behaviorRaw.weekendCount ?? 0),
      impulseAmount: Number(behaviorRaw.impulseAmount ?? 0),
      impulseCount: Number(behaviorRaw.impulseCount ?? 0),
    },
  };
}

function formatRange(start: string, end: string): string {
  return `${formatDate(start, { day: 'numeric', month: 'short' })} – ${formatDate(end, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

export default function WeeklySummaryPage() {
  const currentQuery = useCurrentWeeklySummary();
  const historyQuery = useWeeklySummaryHistory(8);
  const generateMut = useGenerateWeeklySummary();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const week = useMemo(() => {
    // Selected history entry takes precedence over the live current week.
    if (selectedId && historyQuery.data) {
      const found = historyQuery.data.find((s) => s.id === selectedId);
      if (found) return backendToVm(found);
    }
    return backendToVm(currentQuery.data);
  }, [selectedId, currentQuery.data, historyQuery.data]);

  const history = useMemo<WeeklySummary[]>(
    () => (historyQuery.data ?? []) as WeeklySummary[],
    [historyQuery.data],
  );

  // Prev-week deltas use the immediately preceding history entry when
  // available. The backend doesn't surface them in the response, so we
  // compute locally from history rather than leaving the UI blank.
  const previousWeek = useMemo(() => {
    if (!week || history.length < 2) return null;
    const idx = history.findIndex((h) => h.id === week.id);
    if (idx < 0 || idx >= history.length - 1) return null;
    return backendToVm(history[idx + 1]);
  }, [week, history]);

  const spendChange = previousWeek
    ? percentChange(week!.totalSpent, previousWeek.totalSpent)
    : null;
  const savingsChange = previousWeek
    ? percentChange(week!.netSavings, previousWeek.netSavings)
    : null;

  const isLoading = currentQuery.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-headline-lg text-on-surface">Weekly Summary</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {week ? formatRange(week.weekStart, week.weekEnd) : 'Your week at a glance'}
          </p>
        </div>
        <Button
          variant="secondary"
          leadingIcon={<RefreshCw size={16} strokeWidth={1.75} />}
          onClick={() => {
            setSelectedId(null);
            generateMut.mutate();
          }}
          loading={generateMut.isPending}
        >
          Regenerate
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton h={140} rounded="lg" />
          <Skeleton h={160} rounded="lg" />
          <Skeleton h={200} rounded="lg" />
        </div>
      ) : !week ? (
        <EmptyState
          icon={<Sparkles size={48} strokeWidth={1.5} />}
          title="No summary yet"
          description="Generate your first weekly summary to see how you're doing."
          action={
            <Button
              leadingIcon={<RefreshCw size={16} strokeWidth={1.75} />}
              onClick={() => generateMut.mutate()}
              loading={generateMut.isPending}
            >
              Generate now
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-6 min-w-0">
            {/* AI summary */}
            {week.aiSummary && (
              <Card variant="ai" padding="lg">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-accent-ai/30 bg-accent-ai/10">
                    <Sparkles size={16} strokeWidth={1.75} className="text-accent-ai" />
                  </div>
                  <h2 className="text-headline-sm text-accent-ai">AI summary</h2>
                </div>
                <p className="text-body-md text-on-surface leading-relaxed">{week.aiSummary}</p>
              </Card>
            )}

            {/* Hero stats */}
            <Card variant="hero" padding="lg" className="flex flex-col gap-4">
              <div className="flex items-stretch gap-4">
                <HeroCol
                  label="Saved"
                  value={formatCurrency(week.netSavings, { compact: true })}
                  delta={savingsChange}
                  tone={week.netSavings >= 0 ? 'success' : 'error'}
                />
                <Divider />
                <HeroCol
                  label="Spent"
                  value={formatCurrency(week.totalSpent, { compact: true })}
                  delta={spendChange}
                  tone="default"
                  /* For spending, "negative change" (less spent) is
                   * actually good — flip the polarity that drives the
                   * coloured delta hint. */
                  flipDelta
                />
                <Divider />
                <HeroCol
                  label="Income"
                  value={formatCurrency(week.totalIncome, { compact: true })}
                  tone="default"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-label-sm uppercase tracking-wider">
                  <span className="text-on-surface-variant">Savings rate</span>
                  <span className="tabular-nums text-accent-success">
                    {week.savingsRate.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar value={week.savingsRate} color="var(--accent-success)" />
              </div>
            </Card>

            {/* Top categories + merchants */}
            <div className="grid gap-4 md:grid-cols-2">
              <BreakdownCard
                title="Top categories"
                icon={<Tag size={16} strokeWidth={1.75} />}
                items={week.topCategories}
                empty="No spending categorised yet."
              />
              <BreakdownCard
                title="Top merchants"
                icon={<Store size={16} strokeWidth={1.75} />}
                items={week.topMerchants}
                empty="No merchant patterns this week."
              />
            </div>

            {/* Behavioural patterns */}
            {(week.behavior.lateNightCount > 0 ||
              week.behavior.weekendCount > 0 ||
              week.behavior.impulseCount > 0) && (
              <Card padding="lg" className="flex flex-col gap-3">
                <h2 className="text-headline-sm text-on-surface">Behavioural patterns</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <BehaviorTile
                    label="Late night"
                    count={week.behavior.lateNightCount}
                    amount={week.behavior.lateNightAmount}
                    color="var(--accent-ai)"
                    emoji="🌙"
                  />
                  <BehaviorTile
                    label="Weekend"
                    count={week.behavior.weekendCount}
                    amount={week.behavior.weekendAmount}
                    color="var(--accent-primary)"
                    emoji="📅"
                  />
                  <BehaviorTile
                    label="Impulse"
                    count={week.behavior.impulseCount}
                    amount={week.behavior.impulseAmount}
                    color="var(--accent-warning)"
                    emoji="⚡"
                  />
                </div>
              </Card>
            )}

            {/* Wins */}
            {week.wins.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-headline-sm text-on-surface">Wins this week</h2>
                <div className="flex flex-col gap-2">
                  {week.wins.map((w, i) => (
                    <Card
                      key={i}
                      padding="md"
                      className="flex items-start gap-3 border-accent-success/30 bg-accent-success/5"
                    >
                      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-accent-success/30 bg-accent-success/10">
                        <Trophy size={16} strokeWidth={1.75} className="text-accent-success" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-body-md font-semibold text-on-surface">{w.title}</h3>
                        <p className="text-body-sm text-on-surface-variant mt-0.5">
                          {w.description}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Improvements */}
            {week.improvements.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-headline-sm text-on-surface">Areas to improve</h2>
                <div className="flex flex-col gap-2">
                  {week.improvements.map((imp, i) => (
                    <Card key={i} padding="md" className="flex items-start gap-3">
                      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-accent-warning/30 bg-accent-warning/10">
                        <TrendingDown size={16} strokeWidth={1.75} className="text-accent-warning" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-body-md font-semibold text-on-surface">{imp.title}</h3>
                        <p className="text-body-sm text-on-surface-variant mt-0.5">
                          {imp.description}
                        </p>
                      </div>
                      {imp.amount !== undefined && (
                        <p className="shrink-0 text-body-md font-bold tabular-nums text-accent-warning">
                          {formatCurrency(imp.amount, { compact: true })}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Unusual */}
            {week.unusual.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-headline-sm text-on-surface">Unusual spending</h2>
                <Card padding="md">
                  <ul className="divide-y divide-[var(--border-default)]">
                    {week.unusual.map((u, i) => (
                      <li key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <AlertTriangle
                          size={16}
                          strokeWidth={2}
                          className="flex-none text-accent-error"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-md font-semibold text-on-surface">
                            {u.merchant}
                          </p>
                          <p className="truncate text-body-sm text-on-surface-variant">
                            {u.reason}
                          </p>
                        </div>
                        <p className="shrink-0 text-body-md font-bold tabular-nums text-accent-error">
                          {formatCurrency(u.amount)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            )}

            {/* Recommendations */}
            {week.recommendations.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-headline-sm text-accent-ai">Recommendations for next week</h2>
                <div className="flex flex-col gap-2">
                  {week.recommendations.map((r, i) => (
                    <Card key={i} variant="ai" padding="md" className="flex items-start gap-3">
                      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-accent-ai/30 bg-accent-ai/10">
                        <Lightbulb size={16} strokeWidth={1.75} className="text-accent-ai" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-body-md text-on-surface leading-relaxed">{r.text}</p>
                        {!!r.impact && (
                          <p className="mt-1 text-body-sm font-bold tabular-nums text-accent-success">
                            Save {formatCurrency(r.impact, { compact: true })}/wk
                          </p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* History rail */}
          <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
            <h2 className="text-headline-sm text-on-surface">History</h2>
            {historyQuery.isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} h={72} rounded="lg" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <Card padding="md">
                <p className="text-body-sm text-on-surface-variant">
                  Your past weeks will appear here once they&apos;re generated.
                </p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {history.map((h) => {
                  const isActive = h.id === week.id;
                  const savings = Number(h.savingsAmount ?? 0);
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setSelectedId(h.id)}
                      aria-pressed={isActive}
                      className={cn(
                        'rounded-lg border bg-surface-container px-4 py-3 text-left transition-colors duration-snappy',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-outline',
                        isActive
                          ? 'border-accent-primary bg-accent-primary/10'
                          : 'border-[var(--border-default)] hover:bg-surface-container-high',
                      )}
                    >
                      <p className="text-body-sm font-semibold text-on-surface">
                        {formatDate(h.weekStartDate, { day: 'numeric', month: 'short' })} –{' '}
                        {formatDate(h.weekEndDate, { day: 'numeric', month: 'short' })}
                      </p>
                      <p
                        className={cn(
                          'mt-1 text-body-md font-bold tabular-nums',
                          savings >= 0 ? 'text-accent-success' : 'text-accent-error',
                        )}
                      >
                        {savings >= 0 ? '+' : '−'}
                        {formatCurrency(Math.abs(savings), { compact: true })}
                      </p>
                      <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                        Saved
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

// =============================================================
// Pieces
// =============================================================
function HeroCol({
  label,
  value,
  delta,
  tone,
  flipDelta,
}: {
  label: string;
  value: string;
  delta?: number | null;
  tone: 'success' | 'error' | 'default';
  flipDelta?: boolean;
}) {
  const valueClass =
    tone === 'success'
      ? 'text-accent-success'
      : tone === 'error'
        ? 'text-accent-error'
        : 'text-on-surface';

  let deltaTone: 'success' | 'error' | 'muted' = 'muted';
  if (delta != null) {
    const positive = flipDelta ? delta < 0 : delta > 0;
    const negative = flipDelta ? delta > 0 : delta < 0;
    if (positive) deltaTone = 'success';
    else if (negative) deltaTone = 'error';
  }

  return (
    <div className="flex-1 min-w-0">
      <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className={cn('mt-1 text-headline-lg tabular-nums', valueClass)}>{value}</p>
      {delta != null && Number.isFinite(delta) && (
        <p
          className={cn(
            'mt-1 text-label-sm uppercase tracking-wider tabular-nums',
            deltaTone === 'success'
              ? 'text-accent-success'
              : deltaTone === 'error'
                ? 'text-accent-error'
                : 'text-on-surface-variant',
          )}
        >
          {delta >= 0 ? '+' : '−'}
          {Math.abs(delta).toFixed(0)}% vs last week
        </p>
      )}
    </div>
  );
}

function Divider() {
  return <div className="w-px self-stretch bg-[var(--border-default)]" />;
}

function BreakdownCard({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ name: string; amount: number; count?: number }>;
  empty: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.amount));
  return (
    <Card padding="lg" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-on-surface-variant">{icon}</span>
        <h2 className="text-headline-sm text-on-surface">{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.slice(0, 5).map((item) => (
            <li key={item.name} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-body-sm text-on-surface">{item.name}</span>
                <span className="shrink-0 text-body-sm font-semibold tabular-nums text-on-surface">
                  {formatCurrency(item.amount, { compact: true })}
                </span>
              </div>
              <ProgressBar value={(item.amount / max) * 100} color="var(--accent-primary)" />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BehaviorTile({
  label,
  count,
  amount,
  color,
  emoji,
}: {
  label: string;
  count: number;
  amount: number;
  color: string;
  emoji: string;
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-md border bg-surface-container-low p-3"
      style={{ borderColor: 'var(--border-default)' }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-body-md">
          {emoji}
        </span>
        <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
      </div>
      <p className="text-headline-sm tabular-nums text-on-surface">
        {formatCurrency(amount, { compact: true })}
      </p>
      <p className="text-body-sm tabular-nums" style={{ color }}>
        {count} txn{count === 1 ? '' : 's'}
      </p>
    </div>
  );
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
