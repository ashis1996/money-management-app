import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import {
  Droplet,
  Calendar as CalendarIcon,
  Repeat,
  TrendingUp,
  Sparkles,
  X,
  Pause,
  Play,
  ArrowRight,
} from 'lucide-react-native';
import { Card, Badge, Button, ProgressBar } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { useSubscriptions, useCancelSubscription, usePauseSubscription } from '../../hooks';
import { formatCurrency, formatRelativeDays } from '../../utils';

type Frequency = 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'QUARTERLY';
type Status = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  status: Status;
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
  duplicateGroup?: string;
}

const PALETTE = [
  Colors.accentPrimary,
  Colors.accentAi,
  Colors.accentSuccess,
  Colors.accentWarning,
  '#A78BFA',
  '#F472B6',
];
function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function monthlyEquivalent(s: Subscription): number {
  if (s.frequency === 'MONTHLY') return s.amount;
  if (s.frequency === 'YEARLY') return s.amount / 12;
  if (s.frequency === 'WEEKLY') return s.amount * 4;
  if (s.frequency === 'QUARTERLY') return s.amount / 3;
  return s.amount;
}

type FilterType = 'all' | 'leaks' | 'upcoming';

export function SubscriptionsScreen({ navigation }: any) {
  const subsQuery = useSubscriptions();
  const cancelSub = useCancelSubscription();
  const pauseSub = usePauseSubscription();

  const subscriptions: Subscription[] = useMemo(() => {
    const list = subsQuery.data || [];
    return list.map((s: any) => ({
      id: s.id,
      name: s.name,
      amount: Number(s.amount),
      frequency: s.frequency,
      status: s.status,
      category: s.category?.name || s.categoryId || 'Other',
      color: s.color || colorForName(s.name || ''),
      nextBillingDate: s.nextBillingDate || new Date().toISOString(),
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

  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === 'ACTIVE');
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
  }, [subscriptions]);

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
    } else {
      list.sort((a, b) => b.amount - a.amount);
    }
    return list;
  }, [subscriptions, filter]);

  const handleCancel = (sub: Subscription) => {
    Alert.alert(
      `Cancel ${sub.name}?`,
      `You'll save ${formatCurrency(monthlyEquivalent(sub))}/month. Cancel guidance will be shown.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Show cancel guide',
          onPress: () => setSelectedSub(sub),
        },
      ],
    );
  };

  const handlePause = (sub: Subscription) => pauseSub.mutate(sub.id);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Subscriptions</Text>
            <Text style={styles.subtitle}>Track and optimize your recurring spend</Text>
          </View>
        </View>

        {/* Hero stats card */}
        <Card variant="hero" style={styles.statsCard} padding="lg">
          <View style={styles.statsRow}>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{stats.activeCount}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>
                {formatCurrency(stats.monthlyTotal, { compact: true })}
              </Text>
              <Text style={styles.statLabel}>Monthly</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>
                {formatCurrency(stats.yearlyTotal, { compact: true })}
              </Text>
              <Text style={styles.statLabel}>Yearly</Text>
            </View>
          </View>
        </Card>

        {/* AI savings card */}
        {stats.leakSavings > 0 && (
          <Card variant="ai" style={styles.aiSavings}>
            <View style={styles.aiSavingsRow}>
              <View style={styles.aiSavingsIcon}>
                <Sparkles size={18} color={Colors.accentAi} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiSavingsTitle}>
                  Save up to {formatCurrency(stats.leakSavings, { compact: true })}/mo
                </Text>
                <Text style={styles.aiSavingsBody}>
                  Cancel low-usage and duplicate subscriptions
                </Text>
              </View>
              <Button title="Review" onPress={() => setFilter('leaks')} size="sm" variant="ai" />
            </View>
          </Card>
        )}

        {/* Filter chip rail */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabs}
        >
          {(
            [
              { key: 'all', label: 'All', icon: Repeat },
              { key: 'leaks', label: 'Leaks', icon: Droplet },
              { key: 'upcoming', label: 'Upcoming', icon: CalendarIcon },
            ] as Array<{ key: FilterType; label: string; icon: React.ComponentType<any> }>
          ).map((tab) => {
            const Icon = tab.icon;
            const active = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(tab.key)}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
              >
                <Icon
                  size={14}
                  color={active ? Colors.white : Colors.textSecondary}
                  strokeWidth={1.75}
                />
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* List */}
        <View style={styles.list}>
          {filtered.map((sub) => (
            <SubscriptionCard
              key={sub.id}
              subscription={sub}
              onCancel={() => handleCancel(sub)}
              onPause={() => handlePause(sub)}
            />
          ))}
          {filtered.length === 0 && (
            <Text style={styles.emptyText}>No subscriptions match this filter.</Text>
          )}
        </View>

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>

      {/* Cancel guide modal */}
      <CancelGuideModal
        sub={selectedSub}
        onClose={() => setSelectedSub(null)}
        onConfirm={() => {
          if (selectedSub) {
            cancelSub.mutate(selectedSub.id);
          }
          setSelectedSub(null);
        }}
      />
    </View>
  );
}

// =============================================================
// Subscription card
// =============================================================
function SubscriptionCard({
  subscription,
  onCancel,
  onPause,
}: {
  subscription: Subscription;
  onCancel: () => void;
  onPause: () => void;
}) {
  const daysUntilBilling = Math.ceil(
    (new Date(subscription.nextBillingDate).getTime() - Date.now()) / (24 * 3600 * 1000),
  );

  const usageColor =
    subscription.usageScore < 0.3
      ? Colors.accentError
      : subscription.usageScore < 0.6
        ? Colors.accentWarning
        : Colors.accentSuccess;

  const initial = (subscription.name?.[0] || '?').toUpperCase();

  return (
    <Card style={styles.subCard}>
      <View style={styles.subTop}>
        <View
          style={[
            styles.subGlyph,
            {
              backgroundColor: subscription.color + '22',
              borderColor: subscription.color + '44',
            },
          ]}
        >
          <Text style={[styles.subGlyphLetter, { color: subscription.color }]}>{initial}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.subHeaderRow}>
            <Text style={styles.subName} numberOfLines={1}>
              {subscription.name}
            </Text>
            <Text style={styles.subAmount}>
              {formatCurrency(subscription.amount)}
              <Text style={styles.subAmountUnit}> /{frequencySuffix(subscription.frequency)}</Text>
            </Text>
          </View>
          <Text style={styles.subCategory} numberOfLines={1}>
            {subscription.category}
          </Text>
          <View style={styles.badgeRow}>
            {subscription.isLowUsage && <Badge text="Low usage" variant="warning" size="sm" />}
            {subscription.priceIncreasePercent && subscription.priceIncreasePercent > 10 && (
              <Badge
                text={`+${subscription.priceIncreasePercent.toFixed(0)}% price`}
                variant="error"
                size="sm"
              />
            )}
            {subscription.isDuplicate && <Badge text="Duplicate" variant="ai" size="sm" />}
            {daysUntilBilling >= 0 && daysUntilBilling <= 3 && (
              <Badge
                text={`Due ${formatRelativeDays(subscription.nextBillingDate)}`}
                variant="warning"
                size="sm"
              />
            )}
          </View>
        </View>
      </View>

      {/* Usage */}
      <View style={styles.usageBlock}>
        <View style={styles.usageHeader}>
          <Text style={styles.usageLabel}>Usage score</Text>
          <Text style={[styles.usageValue, { color: usageColor }]}>
            {Math.round(subscription.usageScore * 100)}%
          </Text>
        </View>
        <ProgressBar progress={subscription.usageScore * 100} color={usageColor} />
      </View>

      {/* Footer */}
      <View style={styles.subFooter}>
        <FooterStat
          label="Next bill"
          value={new Date(subscription.nextBillingDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          })}
        />
        <FooterStat
          label="Total paid"
          value={formatCurrency(subscription.totalPaid, { compact: true })}
        />
        <FooterStat label="Cycles" value={String(subscription.paymentCount)} />
      </View>

      {subscription.priceIncreasePercent && subscription.priceIncreasePercent > 10 && (
        <View style={styles.hikeAlert}>
          <TrendingUp size={14} color={Colors.accentError} strokeWidth={2} />
          <Text style={styles.hikeText}>
            {' '}
            Price rose from {formatCurrency(subscription.originalAmount ?? 0)} to{' '}
            {formatCurrency(subscription.amount)}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <Button
          title={subscription.status === 'PAUSED' ? 'Resume' : 'Pause'}
          onPress={onPause}
          variant="secondary"
          size="sm"
          leadingIcon={
            subscription.status === 'PAUSED' ? (
              <Play size={14} color={Colors.textPrimary} strokeWidth={2} />
            ) : (
              <Pause size={14} color={Colors.textPrimary} strokeWidth={2} />
            )
          }
          style={{ flex: 1 }}
        />
        <View style={{ width: Spacing.sm }} />
        <Button
          title="Cancel"
          onPress={onCancel}
          variant="destructive"
          size="sm"
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.footerLabel}>{label}</Text>
      <Text style={styles.footerValue}>{value}</Text>
    </View>
  );
}

function frequencySuffix(f: Frequency): string {
  switch (f) {
    case 'MONTHLY':
      return 'mo';
    case 'YEARLY':
      return 'yr';
    case 'WEEKLY':
      return 'wk';
    case 'QUARTERLY':
      return 'qtr';
  }
}

// =============================================================
// Cancel guide modal (dark glass)
// =============================================================
function CancelGuideModal({
  sub,
  onClose,
  onConfirm,
}: {
  sub: Subscription | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!sub) return null;
  const yearly = sub.frequency === 'MONTHLY' ? sub.amount * 12 : sub.amount;
  const steps = getCancelSteps(sub.name);

  return (
    <Modal visible={!!sub} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={[styles.modalIcon, { backgroundColor: sub.color + '22' }]}>
              <Text style={[styles.modalIconLetter, { color: sub.color }]}>
                {(sub.name?.[0] || '?').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.modalTitle} numberOfLines={1}>
              Cancel {sub.name}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={Colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={styles.savingsBlock}>
            <Text style={styles.savingsLabel}>You&apos;ll save</Text>
            <Text style={styles.savingsAmount}>{formatCurrency(yearly)}</Text>
            <Text style={styles.savingsPeriod}>per year</Text>
          </View>

          <Text style={styles.stepsTitle}>Steps to cancel</Text>
          {steps.map((step, idx) => (
            <View key={idx} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{idx + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}

          <View style={{ marginTop: Spacing.xl }}>
            <Button
              title="Mark as cancelled"
              onPress={onConfirm}
              fullWidth
              trailingIcon={<ArrowRight size={16} color={Colors.white} strokeWidth={2} />}
            />
          </View>
        </View>
      </View>
    </Modal>
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
    `Open ${name} app or website`,
    'Navigate to Account or Subscription settings',
    "Find 'Cancel subscription'",
    'Confirm cancellation',
  ];
}

// =============================================================
// Styles
// =============================================================
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
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // Hero stats
  statsCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.borderDefault,
  },

  // AI savings
  aiSavings: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  aiSavingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiSavingsIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.base,
    backgroundColor: 'rgba(34,211,238,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  aiSavingsTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
  },
  aiSavingsBody: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Chip rail
  filterTabs: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
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
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
    marginLeft: 6,
  },
  chipLabelActive: {
    color: Colors.white,
  },

  // List
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: Spacing.xl,
    textAlign: 'center',
  },

  // Sub card
  subCard: {
    marginBottom: Spacing.base,
  },
  subTop: {
    flexDirection: 'row',
  },
  subGlyph: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  subGlyphLetter: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    flexShrink: 1,
    paddingRight: Spacing.sm,
  },
  subAmount: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  subAmountUnit: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.regular,
    color: Colors.textSecondary,
  },
  subCategory: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: Spacing.xs,
  },

  // Usage
  usageBlock: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  usageLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  usageValue: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
  },

  // Footer
  subFooter: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  footerLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  footerValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
    marginTop: 2,
    fontVariant: ['tabular-nums'] as any,
  },

  // Hike alert
  hikeAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,180,171,0.10)',
    borderRadius: BorderRadius.base,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.30)',
  },
  hikeText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.accentError,
    fontWeight: Typography.weights.medium,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surfaceContainerHighest,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.outline,
    alignSelf: 'center',
    marginBottom: Spacing.base,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  modalIconLetter: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
  },
  modalTitle: {
    flex: 1,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
  },
  savingsBlock: {
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  savingsLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  savingsAmount: {
    fontSize: 40,
    lineHeight: 44,
    color: Colors.accentSuccess,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    marginVertical: 6,
  },
  savingsPeriod: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  stepsTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: Typography.sizes.xs,
    color: Colors.accentPrimary,
    fontWeight: Typography.weights.bold,
  },
  stepText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.5,
  },
});
