import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, FlatList } from 'react-native';
import {
  Bell,
  Plus,
  Target,
  PieChart,
  Droplet,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Calendar,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth.store';
import {
  AiOrb,
  Badge,
  Card,
  IconButton,
  ProgressBar,
  ProgressRing,
  Section,
  Skeleton,
  Button,
} from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
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
  getHealthRating,
  widgetOrderFor,
  dayDiff,
} from '../../utils';
import type { Archetype, HealthScoreFactor, Priority } from '../../types';

// =============================================================
// View-model: a flattened, defensive projection of every query the
// dashboard merges. Lives at the top of the file so widget props are
// easy to scan.
// =============================================================
interface DashboardVm {
  archetype: Archetype;
  healthScore: number;
  healthFactors: HealthScoreFactor[];
  monthlySpent: number;
  monthlyIncome: number;
  monthlySavings: number;
  potentialSavings: number;
  upcomingDues: number;
  activeSubscriptions: number;
  totalBalance: number;
  topGoal: { name: string; progress: number; target: number; current: number } | null;
  actionCards: Array<{
    id: string;
    title: string;
    description: string;
    priority: Priority;
    impact: number;
  }>;
  topLeaks: Array<{ type: string; amount: number }>;
  upcomingPayments: Array<{
    id: string;
    name: string;
    amount: number;
    dueIn: number;
  }>;
  forecastDaysLeft: number;
}

const EMPTY_VM: DashboardVm = {
  archetype: 'BALANCED',
  healthScore: 0,
  healthFactors: [],
  monthlySpent: 0,
  monthlyIncome: 0,
  monthlySavings: 0,
  potentialSavings: 0,
  upcomingDues: 0,
  activeSubscriptions: 0,
  totalBalance: 0,
  topGoal: null,
  actionCards: [],
  topLeaks: [],
  upcomingPayments: [],
  forecastDaysLeft: 0,
};

function colorForFactor(label: string): string {
  const k = label.toLowerCase();
  if (k.includes('saving')) return Colors.accentPrimary;
  if (k.includes('budget')) return Colors.accentSuccess;
  if (k.includes('subscription')) return Colors.accentWarning;
  if (k.includes('impulse') || k.includes('control')) return Colors.accentError;
  if (k.includes('debt') || k.includes('credit')) return Colors.accentWarning;
  return Colors.accentPrimary;
}

// =============================================================
// Screen
// =============================================================
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

  const data: DashboardVm = useMemo(() => {
    const dash: any = dashboardQuery.data ?? {};
    const health: any = healthQuery.data ?? {};
    const leaks: any = leaksQuery.data ?? {};
    const cards: any[] = cardsQuery.data ?? [];
    const goals: any[] = goalsQuery.data ?? [];
    const upcoming: any[] = upcomingSubs.data ?? [];
    const subs: any[] = allSubs.data ?? [];

    const archetype: Archetype = ((archetypeQuery.data?.archetype as Archetype | undefined) ||
      ((user as any)?.archetype as Archetype) ||
      'BALANCED') as Archetype;

    const healthScore = Number(health.score ?? health.healthScore ?? 0);
    const healthFactors: HealthScoreFactor[] = Array.isArray(health.factors) ? health.factors : [];

    const potentialSavings = Number(
      leaks.potential_monthly_savings ??
        leaks.potentialMonthlySavings ??
        leaks.monthly_savings ??
        0,
    );
    const topLeaks = (leaks.leaks ?? []).slice(0, 3).map((l: any) => ({
      type: l.title || l.type || 'Leak',
      amount: Number(l.monthly_savings ?? l.monthlySavings ?? l.amount ?? 0),
    }));

    const monthlySpent = Number(dash.monthlyExpense ?? 0);
    const monthlyIncome = Number(dash.monthlyIncome ?? 0);
    const monthlySavings = Number(dash.netSavings ?? monthlyIncome - monthlySpent);
    const totalBalance = Number(dash.totalBalance ?? 0);

    const goalsList = goals.filter((g) => !g.isCompleted);
    const topGoalRaw = goalsList[0];
    const topGoal = topGoalRaw
      ? {
          name: topGoalRaw.name,
          progress: Number(topGoalRaw.progressPercent ?? 0),
          target: Number(topGoalRaw.targetAmount ?? 0),
          current: Number(topGoalRaw.currentAmount ?? 0),
        }
      : null;

    const actionCards = cards.slice(0, 3).map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      priority: (c.priority || 'MEDIUM') as Priority,
      impact: Number(c.impactAmount ?? 0),
    }));

    const upcomingDues = upcoming.reduce((sum, u) => sum + Number(u.amount ?? 0), 0);
    const upcomingPayments = upcoming.slice(0, 3).map((u, i) => ({
      id: u.id || `p${i}`,
      name: u.name,
      amount: Number(u.amount ?? 0),
      dueIn: u.nextBillingDate ? dayDiff(u.nextBillingDate) : 0,
    }));

    const dailyBurn = monthlySpent / 30;
    const forecastDaysLeft = dailyBurn > 0 ? Math.floor(totalBalance / dailyBurn) : 30;

    return {
      archetype,
      healthScore,
      healthFactors,
      monthlySpent,
      monthlyIncome,
      monthlySavings,
      potentialSavings,
      upcomingDues,
      activeSubscriptions: subs.length,
      totalBalance,
      topGoal,
      actionCards,
      topLeaks,
      upcomingPayments,
      forecastDaysLeft,
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
      await Promise.all(queries.map((q) => q.refetch()));
    } finally {
      setRefreshing(false);
    }
  };

  const widgetOrder = useMemo(() => widgetOrderFor(data.archetype), [data.archetype]);

  if (initialLoading) {
    return <DashboardSkeleton />;
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
    forecast: (
      <ForecastWidget key="forecast" days={data.forecastDaysLeft} balance={data.totalBalance} />
    ),
    payments: <UpcomingPaymentsWidget key="payments" payments={data.upcomingPayments} />,
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accentAi}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <Header
          name={user?.name || 'there'}
          archetype={data.archetype}
          onNotifications={() => navigation.navigate('Notifications')}
          onAi={() => navigation.navigate('AIAssistant')}
        />

        <BalanceHero balance={data.totalBalance} archetype={data.archetype} />

        <QuickActionRow navigation={navigation} />

        {widgetOrder.map((key) => widgets[key]).filter(Boolean)}

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </View>
  );
}

// =============================================================
// Header
// =============================================================
function Header({
  name,
  archetype,
  onNotifications,
  onAi,
}: {
  name: string;
  archetype: Archetype;
  onNotifications: () => void;
  onAi: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.userName} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <View style={styles.headerActions}>
        <IconButton
          name="bell"
          accessibilityLabel="Notifications"
          onPress={onNotifications}
          showBadge
        />
        <View style={{ width: 8 }} />
        <AiOrb size={44} onPress={onAi} accessibilityLabel="Open AI assistant" />
      </View>
    </View>
  );
}

// =============================================================
// Hero balance card
// =============================================================
function BalanceHero({ balance, archetype }: { balance: number; archetype: Archetype }) {
  return (
    <Card variant="hero" style={styles.heroCard} padding="xl">
      <Text style={styles.heroLabel}>TOTAL BALANCE</Text>
      <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {formatCurrency(balance)}
      </Text>
      <View style={styles.heroFooter}>
        <Badge text={getArchetypeLabel(archetype)} variant="primary" size="sm" />
        <View style={styles.heroAiNote}>
          <Sparkles size={12} color={Colors.accentAi} strokeWidth={2.2} />
          <Text style={styles.heroAiText}>
            Healthier than <Text style={{ color: Colors.accentAi }}>82%</Text> this month
          </Text>
        </View>
      </View>
    </Card>
  );
}

// =============================================================
// Quick actions
// =============================================================
function QuickActionRow({ navigation }: { navigation: any }) {
  return (
    <View style={styles.quickActions}>
      <QuickAction
        icon={Plus}
        label="Add"
        tone="primary"
        onPress={() => navigation.navigate('AddTransaction')}
      />
      <QuickAction
        icon={Target}
        label="Goals"
        tone="success"
        onPress={() => navigation.navigate('Goals')}
      />
      <QuickAction
        icon={PieChart}
        label="Budgets"
        tone="ai"
        onPress={() => navigation.navigate('Budgets')}
      />
      <QuickAction
        icon={Droplet}
        label="Leaks"
        tone="error"
        onPress={() => navigation.navigate('MoneyLeaks')}
      />
    </View>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onPress,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone: 'primary' | 'success' | 'ai' | 'error';
}) {
  const colorMap = {
    primary: { fg: Colors.accentPrimary, bg: 'rgba(59,130,246,0.15)' },
    success: { fg: Colors.accentSuccess, bg: 'rgba(16,185,129,0.15)' },
    ai: { fg: Colors.accentAi, bg: 'rgba(34,211,238,0.15)' },
    error: { fg: Colors.accentError, bg: 'rgba(255,180,171,0.15)' },
  }[tone];

  return (
    <View style={styles.quickAction}>
      <IconButton
        name="plus" /* unused; we render the lucide icon inline below */
        onPress={onPress}
        accessibilityLabel={label}
        size="lg"
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' as any }}
      />
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: BorderRadius.md,
          backgroundColor: colorMap.bg,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colorMap.fg + '40',
          marginBottom: Spacing.xs,
        }}
        onTouchEnd={onPress}
      >
        <Icon size={22} color={colorMap.fg} strokeWidth={1.75} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </View>
  );
}

// =============================================================
// Health Score (AI surface)
// =============================================================
function HealthScoreWidget({
  score,
  factors,
  navigation,
}: {
  score: number;
  factors: HealthScoreFactor[];
  navigation: any;
}) {
  const visible = factors.slice(0, 4);

  return (
    <Card variant="ai" onPress={() => navigation.navigate('HealthScore')} style={styles.widget}>
      <View style={styles.widgetHeader}>
        <View>
          <Text style={styles.widgetLabel}>FINANCIAL HEALTH</Text>
          <Text style={styles.widgetTitleAi}>{getHealthRating(score)}</Text>
        </View>
        <ArrowRight size={18} color={Colors.accentAi} strokeWidth={1.5} />
      </View>

      <View style={styles.healthRow}>
        <ProgressRing
          progress={score}
          size={120}
          strokeWidth={10}
          gradient
          showPercentage
          label="of 100"
        />
        <View style={styles.healthFactors}>
          {visible.length > 0 ? (
            visible.map((f) => (
              <FactorRow
                key={f.label}
                label={f.label}
                value={Number(f.value ?? 0)}
                color={f.color || colorForFactor(f.label)}
              />
            ))
          ) : (
            <Text style={styles.factorsEmpty}>
              Run an analysis to see what&apos;s driving your score.
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

function FactorRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <View style={styles.factorHeader}>
        <Text style={styles.factorLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.factorValue, { color }]}>{Math.round(value)}</Text>
      </View>
      <ProgressBar progress={value} color={color} />
    </View>
  );
}

// =============================================================
// Money Leaks
// =============================================================
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
      style={[styles.widget, styles.leakCard]}
    >
      <View style={styles.widgetHeader}>
        <View style={styles.iconTitleRow}>
          <View style={styles.glyph}>
            <Droplet size={16} color={Colors.accentError} strokeWidth={1.75} />
          </View>
          <Text style={styles.widgetTitle}>Money Leaks</Text>
        </View>
        <Badge
          text={`${leaks.length} found`}
          variant={leaks.length > 0 ? 'error' : 'gray'}
          size="sm"
        />
      </View>

      <Text style={styles.leakSavingsLine}>
        Save up to{' '}
        <Text style={styles.leakAmount}>
          {formatCurrency(potentialSavings, { compact: true })}/mo
        </Text>
      </Text>

      {leaks.length === 0 ? (
        <Text style={styles.emptyHint}>No leaks detected — nice work.</Text>
      ) : (
        <View style={{ marginTop: Spacing.xs }}>
          {leaks.slice(0, 3).map((leak, idx) => (
            <View key={`${leak.type}-${idx}`} style={styles.leakRow}>
              <Text style={styles.leakType} numberOfLines={1}>
                {leak.type}
              </Text>
              <Text style={styles.leakValue}>{formatCurrency(leak.amount)}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

// =============================================================
// Action Cards (AI horizontal carousel)
// =============================================================
function ActionCardsWidget({
  cards,
  navigation,
}: {
  cards: DashboardVm['actionCards'];
  navigation: any;
}) {
  if (cards.length === 0) return null;
  return (
    <Section
      title="Fix My Finances"
      subtitle="AI-suggested actions"
      actionLabel="See all"
      onActionPress={() => navigation.navigate('Insights')}
      highlightTitle
    >
      <FlatList
        data={cards}
        horizontal
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.xs, paddingTop: 4 }}
        renderItem={({ item }) => <ActionCardItem card={item} />}
      />
    </Section>
  );
}

function ActionCardItem({ card }: { card: DashboardVm['actionCards'][0] }) {
  const variant: 'error' | 'warning' | 'primary' =
    card.priority === 'URGENT' ? 'error' : card.priority === 'HIGH' ? 'warning' : 'primary';
  return (
    <Card variant="ai" style={styles.actionCard} padding="base">
      <View style={styles.actionCardHeader}>
        <Sparkles size={16} color={Colors.accentAi} strokeWidth={1.75} />
        <Badge text={card.priority} variant={variant} size="sm" />
      </View>
      <Text style={styles.actionCardTitle} numberOfLines={2}>
        {card.title}
      </Text>
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

// =============================================================
// Spending widget
// =============================================================
function SpendingWidget({
  spent,
  income,
  savings,
}: {
  spent: number;
  income: number;
  savings: number;
}) {
  const rate = income > 0 ? Math.max(0, Math.round((savings / income) * 100)) : 0;

  return (
    <Card style={styles.widget}>
      <View style={styles.widgetHeader}>
        <Text style={styles.widgetTitle}>This Month</Text>
        <Text style={styles.metaText}>{rate}% saved</Text>
      </View>

      <View style={styles.statRow}>
        <Stat
          icon={<TrendingUp size={14} color={Colors.accentSuccess} strokeWidth={2} />}
          label="Income"
          value={income}
          color={Colors.accentSuccess}
          sign="+"
        />
        <View style={styles.statDivider} />
        <Stat
          icon={<TrendingDown size={14} color={Colors.accentError} strokeWidth={2} />}
          label="Spent"
          value={spent}
          color={Colors.accentError}
          sign="-"
        />
        <View style={styles.statDivider} />
        <Stat label="Saved" value={savings} color={Colors.accentPrimary} />
      </View>

      <View style={{ marginTop: Spacing.base }}>
        <ProgressBar progress={rate} color={Colors.accentPrimary} />
      </View>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  color,
  sign = '',
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
  color: string;
  sign?: string;
}) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statHeader}>
        {icon}
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>
        {sign}
        {formatCurrency(value, { compact: true })}
      </Text>
    </View>
  );
}

// =============================================================
// Subscriptions
// =============================================================
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
        <Text style={styles.widgetTitle}>Subscriptions</Text>
        <ArrowRight size={16} color={Colors.accentPrimary} strokeWidth={1.5} />
      </View>
      <View style={styles.subRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.subValue}>{count}</Text>
          <Text style={styles.subLabel}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.subValue}>{formatCurrency(dues, { compact: true })}</Text>
          <Text style={styles.subLabel}>Upcoming</Text>
        </View>
      </View>
    </Card>
  );
}

// =============================================================
// Goals
// =============================================================
function GoalsWidget({ goal, navigation }: { goal: DashboardVm['topGoal']; navigation: any }) {
  return (
    <Card onPress={() => navigation.navigate('Goals')} style={styles.widget}>
      <View style={styles.widgetHeader}>
        <View style={styles.iconTitleRow}>
          <View style={styles.glyph}>
            <Target size={16} color={Colors.accentSuccess} strokeWidth={1.75} />
          </View>
          <Text style={styles.widgetTitle}>Top Goal</Text>
        </View>
        <ArrowRight size={16} color={Colors.accentPrimary} strokeWidth={1.5} />
      </View>

      {goal ? (
        <View style={styles.goalContent}>
          <ProgressRing
            progress={goal.progress}
            size={84}
            strokeWidth={6}
            color={Colors.accentSuccess}
            showPercentage
          />
          <View style={styles.goalInfo}>
            <Text style={styles.goalName} numberOfLines={1}>
              {goal.name}
            </Text>
            <Text style={styles.goalAmount}>
              {formatCurrency(goal.current)} / {formatCurrency(goal.target)}
            </Text>
            <Text style={styles.goalRemaining}>
              {formatCurrency(Math.max(0, goal.target - goal.current))} to go
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.emptyHint}>Set your first savings goal to see progress here.</Text>
      )}
    </Card>
  );
}

// =============================================================
// Forecast
// =============================================================
function ForecastWidget({ days, balance }: { days: number; balance: number }) {
  return (
    <Card variant="ai" style={styles.widget}>
      <View style={styles.iconTitleRow}>
        <Sparkles size={16} color={Colors.accentAi} strokeWidth={1.75} />
        <Text style={styles.widgetTitleAi}>Cash flow forecast</Text>
      </View>
      <Text style={[styles.metaText, { marginTop: Spacing.sm }]}>
        At your current pace, your balance lasts
      </Text>
      <Text style={styles.forecastDays}>
        {days} <Text style={styles.forecastDaysUnit}>days</Text>
      </Text>
      <Text style={styles.metaText}>Predicted end-of-month: {formatCurrency(balance)}</Text>
    </Card>
  );
}

// =============================================================
// Upcoming payments
// =============================================================
function UpcomingPaymentsWidget({ payments }: { payments: DashboardVm['upcomingPayments'] }) {
  if (payments.length === 0) return null;
  return (
    <Card style={styles.widget}>
      <View style={styles.widgetHeader}>
        <Text style={styles.widgetTitle}>Upcoming Payments</Text>
      </View>
      {payments.map((p, i) => (
        <View
          key={p.id}
          style={[styles.paymentRow, i === payments.length - 1 && { borderBottomWidth: 0 }]}
        >
          <View style={styles.paymentGlyph}>
            <Calendar size={16} color={Colors.accentPrimary} strokeWidth={1.75} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.paymentName} numberOfLines={1}>
              {p.name}
            </Text>
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

// =============================================================
// Loading + error states
// =============================================================
function DashboardSkeleton() {
  return (
    <View
      style={[
        styles.container,
        { paddingTop: Spacing['3xl'] + Spacing.lg, paddingHorizontal: Spacing.lg },
      ]}
    >
      <View style={[styles.header, { marginBottom: Spacing.lg }]}>
        <View style={{ flex: 1 }}>
          <Skeleton width={120} height={14} radius="sm" />
          <View style={{ height: 8 }} />
          <Skeleton width={180} height={26} radius="sm" />
        </View>
        <Skeleton width={44} height={44} radius="md" />
      </View>
      <Skeleton width="100%" height={150} radius="lg" />
      <View style={{ height: Spacing.lg }} />
      <Skeleton width="100%" height={80} radius="lg" />
      <View style={{ height: Spacing.lg }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ marginBottom: Spacing.base }}>
          <Skeleton width="100%" height={150} radius="lg" />
        </View>
      ))}
    </View>
  );
}

function FullScreenError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.fullScreenState}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: 'rgba(255,180,171,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: Spacing.base,
        }}
      >
        <Droplet size={28} color={Colors.accentError} strokeWidth={1.5} />
      </View>
      <Text style={styles.fullScreenStateTitle}>Couldn&apos;t load dashboard</Text>
      <Text style={styles.fullScreenStateText}>Check your connection and try again.</Text>
      <View style={{ marginTop: Spacing.xl, alignSelf: 'stretch' }}>
        <Button title="Retry" onPress={onRetry} fullWidth />
      </View>
    </View>
  );
}

// =============================================================
// Styles
// =============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingTop: Spacing['3xl'] + Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },

  // Full-screen states
  fullScreenState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  fullScreenStateTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  fullScreenStateText: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  greeting: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  userName: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Hero card
  heroCard: {
    marginBottom: Spacing.lg,
    minHeight: 160,
  },
  heroLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1.2,
    fontWeight: Typography.weights.medium,
    fontFamily: fontFamilyForWeight(Typography.weights.medium),
  },
  heroValue: {
    fontSize: 48,
    lineHeight: 52,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    letterSpacing: -1.5,
    marginTop: Spacing.xs,
    marginBottom: Spacing.base,
    fontVariant: ['tabular-nums'] as any,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  heroAiNote: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAiText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginLeft: 4,
    letterSpacing: 0.2,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  quickAction: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
    fontFamily: fontFamilyForWeight(Typography.weights.medium),
    letterSpacing: 0.2,
  },

  // Widget
  widget: {
    marginBottom: Spacing.base,
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glyph: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.base,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  widgetLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1.2,
    fontWeight: Typography.weights.medium,
    fontFamily: fontFamilyForWeight(Typography.weights.medium),
  },
  widgetTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  widgetTitleAi: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.accentAi,
    letterSpacing: -0.2,
    marginLeft: 6,
  },
  metaText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },

  // Health
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthFactors: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  factorsEmpty: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  factorLabel: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    paddingRight: Spacing.xs,
  },
  factorValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    fontVariant: ['tabular-nums'] as any,
  },

  // Leaks
  leakCard: {
    backgroundColor: 'rgba(255,180,171,0.06)',
    borderColor: 'rgba(255,180,171,0.20)',
  },
  leakSavingsLine: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  leakAmount: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.accentSuccess,
    fontVariant: ['tabular-nums'] as any,
  },
  leakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  leakType: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  leakValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.accentError,
    fontVariant: ['tabular-nums'] as any,
  },
  emptyHint: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // Action cards
  actionCard: {
    width: 240,
    marginRight: Spacing.sm,
  },
  actionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  actionCardTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  actionCardDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sizes.sm * 1.4,
    marginBottom: Spacing.sm,
  },
  actionCardFooter: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  actionCardImpact: {
    fontSize: Typography.sizes.sm,
    color: Colors.accentSuccess,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    fontVariant: ['tabular-nums'] as any,
  },

  // Spending
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  statValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.4,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.borderDefault,
    marginHorizontal: Spacing.sm,
  },

  // Subscriptions
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subValue: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.6,
  },
  subLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },
  goalAmount: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    fontVariant: ['tabular-nums'] as any,
  },
  goalRemaining: {
    fontSize: Typography.sizes.xs,
    color: Colors.accentSuccess,
    fontWeight: Typography.weights.medium,
    fontFamily: fontFamilyForWeight(Typography.weights.medium),
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  // Forecast
  forecastDays: {
    fontSize: 48,
    lineHeight: 52,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    letterSpacing: -1.5,
    marginVertical: Spacing.xs,
    fontVariant: ['tabular-nums'] as any,
  },
  forecastDaysUnit: {
    fontSize: Typography.sizes.lg,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.regular,
    letterSpacing: 0,
  },

  // Payments
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  paymentGlyph: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.base,
    backgroundColor: 'rgba(59,130,246,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  paymentName: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
    fontFamily: fontFamilyForWeight(Typography.weights.medium),
  },
  paymentDue: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  paymentAmount: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
  },
});
