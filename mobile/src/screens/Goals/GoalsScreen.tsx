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
} from 'react-native';
import {
  Shield,
  Plane,
  Smartphone,
  Car,
  Home as HomeIcon,
  GraduationCap,
  Heart as HeartIcon,
  Target,
  Plus,
  X,
  Sparkles,
  ArrowRight,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Header,
  ProgressRing,
  Section,
} from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { useGoals, useCreateGoal, useContributeGoal, useDeleteGoal } from '../../hooks';
import { formatCurrency } from '../../utils';

interface Goal {
  id: string;
  name: string;
  category?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string | null;
  isCompleted: boolean;
  progressPercent?: number;
  monthsToGoal?: number | null;
}

interface GoalCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const GOAL_CATEGORIES: GoalCategory[] = [
  { id: 'emergency', label: 'Emergency', icon: Shield, color: Colors.accentSuccess },
  { id: 'travel', label: 'Travel', icon: Plane, color: Colors.accentPrimary },
  { id: 'gadget', label: 'Gadget', icon: Smartphone, color: '#A78BFA' },
  { id: 'vehicle', label: 'Vehicle', icon: Car, color: Colors.accentWarning },
  { id: 'home', label: 'Home', icon: HomeIcon, color: '#F472B6' },
  { id: 'education', label: 'Education', icon: GraduationCap, color: Colors.accentAi },
  { id: 'wedding', label: 'Wedding', icon: HeartIcon, color: '#EC4899' },
  { id: 'other', label: 'Other', icon: Target, color: '#6366F1' },
];

function categoryFor(id: string | undefined): GoalCategory {
  return GOAL_CATEGORIES.find((c) => c.id === id) ?? GOAL_CATEGORIES[7];
}

type FilterType = 'active' | 'completed' | 'all';

export function GoalsScreen({ navigation }: any) {
  const goalsQuery = useGoals();
  const createGoal = useCreateGoal();
  const contributeGoal = useContributeGoal();
  const deleteGoal = useDeleteGoal();

  const goals: Goal[] = useMemo(() => {
    const list = goalsQuery.data || [];
    return list.map((g: any) => ({
      id: g.id,
      name: g.name,
      category: g.category || g.categoryId,
      targetAmount: Number(g.targetAmount ?? 0),
      currentAmount: Number(g.currentAmount ?? 0),
      targetDate: g.targetDate,
      isCompleted: !!g.isCompleted,
      progressPercent: Number(g.progressPercent ?? 0),
      monthsToGoal: g.monthsToGoal,
    }));
  }, [goalsQuery.data]);

  const [filter, setFilter] = useState<FilterType>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [contributeFor, setContributeFor] = useState<Goal | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'active') return goals.filter((g) => !g.isCompleted);
    if (filter === 'completed') return goals.filter((g) => g.isCompleted);
    return goals;
  }, [goals, filter]);

  const stats = useMemo(() => {
    const active = goals.filter((g) => !g.isCompleted);
    const completed = goals.filter((g) => g.isCompleted).length;
    const totalTarget = active.reduce((s, g) => s + g.targetAmount, 0);
    const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0);
    return { activeCount: active.length, completed, totalTarget, totalSaved };
  }, [goals]);

  const handleDelete = (id: string) =>
    Alert.alert('Delete this goal?', 'You\u2019ll lose its history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteGoal.mutate(id),
      },
    ]);

  return (
    <View style={styles.container}>
      <Header
        title="Savings Goals"
        subtitle={`${stats.activeCount} active${stats.completed > 0 ? ` • ${stats.completed} completed` : ''}`}
        onBack={() => navigation.goBack()}
        rightContent={
          <TouchableOpacity
            onPress={() => setCreateOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Create goal"
            style={styles.headerCta}
          >
            <Plus size={16} color={Colors.white} strokeWidth={2.5} />
            <Text style={styles.headerCtaText}>New</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero stats */}
        <Card variant="hero" padding="xl">
          <Text style={styles.heroLabel}>SAVED TOWARDS GOALS</Text>
          <Text style={styles.heroValue}>{formatCurrency(stats.totalSaved)}</Text>
          <Text style={styles.heroSub}>of {formatCurrency(stats.totalTarget)} target</Text>
          <View style={{ marginTop: Spacing.base }}>
            <ProgressRingHero
              progress={stats.totalTarget > 0 ? (stats.totalSaved / stats.totalTarget) * 100 : 0}
            />
          </View>
        </Card>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {(['active', 'completed', 'all'] as FilterType[]).map((f) => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                accessibilityRole="button"
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {filtered.length === 0 ? (
          <EmptyState
            icon="🎯"
            title={filter === 'completed' ? 'No completed goals yet' : 'No goals yet'}
            message={
              filter === 'completed'
                ? 'Complete a goal to celebrate it here.'
                : 'Set a savings goal — we\u2019ll track contributions and forecast when you\u2019ll hit it.'
            }
            actionLabel={filter !== 'completed' ? 'Create goal' : undefined}
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <View>
            {filtered.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onContribute={() => setContributeFor(goal)}
                onDelete={() => handleDelete(goal.id)}
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>

      <CreateGoalModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(payload) => {
          createGoal.mutate(payload, {
            onSuccess: () => setCreateOpen(false),
          });
        }}
      />

      <ContributeModal
        goal={contributeFor}
        onClose={() => setContributeFor(null)}
        onContribute={(amount) => {
          if (!contributeFor) return;
          contributeGoal.mutate(
            { id: contributeFor.id, amount },
            { onSuccess: () => setContributeFor(null) },
          );
        }}
      />
    </View>
  );
}

// =============================================================
// Hero ring (only renders if there's progress to show)
// =============================================================
function ProgressRingHero({ progress }: { progress: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <ProgressRing progress={progress} size={64} strokeWidth={6} gradient showPercentage />
      <Text style={styles.heroProgressText}>
        {progress > 0
          ? `You're ${Math.round(progress)}% of the way there`
          : 'Start contributing to see progress'}
      </Text>
    </View>
  );
}

// =============================================================
// Goal card
// =============================================================
function GoalCard({
  goal,
  onContribute,
  onDelete,
}: {
  goal: Goal;
  onContribute: () => void;
  onDelete: () => void;
}) {
  const cat = categoryFor(goal.category);
  const Icon = cat.icon;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const monthsToGoal = goal.monthsToGoal ?? null;

  return (
    <Card padding="base" style={styles.goalCard}>
      <View style={styles.goalTopRow}>
        <View
          style={[
            styles.goalIcon,
            {
              backgroundColor: cat.color + '22',
              borderColor: cat.color + '44',
            },
          ]}
        >
          <Icon size={18} color={cat.color} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.goalName} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={styles.goalCategory}>{cat.label}</Text>
        </View>
        {goal.isCompleted && <Badge text="Done" variant="success" size="sm" />}
      </View>

      <View style={styles.goalProgress}>
        <ProgressRing
          progress={Number(goal.progressPercent ?? 0)}
          size={88}
          strokeWidth={7}
          color={cat.color}
        />
        <View style={styles.goalProgressInfo}>
          <Text style={styles.goalAmounts}>
            <Text style={styles.goalCurrent}>{formatCurrency(goal.currentAmount)}</Text>
            <Text style={styles.goalSep}> / </Text>
            <Text style={styles.goalTarget}>{formatCurrency(goal.targetAmount)}</Text>
          </Text>
          <Text style={styles.goalRemainingLabel}>{formatCurrency(remaining)} TO GO</Text>
          {monthsToGoal !== null && monthsToGoal !== undefined && (
            <View style={styles.goalForecast}>
              <Sparkles size={12} color={Colors.accentAi} strokeWidth={2} />
              <Text style={styles.goalForecastText}>
                {monthsToGoal} {monthsToGoal === 1 ? 'month' : 'months'} at this pace
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.goalActions}>
        <Button
          title="Delete"
          variant="secondary"
          size="sm"
          onPress={onDelete}
          leadingIcon={<Trash2 size={14} color={Colors.textPrimary} strokeWidth={2} />}
          style={{ flex: 1 }}
        />
        <View style={{ width: Spacing.sm }} />
        <Button
          title="Contribute"
          size="sm"
          onPress={onContribute}
          trailingIcon={<ArrowRight size={14} color={Colors.white} strokeWidth={2} />}
          style={{ flex: 2 }}
        />
      </View>
    </Card>
  );
}

// =============================================================
// Create modal
// =============================================================
function CreateGoalModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (payload: any) => void;
}) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [category, setCategory] = useState<string>('other');

  const handleCreate = () => {
    const amount = Number(target.replace(/[^0-9.]/g, ''));
    if (!name.trim() || !amount || amount <= 0) {
      Alert.alert('Missing details', 'Please enter a name and target amount.');
      return;
    }
    onCreate({
      name: name.trim(),
      targetAmount: amount,
      category,
    });
    setName('');
    setTarget('');
    setCategory('other');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New goal</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={Colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Europe trip"
            placeholderTextColor={Colors.textTertiary}
            style={styles.modalInput}
          />

          <Text style={styles.modalLabel}>TARGET AMOUNT (₹)</Text>
          <TextInput
            value={target}
            onChangeText={setTarget}
            placeholder="300000"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="numeric"
            style={styles.modalInput}
          />

          <Text style={styles.modalLabel}>CATEGORY</Text>
          <View style={styles.categoryGrid}>
            {GOAL_CATEGORIES.map((c) => {
              const active = category === c.id;
              const Icon = c.icon;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.categoryTile,
                    active && {
                      borderColor: c.color,
                      backgroundColor: c.color + '14',
                    },
                  ]}
                >
                  <Icon
                    size={18}
                    color={active ? c.color : Colors.textSecondary}
                    strokeWidth={1.75}
                  />
                  <Text style={[styles.categoryTileLabel, active && { color: c.color }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ marginTop: Spacing.xl }}>
            <Button
              title="Create goal"
              onPress={handleCreate}
              fullWidth
              size="lg"
              trailingIcon={<ArrowRight size={16} color={Colors.white} strokeWidth={2} />}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================
// Contribute modal
// =============================================================
function ContributeModal({
  goal,
  onClose,
  onContribute,
}: {
  goal: Goal | null;
  onClose: () => void;
  onContribute: (amount: number) => void;
}) {
  const [amount, setAmount] = useState('');
  if (!goal) return null;

  const handle = () => {
    const value = Number(amount.replace(/[^0-9.]/g, ''));
    if (!value || value <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number.');
      return;
    }
    onContribute(value);
    setAmount('');
  };

  return (
    <Modal visible={!!goal} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              Add to {goal.name}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={Colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>AMOUNT (₹)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="5000"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="numeric"
            autoFocus
            style={styles.modalInput}
          />

          <View style={{ marginTop: Spacing.xl }}>
            <Button
              title="Contribute"
              onPress={handle}
              fullWidth
              size="lg"
              trailingIcon={<ArrowRight size={16} color={Colors.white} strokeWidth={2} />}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  headerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accentPrimary,
    gap: 4,
  },
  headerCtaText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    letterSpacing: 0.4,
  },

  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['3xl'],
  },

  // Hero
  heroLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1.2,
    fontWeight: Typography.weights.medium,
  },
  heroValue: {
    marginTop: 4,
    fontSize: 40,
    lineHeight: 44,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'] as any,
  },
  heroProgressText: {
    flex: 1,
    marginLeft: Spacing.base,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.4,
  },

  // Tabs
  tabs: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
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

  // Goal card
  goalCard: {
    marginBottom: Spacing.sm,
  },
  goalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  goalName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
  },
  goalCategory: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    letterSpacing: 0.4,
    marginTop: 2,
  },

  goalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  goalProgressInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  goalAmounts: {
    fontSize: Typography.sizes.base,
    fontVariant: ['tabular-nums'] as any,
  },
  goalCurrent: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
  },
  goalSep: {
    color: Colors.textTertiary,
    fontWeight: Typography.weights.regular,
  },
  goalTarget: {
    color: Colors.textSecondary,
    fontWeight: Typography.weights.regular,
  },
  goalRemainingLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.accentSuccess,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    letterSpacing: 0.6,
    marginTop: 4,
    fontVariant: ['tabular-nums'] as any,
  },
  goalForecast: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: 4,
  },
  goalForecastText: {
    fontSize: Typography.sizes.xs,
    color: Colors.accentAi,
  },

  goalActions: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surfaceContainerHighest,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.outline,
    alignSelf: 'center',
    marginBottom: Spacing.base,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    flex: 1,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
  },
  modalLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    fontWeight: Typography.weights.semiBold,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  modalInput: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.base,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },

  // Category grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  categoryTile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    gap: 6,
  },
  categoryTileLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
});
