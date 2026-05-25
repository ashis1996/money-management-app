import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import {
  Card,
  Badge,
  Button,
  ProgressRing,
  ProgressBar,
} from '../../components/shared';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  ArchetypeColors,
  HealthScoreColors,
  PriorityColors,
} from '../../styles/theme';

type Archetype = 'SPEND_HEAVY' | 'SAVINGS_FOCUSED' | 'CREDIT_USER' | 'SUBSCRIPTION_HEAVY' | 'BALANCED';

interface MockData {
  archetype: Archetype;
  healthScore: number;
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
    priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
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

// Mock data - in production this comes from API
const mockData: MockData = {
  archetype: 'SPEND_HEAVY',
  healthScore: 68,
  leakScore: 42,
  monthlySpent: 45000,
  monthlyIncome: 75000,
  monthlySavings: 30000,
  potentialSavings: 4500,
  upcomingDues: 8500,
  activeSubscriptions: 7,
  goalProgress: 65,
  topGoal: { name: 'Emergency Fund', progress: 65, target: 100000, current: 65000 },
  actionCards: [
    {
      id: 'a1',
      title: 'Cancel Spotify',
      description: 'Low usage detected. Save ₹119/month.',
      priority: 'HIGH',
      impact: 119,
      icon: '🎵',
    },
    {
      id: 'a2',
      title: 'Reduce Food Delivery',
      description: 'You spent ₹8,200 on Swiggy. Try cooking 2 days/week.',
      priority: 'MEDIUM',
      impact: 2000,
      icon: '🍔',
    },
    {
      id: 'a3',
      title: 'Netflix Price Hike',
      description: 'Increased from ₹499 to ₹649. Review subscription.',
      priority: 'MEDIUM',
      impact: 150,
      icon: '🎬',
    },
  ],
  topLeaks: [
    { type: 'Late-night impulse', amount: 2500, description: 'Spent after 10 PM' },
    { type: 'Duplicate music apps', merchant: 'Spotify + YT Music', amount: 248, description: 'Two services overlap' },
    { type: 'Unused gym', merchant: 'Cult.fit', amount: 999, description: '0 visits in 30 days' },
  ],
  upcomingPayments: [
    { id: 'p1', name: 'Netflix', amount: 649, dueIn: 3, icon: '🎬' },
    { id: 'p2', name: 'Credit Card', amount: 12500, dueIn: 5, icon: '💳' },
    { id: 'p3', name: 'Internet', amount: 999, dueIn: 8, icon: '🌐' },
  ],
  forecast: { daysLeft: 18, balance: 27500 },
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getHealthColor(score: number): string {
  if (score >= 85) return HealthScoreColors.excellent;
  if (score >= 70) return HealthScoreColors.good;
  if (score >= 55) return HealthScoreColors.fair;
  return HealthScoreColors.poor;
}

function getHealthRating(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  return 'Needs Work';
}

function getArchetypeLabel(archetype: Archetype): string {
  const labels: Record<Archetype, string> = {
    SPEND_HEAVY: '💸 Spend Heavy',
    SAVINGS_FOCUSED: '💰 Saver',
    CREDIT_USER: '💳 Credit User',
    SUBSCRIPTION_HEAVY: '🔄 Subscription Heavy',
    BALANCED: '⚖️ Balanced',
  };
  return labels[archetype];
}

export function HomeScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const data = mockData;

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Personalized widget order based on archetype
  const widgetOrder = useMemo(() => {
    switch (data.archetype) {
      case 'SPEND_HEAVY':
        return ['leaks', 'health', 'actions', 'spending', 'subscriptions', 'goals', 'forecast'];
      case 'SAVINGS_FOCUSED':
        return ['goals', 'health', 'spending', 'forecast', 'actions', 'subscriptions', 'leaks'];
      case 'CREDIT_USER':
        return ['payments', 'health', 'spending', 'leaks', 'actions', 'goals', 'forecast'];
      case 'SUBSCRIPTION_HEAVY':
        return ['subscriptions', 'leaks', 'actions', 'health', 'payments', 'spending', 'goals'];
      default:
        return ['health', 'spending', 'goals', 'actions', 'leaks', 'subscriptions', 'forecast'];
    }
  }, [data.archetype]);

  const widgets: Record<string, React.ReactNode> = {
    health: <HealthScoreWidget key="health" score={data.healthScore} navigation={navigation} />,
    leaks: <MoneyLeaksWidget key="leaks" leaks={data.topLeaks} potentialSavings={data.potentialSavings} navigation={navigation} />,
    actions: <ActionCardsWidget key="actions" cards={data.actionCards} navigation={navigation} />,
    spending: <SpendingWidget key="spending" spent={data.monthlySpent} income={data.monthlyIncome} savings={data.monthlySavings} />,
    subscriptions: <SubscriptionsWidget key="subscriptions" count={data.activeSubscriptions} dues={data.upcomingDues} navigation={navigation} />,
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
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Badge
              text={getArchetypeLabel(data.archetype)}
              variant="primary"
              size="sm"
            />
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Text style={styles.bellIcon}>🔔</Text>
              <View style={styles.bellBadge} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.aiButton}
              onPress={() => navigation.navigate('AIAssistant')}
            >
              <Text style={styles.aiButtonIcon}>🤖</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <QuickAction icon="➕" label="Add" onPress={() => navigation.navigate('AddTransaction')} />
          <QuickAction icon="🎯" label="Goals" onPress={() => navigation.navigate('Goals')} />
          <QuickAction icon="📊" label="Budgets" onPress={() => navigation.navigate('Budgets')} />
          <QuickAction icon="💧" label="Leaks" onPress={() => navigation.navigate('MoneyLeaks')} />
        </View>

        {/* Personalized widgets */}
        {widgetOrder.map((key) => widgets[key])}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

// ==================== WIDGETS ====================

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIcon}>
        <Text style={styles.quickActionIconText}>{icon}</Text>
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function HealthScoreWidget({ score, navigation }: { score: number; navigation: any }) {
  const color = getHealthColor(score);
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
        <View style={styles.healthFactors}>
          <FactorRow label="Savings Rate" value={60} color={Colors.primary} />
          <FactorRow label="Budget" value={75} color={Colors.success} />
          <FactorRow label="Subscriptions" value={50} color={Colors.warning} />
          <FactorRow label="Impulse Control" value={55} color={Colors.error} />
        </View>
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
  leaks: MockData['topLeaks'];
  potentialSavings: number;
  navigation: any;
}) {
  return (
    <Card onPress={() => navigation.navigate('MoneyLeaks')} style={[styles.widget, styles.leakWidget]}>
      <View style={styles.widgetHeader}>
        <View style={styles.widgetTitleRow}>
          <Text style={styles.leakIcon}>💧</Text>
          <Text style={styles.widgetTitle}>Money Leaks</Text>
        </View>
        <Badge text={`${leaks.length} found`} variant="error" size="sm" />
      </View>
      <Text style={styles.leakSavings}>
        Save up to <Text style={styles.leakAmount}>₹{potentialSavings.toLocaleString()}/mo</Text>
      </Text>
      {leaks.slice(0, 3).map((leak, idx) => (
        <View key={idx} style={styles.leakRow}>
          <Text style={styles.leakType}>• {leak.type}</Text>
          <Text style={styles.leakValue}>₹{leak.amount.toLocaleString()}</Text>
        </View>
      ))}
    </Card>
  );
}

function ActionCardsWidget({
  cards,
  navigation,
}: {
  cards: MockData['actionCards'];
  navigation: any;
}) {
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

function ActionCardItem({ card }: { card: MockData['actionCards'][0] }) {
  return (
    <Card style={styles.actionCard} variant="outlined">
      <View style={styles.actionCardHeader}>
        <Text style={styles.actionCardIcon}>{card.icon}</Text>
        <Badge
          text={card.priority}
          variant={
            card.priority === 'URGENT'
              ? 'error'
              : card.priority === 'HIGH'
              ? 'warning'
              : 'info'
          }
          size="sm"
        />
      </View>
      <Text style={styles.actionCardTitle}>{card.title}</Text>
      <Text style={styles.actionCardDescription} numberOfLines={2}>
        {card.description}
      </Text>
      <View style={styles.actionCardFooter}>
        <Text style={styles.actionCardImpact}>Save ₹{card.impact}/mo</Text>
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
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

  return (
    <Card style={styles.widget}>
      <Text style={styles.widgetTitle}>This Month</Text>
      <View style={styles.spendingRow}>
        <View style={styles.spendingItem}>
          <Text style={styles.spendingLabel}>Income</Text>
          <Text style={[styles.spendingAmount, { color: Colors.success }]}>
            +₹{income.toLocaleString()}
          </Text>
        </View>
        <View style={styles.spendingDivider} />
        <View style={styles.spendingItem}>
          <Text style={styles.spendingLabel}>Spent</Text>
          <Text style={[styles.spendingAmount, { color: Colors.error }]}>
            -₹{spent.toLocaleString()}
          </Text>
        </View>
        <View style={styles.spendingDivider} />
        <View style={styles.spendingItem}>
          <Text style={styles.spendingLabel}>Saved</Text>
          <Text style={[styles.spendingAmount, { color: Colors.primary }]}>
            ₹{savings.toLocaleString()}
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
          <Text style={styles.subStatValue}>₹{dues.toLocaleString()}</Text>
          <Text style={styles.subStatLabel}>Upcoming Dues</Text>
        </View>
      </View>
    </Card>
  );
}

function GoalsWidget({
  goal,
  navigation,
}: {
  goal: MockData['topGoal'];
  navigation: any;
}) {
  return (
    <Card onPress={() => navigation.navigate('Goals')} style={styles.widget}>
      <View style={styles.widgetHeader}>
        <Text style={styles.widgetTitle}>🎯 Top Goal</Text>
        <Text style={styles.linkText}>All goals →</Text>
      </View>
      <View style={styles.goalContent}>
        <ProgressRing
          progress={goal.progress}
          size={80}
          strokeWidth={8}
          color={Colors.success}
        />
        <View style={styles.goalInfo}>
          <Text style={styles.goalName}>{goal.name}</Text>
          <Text style={styles.goalAmount}>
            ₹{goal.current.toLocaleString()} / ₹{goal.target.toLocaleString()}
          </Text>
          <Text style={styles.goalRemaining}>
            ₹{(goal.target - goal.current).toLocaleString()} to go
          </Text>
        </View>
      </View>
    </Card>
  );
}

function ForecastWidget({ forecast }: { forecast: MockData['forecast'] }) {
  return (
    <Card style={[styles.widget, styles.forecastWidget]}>
      <View style={styles.forecastHeader}>
        <Text style={styles.forecastIcon}>🔮</Text>
        <Text style={styles.widgetTitle}>Cash Flow Forecast</Text>
      </View>
      <Text style={styles.forecastMessage}>
        At current pace, your money will last
      </Text>
      <Text style={styles.forecastDays}>{forecast.daysLeft} days</Text>
      <Text style={styles.forecastBalance}>
        Predicted end-of-month: ₹{forecast.balance.toLocaleString()}
      </Text>
    </Card>
  );
}

function UpcomingPaymentsWidget({ payments }: { payments: MockData['upcomingPayments'] }) {
  return (
    <Card style={styles.widget}>
      <Text style={styles.widgetTitle}>Upcoming Payments</Text>
      {payments.map((p) => (
        <View key={p.id} style={styles.paymentRow}>
          <Text style={styles.paymentIcon}>{p.icon}</Text>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentName}>{p.name}</Text>
            <Text style={styles.paymentDue}>Due in {p.dueIn} days</Text>
          </View>
          <Text style={styles.paymentAmount}>₹{p.amount.toLocaleString()}</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
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
  // Health Score
  healthContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthFactors: {
    flex: 1,
    marginLeft: Spacing.lg,
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
  },
  factorValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
  },
  // Money Leaks
  leakWidget: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
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
