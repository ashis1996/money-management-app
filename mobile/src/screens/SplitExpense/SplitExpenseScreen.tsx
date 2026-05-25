import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Share,
} from 'react-native';
import { Card, Badge, Button, Header, EmptyState } from '../../components/shared';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../../styles/theme';

type SplitMode = 'equal' | 'percentage' | 'custom' | 'shares';

interface Person {
  id: string;
  name: string;
  initial: string;
  color: string;
  // Split data
  amount?: number;
  percentage?: number;
  shares?: number;
  customAmount?: number;
  isPaid: boolean;
}

const AVATAR_COLORS = [
  '#EF4444',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

interface PastSplit {
  id: string;
  title: string;
  totalAmount: number;
  date: string;
  people: number;
  yourShare: number;
  status: 'pending' | 'settled';
}

const mockPastSplits: PastSplit[] = [
  {
    id: 'p1',
    title: 'Goa Trip',
    totalAmount: 12500,
    date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    people: 4,
    yourShare: 3125,
    status: 'pending',
  },
  {
    id: 'p2',
    title: "Friday Dinner",
    totalAmount: 4800,
    date: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
    people: 3,
    yourShare: 1600,
    status: 'settled',
  },
];

export function SplitExpenseScreen({ navigation, route }: any) {
  const presetAmount = route?.params?.amount;
  const presetMerchant = route?.params?.merchant;

  const [title, setTitle] = useState(presetMerchant ? `Split with ${presetMerchant}` : '');
  const [totalAmount, setTotalAmount] = useState(
    presetAmount ? String(presetAmount) : ''
  );
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [people, setPeople] = useState<Person[]>([
    {
      id: 'me',
      name: 'You',
      initial: 'Y',
      color: Colors.primary,
      isPaid: true,
    },
    {
      id: 'p1',
      name: 'Rahul',
      initial: 'R',
      color: AVATAR_COLORS[0],
      isPaid: false,
    },
    {
      id: 'p2',
      name: 'Priya',
      initial: 'P',
      color: AVATAR_COLORS[1],
      isPaid: false,
    },
  ]);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [showHistory, setShowHistory] = useState(true);

  const total = parseFloat(totalAmount) || 0;
  const peopleCount = people.length;

  // Compute splits
  const computedPeople = useMemo(() => {
    if (total === 0) {
      return people.map((p) => ({ ...p, amount: 0 }));
    }

    if (splitMode === 'equal') {
      const each = Math.round((total / peopleCount) * 100) / 100;
      return people.map((p) => ({ ...p, amount: each }));
    }

    if (splitMode === 'percentage') {
      const equalPct = Math.round(100 / peopleCount);
      return people.map((p) => {
        const pct = p.percentage ?? equalPct;
        return { ...p, amount: Math.round((total * pct) / 100 * 100) / 100, percentage: pct };
      });
    }

    if (splitMode === 'shares') {
      const totalShares = people.reduce((s, p) => s + (p.shares ?? 1), 0);
      return people.map((p) => {
        const sh = p.shares ?? 1;
        return { ...p, amount: Math.round((total * sh) / totalShares * 100) / 100, shares: sh };
      });
    }

    if (splitMode === 'custom') {
      return people.map((p) => ({ ...p, amount: p.customAmount ?? 0 }));
    }

    return people;
  }, [people, total, splitMode, peopleCount]);

  const customSum = useMemo(() => {
    if (splitMode !== 'custom') return total;
    return computedPeople.reduce((s, p) => s + (p.amount ?? 0), 0);
  }, [computedPeople, splitMode, total]);

  const customDiff = total - customSum;

  const yourShare = computedPeople.find((p) => p.id === 'me')?.amount ?? 0;
  const owedToYou = total - yourShare;

  const handleAddPerson = () => {
    if (!newPersonName.trim()) return;
    setPeople([
      ...people,
      {
        id: `p-${Date.now()}`,
        name: newPersonName.trim(),
        initial: newPersonName.trim().charAt(0).toUpperCase(),
        color: AVATAR_COLORS[people.length % AVATAR_COLORS.length],
        isPaid: false,
      },
    ]);
    setNewPersonName('');
    setShowAddPerson(false);
  };

  const handleRemovePerson = (id: string) => {
    if (id === 'me') return;
    setPeople((prev) => prev.filter((p) => p.id !== id));
  };

  const handleTogglePaid = (id: string) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isPaid: !p.isPaid } : p))
    );
  };

  const handleUpdatePercentage = (id: string, value: string) => {
    const pct = parseFloat(value) || 0;
    setPeople((prev) =>
      prev.map((p) => (p.id === id ? { ...p, percentage: pct } : p))
    );
  };

  const handleUpdateShares = (id: string, delta: number) => {
    setPeople((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, shares: Math.max(1, (p.shares ?? 1) + delta) } : p
      )
    );
  };

  const handleUpdateCustom = (id: string, value: string) => {
    const amt = parseFloat(value) || 0;
    setPeople((prev) =>
      prev.map((p) => (p.id === id ? { ...p, customAmount: amt } : p))
    );
  };

  const handleSendReminder = async (person: Person) => {
    try {
      await Share.share({
        message: `Hey ${person.name}! You owe ₹${person.amount?.toLocaleString()} for "${title || 'our split expense'}". Could you settle it when you get a chance? Thanks! 🙏`,
      });
    } catch {}
  };

  const handleSaveSplit = () => {
    if (!title || !totalAmount) {
      Alert.alert('Missing info', 'Add a title and amount to save');
      return;
    }
    if (splitMode === 'custom' && Math.abs(customDiff) > 0.01) {
      Alert.alert(
        'Amounts don\'t match',
        `Sum is ₹${customSum.toLocaleString()} but total is ₹${total.toLocaleString()}. Adjust the custom amounts.`
      );
      return;
    }
    Alert.alert('Split saved', 'Reminders will be sent to each person', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <View style={styles.container}>
      <Header
        title="Split Expense"
        subtitle="Share costs with friends"
        onBack={() => navigation.goBack()}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* History toggle */}
        {mockPastSplits.length > 0 && (
          <TouchableOpacity
            style={styles.historyToggle}
            onPress={() => setShowHistory(!showHistory)}
          >
            <Text style={styles.historyToggleText}>
              📋 Past Splits ({mockPastSplits.length})
            </Text>
            <Text style={styles.historyToggleArrow}>
              {showHistory ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
        )}

        {showHistory && mockPastSplits.length > 0 && (
          <View style={styles.history}>
            {mockPastSplits.map((past) => (
              <Card key={past.id} style={styles.pastCard} onPress={() => {}}>
                <View style={styles.pastHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pastTitle}>{past.title}</Text>
                    <Text style={styles.pastMeta}>
                      {new Date(past.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      • {past.people} people
                    </Text>
                  </View>
                  <Badge
                    text={past.status === 'pending' ? 'Pending' : 'Settled'}
                    variant={past.status === 'pending' ? 'warning' : 'success'}
                    size="sm"
                  />
                </View>
                <View style={styles.pastFooter}>
                  <Text style={styles.pastAmount}>
                    Total ₹{past.totalAmount.toLocaleString()}
                  </Text>
                  <Text style={styles.pastShare}>
                    Your share: ₹{past.yourShare.toLocaleString()}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* New split form */}
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>✨ New Split</Text>
        </View>

        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Pizza Hut, Goa Trip..."
            placeholderTextColor={Colors.textTertiary}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.fieldLabel}>Total Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
              value={totalAmount}
              onChangeText={setTotalAmount}
            />
          </View>
        </Card>

        {/* Split mode selector */}
        <View style={styles.modeSelector}>
          <ModeBtn
            label="Equal"
            icon="="
            active={splitMode === 'equal'}
            onPress={() => setSplitMode('equal')}
          />
          <ModeBtn
            label="Percentage"
            icon="%"
            active={splitMode === 'percentage'}
            onPress={() => setSplitMode('percentage')}
          />
          <ModeBtn
            label="Shares"
            icon="📊"
            active={splitMode === 'shares'}
            onPress={() => setSplitMode('shares')}
          />
          <ModeBtn
            label="Custom"
            icon="✏️"
            active={splitMode === 'custom'}
            onPress={() => setSplitMode('custom')}
          />
        </View>

        {/* People */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>People ({peopleCount})</Text>
            <TouchableOpacity onPress={() => setShowAddPerson(true)}>
              <Text style={styles.linkText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {computedPeople.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              splitMode={splitMode}
              onRemove={() => handleRemovePerson(p.id)}
              onTogglePaid={() => handleTogglePaid(p.id)}
              onUpdatePercentage={(v) => handleUpdatePercentage(p.id, v)}
              onUpdateShares={(d) => handleUpdateShares(p.id, d)}
              onUpdateCustom={(v) => handleUpdateCustom(p.id, v)}
              onRemind={() => handleSendReminder(p)}
            />
          ))}
        </Card>

        {/* Custom validation */}
        {splitMode === 'custom' && total > 0 && (
          <Card
            style={[
              styles.validCard,
              {
                backgroundColor:
                  Math.abs(customDiff) < 0.01 ? '#D1FAE5' : '#FEE2E2',
                borderColor:
                  Math.abs(customDiff) < 0.01 ? '#A7F3D0' : '#FECACA',
              },
            ]}
          >
            <Text style={styles.validText}>
              {Math.abs(customDiff) < 0.01
                ? '✓ Amounts add up correctly'
                : customDiff > 0
                ? `⚠️ Missing ₹${customDiff.toFixed(2)} (sum is short)`
                : `⚠️ Over by ₹${Math.abs(customDiff).toFixed(2)}`}
            </Text>
          </Card>
        )}

        {/* Summary */}
        {total > 0 && (
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>📋 Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total bill</Text>
              <Text style={styles.summaryValue}>
                ₹{total.toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Your share</Text>
              <Text style={[styles.summaryValue, { color: Colors.primary }]}>
                ₹{yourShare.toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Friends owe you</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>
                ₹{owedToYou.toLocaleString()}
              </Text>
            </View>
          </Card>
        )}

        {/* Save */}
        <View style={styles.actions}>
          <Button
            title="Save Split"
            onPress={handleSaveSplit}
            variant="primary"
            size="lg"
            fullWidth
            disabled={!title || total === 0}
          />
        </View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      {/* Add Person modal */}
      <Modal
        visible={showAddPerson}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAddPerson(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addModal}>
            <Text style={styles.addTitle}>Add Person</Text>
            <TextInput
              style={styles.addInput}
              placeholder="Name"
              placeholderTextColor={Colors.textTertiary}
              value={newPersonName}
              onChangeText={setNewPersonName}
              autoFocus
            />
            <View style={styles.addActions}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowAddPerson(false);
                  setNewPersonName('');
                }}
                variant="ghost"
                style={{ flex: 1 }}
              />
              <Button
                title="Add"
                onPress={handleAddPerson}
                variant="primary"
                disabled={!newPersonName.trim()}
                style={{ flex: 1, marginLeft: Spacing.sm }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ModeBtn({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.modeBtn, active && styles.modeBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.modeIcon, active && { color: Colors.white }]}>
        {icon}
      </Text>
      <Text
        style={[styles.modeLabel, active && styles.modeLabelActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface PersonRowProps {
  person: Person & { amount?: number };
  splitMode: SplitMode;
  onRemove: () => void;
  onTogglePaid: () => void;
  onUpdatePercentage: (v: string) => void;
  onUpdateShares: (delta: number) => void;
  onUpdateCustom: (v: string) => void;
  onRemind: () => void;
}

function PersonRow({
  person,
  splitMode,
  onRemove,
  onTogglePaid,
  onUpdatePercentage,
  onUpdateShares,
  onUpdateCustom,
  onRemind,
}: PersonRowProps) {
  const isMe = person.id === 'me';

  return (
    <View style={styles.personRow}>
      <View style={[styles.avatar, { backgroundColor: person.color }]}>
        <Text style={styles.avatarText}>{person.initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.personTopRow}>
          <Text style={styles.personName}>{person.name}</Text>
          {!isMe && !person.isPaid && (
            <TouchableOpacity onPress={onRemove}>
              <Text style={styles.removeBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Mode-specific input */}
        {splitMode === 'percentage' && (
          <View style={styles.pctInput}>
            <TextInput
              style={styles.pctInputField}
              keyboardType="numeric"
              value={String(person.percentage ?? 0)}
              onChangeText={onUpdatePercentage}
            />
            <Text style={styles.pctSuffix}>%</Text>
          </View>
        )}

        {splitMode === 'shares' && (
          <View style={styles.sharesRow}>
            <TouchableOpacity
              onPress={() => onUpdateShares(-1)}
              style={styles.sharesBtn}
            >
              <Text style={styles.sharesBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.sharesValue}>{person.shares ?? 1}</Text>
            <TouchableOpacity
              onPress={() => onUpdateShares(1)}
              style={styles.sharesBtn}
            >
              <Text style={styles.sharesBtnText}>+</Text>
            </TouchableOpacity>
            <Text style={styles.sharesLabel}>shares</Text>
          </View>
        )}

        {splitMode === 'custom' && (
          <TextInput
            style={styles.customInput}
            placeholder="Amount"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="numeric"
            value={String(person.customAmount ?? '')}
            onChangeText={onUpdateCustom}
          />
        )}
      </View>

      <View style={styles.personRight}>
        <Text style={[styles.personAmount, isMe && { color: Colors.primary }]}>
          ₹{(person.amount ?? 0).toLocaleString()}
        </Text>
        {!isMe ? (
          <View style={styles.personActions}>
            <TouchableOpacity onPress={onTogglePaid} style={styles.paidBtn}>
              <Text
                style={[
                  styles.paidBtnText,
                  person.isPaid && styles.paidBtnTextActive,
                ]}
              >
                {person.isPaid ? '✓ Paid' : 'Mark paid'}
              </Text>
            </TouchableOpacity>
            {!person.isPaid && (
              <TouchableOpacity onPress={onRemind} style={styles.remindBtn}>
                <Text style={styles.remindIcon}>📤</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Text style={styles.youLabel}>(you paid)</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // History
  historyToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  historyToggleText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  historyToggleArrow: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  history: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  pastCard: {
    marginBottom: Spacing.sm,
  },
  pastHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  pastTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  pastMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pastFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  pastAmount: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  pastShare: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primary,
  },
  // Form
  formHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  formTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
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
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  linkText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.semiBold,
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
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.base,
    paddingHorizontal: Spacing.base,
  },
  currency: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginRight: Spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    paddingVertical: Spacing.base,
  },
  // Mode selector
  modeSelector: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
    marginBottom: Spacing.base,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.base,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeIcon: {
    fontSize: 18,
    marginBottom: 2,
    color: Colors.textPrimary,
  },
  modeLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textSecondary,
  },
  modeLabelActive: {
    color: Colors.white,
  },
  // Person row
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  avatarText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
  personTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  removeBtn: {
    fontSize: 16,
    color: Colors.textTertiary,
    paddingHorizontal: 4,
  },
  // Mode inputs
  pctInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    width: 80,
    marginTop: 4,
  },
  pctInputField: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    paddingVertical: 4,
  },
  pctSuffix: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  sharesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sharesBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharesBtnText: {
    fontSize: 18,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  sharesValue: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginHorizontal: Spacing.sm,
    minWidth: 16,
    textAlign: 'center',
  },
  sharesLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  customInput: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginTop: 4,
    width: 100,
  },
  // Right
  personRight: {
    alignItems: 'flex-end',
  },
  personAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  personActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  paidBtn: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  paidBtnText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  paidBtnTextActive: {
    color: Colors.success,
  },
  remindBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remindIcon: {
    fontSize: 12,
  },
  youLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  // Validation
  validCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    borderWidth: 1,
  },
  validText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  // Summary
  summaryCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  summaryTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  // Actions
  actions: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.base,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  addModal: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  addTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.base,
  },
  addInput: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.base,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  addActions: {
    flexDirection: 'row',
  },
});
