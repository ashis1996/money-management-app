import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { Card, Badge, Button, ProgressBar, Header } from '../../components/shared';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../../styles/theme';

interface WeekData {
  weekStart: string;
  weekEnd: string;
  totalSpent: number;
  totalIncome: number;
  netSavings: number;
  savingsRate: number;
  // vs prev week
  spendChange: number;
  savingsChange: number;
  // top categories
  topCategories: { category: string; icon: string; amount: number; trend: number }[];
  // top merchants
  topMerchants: { name: string; amount: number; transactions: number }[];
  // daily breakdown
  daily: { day: string; amount: number }[];
  // wins & insights
  wins: { icon: string; title: string; description: string }[];
  improvements: { icon: string; title: string; description: string; amount?: number }[];
  unusual: { merchant: string; amount: number; reason: string }[];
  // AI summary
  aiSummary: string;
  recommendations: { icon: string; text: string; impact: number }[];
  // streak
  streak: { days: number; type: string };
  // healthScore change
  healthScore: { current: number; change: number };
}

const mockWeek: WeekData = {
  weekStart: '2026-05-19',
  weekEnd: '2026-05-25',
  totalSpent: 11500,
  totalIncome: 18750,
  netSavings: 7250,
  savingsRate: 38.7,
  spendChange: -12, // 12% less than last week
  savingsChange: 22, // 22% more than last week
  topCategories: [
    { category: 'Food & Dining', icon: '🍔', amount: 3200, trend: -8 },
    { category: 'Shopping', icon: '🛍️', amount: 2400, trend: 35 },
    { category: 'Transport', icon: '🚗', amount: 1800, trend: -15 },
    { category: 'Bills', icon: '⚡', amount: 2100, trend: 0 },
    { category: 'Entertainment', icon: '🎬', amount: 850, trend: 5 },
  ],
  topMerchants: [
    { name: 'Swiggy', amount: 2200, transactions: 5 },
    { name: 'Amazon', amount: 1900, transactions: 2 },
    { name: 'Uber', amount: 1100, transactions: 8 },
  ],
  daily: [
    { day: 'Mon', amount: 1200 },
    { day: 'Tue', amount: 800 },
    { day: 'Wed', amount: 2400 },
    { day: 'Thu', amount: 1500 },
    { day: 'Fri', amount: 1900 },
    { day: 'Sat', amount: 2100 },
    { day: 'Sun', amount: 1600 },
  ],
  wins: [
    {
      icon: '💰',
      title: 'Saved 22% more than last week',
      description: 'Your savings of ₹7,250 is ₹1,300 more than last week.',
    },
    {
      icon: '🍔',
      title: 'Food spending down',
      description: 'Reduced food orders from 9 to 5 — saved ₹280.',
    },
    {
      icon: '🚫',
      title: 'No-Spend Day on Tuesday',
      description: 'Kept spending under ₹100 — keep it up!',
    },
  ],
  improvements: [
    {
      icon: '🛍️',
      title: 'Shopping up 35%',
      description: 'You spent ₹2,400 — ₹620 more than usual.',
      amount: 620,
    },
    {
      icon: '🌙',
      title: '4 late-night purchases',
      description: 'Spent ₹890 after 10 PM (impulse-prone hours).',
      amount: 890,
    },
  ],
  unusual: [
    {
      merchant: 'Online Store XYZ',
      amount: 1899,
      reason: '5x larger than your typical transaction',
    },
  ],
  aiSummary:
    'A solid week! You saved ₹7,250 — your highest savings rate (38.7%) in 4 weeks. Food and transport costs dropped. Watch your shopping spike (+35%) and late-night purchases (₹890) — these are the easy wins for next week.',
  recommendations: [
    {
      icon: '🛍️',
      text: 'Set a ₹500/week shopping limit',
      impact: 600,
    },
    {
      icon: '🌙',
      text: 'Use 24-hour rule for late-night buys',
      impact: 500,
    },
    {
      icon: '🍔',
      text: 'Cook 2 meals/week — save ₹400',
      impact: 400,
    },
  ],
  streak: { days: 1, type: 'No-Spend Day' },
  healthScore: { current: 70, change: 2 },
};

export function WeeklySummaryScreen({ navigation }: any) {
  const [week] = useState(mockWeek);
  const maxDaily = Math.max(...week.daily.map((d) => d.amount));

  const dateRange = formatRange(week.weekStart, week.weekEnd);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `My week of ${dateRange}:\n💰 Saved ₹${week.netSavings.toLocaleString()} (${week.savingsRate}%)\n📊 Spent ₹${week.totalSpent.toLocaleString()}\n${week.wins[0].title} 🎉\n\nTracked with MoneyMind`,
      });
    } catch {}
  };

  return (
    <View style={styles.container}>
      <Header
        title="Weekly Summary"
        subtitle={dateRange}
        onBack={() => navigation.goBack()}
        rightIcon="📤"
        onRightPress={handleShare}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* AI Summary hero */}
        <Card style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroIcon}>✨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>AI Summary</Text>
              <Text style={styles.heroDate}>Week of {dateRange}</Text>
            </View>
          </View>
          <Text style={styles.heroSummary}>{week.aiSummary}</Text>
        </Card>

        {/* Big numbers */}
        <View style={styles.bigNumbers}>
          <NumberCard
            label="Saved"
            value={week.netSavings}
            change={week.savingsChange}
            color={Colors.success}
            invertSign={false}
          />
          <NumberCard
            label="Spent"
            value={week.totalSpent}
            change={week.spendChange}
            color={Colors.error}
            invertSign
          />
        </View>

        {/* Savings rate progress */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💪 Savings Rate</Text>
            <Text style={styles.savingsRate}>{week.savingsRate}%</Text>
          </View>
          <ProgressBar
            progress={week.savingsRate}
            color={Colors.success}
            height={10}
          />
          <Text style={styles.sectionHint}>
            Target: 20%+ • You're crushing it!
          </Text>
        </Card>

        {/* Daily chart */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Daily Spending</Text>
          <View style={styles.chart}>
            {week.daily.map((d) => {
              const heightPct = (d.amount / maxDaily) * 100;
              return (
                <View key={d.day} style={styles.chartBar}>
                  <Text style={styles.chartAmount}>
                    ₹{(d.amount / 1000).toFixed(1)}k
                  </Text>
                  <View style={styles.chartTrack}>
                    <View
                      style={[
                        styles.chartFill,
                        {
                          height: `${heightPct}%`,
                          backgroundColor:
                            d.amount < 200
                              ? Colors.success
                              : d.amount > 2000
                              ? Colors.warning
                              : Colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartLabel}>{d.day}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Wins */}
        {week.wins.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎉 Wins this week</Text>
            {week.wins.map((win, idx) => (
              <Card key={idx} style={styles.winCard}>
                <View style={styles.winRow}>
                  <Text style={styles.winIcon}>{win.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.winTitle}>{win.title}</Text>
                    <Text style={styles.winDescription}>{win.description}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Improvements */}
        {week.improvements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Areas to improve</Text>
            {week.improvements.map((imp, idx) => (
              <Card key={idx} style={styles.improveCard}>
                <View style={styles.winRow}>
                  <Text style={styles.winIcon}>{imp.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.winTitle}>{imp.title}</Text>
                    <Text style={styles.winDescription}>{imp.description}</Text>
                  </View>
                  {imp.amount && (
                    <Text style={styles.impAmount}>+₹{imp.amount}</Text>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Unusual */}
        {week.unusual.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Unusual transactions</Text>
            {week.unusual.map((u, idx) => (
              <Card key={idx} style={styles.unusualCard}>
                <View style={styles.winRow}>
                  <Text style={styles.winIcon}>🔍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.winTitle}>{u.merchant}</Text>
                    <Text style={styles.winDescription}>{u.reason}</Text>
                  </View>
                  <Text style={styles.unusualAmount}>
                    ₹{u.amount.toLocaleString()}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Top Categories */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📁 Top Categories</Text>
          {week.topCategories.map((cat) => (
            <View key={cat.category} style={styles.catRow}>
              <Text style={styles.catIcon}>{cat.icon}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.catTopRow}>
                  <Text style={styles.catName}>{cat.category}</Text>
                  <Text style={styles.catAmount}>
                    ₹{cat.amount.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.catBottomRow}>
                  <View style={{ flex: 1, marginRight: Spacing.sm }}>
                    <ProgressBar
                      progress={(cat.amount / week.totalSpent) * 100}
                      color={Colors.primary}
                      height={4}
                    />
                  </View>
                  <Text
                    style={[
                      styles.catTrend,
                      {
                        color:
                          cat.trend > 10
                            ? Colors.error
                            : cat.trend < -10
                            ? Colors.success
                            : Colors.textSecondary,
                      },
                    ]}
                  >
                    {cat.trend > 0 ? '↑' : cat.trend < 0 ? '↓' : '→'}{' '}
                    {Math.abs(cat.trend)}%
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Card>

        {/* Top Merchants */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>🏪 Top Merchants</Text>
          {week.topMerchants.map((m, idx) => (
            <View key={m.name} style={styles.merchRow}>
              <View style={styles.merchRank}>
                <Text style={styles.merchRankText}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.merchName}>{m.name}</Text>
                <Text style={styles.merchMeta}>
                  {m.transactions} transactions
                </Text>
              </View>
              <Text style={styles.merchAmount}>
                ₹{m.amount.toLocaleString()}
              </Text>
            </View>
          ))}
        </Card>

        {/* Recommendations */}
        <Card style={styles.recCard}>
          <Text style={styles.recTitle}>🎯 Next week's plan</Text>
          {week.recommendations.map((rec, idx) => (
            <View key={idx} style={styles.recRow}>
              <Text style={styles.recIcon}>{rec.icon}</Text>
              <Text style={styles.recText}>{rec.text}</Text>
              <Text style={styles.recImpact}>+₹{rec.impact}</Text>
            </View>
          ))}
          <View style={styles.recTotal}>
            <Text style={styles.recTotalLabel}>Potential weekly savings</Text>
            <Text style={styles.recTotalValue}>
              ₹{week.recommendations.reduce((s, r) => s + r.impact, 0)}
            </Text>
          </View>
        </Card>

        {/* Health score change */}
        <Card style={styles.scoreCard}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreInfo}>
              <Text style={styles.scoreLabel}>Health Score</Text>
              <Text style={styles.scoreValue}>{week.healthScore.current}</Text>
              <Text
                style={[
                  styles.scoreChange,
                  {
                    color: week.healthScore.change >= 0 ? Colors.success : Colors.error,
                  },
                ]}
              >
                {week.healthScore.change > 0 ? '+' : ''}
                {week.healthScore.change} this week
              </Text>
            </View>
            <Button
              title="View Details"
              onPress={() => navigation.navigate('HealthScore')}
              variant="outline"
              size="sm"
            />
          </View>
        </Card>

        {/* Share / Done */}
        <View style={styles.actions}>
          <Button
            title="📤 Share"
            onPress={handleShare}
            variant="outline"
            style={{ flex: 1 }}
          />
          <Button
            title="Got it"
            onPress={() => navigation.goBack()}
            variant="primary"
            style={{ flex: 1, marginLeft: Spacing.sm }}
          />
        </View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

function NumberCard({
  label,
  value,
  change,
  color,
  invertSign,
}: {
  label: string;
  value: number;
  change: number;
  color: string;
  invertSign: boolean;
}) {
  // For "Spent", down is good. For "Saved", up is good.
  const positive = invertSign ? change < 0 : change > 0;
  return (
    <Card style={styles.numCard}>
      <Text style={styles.numLabel}>{label}</Text>
      <Text style={[styles.numValue, { color }]}>
        ₹{value.toLocaleString()}
      </Text>
      <View style={styles.numChange}>
        <Text
          style={[
            styles.numChangeText,
            { color: positive ? Colors.success : Colors.error },
          ]}
        >
          {change > 0 ? '↑' : '↓'} {Math.abs(change)}%
        </Text>
        <Text style={styles.numChangeMeta}> vs last week</Text>
      </View>
    </Card>
  );
}

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${s.toLocaleDateString('en-IN', opts)} - ${e.toLocaleDateString('en-IN', opts)}`;
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
    backgroundColor: Colors.primary,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  heroIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  heroLabel: {
    fontSize: Typography.sizes.xs,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
  heroDate: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  heroSummary: {
    fontSize: Typography.sizes.base,
    color: Colors.white,
    lineHeight: Typography.sizes.base * 1.6,
  },
  // Big numbers
  bigNumbers: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  numCard: {
    flex: 1,
  },
  numLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  numValue: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    marginVertical: 4,
  },
  numChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numChangeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
  },
  numChangeMeta: {
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
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  sectionHint: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  savingsRate: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.success,
  },
  // Chart
  chart: {
    flexDirection: 'row',
    height: 140,
    paddingVertical: Spacing.sm,
    justifyContent: 'space-between',
    gap: 4,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
  },
  chartAmount: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  chartTrack: {
    flex: 1,
    width: '70%',
    backgroundColor: Colors.gray100,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartFill: {
    width: '100%',
    borderRadius: 4,
  },
  chartLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  // Wins/Improvements
  winCard: {
    marginBottom: Spacing.sm,
    backgroundColor: '#D1FAE5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
  },
  improveCard: {
    marginBottom: Spacing.sm,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  unusualCard: {
    marginBottom: Spacing.sm,
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    borderWidth: 1,
  },
  winRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  winIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  winTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  winDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: Typography.sizes.sm * 1.5,
  },
  impAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.warning,
    marginLeft: Spacing.sm,
  },
  unusualAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.error,
    marginLeft: Spacing.sm,
  },
  // Categories
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  catIcon: {
    fontSize: 22,
    marginRight: Spacing.sm,
    width: 28,
  },
  catTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  catName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  catAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  catBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catTrend: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    minWidth: 50,
    textAlign: 'right',
  },
  // Merchants
  merchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  merchRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  merchRankText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  merchName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  merchMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  merchAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  // Recommendations
  recCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  recTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  recIcon: {
    fontSize: 22,
    marginRight: Spacing.sm,
    width: 28,
  },
  recText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  recImpact: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.success,
  },
  recTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.primaryLight,
  },
  recTotalLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  recTotalValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.success,
  },
  // Score
  scoreCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreInfo: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  scoreValue: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginVertical: 2,
  },
  scoreChange: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
  },
  // Actions
  actions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginVertical: Spacing.base,
  },
});
