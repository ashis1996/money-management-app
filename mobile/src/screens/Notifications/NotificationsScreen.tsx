import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  AlertTriangle,
  CalendarClock,
  Sparkles,
  Trophy,
  CheckCheck,
  ArrowRight,
  Bell,
  Repeat,
  TrendingUp,
  ShieldAlert,
  Wallet,
  PiggyBank,
  type LucideIcon,
} from 'lucide-react-native';
import { Badge, Button, Card, EmptyState, Header } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '../../hooks';
import { formatCurrency } from '../../utils';

type NotifCategory = 'risks' | 'reminders' | 'insights' | 'wins';
type NotifPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
type NotifType =
  | 'LOW_BALANCE'
  | 'FRAUD_ALERT'
  | 'DUPLICATE_CHARGE'
  | 'BUDGET_EXCEEDED'
  | 'BUDGET_WARNING'
  | 'BUDGET_ALERT'
  | 'BILL_DUE'
  | 'EMI_DUE'
  | 'SUBSCRIPTION_RENEWAL'
  | 'SUBSCRIPTION'
  | 'INSIGHT'
  | 'PRICE_INCREASE'
  | 'WEEKLY_SUMMARY'
  | 'ACHIEVEMENT'
  | 'GOAL_PROGRESS'
  | string;

interface Notification {
  id: string;
  type: NotifType;
  category: NotifCategory;
  priority: NotifPriority;
  title: string;
  message: string;
  amount?: number;
  daysUntil?: number;
  actionLabel?: string;
  actionRoute?: string;
  actionParams?: any;
  isRead: boolean;
  createdAt: string;
}

const FILTERS: Array<{
  key: NotifCategory | 'all' | 'unread';
  label: string;
  icon?: LucideIcon;
}> = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'risks', label: 'Risks', icon: ShieldAlert },
  { key: 'reminders', label: 'Reminders', icon: CalendarClock },
  { key: 'insights', label: 'Insights', icon: Sparkles },
  { key: 'wins', label: 'Wins', icon: Trophy },
];

// =============================================================
// Type → category + icon resolution. Centralised so the row and the
// filter chip can stay in sync.
// =============================================================
function categoryOf(type: NotifType): NotifCategory {
  if (
    type === 'LOW_BALANCE' ||
    type === 'FRAUD_ALERT' ||
    type === 'DUPLICATE_CHARGE' ||
    type === 'BUDGET_EXCEEDED' ||
    type === 'BUDGET_WARNING' ||
    type === 'BUDGET_ALERT'
  )
    return 'risks';
  if (
    type === 'BILL_DUE' ||
    type === 'EMI_DUE' ||
    type === 'SUBSCRIPTION_RENEWAL' ||
    type === 'SUBSCRIPTION'
  )
    return 'reminders';
  if (type === 'INSIGHT' || type === 'PRICE_INCREASE' || type === 'WEEKLY_SUMMARY')
    return 'insights';
  if (type === 'ACHIEVEMENT' || type === 'GOAL_PROGRESS') return 'wins';
  return 'reminders';
}

function iconFor(type: NotifType): LucideIcon {
  switch (type) {
    case 'LOW_BALANCE':
    case 'BUDGET_EXCEEDED':
    case 'BUDGET_WARNING':
    case 'BUDGET_ALERT':
      return Wallet;
    case 'FRAUD_ALERT':
    case 'DUPLICATE_CHARGE':
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
  bg: string;
  border: string;
}
function styleFor(category: NotifCategory): CategoryStyle {
  switch (category) {
    case 'risks':
      return {
        fg: Colors.accentError,
        bg: 'rgba(255,180,171,0.12)',
        border: 'rgba(255,180,171,0.30)',
      };
    case 'reminders':
      return {
        fg: Colors.accentWarning,
        bg: 'rgba(251,191,36,0.12)',
        border: 'rgba(251,191,36,0.30)',
      };
    case 'insights':
      return {
        fg: Colors.accentAi,
        bg: 'rgba(34,211,238,0.12)',
        border: 'rgba(34,211,238,0.30)',
      };
    case 'wins':
      return {
        fg: Colors.accentSuccess,
        bg: 'rgba(16,185,129,0.12)',
        border: 'rgba(16,185,129,0.30)',
      };
  }
}

function backendToNotification(n: any): Notification {
  const data = n.data ?? {};
  const rawType = (data.uiType as string) ?? (n.type as string);
  return {
    id: n.id,
    type: rawType,
    category: categoryOf(rawType),
    priority: (n.priority || 'NORMAL') as NotifPriority,
    title: n.title,
    message: n.message || '',
    amount: data.amount,
    daysUntil: data.daysUntil,
    actionLabel: data.actionLabel,
    actionRoute: data.actionRoute,
    actionParams: data.actionParams,
    isRead: !!n.isRead,
    createdAt: n.createdAt,
  };
}

// =============================================================
// Screen
// =============================================================
export function NotificationsScreen({ navigation }: any) {
  const notifsQuery = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const notifs: Notification[] = useMemo(() => {
    return (notifsQuery.data || []).map(backendToNotification);
  }, [notifsQuery.data]);

  const [filter, setFilter] = useState<(typeof FILTERS)[0]['key']>('all');

  const unreadCount = notifs.filter((n) => !n.isRead).length;

  const filtered = useMemo(() => {
    if (filter === 'all') return notifs;
    if (filter === 'unread') return notifs.filter((n) => !n.isRead);
    return notifs.filter((n) => n.category === filter);
  }, [notifs, filter]);

  const grouped = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    filtered.forEach((n) => {
      const ago = Date.now() - new Date(n.createdAt).getTime();
      let key: string;
      if (ago < 24 * 3600 * 1000) key = 'Today';
      else if (ago < 2 * 24 * 3600 * 1000) key = 'Yesterday';
      else if (ago < 7 * 24 * 3600 * 1000) key = 'This week';
      else key = 'Earlier';
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    return groups;
  }, [filtered]);

  return (
    <View style={styles.container}>
      <Header
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        onBack={() => navigation.goBack()}
        rightContent={
          unreadCount > 0 ? (
            <TouchableOpacity
              onPress={() => markAllAsRead.mutate()}
              accessibilityRole="button"
              accessibilityLabel="Mark all read"
              hitSlop={8}
              style={styles.markAllBtn}
            >
              <CheckCheck size={16} color={Colors.accentAi} strokeWidth={1.75} />
              <Text style={styles.markAllText}>Mark all</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Filter chip rail */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabs}
      >
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
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityLabel={f.label}
              style={[styles.chip, active && styles.chipActive]}
            >
              {Icon && (
                <Icon
                  size={14}
                  color={active ? Colors.white : Colors.textSecondary}
                  strokeWidth={1.75}
                />
              )}
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{f.label}</Text>
              {count > 0 && (
                <Text style={[styles.chipCount, active && styles.chipCountActive]}>{count}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {Object.keys(grouped).length === 0 ? (
          <EmptyState
            icon="🔔"
            title="No notifications"
            message={
              filter === 'unread'
                ? 'Nothing unread right now.'
                : 'When something happens with your money, you\u2019ll see it here.'
            }
          />
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <View key={date} style={{ marginBottom: Spacing.base }}>
              <Text style={styles.dateHeader}>{date}</Text>
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notif={n}
                  onPress={() => {
                    if (!n.isRead) markAsRead.mutate(n.id);
                    if (n.actionRoute) {
                      navigation.navigate(n.actionRoute, n.actionParams);
                    }
                  }}
                  onDismiss={() => markAsRead.mutate(n.id)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// =============================================================
// Notification row
// =============================================================
function NotificationItem({
  notif,
  onPress,
  onDismiss,
}: {
  notif: Notification;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const Icon = iconFor(notif.type);
  const tone = styleFor(notif.category);
  const isUrgent = notif.priority === 'URGENT';
  const ago = formatRelativeTime(notif.createdAt);

  return (
    <Card
      style={[
        styles.card,
        !notif.isRead && {
          borderColor: tone.border,
        },
      ]}
      padding="base"
      onPress={onPress}
    >
      {/* Unread leading bar */}
      {!notif.isRead && (
        <View
          style={[styles.unreadBar, { backgroundColor: tone.fg }]}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}

      <View style={styles.row}>
        <View style={[styles.iconHost, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Icon size={18} color={tone.fg} strokeWidth={1.75} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                !notif.isRead && {
                  fontWeight: Typography.weights.bold,
                  fontFamily: fontFamilyForWeight(Typography.weights.bold),
                },
              ]}
              numberOfLines={1}
            >
              {notif.title}
            </Text>
            {isUrgent && <Badge text="URGENT" variant="error" size="sm" />}
          </View>
          <Text style={styles.message} numberOfLines={2}>
            {notif.message}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaTime}>{ago}</Text>
            {notif.amount !== undefined && (
              <>
                <View style={styles.metaDot} />
                <Text style={styles.metaAmount}>{formatCurrency(notif.amount)}</Text>
              </>
            )}
            {notif.daysUntil !== undefined && (
              <>
                <View style={styles.metaDot} />
                <Text style={styles.metaTime}>
                  in {notif.daysUntil} day
                  {notif.daysUntil === 1 ? '' : 's'}
                </Text>
              </>
            )}
          </View>

          {notif.actionLabel && (
            <View style={{ marginTop: Spacing.sm }}>
              <Button
                title={notif.actionLabel}
                size="sm"
                variant="secondary"
                onPress={onPress}
                trailingIcon={<ArrowRight size={14} color={Colors.textPrimary} strokeWidth={2} />}
              />
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Mark as read"
          style={styles.dismissBtn}
        >
          <CheckCheck size={14} color={notif.isRead ? Colors.outline : tone.fg} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </Card>
  );
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(34,211,238,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.30)',
  },
  markAllText: {
    marginLeft: 4,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    color: Colors.accentAi,
    letterSpacing: 0.4,
  },

  // Chips
  filterTabs: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    marginRight: Spacing.sm,
  },
  chipActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  chipLabel: {
    marginLeft: 4,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
  chipLabelActive: {
    color: Colors.white,
  },
  chipCount: {
    marginLeft: 6,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'] as any,
  },
  chipCountActive: {
    color: 'rgba(255,255,255,0.85)',
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  dateHeader: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },

  // Card
  card: {
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  unreadBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconHost: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },
  message: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: Typography.sizes.sm * 1.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  metaTime: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginHorizontal: Spacing.xs,
    backgroundColor: Colors.outline,
  },
  metaAmount: {
    fontSize: Typography.sizes.xs,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semiBold,
    fontVariant: ['tabular-nums'] as any,
  },
  dismissBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
});
