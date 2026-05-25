import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Card, Badge, Button, Header, EmptyState } from '../../components/shared';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../../styles/theme';

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

const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'LOW_BALANCE',
    category: 'risks',
    priority: 'URGENT',
    title: 'Low balance warning',
    message: 'At current pace, your account will hit ₹0 in 18 days',
    icon: '⚠️',
    actionLabel: 'View forecast',
    actionRoute: 'Insights',
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'n2',
    type: 'FRAUD_ALERT',
    category: 'risks',
    priority: 'URGENT',
    title: 'Unusual transaction',
    message: '₹15,000 charged at "Online Store XYZ" — 5x your usual transaction size. Recognize this?',
    icon: '🚨',
    amount: 15000,
    actionLabel: 'Review',
    actionRoute: 'TransactionDetail',
    actionParams: { id: 'unusual-1' },
    isRead: false,
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'n3',
    type: 'DUPLICATE_CHARGE',
    category: 'risks',
    priority: 'HIGH',
    title: 'Possible duplicate charge',
    message: 'Two charges of ₹649 from Netflix in the same day',
    icon: '🔁',
    amount: 649,
    actionLabel: 'Investigate',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n4',
    type: 'BUDGET_EXCEEDED',
    category: 'risks',
    priority: 'HIGH',
    title: 'Shopping budget exceeded',
    message: "You've spent ₹6,500 of your ₹5,000 shopping budget (130%)",
    icon: '🚨',
    amount: 1500,
    actionLabel: 'View budget',
    actionRoute: 'Budgets',
    isRead: true,
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n5',
    type: 'BUDGET_WARNING',
    category: 'risks',
    priority: 'NORMAL',
    title: 'Food budget at 85%',
    message: 'Only ₹1,500 left in your Food budget (12 days remaining)',
    icon: '⚠️',
    actionLabel: 'View budget',
    actionRoute: 'Budgets',
    isRead: true,
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n6',
    type: 'BILL_DUE',
    category: 'reminders',
    priority: 'HIGH',
    title: 'Credit card due in 2 days',
    message: 'HDFC ****1234 — ₹12,500 due May 27',
    icon: '💳',
    amount: 12500,
    daysUntil: 2,
    actionLabel: 'Pay now',
    isRead: false,
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n7',
    type: 'SUBSCRIPTION_RENEWAL',
    category: 'reminders',
    priority: 'NORMAL',
    title: 'Netflix renews in 3 days',
    message: '₹649 will be charged on May 28. Cancel before to avoid the charge.',
    icon: '🎬',
    amount: 649,
    daysUntil: 3,
    actionLabel: 'Manage',
    actionRoute: 'Subscriptions',
    isRead: false,
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n8',
    type: 'EMI_DUE',
    category: 'reminders',
    priority: 'HIGH',
    title: 'Bike loan EMI in 5 days',
    message: '₹4,200 due May 30',
    icon: '🏍️',
    amount: 4200,
    daysUntil: 5,
    isRead: true,
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n9',
    type: 'PRICE_INCREASE',
    category: 'insights',
    priority: 'NORMAL',
    title: 'Netflix increased price',
    message: 'Now ₹649/month (was ₹499). +30% increase detected silently.',
    icon: '📈',
    actionLabel: 'Review',
    actionRoute: 'Subscriptions',
    isRead: false,
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n10',
    type: 'INSIGHT',
    category: 'insights',
    priority: 'LOW',
    title: 'Late-night spending alert',
    message: 'You spent ₹2,500 after 10 PM this month — likely impulse purchases',
    icon: '🌙',
    actionLabel: 'View patterns',
    actionRoute: 'Insights',
    isRead: true,
    createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n11',
    type: 'WEEKLY_SUMMARY',
    category: 'insights',
    priority: 'NORMAL',
    title: 'Weekly summary ready',
    message: 'Your week of May 19-25 is ready to review',
    icon: '📊',
    actionLabel: 'View summary',
    actionRoute: 'WeeklySummary',
    isRead: false,
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n12',
    type: 'ACHIEVEMENT',
    category: 'wins',
    priority: 'LOW',
    title: '🎉 Goal completed!',
    message: 'You reached your Bike Down Payment goal of ₹25,000',
    icon: '🎉',
    actionLabel: 'Celebrate',
    actionRoute: 'Goals',
    isRead: true,
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n13',
    type: 'GOAL_PROGRESS',
    category: 'wins',
    priority: 'LOW',
    title: 'Emergency Fund 65% complete',
    message: "You're ₹35,000 away. On track for 6 months!",
    icon: '🛡️',
    actionLabel: 'View',
    actionRoute: 'Goals',
    isRead: true,
    createdAt: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
  },
];

const FILTERS: { key: NotifCategory | 'all' | 'unread'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'risks', label: '🚨 Risks' },
  { key: 'reminders', label: '📅 Reminders' },
  { key: 'insights', label: '💡 Insights' },
  { key: 'wins', label: '🎉 Wins' },
];

export function NotificationsScreen({ navigation }: any) {
  const [notifs, setNotifs] = useState<Notification[]>(mockNotifications);
  const [filter, setFilter] = useState<typeof FILTERS[0]['key']>('all');

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
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleClearAll = () => {
    Alert.alert('Clear all notifications?', 'They will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setNotifs([]) },
    ]);
  };

  const handleAction = (notif: Notification) => {
    setNotifs((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
    );
    if (notif.actionRoute) {
      navigation.navigate(notif.actionRoute, notif.actionParams);
    }
  };

  const handleDismiss = (id: string) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
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
              <Text
                style={[styles.tabText, filter === f.key && styles.tabTextActive]}
              >
                {f.label} {count > 0 && `(${count})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {Object.keys(grouped).length === 0 ? (
          <EmptyState
            icon="🔔"
            title="No notifications"
            message="You're all caught up!"
          />
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
            <Text
              style={[
                styles.notifTitle,
                !notif.isRead && styles.notifTitleUnread,
              ]}
            >
              {notif.title}
            </Text>
            {!notif.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifMessage}>{notif.message}</Text>
          <View style={styles.notifFooter}>
            <Text style={styles.notifTime}>{ago}</Text>
            {notif.priority === 'URGENT' && (
              <Badge text="URGENT" variant="error" size="sm" />
            )}
            {notif.priority === 'HIGH' && (
              <Badge text="HIGH" variant="warning" size="sm" />
            )}
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
          <Button
            title={notif.actionLabel}
            onPress={onAction}
            variant="primary"
            size="sm"
          />
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
    backgroundColor: '#EEF2FF',
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
