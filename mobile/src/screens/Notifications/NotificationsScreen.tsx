import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Card, Badge, Button, Header, EmptyState } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, Tints } from '../../styles/theme';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '../../hooks';

type NotifType =
  | 'LOW_BALANCE'
  | 'FRAUD_ALERT'
  | 'DUPLICATE_CHARGE'
  | 'BUDGET_EXCEEDED'
  | 'BUDGET_WARNING'
  | 'BILL_DUE'
  | 'EMI_DUE'
  | 'SUBSCRIPTION_RENEWAL'
  | 'PRICE_INCREASE'
  | 'GOAL_PROGRESS'
  | 'INSIGHT'
  | 'ACHIEVEMENT'
  | 'WEEKLY_SUMMARY';

type NotifPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
type NotifCategory = 'risks' | 'reminders' | 'insights' | 'wins';

interface Notification {
  id: string;
  type: NotifType;
  category: NotifCategory;
  priority: NotifPriority;
  title: string;
  message: string;
  icon: string;
  amount?: number;
  daysUntil?: number;
  actionLabel?: string;
  actionRoute?: string;
  actionParams?: any;
  isRead: boolean;
  createdAt: string;
}

const mockNotifications: Notification[] = [];

const FILTERS: { key: NotifCategory | 'all' | 'unread'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'risks', label: '🚨 Risks' },
  { key: 'reminders', label: '📅 Reminders' },
  { key: 'insights', label: '💡 Insights' },
  { key: 'wins', label: '🎉 Wins' },
];

/**
 * Map a backend NotificationType + data payload to the rich UI shape.
 * The schema only has type/title/message/data; we infer category/icon/priority.
 */
function backendToNotification(n: any): Notification {
  const data = n.data ?? {};
  const rawType = (data.uiType as string) ?? (n.type as string);
  const type: NotifType = rawType as NotifType;

  let category: NotifCategory = 'reminders';
  if (
    rawType === 'LOW_BALANCE' ||
    rawType === 'FRAUD_ALERT' ||
    rawType === 'DUPLICATE_CHARGE' ||
    rawType === 'BUDGET_EXCEEDED' ||
    rawType === 'BUDGET_WARNING' ||
    rawType === 'BUDGET_ALERT'
  )
    category = 'risks';
  else if (
    rawType === 'BILL_DUE' ||
    rawType === 'EMI_DUE' ||
    rawType === 'SUBSCRIPTION_RENEWAL' ||
    rawType === 'SUBSCRIPTION'
  )
    category = 'reminders';
  else if (rawType === 'INSIGHT' || rawType === 'PRICE_INCREASE' || rawType === 'WEEKLY_SUMMARY')
    category = 'insights';
  else if (rawType === 'ACHIEVEMENT' || rawType === 'GOAL_PROGRESS') category = 'wins';

  return {
    id: n.id,
    type: type as NotifType,
    category,
    priority: (n.priority || 'NORMAL') as NotifPriority,
    title: n.title,
    message: n.message || '',
    icon: data.icon || '🔔',
    amount: data.amount,
    daysUntil: data.daysUntil,
    actionLabel: data.actionLabel,
    actionRoute: data.actionRoute,
    actionParams: data.actionParams,
    isRead: !!n.isRead,
    createdAt: n.createdAt,
  };
}

export function NotificationsScreen({ navigation }: any) {
  const notifsQuery = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const notifs: Notification[] = useMemo(() => {
    const list = notifsQuery.data || [];
    return list.map(backendToNotification);
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

  const handleMarkAllRead = () => {
    markAllAsRead.mutate();
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear all notifications?',
      'Use Mark All Read instead — clearing is not yet supported',
      [{ text: 'OK' }],
    );
  };

  const handleAction = (notif: Notification) => {
    if (!notif.isRead) markAsRead.mutate(notif.id);
    if (notif.actionRoute) {
      navigation.navigate(notif.actionRoute, notif.actionParams);
    }
  };

  const handleDismiss = (id: string) => {
    markAsRead.mutate(id);
  };

  return (
    <View style={styles.container}>
      <Header
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        onBack={() => navigation.goBack()}
        rightIcon="✓"
        onRightPress={unreadCount > 0 ? handleMarkAllRead : undefined}
      />

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {FILTERS.map((f) => {
          const count =
            f.key === 'all'
              ? notifs.length
              : f.key === 'unread'
                ? unreadCount
                : notifs.filter((n) => n.category === f.key).length;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.tab, filter === f.key && styles.tabActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.tabText, filter === f.key && styles.tabTextActive]}>
                {f.label} {count > 0 && `(${count})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {Object.keys(grouped).length === 0 ? (
          <EmptyState icon="🔔" title="No notifications" message="You're all caught up!" />
        ) : (
          Object.entries(grouped).map(([group, items]) => (
            <View key={group}>
              <Text style={styles.groupHeader}>{group}</Text>
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notif={n}
                  onAction={() => handleAction(n)}
                  onDismiss={() => handleDismiss(n.id)}
                />
              ))}
            </View>
          ))
        )}

        {notifs.length > 0 && (
          <TouchableOpacity style={styles.clearAll} onPress={handleClearAll}>
            <Text style={styles.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

function NotificationItem({
  notif,
  onAction,
  onDismiss,
}: {
  notif: Notification;
  onAction: () => void;
  onDismiss: () => void;
}) {
  const priorityColors: Record<NotifPriority, string> = {
    URGENT: Colors.error,
    HIGH: Colors.warning,
    NORMAL: Colors.primary,
    LOW: Colors.gray400,
  };

  const ago = formatRelativeTime(notif.createdAt);
  const borderColor = priorityColors[notif.priority];

  return (
    <Card
      onPress={onAction}
      style={[
        styles.notif,
        !notif.isRead && styles.notifUnread,
        { borderLeftWidth: 4, borderLeftColor: borderColor },
      ]}
    >
      <View style={styles.notifHeader}>
        <Text style={styles.notifIcon}>{notif.icon}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.notifTitleRow}>
            <Text style={[styles.notifTitle, !notif.isRead && styles.notifTitleUnread]}>
              {notif.title}
            </Text>
            {!notif.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifMessage}>{notif.message}</Text>
          <View style={styles.notifFooter}>
            <Text style={styles.notifTime}>{ago}</Text>
            {notif.priority === 'URGENT' && <Badge text="URGENT" variant="error" size="sm" />}
            {notif.priority === 'HIGH' && <Badge text="HIGH" variant="warning" size="sm" />}
            {notif.daysUntil !== undefined && notif.daysUntil <= 3 && (
              <Badge
                text={`In ${notif.daysUntil} days`}
                variant={notif.daysUntil <= 1 ? 'error' : 'warning'}
                size="sm"
              />
            )}
          </View>
        </View>
      </View>

      {notif.actionLabel && (
        <View style={styles.notifActions}>
          <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
          <Button title={notif.actionLabel} onPress={onAction} variant="primary" size="sm" />
        </View>
      )}
    </Card>
  );
}

function formatRelativeTime(iso: string): string {
  const ago = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ago / 60000);
  const hrs = Math.floor(ago / 3600000);
  const days = Math.floor(ago / (24 * 3600000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Tabs
  tabs: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  tab: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
    marginRight: Spacing.sm,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  // Group header
  groupHeader: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  // Notif card
  notif: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  notifUnread: {
    backgroundColor: Tints.primaryBg,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notifIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  notifTitle: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semiBold,
  },
  notifTitleUnread: {
    fontWeight: Typography.weights.bold,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  notifMessage: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: Typography.sizes.sm * 1.5,
  },
  notifFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    flexWrap: 'wrap',
  },
  notifTime: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    marginRight: 4,
  },
  notifActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  dismissBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  dismissText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  clearAll: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  clearAllText: {
    fontSize: Typography.sizes.sm,
    color: Colors.error,
    fontWeight: Typography.weights.medium,
  },
});
