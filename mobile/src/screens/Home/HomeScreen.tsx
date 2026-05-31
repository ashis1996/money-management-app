import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import { Card, Badge, Button, ProgressRing, ProgressBar } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, Tints } from '../../styles/theme';
import {
  useDashboard,
  useHealthScore,
  useMoneyLeaks,
  useActionCards,
  useGoals,
  useUpcomingSubscriptions,
  useArchetype,
  useSubscriptions,
} from '../../hooks';
import {
  formatCurrency,
  getArchetypeLabel,
  getGreeting,
  getHealthColor,
  getHealthRating,
  widgetOrderFor,
  dayDiff,
} from '../../utils';
import type { Archetype, HealthScoreFactor, Priority } from '../../types';

// =============================================================
// Local "view-model" shape — the screen's flattened, defensive
// projection of all the queries it merges. Replaces the old
// `MockData` interface; "Mock" in the name was a relic.
// =============================================================
interface DashboardVm {
  archetype: Archetype;
  healthScore: number;
  healthFactors: HealthScoreFactor[];
  leakScore: number;
  monthlySpent: number;
  monthlyIncome: number;
  monthlySavings: number;
  potentialSavings: number;
  upcomingDues: number;
  activeSubscriptions: number;
  goalProgress: number;
  topGoal: { name: string; progress: number; target: number; current: number };
  actionCards: Array<{
    id: string;
    title: string;
    description: string;
    priority: Priority;
    impact: number;
    icon: string;
  }>;
  topLeaks: Array<{
    type: string;
    merchant?: string;
    amount: number;
    description: string;
  }>;
  upcomingPayments: Array<{
    id: string;
    name: string;
    amount: number;
    dueIn: number;
    icon: string;
  }>;
  forecast: { daysLeft: number; balance: number };
}

const EMPTY_VM: DashboardVm = {
  archetype: 'BALANCED',
  healthScore: 0,
  healthFactors: [],
  leakScore: 0,
  monthlySpent: 0,
  monthlyIncome: 0,
  monthlySavings: 0,
  potentialSavings: 0,
  upcomingDues: 0,
  activeSubscriptions: 0,
  goalProgress: 0,
  topGoal: { name: 'No goals yet', progress: 0, target: 0, current: 0 },
  actionCards: [],
  topLeaks: [],
  upcomingPayments: [],
  forecast: { daysLeft: 0, balance: 0 },
};

/**
 * Default colour mapping for health-score factor rows when the API
 * doesn't supply a colour. Falls back to a neutral tone for unknown labels.
 */
function colorForFactor(label: string): string {
  const key = label.toLowerCase();
  if (key.includes('saving')) return Colors.primary;
  if (key.includes('budget')) return Colors.success;
  if (key.includes('subscription')) return Colors.warning;
  if (key.includes('impulse') || key.includes('control')) return Colors.error;
  if (key.includes('debt') || key.includes('credit')) return Colors.warning;
  return Colors.primary;
}

export function HomeScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  const dashboardQuery = useDashboard();
  const healthQuery = useHealthScore();
  const leaksQuery = useMoneyLeaks();
  const cardsQuery = useActionCards({ status: 'PENDING' });
  const goalsQuery = useGoals({ isCompleted: false });
  const upcomingSubs = useUpcomingSubscriptions(14);
  const archetypeQuery = useArchetype();
  const allSubs = useSubscriptions('ACTIVE');

  // ---- Loading / error gates --------------------------------------------
  // First paint: until at least one query has produced data, show a
  // full-screen loader instead of an "empty" dashboard. Once any data
  // arrives we render the real screen and individual widgets show their
  // own zero/empty states.
  const queries = [
    dashboardQuery,
    healthQuery,
    leaksQuery,
    cardsQuery,
    goalsQuery,
    upcomingSubs,
    archetypeQuery,
    allSubs,
  ];
  const anyLoaded = queries.some((q) => q.data !== undefined);
  const allFailed = queries.every((q) => q.isError && q.data === undefined);
  const initialLoading = !anyLoaded && queries.some((q) => q.isFetching);

  // ---- Build the view-model ---------------------------------------------
  const data: DashboardVm = useMemo(() => {
    const dash = dashboardQuery.data ?? {};
    const health = healthQuery.data ?? {};
    const leaks = leaksQuery.data ?? {};
    const cards = cardsQuery.data ?? [];
    const goals = goalsQuery.data ?? [];
    const upcoming = upcomingSubs.data ?? [];
    const subs = allSubs.data ?? [];

    const archetype: Archetype = ((archetypeQuery.data?.archetype as Archetype | undefined) ||
      ((user as any)?.archetype as Archetype) ||
      'BALANCED') as Archetype;

    const healthScore = Number((health as any).score ?? (health as any).healthScore ?? 0);
    const rawFactors: HealthScoreFactor[] = Array.isArray((health as any).factors)
      ? (health as any).factors
      : [];

    const leakScore = Number((leaks as any).score ?? (leaks as any).leak_score ?? 0);
    const potentialSavings = Number(
      (leaks as any).potential_monthly_savings ??
        (leaks as any).potentialMonthlySavings ??
        (leaks as any).monthly_savings ??
        0,
    );

    const monthlySpent = Number((dash as any).monthlyExpense ?? 0);
    const monthlyIncome = Number((dash as any).monthlyIncome ?? 0);
    const monthlySavings = Number((dash as any).netSavings ?? monthlyIncome - monthlySpent);

    const upcomingDues = upcoming.reduce((sum: number, u: any) => sum + Number(u.amount ?? 0), 0);

    const goalsList = (goals ?? []).filter((g: any) => !g.isCompleted);
    const topGoalRaw = goalsList[0];
    const topGoal = topGoalRaw
      ? {
          name: topGoalRaw.name,
          progress: Number(topGoalRaw.progressPercent ?? 0),
          target: Number(topGoalRaw.targetAmount ?? 0),
          current: Number(topGoalRaw.currentAmount ?? 0),
        }
      : EMPTY_VM.topGoal;

    const overallProgress =
      goalsList.length > 0
        ? goalsList.reduce((sum: number, g: any) => sum + Number(g.progressPercent ?? 0), 0) /
          goalsList.length
        : 0;

    const topLeaks = ((leaks as any).leaks ?? []).slice(0, 3).map((l: any) => ({
      type: l.title || l.type || 'Leak',
      merchant: l.merchant,
      amount: Number(l.monthly_savings ?? l.monthlySavings ?? l.amount ?? 0),
      description: l.description || '',
    }));

    const actionCards = (cards ?? []).slice(0, 3).map((c: any) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      priority: (c.priority || 'MEDIUM') as Priority,
      impact: Number(c.impactAmount ?? 0),
      icon: '💡',
    }));

    const upcomingPayments = upcoming.slice(0, 3).map((u: any, i: number) => ({
      id: u.id || `p${i}`,
      name: u.name,
      amount: Number(u.amount ?? 0),
      dueIn: u.nextBillingDate ? dayDiff(u.nextBillingDate) : 0,
      icon: '🔔',
    }));

    const dailyBurn = monthlySpent / 30;
    const balance = Number((dash as any).totalBalance ?? 0);
    const daysLeft = dailyBurn > 0 ? Math.floor(balance / dailyBurn) : 30;

    return {
      archetype,
      healthScore,
      healthFactors: rawFactors,
      leakScore,
      monthlySpent,
      monthlyIncome,
      monthlySavings,
      potentialSavings,
      upcomingDues,
      activeSubscriptions: subs.length,
      goalProgress: Math.round(overallProgress),
      topGoal,
      actionCards,
      topLeaks,
      upcomingPayments,
      forecast: { daysLeft, balance },
    };
  }, [
    dashboardQuery.data,
    healthQuery.data,
    leaksQuery.data,
    cardsQuery.data,
    goalsQuery.data,
    upcomingSubs.data,
    archetypeQuery.data,
    allSubs.data,
    user,
  ]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dashboardQuery.refetch(),
        healthQuery.refetch(),
        leaksQuery.refetch(),
        cardsQuery.refetch(),
        goalsQuery.refetch(),
        upcomingSubs.refetch(),
        archetypeQuery.refetch(),
        allSubs.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Personalised widget order driven by archetype. Centralised in
  // utils/archetype.ts so the web app can share the same logic.
  const widgetOrder = useMemo(() => widgetOrderFor(data.archetype), [data.archetype]);

  // ---- Early returns: full-screen loader / error ------------------------
  if (initialLoading) {
    return <FullScreenLoader />;
  }

  if (allFailed) {
    return <FullScreenError onRetry={onRefresh} />;
  }

  const widgets: Record<string, React.ReactNode> = {
    health: (
      <HealthScoreWidget
        key="health"
        score={data.healthScore}
        factors={data.healthFactors}
        navigation={navigation}
      />
    ),
    leaks: (
      <MoneyLeaksWidget
        key="leaks"
        leaks={data.topLeaks}
        potentialSavings={data.potentialSavings}
        navigation={navigation}
      />
    ),
    actions: <ActionCardsWidget key="actions" cards={data.actionCards} navigation={navigation} />,
    spending: (
      <SpendingWidget
        key="spending"
        spent={data.monthlySpent}
        income={data.monthlyIncome}
        savings={data.monthlySavings}
      />
    ),
    subscriptions: (
      <SubscriptionsWidget
        key="subscriptions"
        count={data.activeSubscriptions}
        dues={data.upcomingDues}
        navigation={navigation}
      />
    ),
    goals: <GoalsWidget key="goals" goal={data.topGoal} navigation={navigation} />,
    forecast: <ForecastWidget key="forecast" forecast={data.forecast} />,
    payments: <UpcomingPaymentsWidget key="payments" payments={data.upcomingPayments} />,
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Badge text={getArchetypeLabel(data.archetype)} variant="primary" size="sm" />
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
              style={styles.bellButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Text style={styles.bellIcon}>🔔</Text>
              <View style={styles.bellBadge} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open AI assistant"
              style={styles.aiButton}
              onPress={() => navigation.navigate('AIAssistant')}
            >
              <Text style={styles.aiButtonIcon}>🤖</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <QuickAction
            icon="➕"
            label="Add"
            onPress={() => navigation.navigate('AddTransaction')}
          />
          <QuickAction icon="🎯" label="Goals" onPress={() => navigation.navigate('Goals')} />
          <QuickAction icon="📊" label="Budgets" onPress={() => navigation.navigate('Budgets')} />
          <QuickAction icon="💧" label="Leaks" onPress={() => navigation.navigate('MoneyLeaks')} />
        </View>

        {/* Personalised widgets */}
        {widgetOrder.map((key) => widgets[key]).filter(Boolean)}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

// ==================== STATE COMPONENTS ====================

function FullScreenLoader() {
  return (
    <View style={styles.fullScreenState}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.fullScreenStateText}>Loading your dashboard…</Text>
    </View>
  );
}

function FullScreenError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.fullScreenState}>
      <Text style={styles.fullScreenStateIcon}>⚠️</Text>
      <Text style={styles.fullScreenStateTitle}>Couldn't load dashboard</Text>
      <Text style={styles.fullScreenStateText}>Check your connection and try again.</Text>
      <View style={{ marginTop: Spacing.lg, alignSelf: 'stretch' }}>
        <Button title="Retry" onPress={onRetry} fullWidth />
      </View>
    </View>
  );
}

// ==================== WIDGETS ====================

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.quickAction}
      onPress={onPress}
    >
      <View style={styles.quickActionIcon}>
        <Text style={styles.quickActionIconText}>{icon}</Text>
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function HealthScoreWidget({
  score,
  factors,
  navigation,
}: {
  score: number;
  factors: HealthScoreFactor[];
  navigation: any;
}) {
  const color = getHealthColor(score);

  // When the AI service hasn't returned factor data we hide the right
  // column instead of fabricating numbers — that was the prior bug.
  const visibleFactors = factors.slice(0, 4);

  return (
    <Card onPress={() => navigation.navigate('HealthScore')} style={styles.widget}>
      <View style={styles.widgetHeader}>
        <View>
          <Text style={styles.widgetTitle}>Financial Health</Text>
          <Text style={styles.widgetSubtitle}>{getHealthRating(score)}</Text>
        </View>
        <Badge text="View Details" variant="primary" size="sm" />
      </View>
      <View style={styles.healthContent}>
        <ProgressRing
          progress={score}
          size={120}
          strokeWidth={12}
          color={color}
          showPercentage
          label="Score"
        />
        {visibleFactors.length > 0 ? (
          <View style={styles.healthFactors}>
            {visibleFactors.map((f) => (
              <FactorRow
                key={f.label}
                label={f.label}
                value={Number(f.value ?? 0)}
                color={f.color || colorForFactor(f.label)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.healthFactors}>
            <Text style={styles.factorsEmptyText}>
              Connect transactions or run an analysis to see what's driving your score.
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

function FactorRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.factorRow}>
      <View style={styles.factorHeader}>
        <Text style={styles.factorLabel}>{label}</Text>
        <Text style={[styles.factorValue, { color }]}>{value}</Text>
      </View>
      <ProgressBar progress={value} color={color} height={4} />
    </View>
  );
}

function MoneyLeaksWidget({
  leaks,
  potentialSavings,
  navigation,
}: {
  leaks: DashboardVm['topLeaks'];
  potentialSavings: number;
  navigation: any;
}) {
  return (
    <Card
      onPress={() => navigation.navigate('MoneyLeaks')}
      style={[styles.widget, styles.leakWidget]}
    >
      <View style={styles.widgetHeader}>
        <View style={styles.widgetTitleRow}>
          <Text style={styles.leakIcon}>💧</Text>
          <Text style={styles.widgetTitle}>Money Leaks</Text>
        </View>
        <Badge
          text={`${leaks.length} found`}
          variant={leaks.length > 0 ? 'error' : 'info'}
          size="sm"
        />
      </View>
      <Text style={styles.leakSavings}>
        Save up to{' '}
        <Text style={styles.leakAmount}>
          {formatCurrency(potentialSavings, { compact: true })}/mo
        </Text>
      </Text>
      {leaks.length === 0 ? (
        <Text style={styles.emptyHint}>
          No leaks detected — nice work. Run a fresh analysis from the Money Leaks screen.
        </Text>
      ) : (
        leaks.slice(0, 3).map((leak, idx) => (
          <View key={`${leak.type}-${idx}`} style={styles.leakRow}>
            <Text style={styles.leakType} numberOfLines={1}>
              • {leak.type}
            </Text>
            <Text style={styles.leakValue}>{formatCurrency(leak.amount)}</Text>
          </View>
        ))
      )}
    </Card>
  );
}

function ActionCardsWidget({
  cards,
  navigation,
}: {
  cards: DashboardVm['actionCards'];
  navigation: any;
}) {
  if (cards.length === 0) return null;
  return (
    <View style={styles.widget}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🎯 Fix My Finances</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Insights')}>
          <Text style={styles.linkText}>See all</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={cards}
        horizontal
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionList}
        renderItem={({ item }) => <ActionCardItem card={item} />}
      />
    </View>
  );
}

function ActionCardItem({ card }: { card: DashboardVm['actionCards'][0] }) {
  const variant: 'error' | 'warning' | 'info' =
    card.priority === 'URGENT' ? 'error' : card.priority === 'HIGH' ? 'warning' : 'info';

  return (
    <Card style={styles.actionCard} variant="outlined">
      <View style={styles.actionCardHeader}>
        <Text style={styles.actionCardIcon}>{card.icon}</Text>
        <Badge text={card.priority} variant={variant} size="sm" />
      </View>
      <Text style={styles.actionCardTitle}>{card.title}</Text>
      <Text style={styles.actionCardDescription} numberOfLines={2}>
        {card.description}
      </Text>
      <View style={styles.actionCardFooter}>
        <Text style={styles.actionCardImpact}>
          Save {formatCurrency(card.impact, { compact: true })}/mo
        </Text>
      </View>
    </Card>
  );
}

function SpendingWidget({
  spent,
  income,
  savings,
}: {
  spent: number;
  income: number;
  savings: number;
}) {
  const savingsRate = income > 0 ? Math.max(0, Math.round((savings / income) * 100)) : 0;

  return (
    <Card style={styles.widget}>
      <Text style={styles.widgetTitle}>This Month</Text>
      <View style={styles.spendingRow}>
        <View style={styles.spendingItem}>
          <Text style={styles.spendingLabel}>Income</Text>
          <Text style={[styles.spendingAmount, { color: Colors.success }]}>
            +{formatCurrency(income, { compact: true })}
          </Text>
        </View>
        <View style={styles.spendingDivider} />
        <View style={styles.spendingItem}>
          <Text style={styles.spendingLabel}>Spent</Text>
          <Text style={[styles.spendingAmount, { color: Colors.error }]}>
            -{formatCurrency(spent, { compact: true })}
          </Text>
        </View>
        <View style={styles.spendingDivider} />
        <View style={styles.spendingItem}>
          <Text style={styles.spendingLabel}>Saved</Text>
          <Text style={[styles.spendingAmount, { color: Colors.primary }]}>
            {formatCurrency(savings, { compact: true })}
          </Text>
        </View>
      </View>
      <View style={styles.savingsRateContainer}>
        <Text style={styles.savingsRateLabel}>Savings Rate</Text>
        <Text style={styles.savingsRateValue}>{savingsRate}%</Text>
      </View>
      <ProgressBar progress={savingsRate} color={Colors.primary} />
    </Card>
  );
}

function SubscriptionsWidget({
  count,
  dues,
  navigation,
}: {
  count: number;
  dues: number;
  navigation: any;
}) {
  return (
    <Card onPress={() => navigation.navigate('Subscriptions')} style={styles.widget}>
      <View style={styles.widgetHeader}>
        <Text style={styles.widgetTitle}>🔄 Subscriptions</Text>
        <Text style={styles.linkText}>Manage →</Text>
      </View>
      <View style={styles.subscriptionStats}>
        <View style={styles.subStat}>
          <Text style={styles.subStatValue}>{count}</Text>
          <Text style={styles.subStatLabel}>Active</Text>
        </View>
        <View style={styles.subStat}>
          <Text style={styles.subStatValue}>{formatCurrency(dues, { compact: true })}</Text>
          <Text style={styles.subStatLabel}>Upcoming Dues</Text>
        </View>
      </View>
    </Card>
  );
}

function GoalsWidget({ goal, navigation }: { goal: DashboardVm['topGoal']; navigation: any }) {
  const remaining = Math.max(0, goal.target - goal.current);
  return (
    <Card onPress={() => navigation.navigate('Goals')} style={styles.widget}>
      <View style={styles.widgetHeader}>
        <Text style={styles.widgetTitle}>🎯 Top Goal</Text>
        <Text style={styles.linkText}>All goals →</Text>
      </View>
      <View style={styles.goalContent}>
        <ProgressRing progress={goal.progress} size={80} strokeWidth={8} color={Colors.success} />
        <View style={styles.goalInfo}>
          <Text style={styles.goalName}>{goal.name}</Text>
          <Text style={styles.goalAmount}>
            {formatCurrency(goal.current)} / {formatCurrency(goal.target)}
          </Text>
          <Text style={styles.goalRemaining}>{formatCurrency(remaining)} to go</Text>
        </View>
      </View>
    </Card>
  );
}

function ForecastWidget({ forecast }: { forecast: DashboardVm['forecast'] }) {
  return (
    <Card style={[styles.widget, styles.forecastWidget]}>
      <View style={styles.forecastHeader}>
        <Text style={styles.forecastIcon}>🔮</Text>
        <Text style={styles.widgetTitle}>Cash Flow Forecast</Text>
      </View>
      <Text style={styles.forecastMessage}>At current pace, your money will last</Text>
      <Text style={styles.forecastDays}>{forecast.daysLeft} days</Text>
      <Text style={styles.forecastBalance}>
        Predicted end-of-month: {formatCurrency(forecast.balance)}
      </Text>
    </Card>
  );
}

function UpcomingPaymentsWidget({ payments }: { payments: DashboardVm['upcomingPayments'] }) {
  if (payments.length === 0) return null;
  return (
    <Card style={styles.widget}>
      <Text style={styles.widgetTitle}>Upcoming Payments</Text>
      {payments.map((p) => (
        <View key={p.id} style={styles.paymentRow}>
          <Text style={styles.paymentIcon}>{p.icon}</Text>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentName}>{p.name}</Text>
            <Text style={styles.paymentDue}>
              {p.dueIn === 0 ? 'Due today' : `Due in ${p.dueIn} days`}
            </Text>
          </View>
          <Text style={styles.paymentAmount}>{formatCurrency(p.amount)}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingTop: Spacing['3xl'] + Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  fullScreenState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  fullScreenStateIcon: {
    fontSize: 48,
    marginBottom: Spacing.base,
  },
  fullScreenStateTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  fullScreenStateText: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  greeting: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 2,
    marginBottom: Spacing.xs,
  },
  aiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiButtonIcon: {
    fontSize: 24,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellIcon: {
    fontSize: 22,
  },
  bellBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  quickAction: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  quickActionIconText: {
    fontSize: 24,
  },
  quickActionLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  widget: {
    marginBottom: Spacing.base,
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  widgetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  widgetTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  widgetSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  linkText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
  },
  emptyHint: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  // Health Score
  healthContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthFactors: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  factorsEmptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  factorRow: {
    marginBottom: Spacing.sm,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  factorLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    flexShrink: 1,
    paddingRight: Spacing.xs,
  },
  factorValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
  },
  // Money Leaks
  leakWidget: {
    backgroundColor: Tints.errorBg,
    borderWidth: 1,
    borderColor: Tints.errorBorder,
  },
  leakIcon: {
    fontSize: 20,
    marginRight: Spacing.xs,
  },
  leakSavings: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  leakAmount: {
    color: Colors.success,
    fontWeight: Typography.weights.bold,
    fontSize: Typography.sizes.lg,
  },
  leakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  leakType: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    flexShrink: 1,
    paddingRight: Spacing.sm,
  },
  leakValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.error,
  },
  // Action Cards
  actionList: {
    paddingHorizontal: Spacing.xs,
  },
  actionCard: {
    width: 220,
    marginRight: Spacing.sm,
  },
  actionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  actionCardIcon: {
    fontSize: 28,
  },
  actionCardTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  actionCardDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: Typography.sizes.sm * 1.4,
  },
  actionCardFooter: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionCardImpact: {
    fontSize: Typography.sizes.sm,
    color: Colors.success,
    fontWeight: Typography.weights.semiBold,
  },
  // Spending
  spendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  spendingItem: {
    flex: 1,
    alignItems: 'center',
  },
  spendingLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  spendingAmount: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
  },
  spendingDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  savingsRateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.base,
    marginBottom: Spacing.xs,
  },
  savingsRateLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  savingsRateValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  // Subscriptions
  subscriptionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.sm,
  },
  subStat: {
    alignItems: 'center',
  },
  subStatValue: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  subStatLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  // Goals
  goalContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  goalName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  goalAmount: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  goalRemaining: {
    fontSize: Typography.sizes.xs,
    color: Colors.success,
    fontWeight: Typography.weights.medium,
  },
  // Forecast
  forecastWidget: {
    backgroundColor: Colors.primary,
  },
  forecastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  forecastIcon: {
    fontSize: 24,
    marginRight: Spacing.xs,
  },
  forecastMessage: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  forecastDays: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginVertical: Spacing.xs,
  },
  forecastBalance: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.9)',
  },
  // Payments
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  paymentIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  paymentDue: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  paymentAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
});
