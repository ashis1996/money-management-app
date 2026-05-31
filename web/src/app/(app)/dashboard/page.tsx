'use client';

import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Droplets,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useActionCards,
  useActiveSubscriptions,
  useArchetype,
  useDashboard,
  useHealthScore,
  useMoneyLeaks,
  useUpcomingSubscriptions,
} from '@/hooks/useDashboard';
import { useGoals } from '@/hooks/useGoals';
import {
  getArchetypeLabel,
  getHealthColorVar,
  getHealthRating,
  widgetOrderFor,
} from '@/lib/archetype';
import { formatCurrency, getGreeting } from '@/lib/format';
import { useAuthStore } from '@/store/auth';
import type { Archetype, HealthScoreFactor } from '@/types';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const dashboardQuery = useDashboard();
  const healthQuery = useHealthScore();
  const archetypeQuery = useArchetype();
  const leaksQuery = useMoneyLeaks();
  const goalsQuery = useGoals(false);
  const cardsQuery = useActionCards({ status: 'PENDING' });
  const upcomingSubs = useUpcomingSubscriptions(14);
  const activeSubs = useActiveSubscriptions();

  const queries = [
    dashboardQuery,
    healthQuery,
    archetypeQuery,
    leaksQuery,
    goalsQuery,
    cardsQuery,
    upcomingSubs,
    activeSubs,
  ];
  const anyLoaded = queries.some((q) => q.data !== undefined);
  const allFailed = queries.every((q) => q.isError && q.data === undefined);
  const initialLoading = !anyLoaded && queries.some((q) => q.isFetching);

  const data = useMemo(() => {
    const dash = dashboardQuery.data ?? ({} as Record<string, unknown>);
    const health = healthQuery.data ?? ({} as Record<string, unknown>);
    const leaks = leaksQuery.data ?? ({} as Record<string, unknown>);
    const cards = cardsQuery.data ?? [];
    const goals = goalsQuery.data ?? [];
    const upcoming = upcomingSubs.data ?? [];
    const subs = activeSubs.data ?? [];

    const archetype: Archetype = ((archetypeQuery.data?.archetype as Archetype | undefined) ||
      (user?.archetype as Archetype) ||
      'BALANCED') as Archetype;

    const healthScore = Number(
      (health as { score?: number; healthScore?: number }).score ??
        (health as { healthScore?: number }).healthScore ??
        0,
    );
    const factors: HealthScoreFactor[] = Array.isArray(
      (health as { factors?: HealthScoreFactor[] }).factors,
    )
      ? ((health as { factors?: HealthScoreFactor[] }).factors ?? [])
      : [];

    const monthlySpent = Number((dash as { monthlyExpense?: number }).monthlyExpense ?? 0);
    const monthlyIncome = Number((dash as { monthlyIncome?: number }).monthlyIncome ?? 0);
    const monthlySavings = Number(
      (dash as { netSavings?: number }).netSavings ?? monthlyIncome - monthlySpent,
    );
    const totalBalance = Number((dash as { totalBalance?: number }).totalBalance ?? 0);

    const potentialSavings = Number(
      (leaks as { potential_monthly_savings?: number; monthly_savings?: number })
        .potential_monthly_savings ??
        (leaks as { monthly_savings?: number }).monthly_savings ??
        0,
    );
    const topLeaks = ((leaks as { leaks?: Array<Record<string, unknown>> }).leaks ?? [])
      .slice(0, 3)
      .map((l) => ({
        title: (l.title || l.type || 'Leak') as string,
        amount: Number((l.monthly_savings as number) ?? (l.amount as number) ?? 0),
      }));

    const goalsList = goals.filter((g) => !g.isCompleted);
    const topGoal = goalsList[0];

    const upcomingDues = upcoming.reduce((sum, u) => sum + Number(u.amount ?? 0), 0);
    const dailyBurn = monthlySpent / 30;
    const daysLeft = dailyBurn > 0 ? Math.floor(totalBalance / dailyBurn) : 30;

    return {
      archetype,
      healthScore,
      factors,
      monthlySpent,
      monthlyIncome,
      monthlySavings,
      totalBalance,
      potentialSavings,
      topLeaks,
      goalsList,
      topGoal,
      upcomingDues,
      activeSubscriptions: subs.length,
      cards: cards.slice(0, 3),
      forecastDays: daysLeft,
    };
  }, [
    dashboardQuery.data,
    healthQuery.data,
    archetypeQuery.data,
    leaksQuery.data,
    cardsQuery.data,
    goalsQuery.data,
    upcomingSubs.data,
    activeSubs.data,
    user,
  ]);

  if (initialLoading) {
    return <DashboardSkeleton />;
  }

  if (allFailed) {
    return (
      <Card variant="default" padding="xl" className="text-center">
        <AlertTriangle className="mx-auto text-accent-error mb-3" size={32} strokeWidth={1.75} />
        <h2 className="text-headline-md text-on-surface mb-2">Couldn&apos;t load dashboard</h2>
        <p className="text-body-md text-on-surface-variant mb-5">
          Check your connection and try again.
        </p>
        <Button onClick={() => queries.forEach((q) => q.refetch())}>Retry</Button>
      </Card>
    );
  }

  const widgetOrder = widgetOrderFor(data.archetype);
  const widgets: Record<string, React.ReactNode> = {
    health: <HealthWidget key="health" score={data.healthScore} factors={data.factors} />,
    spending: (
      <SpendingWidget
        key="spending"
        spent={data.monthlySpent}
        income={data.monthlyIncome}
        savings={data.monthlySavings}
      />
    ),
    leaks: <LeaksWidget key="leaks" leaks={data.topLeaks} potential={data.potentialSavings} />,
    goals: <GoalsWidget key="goals" goal={data.topGoal} />,
    actions: <ActionsWidget key="actions" cards={data.cards} />,
    subscriptions: (
      <SubscriptionsWidget
        key="subscriptions"
        count={data.activeSubscriptions}
        dues={data.upcomingDues}
      />
    ),
    forecast: (
      <ForecastWidget key="forecast" days={data.forecastDays} balance={data.totalBalance} />
    ),
    payments: (
      <SubscriptionsWidget
        key="payments"
        count={data.activeSubscriptions}
        dues={data.upcomingDues}
      />
    ),
  };

  return (
    <div className="flex flex-col gap-6">
      <Hero
        userName={user?.name ?? 'there'}
        archetype={data.archetype}
        totalBalance={data.totalBalance}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {widgetOrder.map((k) => widgets[k]).filter((w): w is React.ReactNode => Boolean(w))}
      </div>
    </div>
  );
}

// =============================================================
// Hero
// =============================================================
function Hero({
  userName,
  archetype,
  totalBalance,
}: {
  userName: string;
  archetype: Archetype;
  totalBalance: number;
}) {
  return (
    <Card variant="hero">
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-24 h-[400px] w-[400px] rounded-full blur-3xl pointer-events-none"
        style={{
          background: 'radial-gradient(closest-side, rgba(59,130,246,0.15), transparent 70%)',
        }}
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            {getGreeting()}
          </p>
          <h1 className="text-headline-lg lg:text-display-lg text-on-surface mt-1">
            {userName} <span className="text-ai-gradient">·</span>
          </h1>
          <p className="text-body-md text-on-surface-variant mt-2 flex items-center gap-2">
            <Sparkles size={14} className="text-accent-ai" strokeWidth={2} />
            Your finances are healthier than 82% of users this month.
          </p>
        </div>
        <div className="flex flex-col items-start lg:items-end">
          <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            Total Balance
          </p>
          <p className="text-display-lg text-on-surface tabular-nums mt-1">
            {formatCurrency(totalBalance)}
          </p>
          <Badge variant="primary" size="sm" className="mt-2">
            {getArchetypeLabel(archetype)}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

// =============================================================
// Widgets
// =============================================================
function HealthWidget({ score, factors }: { score: number; factors: HealthScoreFactor[] }) {
  const visible = factors.slice(0, 4);
  return (
    <Card variant="default">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-headline-md text-on-surface">Health Score</h3>
          <p className="text-body-sm text-on-surface-variant mt-1">{getHealthRating(score)}</p>
        </div>
        <Link
          href="/insights"
          className="text-label-md text-accent-primary inline-flex items-center gap-1"
        >
          Details <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <div className="flex items-center gap-6">
        <ProgressRing
          value={score}
          size={120}
          strokeWidth={10}
          color={getHealthColorVar(score)}
          centerLabel={
            <div className="text-center">
              <div className="text-display-lg text-on-surface tabular-nums">
                {Math.round(score)}
              </div>
              <div className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                / 100
              </div>
            </div>
          }
        />
        <div className="flex-1 flex flex-col gap-3">
          {visible.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant italic">
              Run an analysis to see what&apos;s driving your score.
            </p>
          ) : (
            visible.map((f) => (
              <div key={f.label} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-body-sm">
                  <span className="text-on-surface-variant">{f.label}</span>
                  <span className="tabular-nums text-on-surface">
                    {Math.round(Number(f.value ?? 0))}
                  </span>
                </div>
                <ProgressBar
                  value={Number(f.value ?? 0)}
                  color={f.color || getHealthColorVar(Number(f.value ?? 0))}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

function SpendingWidget({
  spent,
  income,
  savings,
}: {
  spent: number;
  income: number;
  savings: number;
}) {
  const rate = income > 0 ? Math.max(0, Math.round((savings / income) * 100)) : 0;
  return (
    <Card variant="default">
      <h3 className="text-headline-md text-on-surface mb-4">This Month</h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Income" value={income} variant="success" icon={<TrendingUp size={14} />} />
        <Stat label="Spent" value={spent} variant="error" icon={<TrendingDown size={14} />} />
        <Stat label="Saved" value={savings} variant="primary" />
      </div>
      <div className="flex justify-between text-body-sm mb-1.5">
        <span className="text-on-surface-variant">Savings rate</span>
        <span className="tabular-nums text-on-surface">{rate}%</span>
      </div>
      <ProgressBar value={rate} color="var(--accent-primary)" />
    </Card>
  );
}

function Stat({
  label,
  value,
  variant,
  icon,
}: {
  label: string;
  value: number;
  variant: 'success' | 'error' | 'primary';
  icon?: React.ReactNode;
}) {
  const colorClass =
    variant === 'success'
      ? 'text-accent-success'
      : variant === 'error'
        ? 'text-accent-error'
        : 'text-accent-primary';
  const sign = variant === 'success' ? '+' : variant === 'error' ? '-' : '';
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label-sm uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className={`text-headline-sm tabular-nums ${colorClass}`}>
        {sign}
        {formatCurrency(value, { compact: true })}
      </span>
    </div>
  );
}

function LeaksWidget({
  leaks,
  potential,
}: {
  leaks: Array<{ title: string; amount: number }>;
  potential: number;
}) {
  return (
    <Card variant="default">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Droplets size={18} className="text-accent-error" strokeWidth={1.75} />
          <h3 className="text-headline-md text-on-surface">Money Leaks</h3>
        </div>
        <Badge variant={leaks.length > 0 ? 'error' : 'neutral'} size="sm">
          {leaks.length} found
        </Badge>
      </div>
      <p className="text-body-sm text-on-surface-variant mb-3">
        Save up to{' '}
        <span className="tabular-nums text-accent-success font-semibold">
          {formatCurrency(potential, { compact: true })}/mo
        </span>
      </p>
      {leaks.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant italic">
          No leaks detected — nice work.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {leaks.map((l, i) => (
            <li key={`${l.title}-${i}`} className="flex justify-between items-center">
              <span className="text-body-sm text-on-surface">{l.title}</span>
              <span className="text-body-sm tabular-nums text-accent-error">
                {formatCurrency(l.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function GoalsWidget({
  goal,
}: {
  goal:
    | {
        name: string;
        progressPercent: number;
        currentAmount: number;
        targetAmount: number;
      }
    | undefined;
}) {
  return (
    <Card variant="default">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-accent-success" strokeWidth={1.75} />
          <h3 className="text-headline-md text-on-surface">Top Goal</h3>
        </div>
        <Link
          href="/dashboard"
          className="text-label-md text-accent-primary inline-flex items-center gap-1"
          aria-disabled
        >
          All
        </Link>
      </div>
      {goal ? (
        <div className="flex items-center gap-4">
          <ProgressRing
            value={Number(goal.progressPercent ?? 0)}
            size={84}
            strokeWidth={6}
            color="var(--accent-success)"
          />
          <div className="flex-1 min-w-0">
            <p className="text-body-md text-on-surface truncate">{goal.name}</p>
            <p className="text-body-sm text-on-surface-variant tabular-nums mt-1">
              {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
            </p>
            <p className="text-label-sm uppercase tracking-wider text-accent-success mt-1">
              {formatCurrency(Math.max(0, goal.targetAmount - goal.currentAmount))} to go
            </p>
          </div>
        </div>
      ) : (
        <p className="text-body-sm text-on-surface-variant italic">
          Set your first savings goal to see progress here.
        </p>
      )}
    </Card>
  );
}

function ActionsWidget({
  cards,
}: {
  cards: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    impactAmount?: number;
  }>;
}) {
  if (cards.length === 0) return null;
  return (
    <Card variant="ai" padding="lg" className="md:col-span-2 lg:col-span-3">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={18} className="text-accent-ai" strokeWidth={1.75} />
        <h3 className="text-headline-md text-ai-gradient">Fix My Finances</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((c) => {
          const variant: 'error' | 'warning' | 'primary' =
            c.priority === 'URGENT' ? 'error' : c.priority === 'HIGH' ? 'warning' : 'primary';
          return (
            <div
              key={c.id}
              className="rounded-md border border-[var(--border-default)] bg-surface-container-low p-4"
            >
              <Badge variant={variant} size="sm">
                {c.priority}
              </Badge>
              <p className="text-body-md text-on-surface font-medium mt-2">{c.title}</p>
              <p className="text-body-sm text-on-surface-variant mt-1 line-clamp-2">
                {c.description}
              </p>
              {!!c.impactAmount && (
                <p className="text-label-sm uppercase tracking-wider text-accent-success mt-3">
                  Save {formatCurrency(c.impactAmount, { compact: true })}/mo
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SubscriptionsWidget({ count, dues }: { count: number; dues: number }) {
  return (
    <Card variant="default">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-headline-md text-on-surface">Subscriptions</h3>
        <Link
          href="/subscriptions"
          className="text-label-md text-accent-primary inline-flex items-center gap-1"
        >
          Manage <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-display-lg text-on-surface tabular-nums">{count}</p>
          <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">Active</p>
        </div>
        <div>
          <p className="text-display-lg text-on-surface tabular-nums">
            {formatCurrency(dues, { compact: true })}
          </p>
          <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">Upcoming</p>
        </div>
      </div>
    </Card>
  );
}

function ForecastWidget({ days, balance }: { days: number; balance: number }) {
  return (
    <Card variant="hero" className="bg-gradient-to-br from-accent-primary/30 to-accent-primary/10">
      <div className="relative">
        <div className="flex items-center gap-2 text-on-surface">
          <Sparkles size={16} className="text-accent-ai" />
          <h3 className="text-headline-sm">Cash flow forecast</h3>
        </div>
        <p className="text-body-sm text-on-surface-variant mt-3">
          At current pace, your balance lasts
        </p>
        <p className="text-display-xl text-on-surface tabular-nums my-1">
          {days} <span className="text-headline-md text-on-surface-variant">days</span>
        </p>
        <p className="text-body-sm text-on-surface-variant">
          End-of-month projected: {formatCurrency(balance)}
        </p>
      </div>
    </Card>
  );
}

// =============================================================
// Loading skeleton
// =============================================================
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton h={180} rounded="lg" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} h={200} rounded="lg" />
        ))}
      </div>
    </div>
  );
}
