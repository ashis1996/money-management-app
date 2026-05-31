import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Moon,
  PartyPopper,
  Zap,
  Tag,
  type LucideIcon,
} from 'lucide-react-native';
import { Badge, Card, ProgressBar, Section } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { useSpendingInsights, useBehaviorAnalysis } from '../../hooks';
import { formatCurrency } from '../../utils';

type Period = 'week' | 'month' | 'quarter' | 'year';

interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

interface BehavioralPattern {
  type: 'late_night' | 'weekend' | 'impulse';
  title: string;
  description: string;
  amount: number;
  percentage: number;
  severity: 'high' | 'medium' | 'low';
  icon: LucideIcon;
}

const CATEGORY_PALETTE = [
  '#EF4444',
  '#A78BFA',
  Colors.accentPrimary,
  Colors.accentWarning,
  '#F472B6',
  Colors.accentSuccess,
  Colors.outline,
  Colors.accentAi,
  '#F97316',
];

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

export function InsightsScreen({ navigation: _navigation }: any) {
  const [period, setPeriod] = useState<Period>('month');
  const insightsQuery = useSpendingInsights(period);
  const behaviorQuery = useBehaviorAnalysis();

  const data = useMemo(() => {
    const insights: any = insightsQuery.data;
    const empty = {
      totalSpent: 0,
      totalIncome: 0,
      savings: 0,
      savingsRate: 0,
      spentChange: 0,
      savingsChange: 0,
      topMerchants: [] as Array<{ name: string; amount: number; count: number }>,
      categories: [] as CategorySpending[],
      patterns: [] as BehavioralPattern[],
    };
    if (!insights) return empty;

    const spending: any = insights.spending ?? insights;
    const totalSpent = Number(spending.totalSpent ?? 0);
    const totalIncome = Number(spending.totalIncome ?? 0);
    const savings = Number(spending.netSavings ?? totalIncome - totalSpent);
    const savingsRate = Number(spending.savingsRate ?? 0);
    const cmp: any = spending.comparisonToPrevious ?? {};

    const topMerchants = (spending.topMerchants ?? []).map((m: any) => ({
      name: m.merchantName || m.name || 'Unknown',
      amount: Number(m.amount ?? 0),
      count: m.transactionCount ?? m.count ?? 0,
    }));

    const categories: CategorySpending[] = (spending.byCategory ?? []).map(
      (c: any, idx: number) => ({
        category: c.categoryId || c.category || 'Other',
        amount: Number(c.amount ?? 0),
        percentage: Number(c.percentage ?? 0),
        color: CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length],
      }),
    );

    const behavior: any = behaviorQuery.data;
    const patterns: BehavioralPattern[] = [];
    if (behavior) {
      const late = Number(
        behavior.lateNightSpending ?? behavior.late_night_spending ?? behavior.lateNightAmount ?? 0,
      );
      if (late > 0)
        patterns.push({
          type: 'late_night',
          title: 'Late-night spending',
          description: `${formatCurrency(late)} after 10 PM. Often impulse purchases.`,
          amount: late,
          percentage: totalSpent ? (late / totalSpent) * 100 : 0,
          severity: late > totalSpent * 0.05 ? 'high' : 'medium',
          icon: Moon,
        });

      const weekend = Number(behavior.weekendSpending ?? behavior.weekend_spending ?? 0);
      if (weekend > 0)
        patterns.push({
          type: 'weekend',
          title: 'Weekend spending',
          description: `${formatCurrency(weekend)} spent on weekends.`,
          amount: weekend,
          percentage: totalSpent ? (weekend / totalSpent) * 100 : 0,
          severity: 'medium',
          icon: PartyPopper,
        });

      const impulse = Number(behavior.impulseSpending ?? behavior.impulse_spending ?? 0);
      if (impulse > 0)
        patterns.push({
          type: 'impulse',
          title: 'Impulse purchases',
          description: `${formatCurrency(impulse)} flagged as impulse buys.`,
          amount: impulse,
          percentage: totalSpent ? (impulse / totalSpent) * 100 : 0,
          severity: 'high',
          icon: Zap,
        });
    }

    return {
      totalSpent,
      totalIncome,
      savings,
      savingsRate,
      spentChange: Number(cmp.spentChange ?? 0),
      savingsChange: Number(cmp.savingsChange ?? 0),
      topMerchants,
      categories,
      patterns,
    };
  }, [insightsQuery.data, behaviorQuery.data]);

  if (insightsQuery.isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.accentAi} />
        <Text style={styles.loadingText}>Analysing your spending…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Insights</Text>
        </View>

        {/* Period chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodTabs}
        >
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                onPress={() => setPeriod(p.key)}
                accessibilityRole="button"
                accessibilityLabel={p.label}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* AI summary hero */}
        <Card variant="ai" padding="xl">
          <View style={styles.aiHeaderRow}>
            <View style={styles.aiHeaderIcon}>
              <Sparkles size={16} color={Colors.accentAi} strokeWidth={1.75} />
            </View>
            <Text style={styles.aiHeader}>AI summary</Text>
          </View>

          <View style={styles.heroFigures}>
            <View style={styles.heroFigure}>
              <Text style={styles.heroLabel}>SPENT</Text>
              <Text style={styles.heroValue}>
                {formatCurrency(data.totalSpent, { compact: true })}
              </Text>
              <DeltaPill value={-data.spentChange} invert />
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroFigure}>
              <Text style={styles.heroLabel}>SAVED</Text>
              <Text style={[styles.heroValue, { color: Colors.accentSuccess }]}>
                {formatCurrency(data.savings, { compact: true })}
              </Text>
              <DeltaPill value={data.savingsChange} />
            </View>
          </View>

          <View style={styles.savingsRateRow}>
            <Text style={styles.savingsRateLabel}>SAVINGS RATE</Text>
            <Text style={styles.savingsRateValue}>{Math.round(data.savingsRate)}%</Text>
          </View>
          <ProgressBar progress={data.savingsRate} color={Colors.accentSuccess} />
        </Card>

        {/* Categories */}
        {data.categories.length > 0 && (
          <Section
            title="By category"
            subtitle={`${period === 'week' ? 'This week' : period === 'month' ? 'This month' : period === 'quarter' ? 'This quarter' : 'This year'} — top categories driving your spend`}
            style={{ marginTop: Spacing.lg }}
          >
            <Card padding="base">
              {/* Stacked-bar visualization (no chart lib needed) */}
              <View style={styles.stackedBar}>
                {data.categories.slice(0, 6).map((c, i) => (
                  <View
                    key={c.category + i}
                    style={{
                      flex: c.percentage,
                      backgroundColor: c.color,
                    }}
                  />
                ))}
              </View>

              <View style={{ marginTop: Spacing.base }}>
                {data.categories.slice(0, 6).map((c) => (
                  <View key={c.category} style={styles.categoryRow}>
                    <View style={[styles.categoryDot, { backgroundColor: c.color }]} />
                    <Text style={styles.categoryName} numberOfLines={1}>
                      {c.category}
                    </Text>
                    <Text style={styles.categoryAmount}>
                      {formatCurrency(c.amount, { compact: true })}
                    </Text>
                    <Text style={styles.categoryPercent}>{Math.round(c.percentage)}%</Text>
                  </View>
                ))}
              </View>
            </Card>
          </Section>
        )}

        {/* Behavioural patterns */}
        {data.patterns.length > 0 && (
          <Section
            title="Behavioural patterns"
            subtitle="When and how you tend to spend"
            highlightTitle
            style={{ marginTop: Spacing.lg }}
          >
            <View>
              {data.patterns.map((p) => (
                <PatternCard key={p.type} pattern={p} />
              ))}
            </View>
          </Section>
        )}

        {/* Top merchants */}
        {data.topMerchants.length > 0 && (
          <Section title="Top merchants" style={{ marginTop: Spacing.lg }}>
            <Card padding="base">
              {data.topMerchants
                .slice(0, 5)
                .map((m: { name: string; amount: number; count: number }, i: number) => (
                  <View
                    key={m.name + i}
                    style={[
                      styles.merchantRow,
                      i === Math.min(4, data.topMerchants.length - 1) && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={styles.merchantRank}>
                      <Text style={styles.merchantRankText}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.merchantName} numberOfLines={1}>
                        {m.name}
                      </Text>
                      <Text style={styles.merchantCount}>
                        {m.count} {m.count === 1 ? 'transaction' : 'transactions'}
                      </Text>
                    </View>
                    <Text style={styles.merchantAmount}>
                      {formatCurrency(m.amount, { compact: true })}
                    </Text>
                  </View>
                ))}
            </Card>
          </Section>
        )}

        {data.categories.length === 0 && data.totalSpent === 0 && (
          <Card style={{ marginTop: Spacing.lg }} padding="xl">
            <View style={{ alignItems: 'center' }}>
              <Tag size={32} color={Colors.outline} strokeWidth={1.5} />
              <Text
                style={{
                  marginTop: Spacing.base,
                  fontSize: Typography.sizes.lg,
                  fontWeight: Typography.weights.semiBold,
                  fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
                  color: Colors.textPrimary,
                }}
              >
                Nothing to insight yet
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: Typography.sizes.sm,
                  color: Colors.textSecondary,
                  textAlign: 'center',
                }}
              >
                Add transactions or wait for SMS auto-capture to fill in.
              </Text>
            </View>
          </Card>
        )}

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </View>
  );
}

// =============================================================
// Helpers
// =============================================================
function DeltaPill({ value, invert }: { value: number; invert?: boolean }) {
  if (Math.abs(value) < 0.5) {
    return null;
  }
  const positive = invert ? value < 0 : value > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const color = positive ? Colors.accentSuccess : Colors.accentError;
  return (
    <View style={styles.deltaPill}>
      <Icon size={12} color={color} strokeWidth={2} />
      <Text style={[styles.deltaText, { color }]}>{Math.abs(value).toFixed(0)}%</Text>
    </View>
  );
}

function PatternCard({ pattern }: { pattern: BehavioralPattern }) {
  const tone =
    pattern.severity === 'high'
      ? Colors.accentError
      : pattern.severity === 'medium'
        ? Colors.accentWarning
        : Colors.outline;
  const Icon = pattern.icon;
  return (
    <Card padding="base" style={{ marginBottom: Spacing.sm }}>
      <View style={styles.patternRow}>
        <View
          style={[styles.patternIcon, { backgroundColor: tone + '22', borderColor: tone + '44' }]}
        >
          <Icon size={18} color={tone} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.patternHeader}>
            <Text style={styles.patternTitle}>{pattern.title}</Text>
            <Badge
              text={`${Math.round(pattern.percentage)}%`}
              variant={pattern.severity === 'high' ? 'error' : 'warning'}
              size="sm"
            />
          </View>
          <Text style={styles.patternDescription}>{pattern.description}</Text>
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
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: Spacing.base,
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['3xl'] + Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  title: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    letterSpacing: -0.6,
  },

  periodTabs: {
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  chip: {
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
  },
  chipLabelActive: {
    color: Colors.white,
  },

  // AI hero
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  aiHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.base,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  aiHeader: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.accentAi,
    letterSpacing: -0.2,
  },

  heroFigures: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroFigure: {
    flex: 1,
  },
  heroLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1.2,
    fontWeight: Typography.weights.medium,
  },
  heroValue: {
    marginTop: 4,
    fontSize: 32,
    lineHeight: 36,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.8,
  },
  heroDivider: {
    width: 1,
    height: 56,
    backgroundColor: Colors.borderDefault,
    marginHorizontal: Spacing.base,
  },

  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  deltaText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    fontVariant: ['tabular-nums'] as any,
  },

  savingsRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  savingsRateLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1.2,
    fontWeight: Typography.weights.medium,
  },
  savingsRateValue: {
    fontSize: Typography.sizes.sm,
    color: Colors.accentSuccess,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
  },

  // Stacked bar viz
  stackedBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceContainerHigh,
  },

  // Category row
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  categoryName: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    paddingRight: Spacing.sm,
  },
  categoryAmount: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
    marginRight: Spacing.sm,
  },
  categoryPercent: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'] as any,
    width: 36,
    textAlign: 'right',
  },

  // Patterns
  patternRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  patternIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  patternHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  patternTitle: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
    paddingRight: Spacing.sm,
  },
  patternDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sizes.sm * 1.4,
  },

  // Merchants
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  merchantRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  merchantRankText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'] as any,
  },
  merchantName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },
  merchantCount: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  merchantAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
});
