import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  PanResponder,
  Alert,
} from 'react-native';
import { Card, Badge, Button, ProgressBar, EmptyState, Header } from '../../components/shared';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../../styles/theme';

interface Budget {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  limit: number;
  spent: number;
  period: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  alertThreshold: number;
  daysLeft: number;
}

const mockBudgets: Budget[] = [
  {
    id: '1',
    name: 'Food & Dining',
    category: 'food',
    icon: '🍔',
    color: Colors.error,
    limit: 10000,
    spent: 8500,
    period: 'MONTHLY',
    alertThreshold: 0.8,
    daysLeft: 12,
  },
  {
    id: '2',
    name: 'Shopping',
    category: 'shopping',
    icon: '🛍️',
    color: Colors.shopping,
    limit: 5000,
    spent: 6500,
    period: 'MONTHLY',
    alertThreshold: 0.8,
    daysLeft: 12,
  },
  {
    id: '3',
    name: 'Transport',
    category: 'transport',
    icon: '🚗',
    color: Colors.transport,
    limit: 4000,
    spent: 1800,
    period: 'MONTHLY',
    alertThreshold: 0.8,
    daysLeft: 12,
  },
  {
    id: '4',
    name: 'Entertainment',
    category: 'entertainment',
    icon: '🎬',
    color: Colors.entertainment,
    limit: 3000,
    spent: 850,
    period: 'MONTHLY',
    alertThreshold: 0.8,
    daysLeft: 12,
  },
];

const CATEGORIES_FOR_NEW = [
  { id: 'food', label: 'Food & Dining', icon: '🍔' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'transport', label: 'Transport', icon: '🚗' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { id: 'bills', label: 'Bills & Utilities', icon: '⚡' },
  { id: 'health', label: 'Health', icon: '💊' },
  { id: 'other', label: 'Other', icon: '📦' },
];

export function BudgetsScreen({ navigation }: any) {
  const [budgets, setBudgets] = useState<Budget[]>(mockBudgets);
  const [showCreate, setShowCreate] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [newBudget, setNewBudget] = useState({
    name: '',
    category: 'food',
    icon: '🍔',
    limit: '5000',
  });

  const totals = useMemo(() => {
    const totalLimit = budgets.reduce((sum, b) => sum + b.limit, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
    const overBudget = budgets.filter((b) => b.spent > b.limit).length;
    return { totalLimit, totalSpent, overBudget };
  }, [budgets]);

  const handleCreate = () => {
    if (!newBudget.name || !newBudget.limit) {
      Alert.alert('Missing fields', 'Please fill all fields');
      return;
    }
    const cat = CATEGORIES_FOR_NEW.find((c) => c.id === newBudget.category);
    setBudgets([
      ...budgets,
      {
        id: String(Date.now()),
        name: newBudget.name,
        category: newBudget.category,
        icon: cat?.icon || '📦',
        color: Colors.primary,
        limit: parseFloat(newBudget.limit),
        spent: 0,
        period: 'MONTHLY',
        alertThreshold: 0.8,
        daysLeft: 30,
      },
    ]);
    setNewBudget({ name: '', category: 'food', icon: '🍔', limit: '5000' });
    setShowCreate(false);
  };

  const handleUpdateLimit = (id: string, newLimit: number) => {
    setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, limit: newLimit } : b)));
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Budget', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setBudgets((prev) => prev.filter((b) => b.id !== id)),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Budgets</Text>
            <Text style={styles.subtitle}>Stay on track with smart limits</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Overview */}
        <Card style={styles.overview}>
          <Text style={styles.overviewLabel}>Total Budget Used</Text>
          <Text style={styles.overviewValue}>
            ₹{totals.totalSpent.toLocaleString()} / ₹{totals.totalLimit.toLocaleString()}
          </Text>
          <ProgressBar
            progress={(totals.totalSpent / totals.totalLimit) * 100}
            color={
              totals.totalSpent > totals.totalLimit ? Colors.error : Colors.primary
            }
            height={10}
            style={{ marginVertical: Spacing.sm }}
          />
          <View style={styles.overviewRow}>
            <Text style={styles.overviewMeta}>
              {Math.round((totals.totalSpent / totals.totalLimit) * 100)}% used
            </Text>
            {totals.overBudget > 0 && (
              <Badge
                text={`${totals.overBudget} over budget`}
                variant="error"
                size="sm"
              />
            )}
          </View>
        </Card>

        {/* AI Alert */}
        <Card style={styles.aiAlert}>
          <View style={styles.aiAlertContent}>
            <Text style={styles.aiAlertIcon}>🔮</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiAlertTitle}>Forecast Alert</Text>
              <Text style={styles.aiAlertText}>
                You'll exceed your Food budget in 4 days at current pace
              </Text>
            </View>
          </View>
        </Card>

        {/* Budgets list */}
        {budgets.length === 0 ? (
          <EmptyState
            icon="📊"
            title="No budgets yet"
            message="Create your first budget to track spending"
            actionLabel="Create Budget"
            onAction={() => setShowCreate(true)}
          />
        ) : (
          <View style={styles.list}>
            {budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onUpdateLimit={(newLimit) => handleUpdateLimit(budget.id, newLimit)}
                onEdit={() => setEditingBudget(budget)}
                onDelete={() => handleDelete(budget.id)}
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      {/* Create Modal */}
      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Budget</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Budget Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Monthly Food"
              placeholderTextColor={Colors.textTertiary}
              value={newBudget.name}
              onChangeText={(t) => setNewBudget({ ...newBudget, name: t })}
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catRow}
            >
              {CATEGORIES_FOR_NEW.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catChip,
                    newBudget.category === cat.id && styles.catChipActive,
                  ]}
                  onPress={() =>
                    setNewBudget({ ...newBudget, category: cat.id, icon: cat.icon })
                  }
                >
                  <Text style={styles.catChipIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.catChipText,
                      newBudget.category === cat.id && styles.catChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Monthly Limit (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="5000"
              placeholderTextColor={Colors.textTertiary}
              value={newBudget.limit}
              onChangeText={(t) => setNewBudget({ ...newBudget, limit: t })}
              keyboardType="numeric"
            />

            <View style={styles.aiSuggest}>
              <Text style={styles.aiSuggestText}>
                💡 Based on your past spending, we suggest ₹6,500/month for this category
              </Text>
            </View>

            <Button
              title="Create Budget"
              onPress={handleCreate}
              variant="primary"
              fullWidth
              style={{ marginTop: Spacing.lg }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface BudgetCardProps {
  budget: Budget;
  onUpdateLimit: (newLimit: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function BudgetCard({ budget, onUpdateLimit, onDelete }: BudgetCardProps) {
  const [tempLimit, setTempLimit] = useState(budget.limit);
  const usage = (budget.spent / tempLimit) * 100;
  const isOver = budget.spent > tempLimit;
  const isNearLimit = usage >= budget.alertThreshold * 100 && usage < 100;
  const remaining = tempLimit - budget.spent;
  const dailyAllowance = remaining > 0 ? Math.floor(remaining / Math.max(budget.daysLeft, 1)) : 0;

  // Slider for budget limit
  const sliderMin = 1000;
  const sliderMax = 30000;
  const sliderPos = ((tempLimit - sliderMin) / (sliderMax - sliderMin)) * 100;

  const handleSliderChange = (delta: number) => {
    const step = 500;
    const next = Math.max(sliderMin, Math.min(sliderMax, tempLimit + delta * step));
    setTempLimit(next);
    onUpdateLimit(next);
  };

  return (
    <Card style={[styles.bCard, isOver && styles.bCardOver]}>
      <View style={styles.bHeader}>
        <View style={[styles.bIcon, { backgroundColor: budget.color + '20' }]}>
          <Text style={styles.bIconText}>{budget.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bName}>{budget.name}</Text>
          <Text style={styles.bMeta}>{budget.daysLeft} days left this month</Text>
        </View>
        <TouchableOpacity onPress={onDelete}>
          <Text style={styles.bDelete}>🗑️</Text>
        </TouchableOpacity>
      </View>

      {/* Spending progress */}
      <View style={styles.bProgress}>
        <View style={styles.bProgressRow}>
          <Text
            style={[
              styles.bSpent,
              { color: isOver ? Colors.error : Colors.textPrimary },
            ]}
          >
            ₹{budget.spent.toLocaleString()}
          </Text>
          <Text style={styles.bLimit}>of ₹{tempLimit.toLocaleString()}</Text>
        </View>
        <ProgressBar
          progress={Math.min(usage, 100)}
          color={isOver ? Colors.error : isNearLimit ? Colors.warning : Colors.success}
          height={10}
        />
        <View style={styles.bProgressFooter}>
          <Text
            style={[
              styles.bUsage,
              { color: isOver ? Colors.error : Colors.textSecondary },
            ]}
          >
            {Math.round(usage)}% used
          </Text>
          {isOver ? (
            <Badge text={`Over by ₹${(budget.spent - tempLimit).toLocaleString()}`} variant="error" size="sm" />
          ) : (
            <Text style={styles.bRemaining}>₹{remaining.toLocaleString()} left</Text>
          )}
        </View>
      </View>

      {/* Live limit slider */}
      <View style={styles.sliderSection}>
        <Text style={styles.sliderLabel}>Adjust limit (live):</Text>
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${sliderPos}%` }]} />
          <View style={[styles.sliderThumb, { left: `${sliderPos}%` }]} />
        </View>
        <View style={styles.sliderActions}>
          <TouchableOpacity
            style={styles.sliderBtn}
            onPress={() => handleSliderChange(-1)}
          >
            <Text style={styles.sliderBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.sliderValue}>₹{tempLimit.toLocaleString()}</Text>
          <TouchableOpacity
            style={styles.sliderBtn}
            onPress={() => handleSliderChange(1)}
          >
            <Text style={styles.sliderBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Daily allowance */}
      <View style={styles.bFooter}>
        <View style={styles.bFooterItem}>
          <Text style={styles.bFooterLabel}>Daily allowance</Text>
          <Text style={styles.bFooterValue}>
            ₹{dailyAllowance.toLocaleString()}
          </Text>
        </View>
        <View style={styles.bFooterDivider} />
        <View style={styles.bFooterItem}>
          <Text style={styles.bFooterLabel}>Daily avg spent</Text>
          <Text style={styles.bFooterValue}>
            ₹{Math.round(budget.spent / (30 - budget.daysLeft || 1)).toLocaleString()}
          </Text>
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
  overviewLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  overviewValue: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewMeta: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  // AI Alert
  aiAlert: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  aiAlertContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiAlertIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  aiAlertTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  aiAlertText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
  // Budget card
  bCard: {
    marginBottom: Spacing.base,
  },
  bCardOver: {
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  bHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  bIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  bIconText: {
    fontSize: 20,
  },
  bName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  bMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bDelete: {
    fontSize: 18,
    padding: Spacing.xs,
  },
  bProgress: {
    marginBottom: Spacing.sm,
  },
  bProgressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  bSpent: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
  },
  bLimit: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  bProgressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  bUsage: {
    fontSize: Typography.sizes.sm,
  },
  bRemaining: {
    fontSize: Typography.sizes.sm,
    color: Colors.success,
    fontWeight: Typography.weights.semiBold,
  },
  // Slider
  sliderSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  sliderLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: Colors.gray200,
    borderRadius: 3,
    position: 'relative',
    marginVertical: Spacing.sm,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    top: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    marginLeft: -10,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  sliderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  sliderBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBtnText: {
    fontSize: 20,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  sliderValue: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  // Footer
  bFooter: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  bFooterItem: {
    flex: 1,
    alignItems: 'center',
  },
  bFooterDivider: {
    width: 1,
    backgroundColor: Colors.gray200,
  },
  bFooterLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  bFooterValue: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    maxHeight: '85%',
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
  catChipActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EEF2FF',
  },
  catChipIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  catChipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  catChipTextActive: {
    fontWeight: Typography.weights.semiBold,
    color: Colors.primary,
  },
  aiSuggest: {
    backgroundColor: '#EEF2FF',
    padding: Spacing.sm,
    borderRadius: BorderRadius.base,
  },
  aiSuggestText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
  },
});
