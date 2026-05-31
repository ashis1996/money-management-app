import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Share,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {
  Sparkles,
  Trophy,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Share2,
  Flame,
} from 'lucide-react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Header,
  ProgressBar,
  Section,
} from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { useCurrentWeeklySummary, useGenerateWeeklySummary } from '../../hooks';
import { formatCurrency } from '../../utils';

interface WeekData {
  weekStart: string;
  weekEnd: string;
  totalSpent: number;
  totalIncome: number;
  netSavings: number;
  savingsRate: number;
  spendChange: number;
  savingsChange: number;
  topCategories: Array<{ category: string; amount: number; trend: number }>;
  topMerchants: Array<{ name: string; amount: number; transactions: number }>;
  daily: Array<{ day: string; amount: number }>;
  wins: Array<{ title: string; description: string }>;
  improvements: Array<{ title: string; description: string; amount?: number }>;
  unusual: Array<{ merchant: string; amount: number; reason: string }>;
  aiSummary: string;
  recommendations: Array<{ text: string; impact: number }>;
  streak: { days: number; type: string };
  healthScore: { current: number; change: number };
}

const EMPTY_WEEK: WeekData = {
  weekStart: new Date().toISOString(),
  weekEnd: new Date().toISOString(),
  totalSpent: 0,
  totalIncome: 0,
  netSavings: 0,
  savingsRate: 0,
  spendChange: 0,
  savingsChange: 0,
  topCategories: [],
  topMerchants: [],
  daily: [
    { day: 'Mon', amount: 0 },
    { day: 'Tue', amount: 0 },
    { day: 'Wed', amount: 0 },
    { day: 'Thu', amount: 0 },
    { day: 'Fri', amount: 0 },
    { day: 'Sat', amount: 0 },
    { day: 'Sun', amount: 0 },
  ],
  wins: [],
  improvements: [],
  unusual: [],
  aiSummary: '',
  recommendations: [],
  streak: { days: 0, type: 'Tracking' },
  healthScore: { current: 0, change: 0 },
};

function backendToWeekData(summary: any): WeekData {
  if (!summary) return EMPTY_WEEK;
  const stats = summary.stats || summary;
  return {
    weekStart: summary.weekStart || summary.weekStartDate || new Date().toISOString(),
    weekEnd: summary.weekEnd || summary.weekEndDate || new Date().toISOString(),
    totalSpent: Number(stats.totalSpent ?? 0),
    totalIncome: Number(stats.totalIncome ?? 0),
    netSavings: Number(stats.netSavings ?? 0),
    savingsRate: Number(stats.savingsRate ?? 0),
    spendChange: Number(stats.spendChange ?? 0),
    savingsChange: Number(stats.savingsChange ?? 0),
    topCategories: stats.topCategories ?? summary.topCategories ?? [],
    topMerchants: stats.topMerchants ?? summary.topMerchants ?? [],
    daily: stats.daily ?? EMPTY_WEEK.daily,
    wins: summary.wins ?? [],
    improvements: summary.improvements ?? [],
    unusual: summary.unusual ?? [],
    aiSummary: summary.aiSummary ?? summary.summary ?? '',
    recommendations: summary.recommendations ?? [],
    streak: summary.streak ?? EMPTY_WEEK.streak,
    healthScore: summary.healthScore ?? EMPTY_WEEK.healthScore,
  };
}

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const f = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${f(s)} – ${f(e)}`;
}

export function WeeklySummaryScreen({ navigation }: any) {
  const summaryQuery = useCurrentWeeklySummary();
  const generateSummary = useGenerateWeeklySummary();

  const week: WeekData = useMemo(() => backendToWeekData(summaryQuery.data), [summaryQuery.data]);

  const maxDaily = Math.max(1, ...week.daily.map((d) => d.amount));
  const dateRange = formatRange(week.weekStart, week.weekEnd);

  const handleShare = async () => {
    try {
      const winsTitle = week.wins[0]?.title ?? '';
      await Share.share({
        message: `My week of ${dateRange}:\nSaved ${formatCurrency(week.netSavings)} (${week.savingsRate.toFixed(1)}%)\nSpent ${formatCurrency(week.totalSpent)}\n${winsTitle ? winsTitle + '\n' : ''}\nTracked with MoneyMind`,
      });
    } catch {
      /* user cancelled */
    }
  };

  if (summaryQuery.isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.accentAi} />
      </View>
    );
  }

  if (!summaryQuery.data) {
    return (
      <View style={styles.container}>
        <Header title="Weekly Summary" onBack={() => navigation.goBack()} />
        <EmptyState
          icon="📊"
          title="No summary yet"
          message="Generate your first weekly summary to see how you\u2019re doing."
          actionLabel={generateSummary.isPending ? 'Generating…' : 'Generate now'}
          onAction={() => generateSummary.mutate(undefined)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Weekly Summary"
        subtitle={dateRange}
        onBack={() => navigation.goBack()}
        rightContent={
          <TouchableOpacity
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share"
            hitSlop={8}
            style={styles.shareBtn}
          >
            <Share2 size={16} color={Colors.textPrimary} strokeWidth={1.75} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* AI summary hero */}
        {!!week.aiSummary && (
          <Card variant="ai" padding="xl">
            <View style={styles.aiSummaryHeader}>
              <View style={styles.aiSummaryIcon}>
                <Sparkles size={16} color={Colors.accentAi} strokeWidth={1.75} />
              </View>
              <Text style={styles.aiSummaryHeaderText}>AI summary</Text>
            </View>
            <Text style={styles.aiSummaryBody}>{week.aiSummary}</Text>
          </Card>
        )}

        {/* Hero stats */}
        <Card variant="hero" padding="xl" style={{ marginTop: Spacing.lg }}>
          <View style={styles.heroRow}>
            <View style={styles.heroCol}>
              <Text style={styles.heroLabel}>SAVED</Text>
              <Text
                style={[
                  styles.heroValue,
                  {
                    color: week.netSavings >= 0 ? Colors.accentSuccess : Colors.accentError,
                  },
                ]}
              >
                {formatCurrency(week.netSavings, { compact: true })}
              </Text>
              <Text style={styles.heroDelta}>
                {week.savingsChange >= 0 ? '+' : ''}
                {week.savingsChange.toFixed(0)}% vs last week
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroCol}>
              <Text style={styles.heroLabel}>SPENT</Text>
              <Text style={styles.heroValue}>
                {formatCurrency(week.totalSpent, { compact: true })}
              </Text>
              <Text style={styles.heroDelta}>
                {week.spendChange >= 0 ? '+' : ''}
                {week.spendChange.toFixed(0)}% vs last week
              </Text>
            </View>
          </View>

          <View style={styles.heroRateRow}>
            <Text style={styles.heroRateLabel}>SAVINGS RATE</Text>
            <Text style={styles.heroRateValue}>{week.savingsRate.toFixed(1)}%</Text>
          </View>
          <ProgressBar progress={week.savingsRate} color={Colors.accentSuccess} />
        </Card>

        {/* Daily breakdown */}
        <Section title="Daily spend" style={{ marginTop: Spacing.lg }}>
          <Card padding="base">
            <View style={styles.dailyChart}>
              {week.daily.map((d) => {
                const h = Math.max(4, (d.amount / maxDaily) * 80);
                return (
                  <View key={d.day} style={styles.dailyCol}>
                    <View
                      style={{
                        width: '60%',
                        height: h,
                        borderRadius: 4,
                        backgroundColor:
                          d.amount > 0 ? Colors.accentPrimary : Colors.surfaceContainerHigh,
                      }}
                    />
                    <Text style={styles.dailyDay}>{d.day}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        </Section>

        {/* Health score */}
        {week.healthScore.current > 0 && (
          <Card padding="base" style={{ marginTop: Spacing.sm }}>
            <View style={styles.healthRow}>
              <View style={styles.healthIcon}>
                <Flame size={18} color={Colors.accentAi} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.metaLabel}>HEALTH SCORE</Text>
                <Text style={styles.metaValue}>
                  {Math.round(week.healthScore.current)}
                  <Text style={styles.healthDelta}>
                    {' '}
                    ({week.healthScore.change >= 0 ? '+' : ''}
                    {week.healthScore.change} vs last week)
                  </Text>
                </Text>
              </View>
              {week.streak.days > 0 && (
                <Badge text={`${week.streak.days}-day streak`} variant="warning" size="sm" />
              )}
            </View>
          </Card>
        )}

        {/* Wins */}
        {week.wins.length > 0 && (
          <Section title="Wins this week" style={{ marginTop: Spacing.lg }}>
            <View>
              {week.wins.map((w, i) => (
                <Card key={i} padding="base" style={[styles.winCard, { marginBottom: Spacing.sm }]}>
                  <View style={styles.winRow}>
                    <View style={styles.winIcon}>
                      <Trophy size={18} color={Colors.accentSuccess} strokeWidth={1.75} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.winTitle}>{w.title}</Text>
                      <Text style={styles.winDescription}>{w.description}</Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </Section>
        )}

        {/* Improvements */}
        {week.improvements.length > 0 && (
          <Section title="Areas to improve" style={{ marginTop: Spacing.lg }}>
            <View>
              {week.improvements.map((imp, i) => (
                <Card key={i} padding="base" style={{ marginBottom: Spacing.sm }}>
                  <View style={styles.improvementRow}>
                    <View style={styles.improvementIcon}>
                      <TrendingDown size={18} color={Colors.accentWarning} strokeWidth={1.75} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.winTitle}>{imp.title}</Text>
                      <Text style={styles.winDescription}>{imp.description}</Text>
                    </View>
                    {imp.amount !== undefined && (
                      <Text style={styles.improvementAmount}>
                        {formatCurrency(imp.amount, { compact: true })}
                      </Text>
                    )}
                  </View>
                </Card>
              ))}
            </View>
          </Section>
        )}

        {/* Unusual */}
        {week.unusual.length > 0 && (
          <Section title="Unusual spending" style={{ marginTop: Spacing.lg }}>
            <Card padding="base">
              {week.unusual.map((u, i) => (
                <View
                  key={i}
                  style={[
                    styles.unusualRow,
                    i === week.unusual.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <AlertTriangle size={14} color={Colors.accentError} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={styles.unusualMerchant} numberOfLines={1}>
                      {u.merchant}
                    </Text>
                    <Text style={styles.unusualReason} numberOfLines={1}>
                      {u.reason}
                    </Text>
                  </View>
                  <Text style={styles.unusualAmount}>{formatCurrency(u.amount)}</Text>
                </View>
              ))}
            </Card>
          </Section>
        )}

        {/* AI Recommendations */}
        {week.recommendations.length > 0 && (
          <Section
            title="Recommendations for next week"
            highlightTitle
            style={{ marginTop: Spacing.lg }}
          >
            <View>
              {week.recommendations.map((r, i) => (
                <Card key={i} variant="ai" padding="base" style={{ marginBottom: Spacing.sm }}>
                  <View style={styles.recRow}>
                    <View style={styles.recIcon}>
                      <Lightbulb size={16} color={Colors.accentAi} strokeWidth={1.75} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recText}>{r.text}</Text>
                      {!!r.impact && (
                        <Text style={styles.recImpact}>
                          Save {formatCurrency(r.impact, { compact: true })}/wk
                        </Text>
                      )}
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </Section>
        )}

        <View style={styles.footerActions}>
          <Button
            title="Share summary"
            onPress={handleShare}
            variant="secondary"
            fullWidth
            leadingIcon={<Share2 size={16} color={Colors.textPrimary} strokeWidth={2} />}
          />
        </View>

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </View>
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
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },

  // AI summary
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  aiSummaryIcon: {
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
  aiSummaryHeaderText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.accentAi,
    letterSpacing: -0.2,
  },
  aiSummaryBody: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.base * 1.5,
  },

  // Hero
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroCol: {
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
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.8,
  },
  heroDelta: {
    marginTop: 4,
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'] as any,
  },
  heroDivider: {
    width: 1,
    height: 60,
    backgroundColor: Colors.borderDefault,
    marginHorizontal: Spacing.base,
  },
  heroRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  heroRateLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1.2,
    fontWeight: Typography.weights.medium,
  },
  heroRateValue: {
    fontSize: Typography.sizes.sm,
    color: Colors.accentSuccess,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
  },

  // Daily
  dailyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
  },
  dailyCol: {
    flex: 1,
    alignItems: 'center',
  },
  dailyDay: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    letterSpacing: 0.6,
  },

  // Health
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  healthIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.base,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  metaLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    fontWeight: Typography.weights.medium,
  },
  metaValue: {
    marginTop: 2,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.4,
  },
  healthDelta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.regular,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: 0,
  },

  // Win
  winCard: {
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderColor: 'rgba(16,185,129,0.30)',
  },
  winRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  winIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.base,
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  winTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },
  winDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: Typography.sizes.sm * 1.4,
  },

  // Improvements
  improvementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  improvementIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.base,
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  improvementAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.accentWarning,
    fontVariant: ['tabular-nums'] as any,
    marginLeft: Spacing.sm,
  },

  // Unusual
  unusualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  unusualMerchant: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  unusualReason: {
    marginTop: 2,
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  unusualAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.accentError,
    fontVariant: ['tabular-nums'] as any,
  },

  // Recommendations
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  recIcon: {
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
  recText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.5,
  },
  recImpact: {
    marginTop: 4,
    fontSize: Typography.sizes.xs,
    color: Colors.accentSuccess,
    fontWeight: Typography.weights.bold,
    fontVariant: ['tabular-nums'] as any,
  },

  footerActions: {
    marginTop: Spacing.xl,
  },
});
