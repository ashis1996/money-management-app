import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Card, Badge, Button, ProgressRing, ProgressBar, EmptyState } from '../../components/shared';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../../styles/theme';
import {
  useGoals,
  useCreateGoal,
  useContributeGoal,
  useDeleteGoal,
} from '../../hooks';

interface Goal {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  category?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string | null;
  monthlyContribution?: number;
  autoAllocate?: boolean;
  priority?: number;
  isCompleted: boolean;
  progressPercent?: number;
  monthsToGoal?: number | null;
  dailyContributionNeeded?: number | null;
}

const mockGoals: Goal[] = [];

const GOAL_CATEGORIES = [
  { id: 'emergency', label: 'Emergency Fund', icon: '🛡️', color: '#10B981' },
  { id: 'travel', label: 'Travel', icon: '✈️', color: '#3B82F6' },
  { id: 'gadget', label: 'Gadget', icon: '📱', color: '#8B5CF6' },
  { id: 'vehicle', label: 'Vehicle', icon: '🚗', color: '#F59E0B' },
  { id: 'home', label: 'Home', icon: '🏠', color: '#EC4899' },
  { id: 'education', label: 'Education', icon: '🎓', color: '#06B6D4' },
  { id: 'wedding', label: 'Wedding', icon: '💍', color: '#F472B6' },
  { id: 'other', label: 'Other', icon: '🎯', color: '#6366F1' },
];

type FilterType = 'active' | 'completed' | 'all';

export function GoalsScreen({ navigation }: any) {
  const goalsQuery = useGoals();
  const createGoal = useCreateGoal();
  const contributeGoal = useContributeGoal();
  const deleteGoal = useDeleteGoal();

  const goals: Goal[] = useMemo(() => {
    const list = goalsQuery.data || [];
    return list.map((g: any) => {
      const cat = GOAL_CATEGORIES.find((c) => c.id === g.category);
      const monthly =
        g.monthsToGoal && g.monthsToGoal > 0
          ? Math.round(
              Math.max(0, g.targetAmount - g.currentAmount) / g.monthsToGoal,
            )
          : 0;
      return {
        ...g,
        icon: g.icon || cat?.icon || '🎯',
        color: g.color || cat?.color || Colors.primary,
        category: g.category || 'other',
        monthlyContribution: monthly,
        autoAllocate: !!g.autoAllocate,
        priority: g.priority ?? 0,
        isCompleted: !!g.isCompleted,
      };
    });
  }, [goalsQuery.data]);

  const [filter, setFilter] = useState<FilterType>('active');
  const [showCreate, setShowCreate] = useState(false);
  const [contributingGoal, setContributingGoal] = useState<Goal | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');

  const [newGoal, setNewGoal] = useState({
    name: '',
    targetAmount: '',
    targetDate: '',
    category: 'emergency',
    icon: '🛡️',
    color: '#10B981',
    autoAllocate: false,
  });

  const stats = useMemo(() => {
    const active = goals.filter((g) => !g.isCompleted);
    const totalTarget = active.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalSaved = active.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalMonthly = active.reduce((sum, g) => sum + (g.monthlyContribution || 0), 0);
    const completedCount = goals.filter((g) => g.isCompleted).length;

    return {
      activeCount: active.length,
      totalTarget,
      totalSaved,
      totalMonthly,
      overallProgress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
      completedCount,
    };
  }, [goals]);

  const filteredGoals = useMemo(() => {
    if (filter === 'active') return goals.filter((g) => !g.isCompleted);
    if (filter === 'completed') return goals.filter((g) => g.isCompleted);
    return goals;
  }, [goals, filter]);

  const handleCreate = async () => {
    if (!newGoal.name || !newGoal.targetAmount) {
      Alert.alert('Missing fields', 'Please fill goal name and target amount');
      return;
    }
    const cat = GOAL_CATEGORIES.find((c) => c.id === newGoal.category);
    const target = parseFloat(newGoal.targetAmount);

    try {
      await createGoal.mutateAsync({
        name: newGoal.name,
        targetAmount: target,
        targetDate: newGoal.targetDate || undefined,
        category: newGoal.category,
        icon: cat?.icon,
        color: cat?.color,
        autoAllocate: newGoal.autoAllocate,
      });
      setNewGoal({
        name: '',
        targetAmount: '',
        targetDate: '',
        category: 'emergency',
        icon: '🛡️',
        color: '#10B981',
        autoAllocate: false,
      });
      setShowCreate(false);
    } catch (e: any) {
      Alert.alert('Could not create goal', e?.message ?? 'Unknown error');
    }
  };

  const handleContribute = async () => {
    if (!contributingGoal || !contributionAmount) return;
    const amt = parseFloat(contributionAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount');
      return;
    }
    try {
      await contributeGoal.mutateAsync({
        id: contributingGoal.id,
        amount: amt,
      });
      setContributingGoal(null);
      setContributionAmount('');
    } catch (e: any) {
      Alert.alert('Could not contribute', e?.message ?? 'Unknown error');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Goal', 'This will remove the goal permanently', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteGoal.mutate(id),
      },
    ]);
  };

  if (goalsQuery.isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (goalsQuery.isError) {
    return (
      <View style={[styles.container, { justifyContent: 'center', padding: Spacing.xl }]}>
        <EmptyState
          icon="⚠️"
          title="Couldn't load goals"
          message={(goalsQuery.error as any)?.message || 'Pull to refresh and try again'}
          actionLabel="Retry"
          onAction={() => goalsQuery.refetch()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Goals</Text>
            <Text style={styles.subtitle}>Save with purpose</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Overview card */}
        <Card style={styles.overview}>
          <View style={styles.overviewContent}>
            <ProgressRing
              progress={stats.overallProgress}
              size={100}
              strokeWidth={10}
              color={Colors.success}
              showPercentage
              label="Overall"
            />
            <View style={styles.overviewStats}>
              <View style={styles.overviewStat}>
                <Text style={styles.overviewStatLabel}>Saved</Text>
                <Text style={styles.overviewStatValue}>
                  ₹{stats.totalSaved.toLocaleString()}
                </Text>
              </View>
              <View style={styles.overviewStat}>
                <Text style={styles.overviewStatLabel}>Target</Text>
                <Text style={[styles.overviewStatValue, { color: Colors.textSecondary }]}>
                  ₹{stats.totalTarget.toLocaleString()}
                </Text>
              </View>
              <View style={styles.overviewStat}>
                <Text style={styles.overviewStatLabel}>Monthly</Text>
                <Text style={[styles.overviewStatValue, { color: Colors.primary }]}>
                  ₹{stats.totalMonthly.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
          {stats.completedCount > 0 && (
            <View style={styles.completedBanner}>
              <Text style={styles.completedText}>
                🎉 {stats.completedCount} goal{stats.completedCount > 1 ? 's' : ''} completed!
              </Text>
            </View>
          )}
        </Card>

        {/* AI Tip */}
        <Card style={styles.aiTip}>
          <Text style={styles.aiTipIcon}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTipTitle}>AI Suggestion</Text>
            <Text style={styles.aiTipText}>
              You can save ₹4,500/month by fixing money leaks. Allocate it to your Goa goal to reach it 1 month earlier!
            </Text>
          </View>
        </Card>

        {/* Filter tabs */}
        <View style={styles.filterTabs}>
          {(['active', 'completed', 'all'] as FilterType[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === f && styles.filterTabTextActive,
                ]}
              >
                {f === 'active'
                  ? `Active (${stats.activeCount})`
                  : f === 'completed'
                  ? `Completed (${stats.completedCount})`
                  : 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Goals list */}
        {filteredGoals.length === 0 ? (
          <EmptyState
            icon="🎯"
            title={filter === 'completed' ? 'No completed goals yet' : 'No active goals'}
            message={
              filter === 'completed'
                ? 'Keep saving! You\'ll get there.'
                : 'Create your first goal to start saving with purpose'
            }
            actionLabel={filter !== 'completed' ? 'Create Goal' : undefined}
            onAction={filter !== 'completed' ? () => setShowCreate(true) : undefined}
          />
        ) : (
          <View style={styles.list}>
            {filteredGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onContribute={() => setContributingGoal(goal)}
                onDelete={() => handleDelete(goal.id)}
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      {/* Create Goal Modal */}
      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Goal</Text>
                <TouchableOpacity onPress={() => setShowCreate(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Goal Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Trip to Goa"
                placeholderTextColor={Colors.textTertiary}
                value={newGoal.name}
                onChangeText={(t) => setNewGoal({ ...newGoal, name: t })}
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catRow}
              >
                {GOAL_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catChip,
                      newGoal.category === cat.id && {
                        borderColor: cat.color,
                        backgroundColor: cat.color + '15',
                      },
                    ]}
                    onPress={() =>
                      setNewGoal({
                        ...newGoal,
                        category: cat.id,
                        icon: cat.icon,
                        color: cat.color,
                      })
                    }
                  >
                    <Text style={styles.catChipIcon}>{cat.icon}</Text>
                    <Text
                      style={[
                        styles.catChipText,
                        newGoal.category === cat.id && {
                          color: cat.color,
                          fontWeight: Typography.weights.bold,
                        },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Target Amount (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="50000"
                placeholderTextColor={Colors.textTertiary}
                value={newGoal.targetAmount}
                onChangeText={(t) => setNewGoal({ ...newGoal, targetAmount: t })}
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Target Date (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
                value={newGoal.targetDate}
                onChangeText={(t) => setNewGoal({ ...newGoal, targetDate: t })}
              />

              <TouchableOpacity
                style={styles.autoToggle}
                onPress={() =>
                  setNewGoal({ ...newGoal, autoAllocate: !newGoal.autoAllocate })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.autoLabel}>🤖 Auto-allocate from savings</Text>
                  <Text style={styles.autoHint}>
                    AI will automatically add money each month
                  </Text>
                </View>
                <View
                  style={[
                    styles.toggle,
                    newGoal.autoAllocate && styles.toggleActive,
                  ]}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      newGoal.autoAllocate && styles.toggleThumbActive,
                    ]}
                  />
                </View>
              </TouchableOpacity>

              {newGoal.targetAmount && (
                <View style={styles.calculation}>
                  <Text style={styles.calculationText}>
                    💡 Save ₹
                    {Math.round(parseFloat(newGoal.targetAmount) / 12).toLocaleString()}/month
                    to reach goal in 12 months
                  </Text>
                </View>
              )}

              <Button
                title="Create Goal"
                onPress={handleCreate}
                variant="primary"
                fullWidth
                style={{ marginTop: Spacing.lg }}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Contribute Modal */}
      <Modal
        visible={!!contributingGoal}
        animationType="fade"
        transparent
        onRequestClose={() => setContributingGoal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.contributeModal}>
            {contributingGoal && (
              <>
                <Text style={styles.contributeIcon}>{contributingGoal.icon}</Text>
                <Text style={styles.contributeTitle}>Add to {contributingGoal.name}</Text>
                <Text style={styles.contributeSubtitle}>
                  ₹{contributingGoal.currentAmount.toLocaleString()} of ₹
                  {contributingGoal.targetAmount.toLocaleString()}
                </Text>
                <TextInput
                  style={styles.contributeInput}
                  placeholder="Amount"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="numeric"
                  value={contributionAmount}
                  onChangeText={setContributionAmount}
                />
                <View style={styles.contributePresets}>
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      style={styles.preset}
                      onPress={() => setContributionAmount(String(amt))}
                    >
                      <Text style={styles.presetText}>₹{amt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.contributeActions}>
                  <Button
                    title="Cancel"
                    onPress={() => {
                      setContributingGoal(null);
                      setContributionAmount('');
                    }}
                    variant="ghost"
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Add"
                    onPress={handleContribute}
                    variant="success"
                    style={{ flex: 1, marginLeft: Spacing.sm }}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface GoalCardProps {
  goal: Goal;
  onContribute: () => void;
  onDelete: () => void;
}

function GoalCard({ goal, onContribute, onDelete }: GoalCardProps) {
  const progress = (goal.currentAmount / goal.targetAmount) * 100;
  const remaining = goal.targetAmount - goal.currentAmount;
  const monthsLeft = Math.max(
    1,
    Math.ceil(
      (new Date(goal.targetDate ?? Date.now()).getTime() - Date.now()) /
        (30 * 24 * 3600 * 1000),
    ),
  );
  const monthlyContribution = goal.monthlyContribution ?? 0;
  const onTrack = monthlyContribution * monthsLeft >= remaining;

  return (
    <Card style={[styles.goalCard, goal.isCompleted && styles.goalCardCompleted]}>
      <View style={styles.goalHeader}>
        <View style={styles.goalLeft}>
          <ProgressRing
            progress={progress}
            size={70}
            strokeWidth={7}
            color={goal.color}
          >
            <Text style={styles.goalRingIcon}>{goal.icon}</Text>
          </ProgressRing>
        </View>
        <View style={styles.goalInfo}>
          <View style={styles.goalTopRow}>
            <Text style={styles.goalName}>{goal.name}</Text>
            {goal.autoAllocate && <Badge text="🤖 Auto" variant="info" size="sm" />}
            {goal.isCompleted && <Badge text="✓ Done" variant="success" size="sm" />}
          </View>
          <Text style={styles.goalAmount}>
            ₹{goal.currentAmount.toLocaleString()} /{' '}
            <Text style={{ color: Colors.textSecondary }}>
              ₹{goal.targetAmount.toLocaleString()}
            </Text>
          </Text>
          <ProgressBar
            progress={progress}
            color={goal.color}
            height={6}
            style={{ marginTop: 4 }}
          />
        </View>
      </View>

      {!goal.isCompleted && (
        <>
          <View style={styles.goalStats}>
            <View style={styles.goalStat}>
              <Text style={styles.goalStatLabel}>Remaining</Text>
              <Text style={styles.goalStatValue}>
                ₹{remaining.toLocaleString()}
              </Text>
            </View>
            <View style={styles.goalStat}>
              <Text style={styles.goalStatLabel}>Time left</Text>
              <Text style={styles.goalStatValue}>
                {monthsLeft} {monthsLeft === 1 ? 'month' : 'months'}
              </Text>
            </View>
            <View style={styles.goalStat}>
              <Text style={styles.goalStatLabel}>Monthly</Text>
              <Text
                style={[
                  styles.goalStatValue,
                  { color: onTrack ? Colors.success : Colors.warning },
                ]}
              >
                ₹{monthlyContribution.toLocaleString()}
              </Text>
            </View>
          </View>

          {!onTrack && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                ⚠️ Increase to ₹{Math.ceil(remaining / monthsLeft).toLocaleString()}/mo to stay on track
              </Text>
            </View>
          )}

          <View style={styles.goalActions}>
            <Button
              title="🗑️"
              onPress={onDelete}
              variant="ghost"
              size="sm"
              style={styles.deleteBtn}
            />
            <Button
              title="+ Add Money"
              onPress={onContribute}
              variant="primary"
              size="sm"
              style={{ flex: 1 }}
            />
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: Colors.white,
    fontSize: 28,
    fontWeight: Typography.weights.bold,
  },
  // Overview
  overview: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  overviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewStats: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  overviewStat: {
    marginVertical: 4,
  },
  overviewStatLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  overviewStatValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  completedBanner: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#D1FAE5',
    borderRadius: BorderRadius.base,
    alignItems: 'center',
  },
  completedText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: '#065F46',
  },
  // AI Tip
  aiTip: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  aiTipIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  aiTipTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  aiTipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    marginTop: 2,
    lineHeight: Typography.sizes.sm * 1.5,
  },
  // Tabs
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterTabText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: Colors.white,
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
  // Goal card
  goalCard: {
    marginBottom: Spacing.base,
  },
  goalCardCompleted: {
    opacity: 0.7,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  goalLeft: {
    marginRight: Spacing.sm,
  },
  goalRingIcon: {
    fontSize: 24,
  },
  goalInfo: {
    flex: 1,
  },
  goalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  goalName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  goalAmount: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  goalStats: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    marginTop: Spacing.sm,
  },
  goalStat: {
    flex: 1,
  },
  goalStatLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  goalStatValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  warningBanner: {
    backgroundColor: '#FEF3C7',
    padding: Spacing.sm,
    borderRadius: BorderRadius.base,
    marginBottom: Spacing.sm,
  },
  warningText: {
    fontSize: Typography.sizes.sm,
    color: '#92400E',
    fontWeight: Typography.weights.medium,
  },
  goalActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteBtn: {
    width: 44,
    marginRight: Spacing.sm,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  modalClose: {
    fontSize: 24,
    color: Colors.textSecondary,
  },
  fieldLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  input: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.base,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  catRow: {
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  catChipIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  catChipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  autoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.base,
  },
  autoLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  autoHint: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.gray300,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  calculation: {
    backgroundColor: '#EEF2FF',
    padding: Spacing.sm,
    borderRadius: BorderRadius.base,
    marginBottom: Spacing.base,
  },
  calculationText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
  },
  // Contribute modal
  contributeModal: {
    backgroundColor: Colors.white,
    margin: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  contributeIcon: {
    fontSize: 48,
  },
  contributeTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  contributeSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginVertical: Spacing.sm,
  },
  contributeInput: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.base,
    padding: Spacing.base,
    width: '100%',
    textAlign: 'center',
    marginVertical: Spacing.base,
  },
  contributePresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  preset: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.full,
  },
  presetText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  contributeActions: {
    flexDirection: 'row',
    width: '100%',
  },
});
