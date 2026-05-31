'use client';

import { useMemo, useState } from 'react';
import {
  Repeat,
  Droplet,
  Calendar,
  TrendingUp,
  Sparkles,
  Pause,
  Play,
  X,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useCancelSubscription,
  usePauseSubscription,
  useResumeSubscription,
  useSubscriptions,
} from '@/hooks/useSubscriptions';
import { glyphColor } from '@/lib/categories';
import { formatCurrency, formatRelativeDays } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { SubscriptionFrequency, SubscriptionStatus } from '@/types';

interface SubVm {
  id: string;
  name: string;
  amount: number;
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  category: string;
  color: string;
  nextBillingDate: string;
  totalPaid: number;
  paymentCount: number;
  originalAmount?: number;
  priceIncreasePercent?: number;
  usageScore: number;
  isLowUsage: boolean;
  isDuplicate: boolean;
}

function monthlyEquivalent(s: SubVm): number {
  if (s.frequency === 'MONTHLY') return s.amount;
  if (s.frequency === 'YEARLY') return s.amount / 12;
  if (s.frequency === 'WEEKLY') return s.amount * 4;
  if (s.frequency === 'QUARTERLY') return s.amount / 3;
  return s.amount;
}

function frequencySuffix(f: SubscriptionFrequency): string {
  if (f === 'MONTHLY') return 'mo';
  if (f === 'YEARLY') return 'yr';
  if (f === 'WEEKLY') return 'wk';
  if (f === 'QUARTERLY') return 'qtr';
  return 'day';
}

type FilterType = 'all' | 'leaks' | 'upcoming';

export default function SubscriptionsPage() {
  const subsQuery = useSubscriptions();
  const cancelSub = useCancelSubscription();
  const pauseSub = usePauseSubscription();
  const resumeSub = useResumeSubscription();

  const subs: SubVm[] = useMemo(() => {
    const list = (subsQuery.data ?? []) as unknown as Array<Record<string, unknown>>;
    return list.map((s) => {
      const name = String(s.name ?? 'Subscription');
      return {
        id: String(s.id),
        name,
        amount: Number(s.amount ?? 0),
        frequency: (s.frequency ?? 'MONTHLY') as SubscriptionFrequency,
        status: (s.status ?? 'ACTIVE') as SubscriptionStatus,
        category:
          ((s.category as { name?: string } | null)?.name as string) ??
          String(s.categoryId ?? 'Other'),
        color: String(s.color ?? glyphColor(name)),
        nextBillingDate: String(s.nextBillingDate ?? new Date().toISOString()),
        totalPaid: Number(s.totalAmountPaid ?? 0),
        paymentCount: Number(s.totalPaymentsCount ?? 0),
        originalAmount: s.originalAmount ? Number(s.originalAmount) : undefined,
        priceIncreasePercent: s.priceIncreasePercent ? Number(s.priceIncreasePercent) : undefined,
        usageScore: s.usageScore ? Number(s.usageScore) : 0.5,
        isLowUsage: !!s.isLowUsage,
        isDuplicate: !!s.isDuplicate,
      };
    });
  }, [subsQuery.data]);

  const [filter, setFilter] = useState<FilterType>('all');
  const [cancelTarget, setCancelTarget] = useState<SubVm | null>(null);

  const stats = useMemo(() => {
    const active = subs.filter((s) => s.status === 'ACTIVE');
    const monthlyTotal = active.reduce((sum, s) => sum + monthlyEquivalent(s), 0);
    const leakSavings = active
      .filter((s) => s.isLowUsage || s.isDuplicate)
      .reduce((sum, s) => sum + monthlyEquivalent(s), 0);
    return {
      activeCount: active.length,
      monthlyTotal: Math.round(monthlyTotal),
      yearlyTotal: Math.round(monthlyTotal * 12),
      leakSavings: Math.round(leakSavings),
    };
  }, [subs]);

  const filtered = useMemo(() => {
    let list = subs.filter((s) => s.status === 'ACTIVE');
    if (filter === 'leaks') {
      list = list.filter((s) => s.isLowUsage || s.priceIncreasePercent || s.isDuplicate);
    } else if (filter === 'upcoming') {
      list = list.filter((s) => {
        const days = Math.ceil(
          (new Date(s.nextBillingDate).getTime() - Date.now()) / (24 * 3600 * 1000),
        );
        return days <= 7;
      });
      list.sort(
        (a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime(),
      );
    } else {
      list.sort((a, b) => b.amount - a.amount);
    }
    return list;
  }, [subs, filter]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg text-on-surface">Subscriptions</h1>
        <p className="text-body-sm text-on-surface-variant mt-1">
          Track and optimise your recurring spend
        </p>
      </div>

      {/* Hero stats */}
      <Card variant="hero" padding="lg">
        <div className="flex items-stretch gap-4">
          <StatCol label="Active" value={String(stats.activeCount)} />
          <Divider />
          <StatCol label="Monthly" value={formatCurrency(stats.monthlyTotal, { compact: true })} />
          <Divider />
          <StatCol label="Yearly" value={formatCurrency(stats.yearlyTotal, { compact: true })} />
        </div>
      </Card>

      {/* AI savings */}
      {stats.leakSavings > 0 && (
        <Card variant="ai" padding="md" className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-accent-ai/30 bg-accent-ai/10">
            <Sparkles size={16} strokeWidth={1.75} className="text-accent-ai" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-md font-bold text-on-surface tabular-nums">
              Save up to {formatCurrency(stats.leakSavings, { compact: true })}/mo
            </p>
            <p className="text-body-sm text-on-surface-variant">
              Cancel low-usage and duplicate subscriptions
            </p>
          </div>
          <Button variant="ai" size="sm" onClick={() => setFilter('leaks')}>
            Review
          </Button>
        </Card>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            { key: 'all', label: 'All', icon: Repeat },
            { key: 'leaks', label: 'Leaks', icon: Droplet },
            { key: 'upcoming', label: 'Upcoming', icon: Calendar },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              aria-pressed={active}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-label-md transition-colors duration-snappy',
                active
                  ? 'border-accent-primary bg-accent-primary text-white'
                  : 'border-[var(--border-default)] bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
              )}
            >
              <Icon size={14} strokeWidth={1.75} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {subsQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} h={180} rounded="lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Repeat size={48} strokeWidth={1.5} />}
          title={
            filter === 'leaks'
              ? 'No leaks to review'
              : filter === 'upcoming'
                ? 'Nothing due in the next 7 days'
                : 'No active subscriptions'
          }
          description="Subscriptions are detected automatically from your transactions. Refresh once you have a few weeks of data."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((s) => (
            <SubscriptionCard
              key={s.id}
              sub={s}
              onCancel={() => setCancelTarget(s)}
              onPause={() => pauseSub.mutate(s.id)}
              onResume={() => resumeSub.mutate(s.id)}
            />
          ))}
        </div>
      )}

      {cancelTarget && (
        <CancelGuideModal
          sub={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => {
            cancelSub.mutate(cancelTarget.id);
            setCancelTarget(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================
// Subscription card
// =============================================================
function SubscriptionCard({
  sub,
  onCancel,
  onPause,
  onResume,
}: {
  sub: SubVm;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const initial = (sub.name?.[0] || '?').toUpperCase();
  const usageColor =
    sub.usageScore < 0.3
      ? 'var(--accent-error)'
      : sub.usageScore < 0.6
        ? 'var(--accent-warning)'
        : 'var(--accent-success)';
  const daysUntilBilling = Math.ceil(
    (new Date(sub.nextBillingDate).getTime() - Date.now()) / (24 * 3600 * 1000),
  );

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-12 w-12 flex-none items-center justify-center rounded-md border text-headline-sm font-bold tabular-nums"
          style={{
            backgroundColor: sub.color + '22',
            borderColor: sub.color + '44',
            color: sub.color,
          }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-body-lg font-bold text-on-surface">{sub.name}</h3>
            <p className="shrink-0 text-headline-sm font-bold tabular-nums text-on-surface">
              {formatCurrency(sub.amount)}
              <span className="ml-1 text-body-sm font-normal text-on-surface-variant">
                /{frequencySuffix(sub.frequency)}
              </span>
            </p>
          </div>
          <p className="text-body-sm text-on-surface-variant truncate">{sub.category}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sub.isLowUsage && (
              <Badge variant="warning" size="sm">
                Low usage
              </Badge>
            )}
            {sub.priceIncreasePercent && sub.priceIncreasePercent > 10 && (
              <Badge variant="error" size="sm">
                +{sub.priceIncreasePercent.toFixed(0)}% price
              </Badge>
            )}
            {sub.isDuplicate && (
              <Badge variant="ai" size="sm">
                Duplicate
              </Badge>
            )}
            {daysUntilBilling >= 0 && daysUntilBilling <= 3 && (
              <Badge variant="warning" size="sm">
                Due {formatRelativeDays(sub.nextBillingDate)}
              </Badge>
            )}
            {sub.status === 'PAUSED' && (
              <Badge variant="neutral" size="sm">
                Paused
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Usage */}
      <div className="border-t border-[var(--border-default)] pt-3">
        <div className="mb-2 flex justify-between text-label-sm uppercase tracking-wider">
          <span className="text-on-surface-variant">Usage score</span>
          <span className="tabular-nums" style={{ color: usageColor }}>
            {Math.round(sub.usageScore * 100)}%
          </span>
        </div>
        <ProgressBar value={sub.usageScore * 100} color={usageColor} />
      </div>

      {/* Footer stats */}
      <div className="grid grid-cols-3 gap-2 border-t border-[var(--border-default)] pt-3">
        <FooterStat
          label="Next bill"
          value={new Date(sub.nextBillingDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          })}
        />
        <FooterStat label="Total paid" value={formatCurrency(sub.totalPaid, { compact: true })} />
        <FooterStat label="Cycles" value={String(sub.paymentCount)} />
      </div>

      {/* Price hike alert */}
      {sub.priceIncreasePercent && sub.priceIncreasePercent > 10 && (
        <div className="flex items-start gap-2 rounded-md border border-accent-error/30 bg-accent-error/10 px-3 py-2">
          <TrendingUp size={14} strokeWidth={2} className="mt-0.5 text-accent-error" />
          <p className="text-body-sm text-accent-error">
            Price rose from {formatCurrency(sub.originalAmount ?? 0)} to{' '}
            {formatCurrency(sub.amount)}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {sub.status === 'PAUSED' ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onResume}
            leadingIcon={<Play size={14} strokeWidth={2} />}
            className="flex-1"
          >
            Resume
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={onPause}
            leadingIcon={<Pause size={14} strokeWidth={2} />}
            className="flex-1"
          >
            Pause
          </Button>
        )}
        <Button variant="destructive" size="sm" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </Card>
  );
}

// =============================================================
// Cancel guide modal
// =============================================================
function CancelGuideModal({
  sub,
  onClose,
  onConfirm,
}: {
  sub: SubVm;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const yearly = sub.frequency === 'MONTHLY' ? sub.amount * 12 : sub.amount;
  const steps = getCancelSteps(sub.name);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-guide-title"
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/65"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-surface-container-highest p-6 shadow-modal"
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 flex-none items-center justify-center rounded-md font-bold tabular-nums"
            style={{ backgroundColor: sub.color + '22', color: sub.color }}
          >
            {(sub.name?.[0] || '?').toUpperCase()}
          </div>
          <h2 id="cancel-guide-title" className="flex-1 truncate text-headline-md text-on-surface">
            Cancel {sub.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-on-surface-variant hover:text-on-surface"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="mb-5 rounded-lg border border-accent-success/30 bg-accent-success/10 p-4 text-center">
          <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            You&apos;ll save
          </p>
          <p className="my-1 text-display-lg tabular-nums text-accent-success">
            {formatCurrency(yearly)}
          </p>
          <p className="text-body-sm text-on-surface-variant">per year</p>
        </div>

        <p className="mb-3 text-label-sm uppercase tracking-wider text-on-surface-variant">
          Steps to cancel
        </p>
        <ol className="flex flex-col gap-3">
          {steps.map((step, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-accent-primary/40 bg-accent-primary/20 text-label-sm font-bold tabular-nums text-accent-primary">
                {idx + 1}
              </span>
              <p className="flex-1 text-body-sm leading-snug text-on-surface">{step}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6">
          <Button
            onClick={onConfirm}
            fullWidth
            size="lg"
            trailingIcon={<ArrowRight size={16} strokeWidth={2} />}
          >
            Mark as cancelled
          </Button>
        </div>
      </div>
    </div>
  );
}

function getCancelSteps(name: string): string[] {
  const lower = name.toLowerCase();
  if (lower.includes('netflix'))
    return [
      'Open Netflix.com or the app',
      "Go to Account → 'Cancel Membership'",
      'Confirm cancellation',
      'Service continues until end of billing period',
    ];
  if (lower.includes('spotify'))
    return [
      'Visit spotify.com/account',
      "Click 'Subscription' on the left",
      "Select 'Change or Cancel'",
      "Choose 'Cancel Premium'",
    ];
  return [
    `Open ${name} website or app`,
    'Navigate to Account or Subscription settings',
    "Find 'Cancel subscription'",
    'Confirm cancellation',
  ];
}

// =============================================================
// Tiny presentation helpers (kept inline; only used here)
// =============================================================
function StatCol({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 flex-1 items-center text-center">
      <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className="text-headline-md tabular-nums text-on-surface">{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-px self-stretch bg-[var(--border-default)]" />;
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className="text-body-sm font-semibold tabular-nums text-on-surface">{value}</span>
    </div>
  );
}
