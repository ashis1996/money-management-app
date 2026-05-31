'use client';

import { useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Repeat,
  CreditCard,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFraudAlerts } from '@/hooks/useDashboard';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { FraudAlert } from '@/lib/api';

/**
 * Fraud / suspicious-activity surface. Mirrors the shape of /money-leaks
 * but the detection logic is intentionally distinct (LeakDetector vs
 * FraudDetector — see ai-service for the rule set).
 *
 * Why a separate page from /money-leaks?
 *   The two detect different categories of harm. Leaks = the user
 *   wasting their own money; Fraud = someone else (or a merchant bug)
 *   doing it. The recommendations differ and the urgency differs;
 *   conflating them in one page made the leak page feel alarmist for
 *   the common no-fraud case.
 */
export default function FraudAlertsPage() {
  const fraudQuery = useFraudAlerts(90);

  const alerts: FraudAlert[] = useMemo(
    () => fraudQuery.data?.alerts ?? [],
    [fraudQuery.data],
  );

  const summary = fraudQuery.data?.summary ?? {};

  const totalRecovery = useMemo(
    () => alerts.reduce((s, a) => s + (a.potential_recovery ?? 0), 0),
    [alerts],
  );

  const grouped = useMemo(() => {
    const buckets: Record<FraudAlert['severity'], FraudAlert[]> = {
      URGENT: [],
      HIGH: [],
      MEDIUM: [],
      LOW: [],
    };
    alerts.forEach((a) => buckets[a.severity]?.push(a));
    return buckets;
  }, [alerts]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg text-on-surface">Fraud alerts</h1>
        <p className="text-body-sm text-on-surface-variant mt-1">
          Suspicious activity in the last {fraudQuery.data?.history_days ?? 90} days.
        </p>
      </div>

      {/* Hero summary */}
      <Card variant="hero" padding="lg">
        <div className="flex items-center gap-4">
          {alerts.length === 0 ? (
            <>
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md border border-accent-success/30 bg-accent-success/10">
                <ShieldCheck size={20} strokeWidth={1.75} className="text-accent-success" />
              </div>
              <div>
                <p className="text-headline-md text-on-surface">All clear</p>
                <p className="text-body-sm text-on-surface-variant">
                  No suspicious activity detected.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md border border-accent-error/30 bg-accent-error/10">
                <ShieldAlert size={20} strokeWidth={1.75} className="text-accent-error" />
              </div>
              <div className="flex-1">
                <p className="text-headline-md text-on-surface">
                  {alerts.length} alert{alerts.length === 1 ? '' : 's'}
                </p>
                <p className="text-body-sm text-on-surface-variant">
                  Up to{' '}
                  <span className="text-accent-success font-semibold tabular-nums">
                    {formatCurrency(totalRecovery, { compact: true })}
                  </span>{' '}
                  may be recoverable.
                </p>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Summary by type */}
      {Object.keys(summary).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(summary).map(([type, info]) => (
            <Card key={type} padding="md" className="flex flex-col gap-1.5">
              <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                {humanType(type)}
              </p>
              <p className="text-headline-sm tabular-nums text-on-surface">
                {info.count}
              </p>
              <p className="text-body-sm text-accent-success tabular-nums">
                {formatCurrency(info.potential_recovery, { compact: true })} recoverable
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Alerts */}
      {fraudQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} h={140} rounded="lg" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={48} strokeWidth={1.5} />}
          title="No suspicious activity"
          description="We didn't spot any duplicate charges, card-testing patterns, or unusual first-time charges in your recent history."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {(Object.keys(grouped) as FraudAlert['severity'][])
            .filter((sev) => grouped[sev].length > 0)
            .map((sev) => (
              <section key={sev} className="flex flex-col gap-2">
                <header className="flex items-center justify-between px-1">
                  <h2 className="text-headline-sm text-on-surface">
                    {humanSeverity(sev)}
                  </h2>
                  <Badge variant={severityToBadge(sev)} size="sm">
                    {grouped[sev].length}
                  </Badge>
                </header>
                <div className="flex flex-col gap-2">
                  {grouped[sev].map((alert, i) => (
                    <AlertCard key={`${alert.type}-${i}`} alert={alert} />
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
function AlertCard({ alert }: { alert: FraudAlert }) {
  const Icon = iconFor(alert.type);
  const tone = severityTone(alert.severity);

  return (
    <Card padding="lg" className={cn('flex flex-col gap-3 border-l-2', tone.border)}>
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className={cn(
            'flex h-10 w-10 flex-none items-center justify-center rounded-md border',
            tone.iconBg,
          )}
        >
          <Icon size={18} strokeWidth={1.75} className={tone.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-body-md font-bold text-on-surface">
              {alert.title}
            </h3>
            <Badge variant={severityToBadge(alert.severity)} size="sm">
              {alert.severity}
            </Badge>
          </div>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {alert.description}
          </p>
        </div>
        {alert.potential_recovery > 0 && (
          <p className="shrink-0 text-headline-sm font-bold tabular-nums text-accent-success">
            {formatCurrency(alert.potential_recovery)}
          </p>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-md border border-accent-ai/20 bg-accent-ai/5 px-3 py-2">
        <Sparkles
          size={14}
          strokeWidth={1.75}
          className="mt-0.5 flex-none text-accent-ai"
        />
        <p className="text-body-sm text-on-surface">
          {alert.recommendation}
        </p>
      </div>

      {alert.transactions.length > 0 && (
        <div>
          <p className="mb-1.5 text-label-sm uppercase tracking-wider text-on-surface-variant">
            {alert.transactions.length} transaction
            {alert.transactions.length === 1 ? '' : 's'}
          </p>
          <ul className="flex flex-col gap-1">
            {alert.transactions.slice(0, 3).map((row, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-md bg-surface-container-low px-3 py-2"
              >
                <span className="truncate text-body-sm text-on-surface">
                  {String(row.merchantName ?? row.merchant ?? 'Unknown merchant')}
                </span>
                <span className="ml-2 shrink-0 tabular-nums text-body-sm text-on-surface-variant">
                  {formatCurrency(Number(row.amount ?? 0))}
                </span>
              </li>
            ))}
            {alert.transactions.length > 3 && (
              <li className="px-3 text-body-sm text-on-surface-variant">
                + {alert.transactions.length - 3} more
              </li>
            )}
          </ul>
        </div>
      )}
    </Card>
  );
}

// =============================================================
// Look-up tables
// =============================================================
function iconFor(type: string): LucideIcon {
  if (type === 'DUPLICATE_CHARGE') return Repeat;
  if (type === 'CARD_TESTING') return CreditCard;
  if (type === 'FIRST_LARGE_CHARGE') return AlertTriangle;
  if (type === 'REPEATED_FAILURES') return AlertTriangle;
  return ShieldAlert;
}

function humanType(type: string): string {
  switch (type) {
    case 'DUPLICATE_CHARGE':
      return 'Duplicate charges';
    case 'CARD_TESTING':
      return 'Card testing';
    case 'FIRST_LARGE_CHARGE':
      return 'Large first charges';
    case 'REPEATED_FAILURES':
      return 'Repeated failures';
    default:
      return type;
  }
}

function humanSeverity(s: FraudAlert['severity']): string {
  if (s === 'URGENT') return 'Urgent — review now';
  if (s === 'HIGH') return 'High priority';
  if (s === 'MEDIUM') return 'Worth a second look';
  return 'Informational';
}

function severityToBadge(s: FraudAlert['severity']) {
  if (s === 'URGENT') return 'urgent' as const;
  if (s === 'HIGH') return 'error' as const;
  if (s === 'MEDIUM') return 'warning' as const;
  return 'neutral' as const;
}

function severityTone(s: FraudAlert['severity']) {
  if (s === 'URGENT') {
    return {
      border: 'border-l-accent-error',
      iconBg: 'border-accent-error/30 bg-accent-error/10',
      iconColor: 'text-accent-error',
    };
  }
  if (s === 'HIGH') {
    return {
      border: 'border-l-accent-error',
      iconBg: 'border-accent-error/30 bg-accent-error/10',
      iconColor: 'text-accent-error',
    };
  }
  if (s === 'MEDIUM') {
    return {
      border: 'border-l-accent-warning',
      iconBg: 'border-accent-warning/30 bg-accent-warning/10',
      iconColor: 'text-accent-warning',
    };
  }
  return {
    border: 'border-l-[var(--border-default)]',
    iconBg: 'border-[var(--border-default)] bg-surface-container-high',
    iconColor: 'text-on-surface-variant',
  };
}
