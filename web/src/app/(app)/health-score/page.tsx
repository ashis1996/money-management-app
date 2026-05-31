'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  PiggyBank,
  PieChart,
  Repeat,
  TrendingUp,
  Target as TargetIcon,
  CreditCard,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { useHealthScore } from '@/hooks/useDashboard';
import { getHealthRating } from '@/lib/archetype';
import { cn } from '@/lib/cn';

interface HealthComponent {
  key: string;
  name: string;
  weight: number;
  score: number;
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_WORK' | 'CRITICAL';
  description: string;
  improvementTips: string[];
  icon: LucideIcon;
}

const COMPONENT_DEFS: Record<string, Pick<HealthComponent, 'key' | 'name' | 'weight' | 'icon'>> = {
  savings_rate: {
    key: 'savings_rate',
    name: 'Savings Rate',
    weight: 25,
    icon: PiggyBank,
  },
  budget_adherence: {
    key: 'budget_adherence',
    name: 'Budget Adherence',
    weight: 20,
    icon: PieChart,
  },
  subscription_health: {
    key: 'subscription_health',
    name: 'Subscription Health',
    weight: 15,
    icon: Repeat,
  },
  spending_consistency: {
    key: 'spending_consistency',
    name: 'Spending Consistency',
    weight: 15,
    icon: TrendingUp,
  },
  impulse_control: {
    key: 'impulse_control',
    name: 'Impulse Control',
    weight: 10,
    icon: TargetIcon,
  },
  goal_progress: {
    key: 'goal_progress',
    name: 'Goal Progress',
    weight: 10,
    icon: TargetIcon,
  },
  credit_utilization: {
    key: 'credit_utilization',
    name: 'Credit Utilisation',
    weight: 5,
    icon: CreditCard,
  },
};

function statusFromScore(score: number): HealthComponent['status'] {
  if (score >= 85) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 55) return 'FAIR';
  if (score >= 40) return 'NEEDS_WORK';
  return 'CRITICAL';
}

function colorForStatus(status: HealthComponent['status']): string {
  switch (status) {
    case 'EXCELLENT':
      return 'var(--accent-success)';
    case 'GOOD':
      return '#34D399';
    case 'FAIR':
      return 'var(--accent-warning)';
    case 'NEEDS_WORK':
      return '#F87171';
    case 'CRITICAL':
      return 'var(--accent-error)';
  }
}

function statusLabel(status: HealthComponent['status']): string {
  switch (status) {
    case 'EXCELLENT':
      return 'Excellent';
    case 'GOOD':
      return 'Good';
    case 'FAIR':
      return 'Fair';
    case 'NEEDS_WORK':
      return 'Needs work';
    case 'CRITICAL':
      return 'Critical';
  }
}

function statusVariant(status: HealthComponent['status']): 'success' | 'warning' | 'error' {
  if (status === 'EXCELLENT' || status === 'GOOD') return 'success';
  if (status === 'FAIR') return 'warning';
  return 'error';
}

export default function HealthScorePage() {
  const healthQuery = useHealthScore();

  const data = useMemo(() => {
    const raw = healthQuery.data as Record<string, unknown> | undefined;
    if (!raw) return null;

    const score = Number(raw.score ?? raw.healthScore ?? 0);
    const componentsRaw = (raw.components ?? raw.componentScores ?? {}) as Record<string, unknown>;

    const components: HealthComponent[] = Object.entries(COMPONENT_DEFS).map(([key, def]) => {
      const cd = componentsRaw[key] as number | (Record<string, unknown> | undefined);
      const compScore = Number(typeof cd === 'number' ? cd : (cd?.score ?? 0));
      const obj = (typeof cd === 'object' && cd) || {};
      return {
        ...def,
        score: compScore,
        status: statusFromScore(compScore),
        description: String(obj.description ?? ''),
        improvementTips: (obj.tips ?? obj.improvementTips ?? []) as string[],
      };
    });

    const recommendations = Array.isArray(raw.recommendations)
      ? (raw.recommendations as string[])
      : [];

    const history = Array.isArray(raw.history ?? raw.scoreHistory)
      ? ((raw.history ?? raw.scoreHistory) as number[])
      : [score];

    return { score, components, recommendations, history };
  }, [healthQuery.data]);

  if (healthQuery.isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton h={48} rounded="md" />
        <Skeleton h={300} rounded="lg" />
        <Skeleton h={200} rounded="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/insights"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-default)] bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Back to insights"
        >
          <ArrowLeft size={18} strokeWidth={1.75} />
        </Link>
        <div>
          <h1 className="text-headline-lg text-on-surface">Health Score</h1>
          <p className="text-body-sm text-on-surface-variant">
            How you&apos;re doing across the seven factors
          </p>
        </div>
      </div>

      {/* Hero score */}
      <Card variant="ai" padding="xl" className="flex flex-col items-center">
        <ProgressRing
          value={data.score}
          size={200}
          strokeWidth={14}
          color="url(#ringGrad)"
          centerLabel={
            <div className="text-center">
              <div className="text-display-xl tabular-nums text-on-surface">
                {Math.round(data.score)}
              </div>
              <div className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                / 100
              </div>
            </div>
          }
        />
        <svg width={0} height={0} className="absolute" aria-hidden>
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="mt-5 flex items-center gap-2">
          <Sparkles size={14} className="text-accent-ai" strokeWidth={2} />
          <p className="text-headline-sm text-accent-ai">{getHealthRating(data.score)}</p>
        </div>
        {data.history.length > 1 && (
          <div className="mt-6 w-full">
            <p className="mb-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
              30-day history
            </p>
            <SparkBar values={data.history.slice(-12)} />
          </div>
        )}
      </Card>

      {/* Components */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-headline-md text-on-surface">What drives your score</h2>
          <p className="text-body-sm text-on-surface-variant">
            Each factor is weighted by how strongly it influences your overall score
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {data.components.map((c) => (
            <ComponentCard key={c.key} component={c} />
          ))}
        </div>
      </section>

      {/* AI recommendations */}
      {data.recommendations.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-headline-md text-ai-gradient">AI recommendations</h2>
            <p className="text-body-sm text-on-surface-variant">
              Top actions to improve your score this month
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {data.recommendations.slice(0, 5).map((rec, i) => (
              <Card key={i} variant="ai" padding="md" className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-accent-ai/30 bg-accent-ai/10">
                  <Lightbulb size={16} strokeWidth={1.75} className="text-accent-ai" />
                </div>
                <p className="flex-1 text-body-sm text-on-surface">{rec}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Score guide */}
      <Card padding="md" className="flex flex-col">
        <p className="mb-2 text-label-sm uppercase tracking-wider text-on-surface-variant">
          Score guide
        </p>
        <ScoreRange label="Excellent" range="85–100" color="var(--accent-success)" />
        <ScoreRange label="Good" range="70–84" color="#34D399" />
        <ScoreRange label="Fair" range="55–69" color="var(--accent-warning)" />
        <ScoreRange label="Needs work" range="40–54" color="#F87171" />
        <ScoreRange label="Critical" range="0–39" color="var(--accent-error)" isLast />
      </Card>
    </div>
  );
}

function ComponentCard({ component }: { component: HealthComponent }) {
  const Icon = component.icon;
  const color = colorForStatus(component.status);
  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 flex-none items-center justify-center rounded-md border"
          style={{ backgroundColor: color + '22', borderColor: color + '44', color }}
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-body-md font-semibold text-on-surface">{component.name}</p>
            <span className="tabular-nums text-headline-sm" style={{ color }}>
              {Math.round(component.score)}
            </span>
          </div>
          <div className="mt-1.5">
            <ProgressBar value={component.score} color={color} />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-label-sm tracking-wider text-outline">
              Weight {component.weight}%
            </span>
            <Badge variant={statusVariant(component.status)} size="sm">
              {statusLabel(component.status)}
            </Badge>
          </div>
          {component.description && (
            <p className="mt-2 text-body-sm text-on-surface-variant">{component.description}</p>
          )}
          {component.improvementTips.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5 border-t border-[var(--border-default)] pt-2">
              {component.improvementTips.slice(0, 2).map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2
                    size={12}
                    strokeWidth={2}
                    className="mt-0.5 flex-none text-accent-ai"
                  />
                  <span className="text-body-sm text-on-surface-variant">{tip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function ScoreRange({
  label,
  range,
  color,
  isLast,
}: {
  label: string;
  range: string;
  color: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2',
        !isLast && 'border-b border-[var(--border-default)]',
      )}
    >
      <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: color }} />
      <span className="flex-1 text-body-sm font-medium text-on-surface">{label}</span>
      <span className="tabular-nums text-body-sm text-on-surface-variant">{range}</span>
    </div>
  );
}

function SparkBar({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1.5 h-9">
      {values.map((v, i) => {
        const h = Math.max(4, (v / max) * 32);
        const tone =
          v >= 70
            ? 'var(--accent-success)'
            : v >= 55
              ? 'var(--accent-warning)'
              : 'var(--accent-error)';
        return (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: `${h}px`,
              background: tone,
              opacity: 0.4 + (i / values.length) * 0.6,
            }}
          />
        );
      })}
    </div>
  );
}
