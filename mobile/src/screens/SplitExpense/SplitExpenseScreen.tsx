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
import {
  Users,
  UserPlus,
  X,
  Plus,
  Minus,
  Send,
  Check,
  Equal,
  Percent,
  PieChart,
  Wallet as WalletIcon,
  ArrowRight,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { Badge, Button, Card, Header, Section } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { formatCurrency } from '../../utils';

type SplitMode = 'equal' | 'percentage' | 'custom' | 'shares';

interface Person {
  id: string;
  name: string;
  initial: string;
  color: string;
  amount?: number;
  percentage?: number;
  shares?: number;
  customAmount?: number;
  isPaid: boolean;
}

const AVATAR_COLORS = [
  '#EF4444',
  Colors.accentPrimary,
  Colors.accentSuccess,
  Colors.accentWarning,
  '#A78BFA',
  '#F472B6',
  Colors.accentAi,
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

const MODES: Array<{
  key: SplitMode;
  label: string;
  icon: LucideIcon;
}> = [
  { key: 'equal', label: 'Equal', icon: Equal },
  { key: 'percentage', label: 'Percent', icon: Percent },
  { key: 'shares', label: 'Shares', icon: PieChart },
  { key: 'custom', label: 'Custom', icon: WalletIcon },
];

// Mock past splits — list endpoint isn't wired yet; renders examples.
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
    title: 'Friday Dinner',
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
  const [totalAmount, setTotalAmount] = useState(presetAmount ? String(presetAmount) : '');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [people, setPeople] = useState<Person[]>([
    {
      id: 'me',
      name: 'You',
      initial: 'Y',
      color: Colors.accentPrimary,
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
      color: AVATAR_COLORS[5],
      isPaid: false,
    },
  ]);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  const total = parseFloat(totalAmount) || 0;
  const peopleCount = people.length;

  const computedPeople = useMemo(() => {
    if (total === 0) return people.map((p) => ({ ...p, amount: 0 }));

    if (splitMode === 'equal') {
      const each = Math.round((total / peopleCount) * 100) / 100;
      return people.map((p) => ({ ...p, amount: each }));
    }
    if (splitMode === 'percentage') {
      const equalPct = Math.round(100 / peopleCount);
      return people.map((p) => {
        const pct = p.percentage ?? equalPct;
        return {
          ...p,
          amount: Math.round(((total * pct) / 100) * 100) / 100,
          percentage: pct,
        };
      });
    }
    if (splitMode === 'shares') {
      const totalShares = people.reduce((s, p) => s + (p.shares ?? 1), 0);
      return people.map((p) => {
        const sh = p.shares ?? 1;
        return {
          ...p,
          amount: Math.round(((total * sh) / totalShares) * 100) / 100,
          shares: sh,
        };
      });
    }
    return people.map((p) => ({ ...p, amount: p.customAmount ?? 0 }));
  }, [people, total, splitMode, peopleCount]);

  const customSum = useMemo(() => {
    if (splitMode !== 'custom') return total;
    return computedPeople.reduce((s, p) => s + (p.amount ?? 0), 0);
  }, [computedPeople, splitMode, total]);

  const customDiff = total - customSum;
  const yourShare = computedPeople.find((p) => p.id === 'me')?.amount ?? 0;
  const owedToYou = Math.max(0, total - yourShare);

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

  const handleTogglePaid = (id: string) =>
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, isPaid: !p.isPaid } : p)));

  const handleUpdatePercentage = (id: string, value: string) => {
    const pct = parseFloat(value) || 0;
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, percentage: pct } : p)));
  };

  const handleUpdateShares = (id: string, delta: number) =>
    setPeople((prev) =>
      prev.map((p) => (p.id === id ? { ...p, shares: Math.max(1, (p.shares ?? 1) + delta) } : p)),
    );

  const handleUpdateCustom = (id: string, value: string) => {
    const amt = parseFloat(value) || 0;
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, customAmount: amt } : p)));
  };

  const handleSendReminder = async (person: Person) => {
    try {
      await Share.share({
        message: `Hey ${person.name}, you owe ${formatCurrency(person.amount ?? 0)} for "${title || 'our shared expense'}". Could you settle when you get a chance? — sent via MoneyMind`,
      });
    } catch {
      /* user cancelled */
    }
  };

  const handleSaveSplit = () => {
    if (!title || !totalAmount)
      return Alert.alert('Missing info', 'Add a title and amount to save.');
    if (splitMode === 'custom' && Math.abs(customDiff) > 0.01)
      return Alert.alert(
        'Amounts don\u2019t match',
        `Sum is ${formatCurrency(customSum)} but total is ${formatCurrency(total)}.`,
      );
    Alert.alert('Split saved', 'Reminders will be sent to each person.', [
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

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero amount */}
        <Card variant="hero" padding="xl">
          <Text style={styles.heroLabel}>TOTAL TO SPLIT</Text>
          <View style={styles.heroAmountRow}>
            <Text style={styles.heroAmountSymbol}>₹</Text>
            <TextInput
              value={totalAmount}
              onChangeText={setTotalAmount}
              placeholder="0"
              placeholderTextColor={Colors.outline}
              keyboardType="numeric"
              style={styles.heroAmountInput}
            />
          </View>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What's this for?"
            placeholderTextColor={Colors.textTertiary}
            style={styles.heroTitleInput}
          />
        </Card>

        {/* Split mode chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modeRow}
        >
          {MODES.map((m) => {
            const active = splitMode === m.key;
            const Icon = m.icon;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setSplitMode(m.key)}
                accessibilityRole="button"
                style={[styles.modeChip, active && styles.modeChipActive]}
              >
                <Icon
                  size={14}
                  color={active ? Colors.white : Colors.textSecondary}
                  strokeWidth={1.75}
                />
                <Text style={[styles.modeChipLabel, active && styles.modeChipLabelActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* People */}
        <Section
          title={`People (${peopleCount})`}
          actionLabel="Add"
          onActionPress={() => setShowAddPerson(true)}
          style={{ marginTop: Spacing.lg }}
        >
          <View>
            {computedPeople.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                splitMode={splitMode}
                onTogglePaid={() => handleTogglePaid(p.id)}
                onRemove={() => handleRemovePerson(p.id)}
                onUpdatePercentage={(v) => handleUpdatePercentage(p.id, v)}
                onUpdateShares={(d) => handleUpdateShares(p.id, d)}
                onUpdateCustom={(v) => handleUpdateCustom(p.id, v)}
                onRemind={() => handleSendReminder(p)}
              />
            ))}
          </View>
        </Section>

        {/* Custom split warning */}
        {splitMode === 'custom' && Math.abs(customDiff) > 0.01 && (
          <Card
            padding="base"
            style={[
              styles.diffCard,
              {
                backgroundColor:
                  customDiff < 0 ? 'rgba(255,180,171,0.10)' : 'rgba(251,191,36,0.10)',
                borderColor: customDiff < 0 ? 'rgba(255,180,171,0.30)' : 'rgba(251,191,36,0.30)',
              },
            ]}
          >
            <Text
              style={[
                styles.diffText,
                {
                  color: customDiff < 0 ? Colors.accentError : Colors.accentWarning,
                },
              ]}
            >
              {customDiff < 0
                ? `Over by ${formatCurrency(Math.abs(customDiff))}`
                : `Under by ${formatCurrency(customDiff)}`}
            </Text>
          </Card>
        )}

        {/* Summary */}
        {total > 0 && (
          <Card variant="ai" padding="base" style={{ marginTop: Spacing.lg }}>
            <View style={styles.summaryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>YOUR SHARE</Text>
                <Text style={styles.summaryValue}>{formatCurrency(yourShare)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.summaryLabel}>OWED TO YOU</Text>
                <Text style={[styles.summaryValue, { color: Colors.accentSuccess }]}>
                  {formatCurrency(owedToYou)}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Past splits */}
        {mockPastSplits.length > 0 && (
          <Section
            title="Past splits"
            subtitle="Stored locally — backend wiring coming soon"
            style={{ marginTop: Spacing.lg }}
          >
            <View>
              {mockPastSplits.map((past) => (
                <Card key={past.id} padding="base" style={{ marginBottom: Spacing.sm }}>
                  <View style={styles.pastTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pastTitle} numberOfLines={1}>
                        {past.title}
                      </Text>
                      <Text style={styles.pastMeta}>
                        {new Date(past.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                        {' • '}
                        {past.people} people
                      </Text>
                    </View>
                    <Badge
                      text={past.status}
                      variant={past.status === 'settled' ? 'success' : 'warning'}
                      size="sm"
                    />
                  </View>
                  <View style={styles.pastFooter}>
                    <View>
                      <Text style={styles.summaryLabel}>TOTAL</Text>
                      <Text style={styles.pastAmount}>{formatCurrency(past.totalAmount)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.summaryLabel}>YOUR SHARE</Text>
                      <Text style={[styles.pastAmount, { color: Colors.accentPrimary }]}>
                        {formatCurrency(past.yourShare)}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </Section>
        )}

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>

      <View style={styles.submitBar}>
        <Button
          title="Save split"
          onPress={handleSaveSplit}
          fullWidth
          size="lg"
          trailingIcon={<ArrowRight size={16} color={Colors.white} strokeWidth={2} />}
        />
      </View>

      {/* Add person modal */}
      <Modal
        visible={showAddPerson}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddPerson(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add a person</Text>
              <TouchableOpacity onPress={() => setShowAddPerson(false)} hitSlop={8}>
                <X size={20} color={Colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>NAME</Text>
            <TextInput
              value={newPersonName}
              onChangeText={setNewPersonName}
              placeholder="Friend's name"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
              style={styles.modalInput}
            />
            <View style={{ marginTop: Spacing.lg }}>
              <Button title="Add" onPress={handleAddPerson} fullWidth />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =============================================================
// Person row
// =============================================================
function PersonRow({
  person,
  splitMode,
  onTogglePaid,
  onRemove,
  onUpdatePercentage,
  onUpdateShares,
  onUpdateCustom,
  onRemind,
}: {
  person: Person;
  splitMode: SplitMode;
  onTogglePaid: () => void;
  onRemove: () => void;
  onUpdatePercentage: (v: string) => void;
  onUpdateShares: (delta: number) => void;
  onUpdateCustom: (v: string) => void;
  onRemind: () => void;
}) {
  const isMe = person.id === 'me';

  return (
    <Card padding="base" style={{ marginBottom: Spacing.sm }}>
      <View style={styles.personRow}>
        <View style={[styles.personAvatar, { backgroundColor: person.color }]}>
          <Text style={styles.personInitial}>{person.initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.personHeader}>
            <Text style={styles.personName} numberOfLines={1}>
              {person.name}
            </Text>
            {isMe && <Badge text="You" variant="ai" size="sm" />}
            {person.isPaid && !isMe && <Badge text="Paid" variant="success" size="sm" />}
          </View>
          {splitMode === 'percentage' && !isMe && (
            <View style={styles.modeInputRow}>
              <TextInput
                value={String(person.percentage ?? 0)}
                onChangeText={onUpdatePercentage}
                keyboardType="numeric"
                style={styles.modeInput}
              />
              <Text style={styles.modeInputUnit}>%</Text>
            </View>
          )}
          {splitMode === 'shares' && !isMe && (
            <View style={styles.sharesRow}>
              <TouchableOpacity
                onPress={() => onUpdateShares(-1)}
                style={styles.sharesBtn}
                hitSlop={6}
              >
                <Minus size={14} color={Colors.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={styles.sharesValue}>{person.shares ?? 1}</Text>
              <TouchableOpacity
                onPress={() => onUpdateShares(1)}
                style={styles.sharesBtn}
                hitSlop={6}
              >
                <Plus size={14} color={Colors.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={styles.sharesLabel}>shares</Text>
            </View>
          )}
          {splitMode === 'custom' && !isMe && (
            <View style={styles.modeInputRow}>
              <Text style={styles.modeInputUnit}>₹</Text>
              <TextInput
                value={String(person.customAmount ?? 0)}
                onChangeText={onUpdateCustom}
                keyboardType="numeric"
                style={[styles.modeInput, { marginLeft: 4 }]}
              />
            </View>
          )}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.personAmount}>{formatCurrency(person.amount ?? 0)}</Text>
          {!isMe && (
            <View style={styles.personActions}>
              <TouchableOpacity
                onPress={onTogglePaid}
                accessibilityLabel={person.isPaid ? 'Mark unpaid' : 'Mark paid'}
                hitSlop={4}
                style={styles.personActionBtn}
              >
                <Check
                  size={14}
                  color={person.isPaid ? Colors.accentSuccess : Colors.textSecondary}
                  strokeWidth={2}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onRemind}
                accessibilityLabel="Send reminder"
                hitSlop={4}
                style={styles.personActionBtn}
              >
                <Send size={14} color={Colors.textSecondary} strokeWidth={1.75} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onRemove}
                accessibilityLabel="Remove"
                hitSlop={4}
                style={styles.personActionBtn}
              >
                <Trash2 size={14} color={Colors.accentError} strokeWidth={1.75} />
              </TouchableOpacity>
            </View>
          )}
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
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },

  // Hero
  heroLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1.2,
    fontWeight: Typography.weights.medium,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  heroAmountSymbol: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  heroAmountInput: {
    flex: 1,
    fontSize: 48,
    lineHeight: 52,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -1.5,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  heroTitleInput: {
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },

  // Mode chips
  modeRow: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    marginRight: Spacing.sm,
    gap: 6,
  },
  modeChipActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  modeChipLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
  modeChipLabelActive: {
    color: Colors.white,
  },

  // Person
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  personInitial: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  personName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },
  personAmount: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.4,
  },
  personActions: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  personActionBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Mode-specific inputs
  modeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  modeInput: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.base,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    width: 80,
    fontVariant: ['tabular-nums'] as any,
  },
  modeInputUnit: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginLeft: 6,
  },
  sharesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: Spacing.xs,
  },
  sharesBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharesValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    minWidth: 16,
    textAlign: 'center',
    fontVariant: ['tabular-nums'] as any,
  },
  sharesLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginLeft: 4,
  },

  // Diff warning
  diffCard: {
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  diffText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontVariant: ['tabular-nums'] as any,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    fontWeight: Typography.weights.medium,
  },
  summaryValue: {
    marginTop: 2,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.4,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.borderDefault,
    marginHorizontal: Spacing.base,
  },

  // Past
  pastTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  pastTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
  },
  pastMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    fontVariant: ['tabular-nums'] as any,
  },
  pastFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  pastAmount: {
    marginTop: 2,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.4,
  },

  // Submit
  submitBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    backgroundColor: Colors.surfaceContainerLow,
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
});
