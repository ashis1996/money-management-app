import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Card, Badge, ProgressBar, EmptyState } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, Tints } from '../../styles/theme';
import { useSpendingInsights, useBehaviorAnalysis, useCategoryBreakdown } from '../../hooks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Period = 'week' | 'month' | 'quarter' | 'year';

interface CategorySpending {
  category: string;
  icon: string;
  amount: number;
  percentage: number;
  color: string;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

interface DailySpending {
  day: string;
  amount: number;
}

interface BehavioralPattern {
  type: 'late_night' | 'weekend' | 'impulse' | 'stress';
  title: string;
  description: string;
  amount: number;
  percentage: number;
  severity: 'high' | 'medium' | 'low';
  icon: string;
}

const EMPTY_DATA = {
  totalSpent: 0,
  totalIncome: 0,
  savings: 0,
  savingsRate: 0,
  prevMonth: { spent: 0, savings: 0 },
  topMerchants: [] as { name: string; amount: number; count: number }[],
  categories: [] as CategorySpending[],
  dailySpending: [
    { day: 'Mon', amount: 0 },
    { day: 'Tue', amount: 0 },
    { day: 'Wed', amount: 0 },
    { day: 'Thu', amount: 0 },
    { day: 'Fri', amount: 0 },
    { day: 'Sat', amount: 0 },
    { day: 'Sun', amount: 0 },
  ] as DailySpending[],
  behavioralPatterns: [] as BehavioralPattern[],
};

const CATEGORY_COLORS = [
  '#EF4444',
  '#8B5CF6',
  '#3B82F6',
  '#F59E0B',
  '#EC4899',
  '#10B981',
  '#6B7280',
  '#06B6D4',
  '#F97316',
];
const CATEGORY_ICON: Record<string, string> = {
  'Food & Dining': '🍔',
  Food: '🍔',
  Shopping: '🛍️',
  Transport: '🚗',
  Bills: '⚡',
  Entertainment: '🎬',
  Health: '💊',
  Other: '📦',
  Subscription: '🔄',
};

const CHART_HEIGHT = 160;

export function InsightsScreen({ navigation }: any) {
  const [period, setPeriod] = useState<Period>('month');

  const insightsQuery = useSpendingInsights(period);
  const behaviorQuery = useBehaviorAnalysis();
  const categoryQuery = useCategoryBreakdown();

  const data = useMemo(() => {
    const insights = insightsQuery.data;
    if (!insights) return EMPTY_DATA;

    const spending: any = (insights as any).spending ?? insights;
    const totalSpent = Number(spending.totalSpent ?? 0);
    const totalIncome = Number(spending.totalIncome ?? 0);
    const savings = Number(spending.netSavings ?? totalIncome - totalSpent);
    const savingsRate = Number(spending.savingsRate ?? 0);

    const cmp: any = spending.comparisonToPrevious ?? {};
    const spentChangePct = Number(cmp.spentChange ?? 0);
    const savingsChangePct = Number(cmp.savingsChange ?? 0);

    const prevSpent = spentChangePct !== 0 ? totalSpent / (1 + spentChangePct / 100) : totalSpent;
    const prevSavings = savingsChangePct !== 0 ? savings / (1 + savingsChangePct / 100) : savings;

    const topMerchants = (spending.topMerchants ?? []).map((m: any) => ({
      name: m.merchantName || m.name || 'Unknown',
      amount: Number(m.amount ?? 0),
      count: m.transactionCount ?? m.count ?? 0,
    }));

    const categories: CategorySpending[] = (spending.byCategory ?? []).map(
      (c: any, idx: number) => ({
        category: c.categoryId || c.category || 'Other',
        icon: CATEGORY_ICON[c.categoryId || c.category] ?? '📦',
        amount: Number(c.amount ?? 0),
        percentage: Number(c.percentage ?? 0),
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
        trend: 'stable',
        changePercent: Number(c.changeFromPrevious ?? 0),
      }),
    );

    const behavior = behaviorQuery.data;
    const behavioralPatterns: BehavioralPattern[] = [];
    if (behavior) {
      const lateAmount = Number(
        behavior.lateNightSpending ?? behavior.late_night_spending ?? behavior.lateNightAmount ?? 0,
      );
      if (lateAmount > 0) {
        behavioralPatterns.push({
          type: 'late_night',
          title: 'Late-Night Spending',
          description: `You spent ₹${lateAmount.toLocaleString()} after 10 PM. These are often impulse purchases.`,
          amount: lateAmount,
          percentage: totalSpent ? (lateAmount / totalSpent) * 100 : 0,
          severity: lateAmount > totalSpent * 0.05 ? 'high' : 'medium',
          icon: '🌙',
        });
      }
      const weekendAmount = Number(behavior.weekendSpending ?? behavior.weekend_spending ?? 0);
      if (weekendAmount > 0) {
        behavioralPatterns.push({
          type: 'weekend',
          title: 'Weekend Spending',
          description: `₹${weekendAmount.toLocaleString()} spent on weekends.`,
          amount: weekendAmount,
          percentage: totalSpent ? (weekendAmount / totalSpent) * 100 : 0,
          severity: 'medium',
          icon: '🎉',
        });
      }
      const impulseAmount = Number(behavior.impulseSpending ?? behavior.impulse_spending ?? 0);
      if (impulseAmount > 0) {
        behavioralPatterns.push({
          type: 'impulse',
          title: 'Impulse Purchases',
          description: `₹${impulseAmount.toLocaleString()} flagged as impulse buys.`,
          amount: impulseAmount,
          percentage: totalSpent ? (impulseAmount / totalSpent) * 100 : 0,
          severity: 'high',
          icon: '🎯',
        });
      }
    }

    return {
      totalSpent,
      totalIncome,
      savings,
      savingsRate,
      prevMonth: { spent: prevSpent, savings: prevSavings },
      topMerchants,
      categories,
      dailySpending: EMPTY_DATA.dailySpending,
      behavioralPatterns,
    };
  }, [insightsQuery.data, behaviorQuery.data]);

  const maxDaily = useMemo(
    () => Math.max(1, ...data.dailySpending.map((d) => d.amount)),
    [data.dailySpending],
  );

  const spentChange = data.prevMonth.spent
    ? ((data.totalSpent - data.prevMonth.spent) / data.prevMonth.spent) * 100
    : 0;

  const savingsChange = data.prevMonth.savings
    ? ((data.savings - data.prevMonth.savings) / data.prevMonth.savings) * 100
    : 0;

  if (insightsQuery.isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Insights</Text>
          <Text style={styles.subtitle}>Understand your money behavior</Text>
        </View>

        {/* Period Selector */}
        <View style={styles.periodTabs}>
          {(['week', 'month', 'quarter', 'year'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodTab, period === p && styles.periodTabActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodTabText, period === p && styles.periodTabTextActive]}>
                {p[0].toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <SummaryCard
            label="Spent"
            value={data.totalSpent}
            change={spentChange}
            color={Colors.error}
            inverted
          />
          <SummaryCard
            label="Saved"
            value={data.savings}
            change={savingsChange}
            color={Colors.success}
          />
        </View>

        {/* Daily Spending Chart */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Daily Spending</Text>
          <Text style={styles.sectionSubtitle}>Last 7 days</Text>
          <View style={styles.chart}>
            {data.dailySpending.map((d, idx) => {
              const heightRatio = d.amount / maxDaily;
              const isHighSpend = d.day === 'Sat' || d.day === 'Sun';
              return (
                <View key={idx} style={styles.chartBarContainer}>
                  <Text style={styles.chartAmount}>₹{(d.amount / 1000).toFixed(1)}k</Text>
                  <View style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: `${heightRatio * 100}%`,
                          backgroundColor: isHighSpend ? Colors.warning : Colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartLabel}>{d.day}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
              <Text style={styles.legendText}>Weekend (40% higher)</Text>
            </View>
          </View>
        </Card>

        {/* Behavioral Patterns */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧠 Behavioral Patterns</Text>
          <Text style={styles.sectionSubtitle}>How you spend matters</Text>
          {data.behavioralPatterns.map((pattern) => (
            <BehavioralCard key={pattern.type} pattern={pattern} />
          ))}
        </View>

        {/* Category Breakdown */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📁 Spending by Category</Text>
          </View>

          {/* Donut visualization */}
          <View style={styles.categoryViz}>
            <View style={styles.donutContainer}>
              {/* Simplified donut: stacked colored bars */}
              <View style={styles.donut}>
                {data.categories.map((cat, idx) => (
                  <View
                    key={cat.category}
                    style={[
                      styles.donutSegment,
                      {
                        flex: cat.percentage,
                        backgroundColor: cat.color,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.donutTotal}>₹{data.totalSpent.toLocaleString()}</Text>
              <Text style={styles.donutLabel}>Total spent</Text>
            </View>
          </View>

          {/* Category list */}
          {data.categories.map((cat) => (
            <CategoryRow key={cat.category} category={cat} />
          ))}
        </Card>

        {/* Top Merchants */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>🏪 Top Merchants</Text>
          <Text style={styles.sectionSubtitle}>Where your money goes</Text>
          {data.topMerchants.map(
            (m: { name: string; amount: number; count: number }, idx: number) => {
              const maxAmount = data.topMerchants[0]?.amount ?? 1;
              return (
                <View key={m.name} style={styles.merchantRow}>
                  <View style={styles.merchantRank}>
                    <Text style={styles.merchantRankText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.merchantInfo}>
                    <View style={styles.merchantTop}>
                      <Text style={styles.merchantName}>{m.name}</Text>
                      <Text style={styles.merchantAmount}>₹{m.amount.toLocaleString()}</Text>
                    </View>
                    <ProgressBar
                      progress={(m.amount / maxAmount) * 100}
                      color={Colors.primary}
                      height={4}
                      style={{ marginTop: 4 }}
                    />
                    <Text style={styles.merchantMeta}>
                      {m.count} transactions • Avg ₹
                      {Math.round(m.amount / m.count).toLocaleString()}
                    </Text>
                  </View>
                </View>
              );
            },
          )}
        </Card>

        {/* Lifestyle Insights */}
        <Card style={[styles.section, styles.lifestyleCard]}>
          <Text style={styles.lifestyleTitle}>💡 Lifestyle Insights</Text>
          <Text style={styles.lifestyleText}>
            You spend <Text style={styles.lifestyleHighlight}>32% more on food delivery</Text> than
            similar users in your income bracket.
          </Text>
          <Text style={styles.lifestyleText}>
            Your <Text style={styles.lifestyleHighlight}>savings rate of 40%</Text> is in the top
            25% — keep it up!
          </Text>
          <Text style={styles.lifestyleText}>
            Cut <Text style={styles.lifestyleHighlight}>₹3,200/month</Text> in small purchases under
            ₹100 that you might not notice.
          </Text>
        </Card>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  change,
  color,
  inverted = false,
}: {
  label: string;
  value: number;
  change: number;
  color: string;
  inverted?: boolean;
}) {
  // For "Spent", up is bad (red); for "Saved", up is good (green)
  const isPositiveDirection = inverted ? change < 0 : change > 0;
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>₹{value.toLocaleString()}</Text>
      <View style={styles.summaryChange}>
        <Text
          style={[
            styles.summaryChangeText,
            { color: isPositiveDirection ? Colors.success : Colors.error },
          ]}
        >
          {arrow} {Math.abs(change).toFixed(1)}%
        </Text>
        <Text style={styles.summaryChangeMeta}> vs last month</Text>
      </View>
    </View>
  );
}

function CategoryRow({ category }: { category: CategorySpending }) {
  const trendIcon = category.trend === 'up' ? '↑' : category.trend === 'down' ? '↓' : '→';
  const trendColor =
    category.trend === 'up' && category.changePercent > 10
      ? Colors.error
      : category.trend === 'down'
        ? Colors.success
        : Colors.textSecondary;

  return (
    <TouchableOpacity style={styles.categoryRow}>
      <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
        <Text style={styles.categoryIconText}>{category.icon}</Text>
      </View>
      <View style={styles.categoryInfo}>
        <View style={styles.categoryTop}>
          <Text style={styles.categoryName}>{category.category}</Text>
          <Text style={styles.categoryAmount}>₹{category.amount.toLocaleString()}</Text>
        </View>
        <View style={styles.categoryBottom}>
          <View style={styles.categoryProgressContainer}>
            <ProgressBar progress={category.percentage} color={category.color} height={4} />
          </View>
          <Text style={[styles.categoryTrend, { color: trendColor }]}>
            {trendIcon} {Math.abs(category.changePercent)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function BehavioralCard({ pattern }: { pattern: BehavioralPattern }) {
  return (
    <Card style={[styles.behaviorCard, pattern.severity === 'high' && styles.behaviorCardHigh]}>
      <View style={styles.behaviorHeader}>
        <Text style={styles.behaviorIcon}>{pattern.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.behaviorTitle}>{pattern.title}</Text>
          <Text style={styles.behaviorDescription}>{pattern.description}</Text>
        </View>
        <Badge
          text={pattern.severity}
          variant={
            pattern.severity === 'high'
              ? 'error'
              : pattern.severity === 'medium'
                ? 'warning'
                : 'info'
          }
          size="sm"
        />
      </View>
      <View style={styles.behaviorStats}>
        <View style={styles.behaviorStat}>
          <Text style={styles.behaviorStatLabel}>Amount</Text>
          <Text style={styles.behaviorStatValue}>₹{pattern.amount.toLocaleString()}</Text>
        </View>
        <View style={styles.behaviorStat}>
          <Text style={styles.behaviorStatLabel}>% of spending</Text>
          <Text style={styles.behaviorStatValue}>{pattern.percentage}%</Text>
        </View>
      </View>
    </Card>
  );
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
    marginTop: 2,
  },
  // Period
  periodTabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    gap: 4,
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  periodTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.base,
  },
  periodTabActive: {
    backgroundColor: Colors.primary,
  },
  periodTabText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
  periodTabTextActive: {
    color: Colors.white,
  },
  // Summary
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.card,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
  },
  summaryLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    marginVertical: 4,
  },
  summaryChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryChangeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
  },
  summaryChangeMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
  },
  // Section
  section: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.base,
  },
  // Chart
  chart: {
    flexDirection: 'row',
    height: CHART_HEIGHT,
    paddingVertical: Spacing.sm,
    justifyContent: 'space-between',
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  chartAmount: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  chartBarTrack: {
    flex: 1,
    width: '70%',
    backgroundColor: Colors.gray100,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderRadius: 4,
  },
  chartLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  chartLegend: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.base,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  // Donut
  categoryViz: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  donutContainer: {
    width: '100%',
    alignItems: 'center',
  },
  donut: {
    flexDirection: 'row',
    height: 16,
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  donutSegment: {
    height: '100%',
  },
  donutTotal: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  donutLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  // Category row
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  categoryIconText: {
    fontSize: 18,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  categoryAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  categoryBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryProgressContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  categoryTrend: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    minWidth: 50,
    textAlign: 'right',
  },
  // Behavioral
  behaviorCard: {
    marginBottom: Spacing.sm,
  },
  behaviorCardHigh: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  behaviorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  behaviorIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  behaviorTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  behaviorDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: Typography.sizes.sm * 1.4,
  },
  behaviorStats: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  behaviorStat: {
    flex: 1,
  },
  behaviorStatLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  behaviorStatValue: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  // Merchants
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  merchantRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  merchantRankText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  merchantInfo: {
    flex: 1,
  },
  merchantTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  merchantName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  merchantAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  merchantMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  // Lifestyle
  lifestyleCard: {
    backgroundColor: Tints.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  lifestyleTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  lifestyleText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.6,
    marginBottom: Spacing.sm,
  },
  lifestyleHighlight: {
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
});
