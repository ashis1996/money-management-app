import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Card, Badge, ProgressBar } from '../../components/shared';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../../styles/theme';

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

const mockData = {
  totalSpent: 45000,
  totalIncome: 75000,
  savings: 30000,
  savingsRate: 40,
  prevMonth: { spent: 42000, savings: 28000 },
  topMerchants: [
    { name: 'Swiggy', amount: 8200, count: 15 },
    { name: 'Amazon', amount: 6500, count: 4 },
    { name: 'Uber', amount: 4200, count: 22 },
    { name: 'BookMyShow', amount: 2800, count: 3 },
    { name: 'Tata Power', amount: 4500, count: 1 },
  ],
  categories: [
    { category: 'Food & Dining', icon: '🍔', amount: 12500, percentage: 28, color: '#EF4444', trend: 'up' as const, changePercent: 18 },
    { category: 'Shopping', icon: '🛍️', amount: 9000, percentage: 20, color: '#8B5CF6', trend: 'up' as const, changePercent: 35 },
    { category: 'Transport', icon: '🚗', amount: 6500, percentage: 14, color: '#3B82F6', trend: 'down' as const, changePercent: -8 },
    { category: 'Bills', icon: '⚡', amount: 8500, percentage: 19, color: '#F59E0B', trend: 'stable' as const, changePercent: 2 },
    { category: 'Entertainment', icon: '🎬', amount: 4500, percentage: 10, color: '#EC4899', trend: 'up' as const, changePercent: 12 },
    { category: 'Health', icon: '💊', amount: 2000, percentage: 4, color: '#10B981', trend: 'stable' as const, changePercent: 0 },
    { category: 'Other', icon: '📦', amount: 2000, percentage: 4, color: '#6B7280', trend: 'down' as const, changePercent: -15 },
  ] as CategorySpending[],
  dailySpending: [
    { day: 'Mon', amount: 1200 },
    { day: 'Tue', amount: 800 },
    { day: 'Wed', amount: 2400 },
    { day: 'Thu', amount: 1500 },
    { day: 'Fri', amount: 3200 },
    { day: 'Sat', amount: 4500 },
    { day: 'Sun', amount: 3800 },
  ] as DailySpending[],
  behavioralPatterns: [
    {
      type: 'late_night' as const,
      title: 'Late-Night Spending',
      description: 'You spend ₹2,500/month after 10 PM. These are often impulse purchases.',
      amount: 2500,
      percentage: 5.5,
      severity: 'high' as const,
      icon: '🌙',
    },
    {
      type: 'weekend' as const,
      title: 'Weekend Spending',
      description: 'You spend 40% more on weekends. Top categories: Food, Entertainment.',
      amount: 8300,
      percentage: 18.4,
      severity: 'medium' as const,
      icon: '🎉',
    },
    {
      type: 'impulse' as const,
      title: 'Impulse Purchases',
      description: '12 transactions look impulsive. Total: ₹4,200',
      amount: 4200,
      percentage: 9.3,
      severity: 'high' as const,
      icon: '🎯',
    },
  ] as BehavioralPattern[],
};

const CHART_HEIGHT = 160;

export function InsightsScreen({ navigation }: any) {
  const [period, setPeriod] = useState<Period>('month');

  const maxDaily = useMemo(
    () => Math.max(...mockData.dailySpending.map((d) => d.amount)),
    []
  );

  const spentChange =
    ((mockData.totalSpent - mockData.prevMonth.spent) / mockData.prevMonth.spent) * 100;

  const savingsChange =
    ((mockData.savings - mockData.prevMonth.savings) / mockData.prevMonth.savings) * 100;

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
              <Text
                style={[
                  styles.periodTabText,
                  period === p && styles.periodTabTextActive,
                ]}
              >
                {p[0].toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <SummaryCard
            label="Spent"
            value={mockData.totalSpent}
            change={spentChange}
            color={Colors.error}
            inverted
          />
          <SummaryCard
            label="Saved"
            value={mockData.savings}
            change={savingsChange}
            color={Colors.success}
          />
        </View>

        {/* Daily Spending Chart */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Daily Spending</Text>
          <Text style={styles.sectionSubtitle}>Last 7 days</Text>
          <View style={styles.chart}>
            {mockData.dailySpending.map((d, idx) => {
              const heightRatio = d.amount / maxDaily;
              const isHighSpend = d.day === 'Sat' || d.day === 'Sun';
              return (
                <View key={idx} style={styles.chartBarContainer}>
                  <Text style={styles.chartAmount}>
                    ₹{(d.amount / 1000).toFixed(1)}k
                  </Text>
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
              <View
                style={[styles.legendDot, { backgroundColor: Colors.warning }]}
              />
              <Text style={styles.legendText}>Weekend (40% higher)</Text>
            </View>
          </View>
        </Card>

        {/* Behavioral Patterns */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧠 Behavioral Patterns</Text>
          <Text style={styles.sectionSubtitle}>How you spend matters</Text>
          {mockData.behavioralPatterns.map((pattern) => (
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
                {mockData.categories.map((cat, idx) => (
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
              <Text style={styles.donutTotal}>
                ₹{mockData.totalSpent.toLocaleString()}
              </Text>
              <Text style={styles.donutLabel}>Total spent</Text>
            </View>
          </View>

          {/* Category list */}
          {mockData.categories.map((cat) => (
            <CategoryRow key={cat.category} category={cat} />
          ))}
        </Card>

        {/* Top Merchants */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>🏪 Top Merchants</Text>
          <Text style={styles.sectionSubtitle}>Where your money goes</Text>
          {mockData.topMerchants.map((m, idx) => {
            const maxAmount = mockData.topMerchants[0].amount;
            return (
              <View key={m.name} style={styles.merchantRow}>
                <View style={styles.merchantRank}>
                  <Text style={styles.merchantRankText}>{idx + 1}</Text>
                </View>
                <View style={styles.merchantInfo}>
                  <View style={styles.merchantTop}>
                    <Text style={styles.merchantName}>{m.name}</Text>
                    <Text style={styles.merchantAmount}>
                      ₹{m.amount.toLocaleString()}
                    </Text>
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
          })}
        </Card>

        {/* Lifestyle Insights */}
        <Card style={[styles.section, styles.lifestyleCard]}>
          <Text style={styles.lifestyleTitle}>💡 Lifestyle Insights</Text>
          <Text style={styles.lifestyleText}>
            You spend <Text style={styles.lifestyleHighlight}>32% more on food delivery</Text> than similar users in your income bracket.
          </Text>
          <Text style={styles.lifestyleText}>
            Your <Text style={styles.lifestyleHighlight}>savings rate of 40%</Text> is{' '}
            in the top 25% — keep it up!
          </Text>
          <Text style={styles.lifestyleText}>
            Cut <Text style={styles.lifestyleHighlight}>₹3,200/month</Text> in small purchases under ₹100 that you might not notice.
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
      <Text style={[styles.summaryValue, { color }]}>
        ₹{value.toLocaleString()}
      </Text>
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
  const trendIcon =
    category.trend === 'up' ? '↑' : category.trend === 'down' ? '↓' : '→';
  const trendColor =
    category.trend === 'up' && category.changePercent > 10
      ? Colors.error
      : category.trend === 'down'
      ? Colors.success
      : Colors.textSecondary;

  return (
    <TouchableOpacity style={styles.categoryRow}>
      <View
        style={[
          styles.categoryIcon,
          { backgroundColor: category.color + '20' },
        ]}
      >
        <Text style={styles.categoryIconText}>{category.icon}</Text>
      </View>
      <View style={styles.categoryInfo}>
        <View style={styles.categoryTop}>
          <Text style={styles.categoryName}>{category.category}</Text>
          <Text style={styles.categoryAmount}>
            ₹{category.amount.toLocaleString()}
          </Text>
        </View>
        <View style={styles.categoryBottom}>
          <View style={styles.categoryProgressContainer}>
            <ProgressBar
              progress={category.percentage}
              color={category.color}
              height={4}
            />
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
    <Card
      style={[
        styles.behaviorCard,
        pattern.severity === 'high' && styles.behaviorCardHigh,
      ]}
    >
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
          <Text style={styles.behaviorStatValue}>
            ₹{pattern.amount.toLocaleString()}
          </Text>
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
    backgroundColor: '#EEF2FF',
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
