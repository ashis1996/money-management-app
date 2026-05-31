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
  Utensils,
  ShoppingBag,
  Car,
  Clapperboard,
  Zap,
  Pill,
  Package,
  Plus,
  X,
  Sparkles,
  ArrowRight,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { Badge, Button, Card, EmptyState, Header, ProgressBar } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { useBudgets, useCreateBudget, useDeleteBudget } from '../../hooks';
import { formatCurrency } from '../../utils';

interface Budget {
  id: string;
  name: string;
  category: string;
  limit: number;
  spent: number;
  period: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  daysLeft: number;
}

interface BudgetCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const CATEGORIES: BudgetCategory[] = [
  { id: 'food', label: 'Food &amp; Dining', icon: Utensils, color: '#EF4444' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#A78BFA' },
  { id: 'transport', label: 'Transport', icon: Car, color: Colors.accentPrimary },
  { id: 'entertainment', label: 'Entertainment', icon: Clapperboard, color: '#F472B6' },
  { id: 'bills', label: 'Bills', icon: Zap, color: Colors.accentWarning },
  { id: 'health', label: 'Health', icon: Pill, color: Colors.accentSuccess },
  { id: 'other', label: 'Other', icon: Package, color: Colors.outline },
];

function categoryFor(id: string | undefined): BudgetCategory {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[6];
}

export function BudgetsScreen({ navigation }: any) {
  const budgetsQuery = useBudgets();
  const createBudget = useCreateBudget();
  const deleteBudget = useDeleteBudget();

  const budgets: Budget[] = useMemo(() => {
    const list = budgetsQuery.data || [];
    return list.map((b: any) => ({
      id: b.id,
      name: b.name || 'Budget',
      category: b.category || b.categoryId || 'other',
      limit: Number(b.limit ?? b.amount ?? 0),
      spent: Number(b.spent ?? 0),
      period: (b.period || 'MONTHLY') as Budget['period'],
      daysLeft: Number(b.daysLeft ?? 0),
    }));
  }, [budgetsQuery.data]);

  const [createOpen, setCreateOpen] = useState(false);

  const stats = useMemo(() => {
    const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
    const overshooting = budgets.filter((b) => b.spent > b.limit).length;
    return {
      totalLimit,
      totalSpent,
      remaining: Math.max(0, totalLimit - totalSpent),
      overshooting,
      utilization: totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0,
    };
  }, [budgets]);

  const handleDelete = (id: string) =>
    Alert.alert('Delete budget?', 'You can recreate it any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteBudget.mutate(id),
      },
    ]);

  return (
    <View style={styles.container}>
      <Header
        title="Budgets"
        subtitle={`${budgets.length} active`}
        onBack={() => navigation.goBack()}
        rightContent={
          <TouchableOpacity
            onPress={() => setCreateOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Create budget"
            style={styles.headerCta}
          >
            <Plus size={16} color={Colors.white} strokeWidth={2.5} />
            <Text style={styles.headerCtaText}>New</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Card variant="hero" padding="xl">
          <View style={styles.heroRow}>
            <View style={styles.heroCol}>
              <Text style={styles.heroLabel}>BUDGET</Text>
              <Text style={styles.heroValue}>
                {formatCurrency(stats.totalLimit, { compact: true })}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroCol}>
              <Text style={styles.heroLabel}>SPENT</Text>
              <Text style={styles.heroValue}>
                {formatCurrency(stats.totalSpent, { compact: true })}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroCol}>
              <Text style={styles.heroLabel}>LEFT</Text>
              <Text style={[styles.heroValue, { color: Colors.accentSuccess }]}>
                {formatCurrency(stats.remaining, { compact: true })}
              </Text>
            </View>
          </View>

          <View style={styles.heroBarRow}>
            <Text style={styles.heroBarLabel}>{stats.utilization}% utilised</Text>
            {stats.overshooting > 0 && (
              <Badge text={`${stats.overshooting} over`} variant="error" size="sm" />
            )}
          </View>
          <ProgressBar
            progress={stats.utilization}
            color={
              stats.utilization >= 100
                ? Colors.accentError
                : stats.utilization >= 80
                  ? Colors.accentWarning
                  : Colors.accentSuccess
            }
          />
        </Card>

        {/* AI summary */}
        {budgets.length > 0 && (
          <Card variant="ai" padding="base" style={{ marginTop: Spacing.base }}>
            <View style={styles.aiSummaryRow}>
              <View style={styles.aiSummaryIcon}>
                <Sparkles size={16} color={Colors.accentAi} strokeWidth={1.75} />
              </View>
              <Text style={styles.aiSummaryText}>
                {stats.overshooting > 0
                  ? `${stats.overshooting} ${stats.overshooting === 1 ? 'budget is' : 'budgets are'} over their limit. Tap one to see where the spend is going.`
                  : `On track to save ${formatCurrency(stats.remaining, { compact: true })} this period — keep it up.`}
              </Text>
            </View>
          </Card>
        )}

        {budgets.length === 0 ? (
          <EmptyState
            icon="📊"
            title="No budgets yet"
            message="Set a category budget — we\u2019ll alert you at 80% so you never overshoot."
            actionLabel="Create budget"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <View style={{ marginTop: Spacing.lg }}>
            {budgets.map((b) => (
              <BudgetCard key={b.id} budget={b} onDelete={() => handleDelete(b.id)} />
            ))}
          </View>
        )}

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>

      <CreateBudgetModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(payload) => {
          createBudget.mutate(payload, {
            onSuccess: () => setCreateOpen(false),
          });
        }}
      />
    </View>
  );
}

// =============================================================
// Budget card
// =============================================================
function BudgetCard({ budget, onDelete }: { budget: Budget; onDelete: () => void }) {
  const cat = categoryFor(budget.category);
  const Icon = cat.icon;
  const utilization = Math.round((budget.spent / Math.max(1, budget.limit)) * 100);
  const tone =
    utilization >= 100
      ? Colors.accentError
      : utilization >= 80
        ? Colors.accentWarning
        : Colors.accentSuccess;

  return (
    <Card padding="base" style={styles.budgetCard}>
      <View style={styles.budgetTopRow}>
        <View
          style={[
            styles.budgetIcon,
            {
              backgroundColor: cat.color + '22',
              borderColor: cat.color + '44',
            },
          ]}
        >
          <Icon size={18} color={cat.color} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.budgetName} numberOfLines={1}>
            {budget.name}
          </Text>
          <Text style={styles.budgetMeta}>
            {cat.label} • {budget.period.toLowerCase()}
            {budget.daysLeft > 0 ? ` • ${budget.daysLeft}d left` : ''}
          </Text>
        </View>
        <Badge
          text={utilization >= 100 ? 'Over' : utilization >= 80 ? 'Watch' : 'On track'}
          variant={utilization >= 100 ? 'error' : utilization >= 80 ? 'warning' : 'success'}
          size="sm"
        />
      </View>

      <View style={styles.budgetFigures}>
        <Text style={styles.budgetSpent}>{formatCurrency(budget.spent)}</Text>
        <Text style={styles.budgetLimit}> / {formatCurrency(budget.limit)}</Text>
      </View>

      <View style={styles.budgetBarRow}>
        <Text style={styles.budgetUtil}>{utilization}%</Text>
      </View>
      <ProgressBar progress={utilization} color={tone} />

      <View style={styles.budgetActions}>
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
          title="View transactions"
          size="sm"
          onPress={() => Alert.alert('Coming soon', 'Drill-down from budgets is on the roadmap.')}
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
function CreateBudgetModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (payload: any) => void;
}) {
  const [category, setCategory] = useState<string>('food');
  const [limit, setLimit] = useState('');
  const [period, setPeriod] = useState<'WEEKLY' | 'MONTHLY' | 'YEARLY'>('MONTHLY');

  const handleCreate = () => {
    const value = Number(limit.replace(/[^0-9.]/g, ''));
    if (!value || value <= 0) {
      Alert.alert('Invalid amount', 'Set a positive limit.');
      return;
    }
    const cat = categoryFor(category);
    onCreate({
      name: cat.label,
      category,
      limit: value,
      amount: value,
      period,
    });
    setLimit('');
    setCategory('food');
    setPeriod('MONTHLY');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New budget</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={Colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>CATEGORY</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((c) => {
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

          <Text style={styles.modalLabel}>LIMIT (₹)</Text>
          <TextInput
            value={limit}
            onChangeText={setLimit}
            placeholder="10000"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="numeric"
            style={styles.modalInput}
          />

          <Text style={styles.modalLabel}>PERIOD</Text>
          <View style={styles.periodRow}>
            {(['WEEKLY', 'MONTHLY', 'YEARLY'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                accessibilityRole="radio"
                accessibilityState={{ selected: period === p }}
                style={[styles.periodTile, period === p && styles.periodTileActive]}
              >
                <Text
                  style={[styles.periodTileLabel, period === p && styles.periodTileLabelActive]}
                >
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: Spacing.xl }}>
            <Button
              title="Create budget"
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
  },

  // Hero
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: Typography.sizes['2xl'],
    color: Colors.textPrimary,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.6,
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.borderDefault,
    marginHorizontal: Spacing.sm,
  },
  heroBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  heroBarLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },

  // AI summary
  aiSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  aiSummaryText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.5,
  },

  // Budget card
  budgetCard: {
    marginBottom: Spacing.sm,
  },
  budgetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  budgetIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  budgetName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
  },
  budgetMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.4,
  },

  budgetFigures: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  budgetSpent: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.6,
  },
  budgetLimit: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'] as any,
  },

  budgetBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  budgetUtil: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    fontWeight: Typography.weights.semiBold,
    fontVariant: ['tabular-nums'] as any,
  },

  budgetActions: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
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

  periodRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  periodTile: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
  },
  periodTileActive: {
    backgroundColor: 'rgba(59,130,246,0.20)',
    borderColor: Colors.accentPrimary,
  },
  periodTileLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
  periodTileLabelActive: {
    color: Colors.accentPrimary,
  },
});
