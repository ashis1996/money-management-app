import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import {
  Search,
  Sliders,
  Plus,
  X,
  Sparkles,
  Check,
  Edit3,
  Calendar,
  ArrowRight,
  Mic,
} from 'lucide-react-native';
import { Card, Badge, Button, EmptyState, IconButton } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { useTransactions, useUpdateTransaction } from '../../hooks';
import { formatCurrency } from '../../utils';

type CaptureMode = 'AUTO' | 'MANUAL' | 'ASSISTED';
type TransactionType = 'CREDIT' | 'DEBIT';

interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  merchant: string;
  description: string;
  date: string;
  source: string;
  captureMode: CaptureMode;
  isImpulse?: boolean;
  isLateNight?: boolean;
  isWeekend?: boolean;
  isUserConfirmed?: boolean;
  aiSuggestedCategory?: string;
  aiConfidence?: number;
}

const FILTER_TABS: Array<{ key: 'all' | CaptureMode; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'AUTO', label: 'Auto' },
  { key: 'ASSISTED', label: 'Assisted' },
  { key: 'MANUAL', label: 'Manual' },
];

// Single-letter glyph backgrounds — derived from the merchant's first
// character so different merchants don't all look the same.
const GLYPH_PALETTE = [
  Colors.accentPrimary,
  Colors.accentAi,
  Colors.accentSuccess,
  Colors.accentWarning,
  Colors.accentError,
  '#A78BFA',
  '#F472B6',
];
function glyphColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return GLYPH_PALETTE[Math.abs(hash) % GLYPH_PALETTE.length];
}

export function TransactionsScreen({ navigation }: any) {
  const [filter, setFilter] = useState<'all' | CaptureMode>('all');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');

  const txQuery = useTransactions({
    type: typeFilter === 'ALL' ? undefined : typeFilter,
    search: search || undefined,
  });
  const updateTx = useUpdateTransaction();

  const transactions: Transaction[] = useMemo(() => {
    const list = txQuery.data || [];
    return list.map((t: any) => ({
      id: t.id,
      amount: Number(t.amount),
      type: t.type,
      category: t.categoryId || 'Other',
      merchant: t.merchantName || t.merchant || 'Unknown',
      description: t.description || '',
      date: t.transactionDate || t.date,
      source: t.source || 'MANUAL',
      captureMode: t.captureMode || 'MANUAL',
      isImpulse: t.isImpulse,
      isLateNight: t.isLateNight,
      isWeekend: t.isWeekend,
      isUserConfirmed: t.isUserConfirmed,
      aiSuggestedCategory: t.aiSuggestedCategory,
      aiConfidence: t.aiConfidence ? Number(t.aiConfidence) : undefined,
    }));
  }, [txQuery.data]);

  const pendingAICount = transactions.filter(
    (t) => t.captureMode === 'ASSISTED' && !t.isUserConfirmed,
  ).length;

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filter !== 'all' && tx.captureMode !== filter) return false;
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          tx.merchant.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          tx.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, filter, typeFilter, search]);

  // Mini analytics roll-up
  const analytics = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let income = 0;
    let spent = 0;
    transactions.forEach((t) => {
      if (new Date(t.date).getTime() < monthStart) return;
      if (t.type === 'CREDIT') income += t.amount;
      else spent += t.amount;
    });
    return { income, spent, net: income - spent };
  }, [transactions]);

  const grouped = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach((tx) => {
      const date = new Date(tx.date);
      const today = new Date();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      let key: string;
      if (date.toDateString() === today.toDateString()) key = 'Today';
      else if (date.toDateString() === yesterday.toDateString()) key = 'Yesterday';
      else
        key = date.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return groups;
  }, [filteredTransactions]);

  const handleConfirmAI = (id: string) => {
    updateTx.mutate({ id, data: { isUserConfirmed: true } });
  };
  const handleRejectAI = (id: string) => {
    updateTx.mutate({ id, data: { isUserConfirmed: true, categoryId: 'Other' } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Transactions</Text>
          <Text style={styles.subtitle}>
            {filteredTransactions.length}{' '}
            {filteredTransactions.length === 1 ? 'transaction' : 'transactions'}
          </Text>
        </View>
        <IconButton
          name="plus"
          variant="primary"
          size="md"
          accessibilityLabel="Add transaction"
          onPress={() => navigation.navigate('AddTransaction')}
        />
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Search size={16} color={Colors.textSecondary} strokeWidth={1.75} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search merchants, categories..."
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity hitSlop={6} accessibilityLabel="Voice search">
          <Mic size={16} color={Colors.textSecondary} strokeWidth={1.75} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          hitSlop={6}
          accessibilityLabel="Filters"
          style={{ marginLeft: Spacing.sm }}
        >
          <Sliders size={16} color={Colors.textSecondary} strokeWidth={1.75} />
        </TouchableOpacity>
      </View>

      {/* Mini analytics card */}
      <Card style={styles.analyticsCard} padding="base">
        <View style={styles.analyticsRow}>
          <View style={styles.analyticsItem}>
            <Text style={styles.analyticsLabel}>This month</Text>
            <Text style={styles.analyticsHeadline}>
              {formatCurrency(analytics.spent, { compact: true })}
            </Text>
            <Text style={styles.analyticsSub}>spent</Text>
          </View>
          <View style={styles.analyticsDivider} />
          <View style={styles.analyticsItem}>
            <Text style={styles.analyticsLabel}>Net</Text>
            <Text
              style={[
                styles.analyticsHeadline,
                {
                  color: analytics.net >= 0 ? Colors.accentSuccess : Colors.accentError,
                },
              ]}
            >
              {analytics.net >= 0 ? '+' : '-'}
              {formatCurrency(Math.abs(analytics.net), { compact: true })}
            </Text>
            <Text style={styles.analyticsSub}>this month</Text>
          </View>
        </View>
      </Card>

      {/* AI nudge */}
      {pendingAICount > 0 && (
        <Card variant="ai" style={styles.aiNudge}>
          <View style={styles.aiNudgeRow}>
            <View style={styles.aiNudgeIcon}>
              <Sparkles size={16} color={Colors.accentAi} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiNudgeTitle}>{pendingAICount} AI suggestions waiting</Text>
              <Text style={styles.aiNudgeSubtitle}>
                Confirm or recategorize the highlighted rows below.
              </Text>
            </View>
            <ArrowRight size={16} color={Colors.accentAi} strokeWidth={1.5} />
          </View>
        </Card>
      )}

      {/* Filter chip rail */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabs}
      >
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.chip, filter === tab.key && styles.chipActive]}
            onPress={() => setFilter(tab.key)}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
          >
            <Text style={[styles.chipLabel, filter === tab.key && styles.chipLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {Object.keys(grouped).length === 0 ? (
          <EmptyState
            icon="📭"
            title="No transactions yet"
            message="Add a transaction or wait for SMS auto-capture to fill in your activity."
            actionLabel="Add Transaction"
            onAction={() => navigation.navigate('AddTransaction')}
          />
        ) : (
          Object.entries(grouped).map(([date, txns]) => (
            <View key={date}>
              <Text style={styles.dateHeader}>{date}</Text>
              {txns.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onConfirm={() => handleConfirmAI(tx.id)}
                  onReject={() => handleRejectAI(tx.id)}
                  onPress={() => navigation.navigate('TransactionDetail', { id: tx.id })}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Filter modal */}
      <FilterModal
        visible={showFilters}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        onClose={() => setShowFilters(false)}
      />
    </View>
  );
}

// =============================================================
// Transaction row
// =============================================================
function TransactionRow({
  transaction: tx,
  onConfirm,
  onReject,
  onPress,
}: {
  transaction: Transaction;
  onConfirm: () => void;
  onReject: () => void;
  onPress: () => void;
}) {
  const isPendingAI = tx.captureMode === 'ASSISTED' && !tx.isUserConfirmed;
  const initial = (tx.merchant?.[0] || '?').toUpperCase();
  const tone = glyphColor(tx.merchant);

  return (
    <Card
      onPress={onPress}
      style={[styles.txRow, isPendingAI && styles.txRowPending]}
      padding="base"
    >
      <View style={styles.txMainRow}>
        <View style={[styles.txGlyph, { backgroundColor: tone + '22', borderColor: tone + '44' }]}>
          <Text style={[styles.txGlyphLetter, { color: tone }]}>{initial}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.txTopRow}>
            <Text style={styles.txMerchant} numberOfLines={1}>
              {tx.merchant}
            </Text>
            <Text
              style={[
                styles.txAmount,
                {
                  color: tx.type === 'CREDIT' ? Colors.accentSuccess : Colors.textPrimary,
                },
              ]}
            >
              {tx.type === 'CREDIT' ? '+' : '−'}
              {formatCurrency(tx.amount)}
            </Text>
          </View>
          <View style={styles.txBottomRow}>
            <Text style={styles.txMeta} numberOfLines={1}>
              {tx.category} • {tx.source.toLowerCase()}
            </Text>
            <Text style={styles.txTime}>{formatTime(tx.date)}</Text>
          </View>
          {(tx.isImpulse || tx.isLateNight) && (
            <View style={styles.txTags}>
              {tx.isImpulse && <Badge text="Impulse" variant="warning" size="sm" />}
              {tx.isLateNight && <Badge text="Late night" variant="ai" size="sm" />}
            </View>
          )}
        </View>
      </View>

      {isPendingAI && (
        <View style={styles.aiActions}>
          <Text style={styles.aiHint}>
            <Sparkles size={12} color={Colors.accentAi} strokeWidth={2} />{' '}
            <Text style={{ color: Colors.accentAi }}>{tx.aiSuggestedCategory}</Text> (
            {Math.round((tx.aiConfidence || 0) * 100)}% confident)
          </Text>
          <View style={styles.aiButtonRow}>
            <Button
              title="Recategorize"
              variant="secondary"
              size="sm"
              onPress={onReject}
              leadingIcon={<Edit3 size={14} color={Colors.textPrimary} strokeWidth={2} />}
              style={{ flex: 1 }}
            />
            <View style={{ width: Spacing.sm }} />
            <Button
              title="Confirm"
              variant="primary"
              size="sm"
              onPress={onConfirm}
              leadingIcon={<Check size={14} color={Colors.white} strokeWidth={2} />}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

// =============================================================
// Filter modal (dark glass)
// =============================================================
function FilterModal({
  visible,
  typeFilter,
  onTypeChange,
  onClose,
}: {
  visible: boolean;
  typeFilter: 'ALL' | TransactionType;
  onTypeChange: (t: 'ALL' | TransactionType) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={Colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>Type</Text>
          <View style={styles.typeRow}>
            {(['ALL', 'CREDIT', 'DEBIT'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, typeFilter === t && styles.typeChipActive]}
                onPress={() => onTypeChange(t)}
              >
                <Text
                  style={[styles.typeChipLabel, typeFilter === t && styles.typeChipLabelActive]}
                >
                  {t === 'ALL' ? 'All' : t === 'CREDIT' ? 'Credit' : 'Debit'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: Spacing.xl }}>
            <Button title="Apply filters" onPress={onClose} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// =============================================================
// Styles
// =============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['3xl'] + Spacing.lg,
    paddingBottom: Spacing.base,
  },
  title: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
  },

  // Mini analytics
  analyticsCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.base,
  },
  analyticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analyticsItem: {
    flex: 1,
  },
  analyticsLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  analyticsHeadline: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.6,
    marginTop: 4,
  },
  analyticsSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  analyticsDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.borderDefault,
    marginHorizontal: Spacing.base,
  },

  // AI nudge
  aiNudge: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.base,
  },
  aiNudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiNudgeIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.base,
    backgroundColor: 'rgba(34,211,238,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  aiNudgeTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },
  aiNudgeSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Chip rail
  filterTabs: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
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
    letterSpacing: 0.2,
  },
  chipLabelActive: {
    color: Colors.white,
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  dateHeader: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },

  // Tx row
  txRow: {
    marginBottom: Spacing.sm,
  },
  txRowPending: {
    borderColor: 'rgba(34,211,238,0.40)',
  },
  txMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txGlyph: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  txGlyphLetter: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txMerchant: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },
  txAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    marginLeft: Spacing.sm,
  },
  txBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  txMeta: {
    flex: 1,
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  txTime: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'] as any,
    marginLeft: Spacing.sm,
  },
  txTags: {
    flexDirection: 'row',
    gap: 4,
    marginTop: Spacing.xs,
  },

  // AI actions
  aiActions: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  aiHint: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  aiButtonRow: {
    flexDirection: 'row',
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
    fontWeight: Typography.weights.semiBold,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeChip: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
  },
  typeChipActive: {
    backgroundColor: 'rgba(59,130,246,0.20)',
    borderColor: Colors.accentPrimary,
  },
  typeChipLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
  typeChipLabelActive: {
    color: Colors.accentPrimary,
  },
});
