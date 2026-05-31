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
import { Card, Badge, Button, ProgressRing, Header, EmptyState } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius } from '../../styles/theme';
import { useMoneyLeaks } from '../../hooks';

type LeakType =
  | 'UNUSED_SUBSCRIPTION'
  | 'DUPLICATE_SERVICE'
  | 'PRICE_INCREASE'
  | 'IMPULSE_PURCHASE'
  | 'LATE_NIGHT'
  | 'SMALL_FREQUENT';

type LeakSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

interface MoneyLeak {
  id: string;
  type: LeakType;
  severity: LeakSeverity;
  title: string;
  description: string;
  monthlySavings: number;
  yearlySavings: number;
  icon: string;
  merchant?: string;
  recommendation: string;
  details?: any;
  isFixed: boolean;
}

const mockLeaks: MoneyLeak[] = [];

const LEAK_TYPE_LABELS: Record<LeakType, string> = {
  UNUSED_SUBSCRIPTION: 'Unused',
  DUPLICATE_SERVICE: 'Duplicate',
  PRICE_INCREASE: 'Price Hike',
  IMPULSE_PURCHASE: 'Impulse',
  LATE_NIGHT: 'Late Night',
  SMALL_FREQUENT: 'Small & Frequent',
};

type FilterType = 'all' | LeakSeverity;

/**
 * The AI service returns leaks in this rough shape:
 *   { type, severity, title, description, monthly_savings, yearly_savings,
 *     recommendation, merchant?, icon? }
 * Map to UI shape (keys can vary - guard for both snake and camel case).
 */
function aiToLeak(l: any, idx: number): MoneyLeak {
  const monthly = Number(l.monthlySavings ?? l.monthly_savings ?? l.potential_savings ?? 0) || 0;
  return {
    id: l.id ?? `leak-${idx}`,
    type: (l.type || 'IMPULSE_PURCHASE') as LeakType,
    severity: (l.severity || 'MEDIUM') as LeakSeverity,
    title: l.title || 'Leak detected',
    description: l.description || '',
    monthlySavings: monthly,
    yearlySavings: Number(l.yearlySavings ?? l.yearly_savings ?? monthly * 12) || 0,
    icon: l.icon || '💧',
    merchant: l.merchant,
    recommendation: l.recommendation || 'Review this spending pattern',
    isFixed: !!l.isFixed,
  };
}

export function MoneyLeaksScreen({ navigation }: any) {
  const leaksQuery = useMoneyLeaks();

  const leaks: MoneyLeak[] = useMemo(() => {
    const data = leaksQuery.data;
    const items = data?.leaks ?? [];
    return items.map((l: any, i: number) => aiToLeak(l, i));
  }, [leaksQuery.data]);

  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const visibleLeaks = useMemo(
    () =>
      leaks
        .filter((l) => !dismissedIds.has(l.id))
        .map((l) => ({ ...l, isFixed: fixedIds.has(l.id) || l.isFixed })),
    [leaks, fixedIds, dismissedIds],
  );

  const [filter, setFilter] = useState<FilterType>('all');

  const stats = useMemo(() => {
    const active = visibleLeaks.filter((l) => !l.isFixed);
    const monthlySavings = active.reduce((sum, l) => sum + l.monthlySavings, 0);
    const yearlySavings = active.reduce((sum, l) => sum + l.yearlySavings, 0);
    const fixed = visibleLeaks.filter((l) => l.isFixed);
    const fixedSavings = fixed.reduce((sum, l) => sum + l.monthlySavings, 0);

    // AI service returns score directly; fall back to local heuristic
    const aiScore =
      Number((leaksQuery.data as any)?.score ?? (leaksQuery.data as any)?.leak_score ?? 0) || 0;
    const totalSpending = 45000;
    const fallbackScore = Math.min(100, Math.round((monthlySavings / totalSpending) * 100));

    return {
      activeCount: active.length,
      monthlySavings,
      yearlySavings,
      fixedCount: fixed.length,
      fixedSavings,
      leakScore: aiScore || fallbackScore,
    };
  }, [visibleLeaks, leaksQuery.data]);

  const filteredLeaks = useMemo(() => {
    if (filter === 'all') return visibleLeaks.filter((l) => !l.isFixed);
    return visibleLeaks.filter((l) => !l.isFixed && l.severity === filter);
  }, [visibleLeaks, filter]);

  const handleFix = (leak: MoneyLeak) => {
    Alert.alert('Fix this leak?', `${leak.recommendation}\n\nSave ₹${leak.monthlySavings}/month`, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Mark Fixed',
        onPress: () => setFixedIds((prev) => new Set(prev).add(leak.id)),
      },
    ]);
  };

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  if (leaksQuery.isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Money Leaks"
        subtitle="Hidden spending hurting your savings"
        onBack={() => navigation.goBack()}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero card with leak score */}
        <Card style={styles.heroCard}>
          <View style={styles.heroContent}>
            <ProgressRing
              progress={stats.leakScore}
              size={120}
              strokeWidth={12}
              color={
                stats.leakScore > 30
                  ? Colors.error
                  : stats.leakScore > 15
                    ? Colors.warning
                    : Colors.success
              }
              backgroundColor={Colors.gray200}
            >
              <Text style={styles.heroScoreLabel}>Leak Score</Text>
              <Text style={styles.heroScoreValue}>{stats.leakScore}</Text>
              <Text style={styles.heroScoreMax}>/100</Text>
            </ProgressRing>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Monthly leaks</Text>
                <Text style={styles.heroStatValue}>₹{stats.monthlySavings.toLocaleString()}</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Yearly impact</Text>
                <Text style={[styles.heroStatValue, { color: Colors.error }]}>
                  ₹{stats.yearlySavings.toLocaleString()}
                </Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Active leaks</Text>
                <Text style={styles.heroStatValue}>{stats.activeCount}</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Fixed leaks celebration */}
        {stats.fixedCount > 0 && (
          <Card style={styles.fixedCard}>
            <View style={styles.fixedRow}>
              <Text style={styles.fixedIcon}>🎉</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.fixedTitle}>
                  {stats.fixedCount} leak{stats.fixedCount > 1 ? 's' : ''} fixed!
                </Text>
                <Text style={styles.fixedSubtitle}>
                  You're saving ₹{stats.fixedSavings.toLocaleString()}/month
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Total potential savings banner */}
        <Card style={styles.savingsBanner}>
          <Text style={styles.savingsLabel}>Potential Monthly Savings</Text>
          <Text style={styles.savingsAmount}>₹{stats.monthlySavings.toLocaleString()}</Text>
          <Text style={styles.savingsYearly}>
            That's ₹{stats.yearlySavings.toLocaleString()} a year!
          </Text>
        </Card>

        {/* Severity filters */}
        <View style={styles.filterTabs}>
          {(
            [
              { key: 'all', label: 'All', count: leaks.filter((l) => !l.isFixed).length },
              {
                key: 'HIGH',
                label: '🚨 High',
                count: leaks.filter((l) => !l.isFixed && l.severity === 'HIGH').length,
              },
              {
                key: 'MEDIUM',
                label: '⚠️ Medium',
                count: leaks.filter((l) => !l.isFixed && l.severity === 'MEDIUM').length,
              },
              {
                key: 'LOW',
                label: 'Low',
                count: leaks.filter((l) => !l.isFixed && l.severity === 'LOW').length,
              },
            ] as { key: FilterType; label: string; count: number }[]
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
              onPress={() => setFilter(tab.key)}
            >
              <Text
                style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}
              >
                {tab.label} ({tab.count})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Leaks list */}
        <View style={styles.list}>
          {filteredLeaks.length === 0 ? (
            <Card style={styles.empty}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyTitle}>No leaks in this category!</Text>
              <Text style={styles.emptyText}>Great work managing your money.</Text>
            </Card>
          ) : (
            filteredLeaks.map((leak) => (
              <LeakCard
                key={leak.id}
                leak={leak}
                onFix={() => handleFix(leak)}
                onDismiss={() => handleDismiss(leak.id)}
              />
            ))
          )}
        </View>

        {/* Tips */}
        <Card style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Tips to prevent leaks</Text>
          <Text style={styles.tipText}>• Review subscriptions monthly</Text>
          <Text style={styles.tipText}>• Set spending alerts for late-night purchases</Text>
          <Text style={styles.tipText}>• Use the 24-hour rule for non-essential buys</Text>
          <Text style={styles.tipText}>• Track small frequent expenses - they add up</Text>
        </Card>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

interface LeakCardProps {
  leak: MoneyLeak;
  onFix: () => void;
  onDismiss: () => void;
}

function LeakCard({ leak, onFix, onDismiss }: LeakCardProps) {
  const severityColors = {
    HIGH: Colors.error,
    MEDIUM: Colors.warning,
    LOW: Colors.gray400,
  };

  return (
    <Card
      style={[
        styles.leakCard,
        { borderLeftWidth: 4, borderLeftColor: severityColors[leak.severity] },
      ]}
    >
      <View style={styles.leakHeader}>
        <Text style={styles.leakIcon}>{leak.icon}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.leakTitleRow}>
            <Text style={styles.leakTitle}>{leak.title}</Text>
            <Badge
              text={LEAK_TYPE_LABELS[leak.type]}
              variant={
                leak.severity === 'HIGH' ? 'error' : leak.severity === 'MEDIUM' ? 'warning' : 'gray'
              }
              size="sm"
            />
          </View>
          <Text style={styles.leakDescription}>{leak.description}</Text>
        </View>
      </View>

      {/* Savings highlight */}
      <View style={styles.savingsRow}>
        <View style={styles.savingsItem}>
          <Text style={styles.savingsItemLabel}>Monthly</Text>
          <Text style={[styles.savingsItemValue, { color: Colors.success }]}>
            ₹{leak.monthlySavings.toLocaleString()}
          </Text>
        </View>
        <View style={styles.savingsItem}>
          <Text style={styles.savingsItemLabel}>Yearly</Text>
          <Text style={[styles.savingsItemValue, { color: Colors.success }]}>
            ₹{leak.yearlySavings.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Recommendation */}
      <View style={styles.recommendation}>
        <Text style={styles.recommendationLabel}>💡 What to do</Text>
        <Text style={styles.recommendationText}>{leak.recommendation}</Text>
      </View>

      {/* Actions */}
      <View style={styles.leakActions}>
        <Button title="Dismiss" onPress={onDismiss} variant="ghost" size="sm" style={{ flex: 1 }} />
        <Button
          title="Fix Now"
          onPress={onFix}
          variant="primary"
          size="sm"
          style={{ flex: 1, marginLeft: Spacing.sm }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Hero
  heroCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroScoreLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  heroScoreValue: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  heroScoreMax: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
  },
  heroStats: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  heroStat: {
    marginVertical: 4,
  },
  heroStatLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  heroStatValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  // Fixed
  fixedCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    backgroundColor: '#D1FAE5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
  },
  fixedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fixedIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  fixedTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: '#065F46',
  },
  fixedSubtitle: {
    fontSize: Typography.sizes.sm,
    color: '#047857',
    marginTop: 2,
  },
  // Savings banner
  savingsBanner: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  savingsLabel: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  savingsAmount: {
    fontSize: Typography.sizes['4xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginVertical: 4,
  },
  savingsYearly: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  // Filter
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  filterTab: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterTabText: {
    fontSize: Typography.sizes.xs,
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
  // Leak card
  leakCard: {
    marginBottom: Spacing.base,
  },
  leakHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  leakIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  leakTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  leakTitle: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  leakDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: Typography.sizes.sm * 1.4,
  },
  // Savings row
  savingsRow: {
    flexDirection: 'row',
    backgroundColor: '#D1FAE5',
    padding: Spacing.sm,
    borderRadius: BorderRadius.base,
    marginVertical: Spacing.sm,
  },
  savingsItem: {
    flex: 1,
    alignItems: 'center',
  },
  savingsItemLabel: {
    fontSize: Typography.sizes.xs,
    color: '#065F46',
  },
  savingsItemValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    marginTop: 2,
  },
  // Recommendation
  recommendation: {
    backgroundColor: Colors.gray50,
    padding: Spacing.sm,
    borderRadius: BorderRadius.base,
    marginBottom: Spacing.sm,
  },
  recommendationLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  recommendationText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.5,
  },
  leakActions: {
    flexDirection: 'row',
  },
  // Empty
  empty: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  // Tips
  tipsCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  tipsTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  tipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    marginVertical: 4,
    lineHeight: Typography.sizes.sm * 1.5,
  },
});
