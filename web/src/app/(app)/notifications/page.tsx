'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Sparkles,
  Trophy,
  CheckCheck,
  Bell,
  Repeat,
  TrendingUp,
  ShieldAlert,
  Wallet,
  PiggyBank,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';

type NotifCategory = 'risks' | 'reminders' | 'insights' | 'wins';
type FilterKey = 'all' | 'unread' | NotifCategory;

interface NotifVm {
  id: string;
  type: string;
  category: NotifCategory;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  title: string;
  message: string;
  amount?: number;
  daysUntil?: number;
  actionLabel?: string;
  actionRoute?: string;
  isRead: boolean;
  createdAt: string;
}

const FILTERS: { key: FilterKey; label: string; icon?: LucideIcon }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'risks', label: 'Risks', icon: ShieldAlert },
  { key: 'reminders', label: 'Reminders', icon: CalendarClock },
  { key: 'insights', label: 'Insights', icon: Sparkles },
  { key: 'wins', label: 'Wins', icon: Trophy },
];

// Notification typing is intentionally loose: the backend sometimes ships
// custom event names (`PRICE_INCREASE`, `WEEKLY_SUMMARY`, etc.) that
// aren't in the canonical NotificationType enum. We bucket them into
// human-relevant groups so users can filter without having to learn
// our taxonomy.
function categoryOf(type: string): NotifCategory {
  if (
    type === 'LOW_BALANCE' ||
    type === 'FRAUD_ALERT' ||
    type === 'DUPLICATE_CHARGE' ||
    type === 'BUDGET_EXCEEDED' ||
    type === 'BUDGET_WARNING' ||
    type === 'BUDGET_ALERT' ||
    type === 'SECURITY'
  )
    return 'risks';
  if (
    type === 'BILL_DUE' ||
    type === 'EMI_DUE' ||
    type === 'SUBSCRIPTION_RENEWAL' ||
    type === 'SUBSCRIPTION' ||
    type === 'REMINDER' ||
    type === 'TRANSACTION'
  )
    return 'reminders';
  if (type === 'INSIGHT' || type === 'PRICE_INCREASE' || type === 'WEEKLY_SUMMARY')
    return 'insights';
  if (type === 'ACHIEVEMENT' || type === 'GOAL_PROGRESS') return 'wins';
  return 'reminders';
}

function iconFor(type: string): LucideIcon {
  switch (type) {
    case 'LOW_BALANCE':
    case 'BUDGET_EXCEEDED':
    case 'BUDGET_WARNING':
    case 'BUDGET_ALERT':
      return Wallet;
    case 'FRAUD_ALERT':
    case 'DUPLICATE_CHARGE':
    case 'SECURITY':
      return AlertTriangle;
    case 'BILL_DUE':
    case 'EMI_DUE':
    case 'SUBSCRIPTION_RENEWAL':
    case 'SUBSCRIPTION':
      return Repeat;
    case 'PRICE_INCREASE':
      return TrendingUp;
    case 'INSIGHT':
    case 'WEEKLY_SUMMARY':
      return Sparkles;
    case 'ACHIEVEMENT':
    case 'GOAL_PROGRESS':
      return PiggyBank;
    default:
      return Bell;
  }
}

interface CategoryStyle {
  fg: string;
  bgClass: string;
  borderClass: string;
}
function styleFor(category: NotifCategory): CategoryStyle {
  switch (category) {
    case 'risks':
      return {
        fg: 'text-accent-error',
        bgClass: 'bg-accent-error/10',
        borderClass: 'border-accent-error/30',
      };
    case 'reminders':
      return {
        fg: 'text-accent-warning',
        bgClass: 'bg-accent-warning/10',
        borderClass: 'border-accent-warning/30',
      };
    case 'insights':
      return {
        fg: 'text-accent-ai',
        bgClass: 'bg-accent-ai/10',
        borderClass: 'border-accent-ai/30',
      };
    case 'wins':
      return {
        fg: 'text-accent-success',
        bgClass: 'bg-accent-success/10',
        borderClass: 'border-accent-success/30',
      };
  }
}

function backendToVm(n: Record<string, unknown>): NotifVm {
  const data = (n.data ?? {}) as Record<string, unknown>;
  const rawType = String(data.uiType ?? n.type ?? 'REMINDER');
  return {
    id: String(n.id),
    type: rawType,
    category: categoryOf(rawType),
    priority: (n.priority ?? 'NORMAL') as NotifVm['priority'],
    title: String(n.title ?? 'Notification'),
    message: String(n.message ?? n.body ?? ''),
    amount: typeof data.amount === 'number' ? data.amount : undefined,
    daysUntil: typeof data.daysUntil === 'number' ? data.daysUntil : undefined,
    actionLabel: typeof data.actionLabel === 'string' ? data.actionLabel : undefined,
    actionRoute: typeof data.actionRoute === 'string' ? data.actionRoute : undefined,
    isRead: !!n.isRead,
    createdAt: String(n.createdAt ?? new Date().toISOString()),
  };
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function bucketLabel(iso: string): string {
  const ago = Date.now() - new Date(iso).getTime();
  if (ago < 24 * 3600 * 1000) return 'Today';
  if (ago < 2 * 24 * 3600 * 1000) return 'Yesterday';
  if (ago < 7 * 24 * 3600 * 1000) return 'This week';
  return 'Earlier';
}

export default function NotificationsPage() {
  const notifsQuery = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotif = useDeleteNotification();

  const notifs: NotifVm[] = useMemo(() => {
    const list = (notifsQuery.data ?? []) as unknown as Array<Record<string, unknown>>;
    return list.map(backendToVm);
  }, [notifsQuery.data]);

  const [filter, setFilter] = useState<FilterKey>('all');
  const unreadCount = notifs.filter((n) => !n.isRead).length;

  const filtered = useMemo(() => {
    if (filter === 'all') return notifs;
    if (filter === 'unread') return notifs.filter((n) => !n.isRead);
    return notifs.filter((n) => n.category === filter);
  }, [notifs, filter]);

  const grouped = useMemo(() => {
    const groups: Record<string, NotifVm[]> = {};
    filtered.forEach((n) => {
      const key = bucketLabel(n.createdAt);
      (groups[key] ??= []).push(n);
    });
    // Preserve a deterministic order regardless of arrival order.
    const order = ['Today', 'Yesterday', 'This week', 'Earlier'];
    const sorted: Record<string, NotifVm[]> = {};
    for (const key of order) {
      if (groups[key]) sorted[key] = groups[key];
    }
    return sorted;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-headline-lg text-on-surface">Notifications</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            leadingIcon={<CheckCheck size={16} strokeWidth={1.75} />}
            onClick={() => markAllRead.mutate()}
            loading={markAllRead.isPending}
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const Icon = f.icon;
          const count =
            f.key === 'all'
              ? notifs.length
              : f.key === 'unread'
                ? unreadCount
                : notifs.filter((n) => n.category === f.key).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-label-md transition-colors duration-snappy',
                active
                  ? 'border-accent-primary bg-accent-primary text-white'
                  : 'border-[var(--border-default)] bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
              )}
            >
              {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden />}
              {f.label}
              {count > 0 && (
                <span
                  className={cn(
                    'tabular-nums text-label-sm',
                    active ? 'text-white/80' : 'text-outline',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {notifsQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} h={86} rounded="lg" />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState
          icon={<Bell size={48} strokeWidth={1.5} />}
          title="No notifications"
          description={
            filter === 'unread'
              ? 'Nothing unread right now.'
              : "When something happens with your money, you'll see it here."
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([bucket, items]) => (
            <section key={bucket} className="flex flex-col gap-2">
              <h2 className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                {bucket}
              </h2>
              <div className="flex flex-col gap-2">
                {items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notif={n}
                    onMarkRead={() => markRead.mutate(n.id)}
                    onDelete={() => deleteNotif.mutate(n.id)}
                  />
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
// Row
// =============================================================
function NotificationRow({
  notif,
  onMarkRead,
  onDelete,
}: {
  notif: NotifVm;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const Icon = iconFor(notif.type);
  const tone = styleFor(notif.category);
  const isUrgent = notif.priority === 'URGENT';

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-lg border bg-surface-container px-4 py-3',
        notif.isRead ? 'border-[var(--border-default)]' : tone.borderClass,
      )}
    >
      {/* Unread leading bar */}
      {!notif.isRead && (
        <span
          aria-hidden
          className={cn('absolute left-0 top-0 bottom-0 w-[3px]', tone.fg.replace('text-', 'bg-'))}
        />
      )}

      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className={cn(
            'flex h-10 w-10 flex-none items-center justify-center rounded-md border',
            tone.bgClass,
            tone.borderClass,
          )}
        >
          <Icon size={18} strokeWidth={1.75} className={tone.fg} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                'truncate text-body-md text-on-surface',
                notif.isRead ? 'font-semibold' : 'font-bold',
              )}
            >
              {notif.title}
            </h3>
            {isUrgent && (
              <Badge variant="urgent" size="sm">
                Urgent
              </Badge>
            )}
          </div>
          <p className="mt-1 text-body-sm text-on-surface-variant line-clamp-2">{notif.message}</p>

          <div className="mt-2 flex items-center gap-3 text-label-sm tabular-nums text-on-surface-variant">
            <span>{formatRelativeTime(notif.createdAt)}</span>
            {notif.amount !== undefined && (
              <>
                <span aria-hidden className="h-1 w-1 rounded-full bg-outline" />
                <span className="text-on-surface font-semibold">
                  {formatCurrency(notif.amount)}
                </span>
              </>
            )}
            {notif.daysUntil !== undefined && (
              <>
                <span aria-hidden className="h-1 w-1 rounded-full bg-outline" />
                <span>
                  in {notif.daysUntil} day{notif.daysUntil === 1 ? '' : 's'}
                </span>
              </>
            )}
          </div>

          {notif.actionLabel && notif.actionRoute && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (!notif.isRead) onMarkRead();
                  if (typeof window !== 'undefined') window.location.href = notif.actionRoute!;
                }}
              >
                {notif.actionLabel}
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          {!notif.isRead && (
            <button
              type="button"
              onClick={onMarkRead}
              aria-label="Mark as read"
              className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-outline transition-colors"
            >
              <CheckCheck size={14} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete notification"
            className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-accent-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-outline transition-colors"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </article>
  );
}
