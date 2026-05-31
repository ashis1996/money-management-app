import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Card, Badge, Button, ProgressBar, EmptyState } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, Tints } from '../../styles/theme';
import { useSubscriptions, useCancelSubscription, usePauseSubscription } from '../../hooks';

type Frequency = 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY';
type Status = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

interface Subscription {
  id: string;
  name: string;
  merchantName: string;
  amount: number;
  frequency: Frequency;
  status: Status;
  category: string;
  icon: string;
  color: string;
  nextBillingDate: string;
  lastPaymentDate: string;
  totalPaid: number;
  paymentCount: number;
  // Leak detection
  originalAmount?: number;
  priceIncreasePercent?: number;
  usageScore: number; // 0-1
  isLowUsage: boolean;
  isDuplicate: boolean;
  duplicateGroup?: string;
}

const mockSubscriptions: Subscription[] = [];

type FilterType = 'all' | 'active' | 'leaks' | 'upcoming';

export function SubscriptionsScreen({ navigation }: any) {
  const subsQuery = useSubscriptions();
  const cancelSub = useCancelSubscription();
  const pauseSub = usePauseSubscription();

  const subscriptions: Subscription[] = useMemo(() => {
    const list = subsQuery.data || [];
    return list.map((s: any) => ({
      id: s.id,
      name: s.name,
      merchantName: s.merchantName || s.name,
      amount: Number(s.amount),
      frequency: s.frequency,
      status: s.status,
      category: s.category?.name || s.categoryId || 'Other',
      icon: s.icon || '🔄',
      color: s.color || Colors.primary,
      nextBillingDate: s.nextBillingDate || new Date().toISOString(),
      lastPaymentDate: s.lastPaymentDate || new Date().toISOString(),
      totalPaid: Number(s.totalAmountPaid ?? 0),
      paymentCount: s.totalPaymentsCount ?? 0,
      originalAmount: s.originalAmount ? Number(s.originalAmount) : undefined,
      priceIncreasePercent: s.priceIncreasePercent ? Number(s.priceIncreasePercent) : undefined,
      usageScore: s.usageScore ? Number(s.usageScore) : 0.5,
      isLowUsage: !!s.isLowUsage,
      isDuplicate: !!s.isDuplicate,
      duplicateGroup: s.duplicateGroup,
    }));
  }, [subsQuery.data]);

  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);

  // Calculate stats
  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === 'ACTIVE');
    const monthlyTotal = active.reduce((sum, s) => {
      if (s.frequency === 'MONTHLY') return sum + s.amount;
      if (s.frequency === 'YEARLY') return sum + s.amount / 12;
      if (s.frequency === 'WEEKLY') return sum + s.amount * 4;
      if (s.frequency === 'QUARTERLY') return sum + s.amount / 3;
      return sum;
    }, 0);
    const yearlyTotal = monthlyTotal * 12;
    const leakSavings = active
      .filter(
        (s) => s.isLowUsage || (s.isDuplicate && s.duplicateGroup === 'music' && s.id === '3'),
      )
      .reduce((sum, s) => sum + (s.frequency === 'MONTHLY' ? s.amount : s.amount / 12), 0);

    return {
      activeCount: active.length,
      monthlyTotal: Math.round(monthlyTotal),
      yearlyTotal: Math.round(yearlyTotal),
      leakSavings: Math.round(leakSavings),
    };
  }, [subscriptions]);

  // Filter subscriptions
  const filtered = useMemo(() => {
    let list = subscriptions.filter((s) => s.status === 'ACTIVE');

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
    } else if (filter === 'active') {
      list.sort((a, b) => b.amount - a.amount);
    } else {
      list.sort((a, b) => b.amount - a.amount);
    }

    return list;
  }, [subscriptions, filter]);

  // Group duplicates for visualization
  const duplicateGroups = useMemo(() => {
    const groups: Record<string, Subscription[]> = {};
    subscriptions
      .filter((s) => s.status === 'ACTIVE' && s.isDuplicate && s.duplicateGroup)
      .forEach((s) => {
        if (!groups[s.duplicateGroup!]) groups[s.duplicateGroup!] = [];
        groups[s.duplicateGroup!].push(s);
      });
    return groups;
  }, [subscriptions]);

  const handleCancel = (sub: Subscription) => {
    Alert.alert(
      `Cancel ${sub.name}?`,
      `You'll save ₹${
        sub.frequency === 'MONTHLY' ? sub.amount : Math.round(sub.amount / 12)
      }/month. Cancel guidance will be shown.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Show Cancel Guide',
          onPress: () => {
            setSelectedSub(sub);
          },
        },
      ],
    );
  };

  const handlePause = (sub: Subscription) => {
    if (sub.status === 'PAUSED') {
      // Resume
      pauseSub.mutate(sub.id);
    } else {
      pauseSub.mutate(sub.id);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Subscriptions</Text>
          <Text style={styles.subtitle}>Track and optimize your recurring payments</Text>
        </View>

        {/* Stats card */}
        <Card style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.activeCount}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{stats.monthlyTotal.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Monthly</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{stats.yearlyTotal.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Yearly</Text>
            </View>
          </View>
        </Card>

        {/* Leaks alert */}
        {stats.leakSavings > 0 && (
          <Card
            style={[
              styles.alertCard,
              { backgroundColor: Tints.errorBg, borderColor: Tints.errorBorder },
            ]}
          >
            <View style={styles.alertRow}>
              <Text style={styles.alertIcon}>💧</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>Save ₹{stats.leakSavings}/month</Text>
                <Text style={styles.alertSubtitle}>
                  Cancel low-usage and duplicate subscriptions
                </Text>
              </View>
              <Button
                title="Review"
                onPress={() => setFilter('leaks')}
                size="sm"
                variant="danger"
              />
            </View>
          </Card>
        )}

        {/* Duplicate groups alert */}
        {Object.entries(duplicateGroups).map(([group, subs]) => (
          <Card key={group} style={styles.duplicateCard}>
            <View style={styles.duplicateHeader}>
              <Text style={styles.duplicateIcon}>🔁</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.duplicateTitle}>
                  {subs.length} {group} services overlap
                </Text>
                <Text style={styles.duplicateSubtitle}>
                  Keep one, save ₹
                  {subs
                    .slice(1)
                    .reduce(
                      (sum, s) => sum + (s.frequency === 'MONTHLY' ? s.amount : s.amount / 12),
                      0,
                    )
                    .toFixed(0)}
                  /month
                </Text>
              </View>
            </View>
            <View style={styles.duplicateList}>
              {subs.map((s) => (
                <View key={s.id} style={styles.duplicateItem}>
                  <Text style={styles.duplicateItemIcon}>{s.icon}</Text>
                  <Text style={styles.duplicateItemName}>{s.name}</Text>
                  <Text style={styles.duplicateItemAmount}>₹{s.amount}</Text>
                </View>
              ))}
            </View>
          </Card>
        ))}

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabs}
        >
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'leaks', label: '💧 Leaks' },
              { key: 'upcoming', label: '📅 Upcoming' },
            ] as { key: FilterType; label: string }[]
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
              onPress={() => setFilter(tab.key)}
            >
              <Text
                style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Subscription list */}
        <View style={styles.list}>
          {filtered.map((sub) => (
            <SubscriptionCard
              key={sub.id}
              subscription={sub}
              onCancel={() => handleCancel(sub)}
              onPause={() => handlePause(sub)}
            />
          ))}
        </View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      {/* Cancel Guide Modal */}
      <Modal
        visible={!!selectedSub}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedSub(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedSub && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalIcon}>{selectedSub.icon}</Text>
                  <Text style={styles.modalTitle}>Cancel {selectedSub.name}</Text>
                  <TouchableOpacity onPress={() => setSelectedSub(null)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalSavings}>
                  <Text style={styles.modalSavingsLabel}>You'll save</Text>
                  <Text style={styles.modalSavingsAmount}>
                    ₹
                    {(selectedSub.frequency === 'MONTHLY'
                      ? selectedSub.amount * 12
                      : selectedSub.amount
                    ).toLocaleString()}
                  </Text>
                  <Text style={styles.modalSavingsPeriod}>per year</Text>
                </View>

                <Text style={styles.modalStepsTitle}>Steps to cancel:</Text>
                {getCancelSteps(selectedSub.name).map((step, idx) => (
                  <View key={idx} style={styles.modalStep}>
                    <View style={styles.modalStepNumber}>
                      <Text style={styles.modalStepNumberText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.modalStepText}>{step}</Text>
                  </View>
                ))}

                <View style={styles.modalActions}>
                  <Button
                    title="Mark as Cancelled"
                    onPress={() => {
                      cancelSub.mutate(selectedSub.id);
                      setSelectedSub(null);
                    }}
                    variant="success"
                    fullWidth
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface SubscriptionCardProps {
  subscription: Subscription;
  onCancel: () => void;
  onPause: () => void;
}

function SubscriptionCard({ subscription, onCancel, onPause }: SubscriptionCardProps) {
  const daysUntilBilling = Math.ceil(
    (new Date(subscription.nextBillingDate).getTime() - Date.now()) / (24 * 3600 * 1000),
  );

  return (
    <Card style={styles.subCard}>
      <View style={styles.subHeader}>
        <View style={[styles.subIcon, { backgroundColor: subscription.color + '20' }]}>
          <Text style={styles.subIconText}>{subscription.icon}</Text>
        </View>
        <View style={styles.subInfo}>
          <View style={styles.subTopRow}>
            <Text style={styles.subName}>{subscription.name}</Text>
            <Text style={styles.subAmount}>
              ₹{subscription.amount}
              <Text style={styles.subFreq}>
                /
                {subscription.frequency === 'MONTHLY'
                  ? 'mo'
                  : subscription.frequency === 'YEARLY'
                    ? 'yr'
                    : 'wk'}
              </Text>
            </Text>
          </View>
          <Text style={styles.subCategory}>{subscription.category}</Text>
          <View style={styles.subBadgeRow}>
            {subscription.isLowUsage && <Badge text="🔇 Low Usage" variant="warning" size="sm" />}
            {subscription.priceIncreasePercent && subscription.priceIncreasePercent > 10 && (
              <Badge
                text={`📈 +${subscription.priceIncreasePercent.toFixed(0)}%`}
                variant="error"
                size="sm"
              />
            )}
            {subscription.isDuplicate && <Badge text="🔁 Duplicate" variant="info" size="sm" />}
            {daysUntilBilling <= 3 && daysUntilBilling >= 0 && (
              <Badge text={`⏰ Due in ${daysUntilBilling}d`} variant="warning" size="sm" />
            )}
          </View>
        </View>
      </View>

      {/* Usage indicator */}
      <View style={styles.usageSection}>
        <View style={styles.usageHeader}>
          <Text style={styles.usageLabel}>Usage Score</Text>
          <Text
            style={[
              styles.usageValue,
              {
                color:
                  subscription.usageScore < 0.3
                    ? Colors.error
                    : subscription.usageScore < 0.6
                      ? Colors.warning
                      : Colors.success,
              },
            ]}
          >
            {Math.round(subscription.usageScore * 100)}%
          </Text>
        </View>
        <ProgressBar
          progress={subscription.usageScore * 100}
          color={
            subscription.usageScore < 0.3
              ? Colors.error
              : subscription.usageScore < 0.6
                ? Colors.warning
                : Colors.success
          }
          height={4}
        />
      </View>

      {/* Next billing */}
      <View style={styles.subFooter}>
        <View style={styles.subFooterItem}>
          <Text style={styles.subFooterLabel}>Next billing</Text>
          <Text style={styles.subFooterValue}>
            {new Date(subscription.nextBillingDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        </View>
        <View style={styles.subFooterItem}>
          <Text style={styles.subFooterLabel}>Total paid</Text>
          <Text style={styles.subFooterValue}>₹{subscription.totalPaid.toLocaleString()}</Text>
        </View>
        <View style={styles.subFooterItem}>
          <Text style={styles.subFooterLabel}>Payments</Text>
          <Text style={styles.subFooterValue}>{subscription.paymentCount}</Text>
        </View>
      </View>

      {/* Price hike alert */}
      {subscription.priceIncreasePercent && subscription.priceIncreasePercent > 10 && (
        <View style={styles.priceHikeAlert}>
          <Text style={styles.priceHikeText}>
            📈 Price increased from ₹{subscription.originalAmount} to ₹{subscription.amount}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.subActions}>
        <Button
          title={subscription.status === 'PAUSED' ? '▶️ Resume' : '⏸ Pause'}
          onPress={onPause}
          variant="secondary"
          size="sm"
          style={{ flex: 1 }}
        />
        <Button
          title="Cancel"
          onPress={onCancel}
          variant="danger"
          size="sm"
          style={{ flex: 1, marginLeft: Spacing.sm }}
        />
      </View>
    </Card>
  );
}

function getCancelSteps(name: string): string[] {
  const lower = name.toLowerCase();
  if (lower.includes('netflix')) {
    return [
      'Open Netflix.com or the app',
      "Go to Account > 'Cancel Membership'",
      'Confirm cancellation',
      'Service continues until end of billing period',
    ];
  }
  if (lower.includes('spotify')) {
    return [
      'Visit spotify.com/account',
      "Click 'Subscription' on the left",
      "Select 'Change or Cancel'",
      "Choose 'Cancel Premium'",
    ];
  }
  return [
    `Open ${name} app or website`,
    'Navigate to Account or Subscription settings',
    "Find 'Cancel Subscription' option",
    'Confirm cancellation',
  ];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['3xl'] + Spacing.lg,
    paddingBottom: Spacing.base,
  },
  title: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statsCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },
  alertCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    borderWidth: 1,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  alertTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  alertSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  // Duplicate
  duplicateCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    backgroundColor: Tints.warningBg,
    borderWidth: 1,
    borderColor: Tints.warningBorder,
  },
  duplicateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  duplicateIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  duplicateTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textTransform: 'capitalize',
  },
  duplicateSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.success,
    fontWeight: Typography.weights.semiBold,
    marginTop: 2,
  },
  duplicateList: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.base,
    padding: Spacing.sm,
  },
  duplicateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  duplicateItemIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  duplicateItemName: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  duplicateItemAmount: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  // Filter tabs
  filterTabs: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
    marginRight: Spacing.sm,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterTabText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: Colors.white,
  },
  // List
  list: {
    paddingHorizontal: Spacing.lg,
  },
  // Subscription card
  subCard: {
    marginBottom: Spacing.base,
  },
  subHeader: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  subIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  subIconText: {
    fontSize: 24,
  },
  subInfo: {
    flex: 1,
  },
  subTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  subAmount: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  subFreq: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.regular,
    color: Colors.textSecondary,
  },
  subCategory: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  subBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: Spacing.xs,
  },
  // Usage
  usageSection: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  usageLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  usageValue: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  // Footer
  subFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  subFooterItem: {
    flex: 1,
  },
  subFooterLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  subFooterValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  // Price hike
  priceHikeAlert: {
    backgroundColor: Tints.errorBg,
    padding: Spacing.sm,
    borderRadius: BorderRadius.base,
    marginTop: Spacing.sm,
  },
  priceHikeText: {
    fontSize: Typography.sizes.sm,
    color: Colors.error,
    fontWeight: Typography.weights.medium,
  },
  // Actions
  subActions: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalIcon: {
    fontSize: 32,
    marginRight: Spacing.sm,
  },
  modalTitle: {
    flex: 1,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  modalClose: {
    fontSize: 24,
    color: Colors.textSecondary,
  },
  modalSavings: {
    backgroundColor: Tints.successBg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalSavingsLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  modalSavingsAmount: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.success,
    marginVertical: 4,
  },
  modalSavingsPeriod: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  modalStepsTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  modalStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  modalStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  modalStepNumberText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
  modalStepText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.5,
  },
  modalActions: {
    marginTop: Spacing.lg,
  },
});
