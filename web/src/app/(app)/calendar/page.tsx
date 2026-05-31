'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { CalendarRange, AlertTriangle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { glyphColor } from '@/lib/categories';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { SubscriptionFrequency } from '@/types';

interface RenewalRow {
  id: string;
  name: string;
  amount: number;
  frequency: SubscriptionFrequency;
  nextBillingDate: string;
  daysUntil: number;
  category: string;
  color: string;
  priceIncreased: boolean;
  isLowUsage: boolean;
}

interface Bucket {
  /** Week-start (Monday) date — used as the visual anchor and key. */
  weekStart: Date;
  weekEnd: Date;
  label: string;
  /** "this week" / "next week" / "in two weeks" classification. */
  relativity: 'this' | 'next' | 'later';
  rows: RenewalRow[];
  total: number;
}

/**
 * Subscription renewal calendar. Groups upcoming charges by ISO week
 * starting on Monday. We deliberately don't render a 7×N grid — the
 * UX research from Phase 7 showed users care about *when am I being
 * charged next* far more than the day-of-week shape, and a list per
 * week is much faster to scan on mobile and tablet sizes.
 */
export default function CalendarPage() {
  const subsQuery = useSubscriptions();

  const rows: RenewalRow[] = useMemo(() => {
    const list = (subsQuery.data ?? []) as unknown as Array<Record<string, unknown>>;
    const now = Date.now();
    return list
      .filter((s) => (s.status ?? 'ACTIVE') === 'ACTIVE')
      .map((s) => {
        const name = String(s.name ?? 'Subscription');
        const next = s.nextBillingDate ? new Date(String(s.nextBillingDate)) : null;
        const days = next
          ? Math.ceil((next.getTime() - now) / (24 * 3600 * 1000))
          : null;
        return {
          id: String(s.id),
          name,
          amount: Number(s.amount ?? 0),
          frequency: (s.frequency ?? 'MONTHLY') as SubscriptionFrequency,
          nextBillingDate: next ? next.toISOString() : '',
          daysUntil: days ?? 9999,
          category:
            ((s.category as { name?: string } | null)?.name as string) ??
            String(s.categoryId ?? 'Other'),
          color: String(s.color ?? glyphColor(name)),
          priceIncreased: !!s.priceIncreased,
          isLowUsage: !!s.isLowUsage,
        };
      })
      // Drop entries without a renewal date; they can't go on a calendar.
      .filter((r) => !!r.nextBillingDate)
      // Show the next 90 days only — beyond that the data is stale and
      // the noise distracts from the near-term renewals users actually
      // act on.
      .filter((r) => r.daysUntil <= 90 && r.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [subsQuery.data]);

  const buckets = useMemo(() => groupByWeek(rows), [rows]);

  const totals = useMemo(() => {
    const next7 = rows.filter((r) => r.daysUntil <= 7).reduce((s, r) => s + r.amount, 0);
    const next30 = rows.filter((r) => r.daysUntil <= 30).reduce((s, r) => s + r.amount, 0);
    return { next7, next30, count: rows.length };
  }, [rows]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg text-on-surface">Renewal calendar</h1>
        <p className="text-body-sm text-on-surface-variant mt-1">
          Upcoming subscription charges grouped by week.
        </p>
      </div>

      {/* Summary hero */}
      <Card variant="hero" padding="lg">
        <div className="flex items-stretch gap-4">
          <SummaryCol label="Due in 7 days" value={formatCurrency(totals.next7, { compact: true })} />
          <Divider />
          <SummaryCol label="Due in 30 days" value={formatCurrency(totals.next30, { compact: true })} />
          <Divider />
          <SummaryCol label="Subscriptions" value={String(totals.count)} />
        </div>
      </Card>

      {subsQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} h={140} rounded="lg" />
          ))}
        </div>
      ) : buckets.length === 0 ? (
        <EmptyState
          icon={<CalendarRange size={48} strokeWidth={1.5} />}
          title="No upcoming renewals"
          description="Active subscriptions with a next-billing date will show up here."
          action={
            <Link href="/subscriptions">
              <Button variant="secondary" trailingIcon={<ArrowRight size={14} strokeWidth={2} />}>
                Review subscriptions
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {buckets.map((b) => (
            <WeekBlock key={b.weekStart.toISOString()} bucket={b} />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================
// Pieces
// =============================================================
function WeekBlock({ bucket }: { bucket: Bucket }) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-2 px-1">
        <div>
          <h2
            className={cn(
              'text-headline-sm',
              bucket.relativity === 'this' ? 'text-accent-primary' : 'text-on-surface',
            )}
          >
            {bucket.label}
          </h2>
          <p className="text-body-sm text-on-surface-variant">
            {formatDate(bucket.weekStart, { day: 'numeric', month: 'short' })} –{' '}
            {formatDate(bucket.weekEnd, { day: 'numeric', month: 'short' })}
          </p>
        </div>
        <p className="text-body-md font-bold tabular-nums text-on-surface">
          {formatCurrency(bucket.total, { compact: true })}
        </p>
      </header>
      <Card padding="none" className="overflow-hidden">
        <ul className="divide-y divide-[var(--border-default)]">
          {bucket.rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/subscriptions`}
                className="flex items-center gap-3 px-4 py-3 transition-colors duration-snappy hover:bg-surface-container-high"
              >
                <div
                  aria-hidden
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-md border text-body-md font-bold tabular-nums"
                  style={{
                    backgroundColor: r.color + '22',
                    borderColor: r.color + '44',
                    color: r.color,
                  }}
                >
                  {(r.name?.[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-body-md font-semibold text-on-surface">
                      {r.name}
                    </p>
                    {r.priceIncreased && (
                      <Badge variant="error" size="sm">
                        Price up
                      </Badge>
                    )}
                    {r.isLowUsage && (
                      <Badge variant="warning" size="sm">
                        Low usage
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-body-sm text-on-surface-variant">
                    {r.category} • {humanRelative(r.daysUntil)}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-body-md font-bold tabular-nums text-on-surface">
                    {formatCurrency(r.amount)}
                  </p>
                  <p className="text-label-sm uppercase tracking-wider text-on-surface-variant tabular-nums">
                    {formatDate(r.nextBillingDate, { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      {bucket.rows.some((r) => r.daysUntil <= 3) && bucket.relativity === 'this' && (
        <div className="flex items-center gap-2 rounded-md border border-accent-warning/30 bg-accent-warning/10 px-3 py-2">
          <AlertTriangle size={14} strokeWidth={2} className="text-accent-warning" />
          <p className="text-body-sm text-accent-warning">
            One or more renewals are within 3 days — top up if needed.
          </p>
        </div>
      )}
    </section>
  );
}

function SummaryCol({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
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

// =============================================================
// Helpers
// =============================================================
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  // Monday-anchored ISO week.
  const dow = d.getDay(); // 0..6 with 0=Sunday
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function groupByWeek(rows: RenewalRow[]): Bucket[] {
  if (rows.length === 0) return [];

  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const nextWeekStart = new Date(thisWeekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  const map = new Map<string, RenewalRow[]>();
  for (const row of rows) {
    const ws = startOfWeek(new Date(row.nextBillingDate));
    const key = ws.toISOString();
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .map(([key, items]) => {
      const weekStart = new Date(key);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      let relativity: Bucket['relativity'] = 'later';
      if (weekStart.getTime() === thisWeekStart.getTime()) relativity = 'this';
      else if (weekStart.getTime() === nextWeekStart.getTime()) relativity = 'next';

      const label =
        relativity === 'this'
          ? 'This week'
          : relativity === 'next'
            ? 'Next week'
            : `Week of ${formatDate(weekStart, { day: 'numeric', month: 'short' })}`;

      return {
        weekStart,
        weekEnd,
        label,
        relativity,
        rows: items.sort((a, b) => a.daysUntil - b.daysUntil),
        total: items.reduce((s, r) => s + r.amount, 0),
      };
    })
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
}

function humanRelative(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;
  if (days < 14) return 'next week';
  if (days < 30) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} month${days >= 60 ? 's' : ''}`;
}
