import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Card, Badge, Button, EmptyState } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Tints } from '../../styles/theme';
import { useTransactions, useUpdateTransaction } from '../../hooks';

type CaptureMode = 'AUTO' | 'MANUAL' | 'ASSISTED';
type TransactionType = 'CREDIT' | 'DEBIT';
type TransactionSource = 'SMS' | 'EMAIL' | 'UPI' | 'BANK_API' | 'MANUAL' | 'VOICE';

interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  merchant: string;
  description: string;
  date: string;
  source: TransactionSource;
  captureMode: CaptureMode;
  isImpulse?: boolean;
  isLateNight?: boolean;
  isWeekend?: boolean;
  isUserConfirmed?: boolean;
  aiSuggestedCategory?: string;
  aiConfidence?: number;
  account?: string;
}

// Mock transactions data
const mockTransactions: Transaction[] = [];

const CATEGORY_ICONS: Record<string, string> = {
  Food: '🍔',
  Shopping: '🛍️',
  Transport: '🚗',
  Entertainment: '🎬',
  Bills: '⚡',
  Health: '💊',
  Salary: '💰',
  Other: '📦',
};

const SOURCE_ICONS: Record<TransactionSource, string> = {
  SMS: '📩',
  EMAIL: '✉️',
  UPI: '📱',
  BANK_API: '🏦',
  MANUAL: '✍️',
  VOICE: '🎤',
};

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'AUTO', label: '⚡ Auto' },
  { key: 'ASSISTED', label: '🤖 Assisted' },
  { key: 'MANUAL', label: '✍️ Manual' },
];

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
      account: t.account?.accountName,
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

  // Group by date
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach((tx) => {
      const date = new Date(tx.date);
      const today = new Date();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else {
        key = date.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return groups;
  }, [filteredTransactions]);

  const handleConfirmAI = (id: string) => {
    updateTx.mutate({ id, data: { isUserConfirmed: true } });
  };

  const handleRejectAI = (id: string) => {
    // In real app, would open category picker
    updateTx.mutate({ id, data: { isUserConfirmed: true, categoryId: 'Other' } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Transactions</Text>
          <Text style={styles.subtitle}>{filteredTransactions.length} transactions</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddTransaction')}
        >
          <Text style={styles.addButtonIcon}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search merchants, categories..."
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity onPress={() => setShowFilters(true)}>
          <Text style={styles.filterIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* AI Pending Banner */}
      {pendingAICount > 0 && (
        <Card style={styles.aiBanner}>
          <View style={styles.aiBannerContent}>
            <Text style={styles.aiBannerIcon}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiBannerTitle}>{pendingAICount} AI suggestions waiting</Text>
              <Text style={styles.aiBannerSubtitle}>Swipe to approve or reject categorization</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabs}
      >
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => setFilter(tab.key as any)}
          >
            <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Transactions list */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {Object.keys(groupedTransactions).length === 0 ? (
          <EmptyState
            icon="📭"
            title="No transactions"
            message="Try adjusting your filters or add a new transaction"
            actionLabel="Add Transaction"
            onAction={() => navigation.navigate('AddTransaction')}
          />
        ) : (
          Object.entries(groupedTransactions).map(([date, txns]) => (
            <View key={date}>
              <Text style={styles.dateHeader}>{date}</Text>
              {txns.map((tx) => (
                <TransactionItem
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

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Type</Text>
            <View style={styles.filterRow}>
              {(['ALL', 'CREDIT', 'DEBIT'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, typeFilter === type && styles.typeChipActive]}
                  onPress={() => setTypeFilter(type)}
                >
                  <Text
                    style={[styles.typeChipText, typeFilter === type && styles.typeChipTextActive]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              title="Apply Filters"
              onPress={() => setShowFilters(false)}
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

interface TransactionItemProps {
  transaction: Transaction;
  onConfirm: () => void;
  onReject: () => void;
  onPress: () => void;
}

function TransactionItem({ transaction: tx, onConfirm, onReject, onPress }: TransactionItemProps) {
  const isPendingAI = tx.captureMode === 'ASSISTED' && !tx.isUserConfirmed;
  const icon = CATEGORY_ICONS[tx.category] || CATEGORY_ICONS.Other;

  return (
    <Card onPress={onPress} style={[styles.txItem, isPendingAI && styles.txItemPending]}>
      <View style={styles.txMain}>
        <View style={[styles.txIcon, { backgroundColor: getCategoryColor(tx.category) }]}>
          <Text style={styles.txIconText}>{icon}</Text>
        </View>
        <View style={styles.txContent}>
          <View style={styles.txTopRow}>
            <Text style={styles.txMerchant} numberOfLines={1}>
              {tx.merchant}
            </Text>
            <Text
              style={[
                styles.txAmount,
                { color: tx.type === 'CREDIT' ? Colors.success : Colors.textPrimary },
              ]}
            >
              {tx.type === 'CREDIT' ? '+' : '-'}₹{tx.amount.toLocaleString()}
            </Text>
          </View>
          <View style={styles.txBottomRow}>
            <Text style={styles.txMeta} numberOfLines={1}>
              {tx.category} • {SOURCE_ICONS[tx.source]} {tx.source}
            </Text>
            <Text style={styles.txTime}>{formatTime(tx.date)}</Text>
          </View>
          {/* Behavioral tags */}
          {(tx.isImpulse || tx.isLateNight) && (
            <View style={styles.tagRow}>
              {tx.isImpulse && <Badge text="🎯 Impulse" variant="warning" size="sm" />}
              {tx.isLateNight && <Badge text="🌙 Late Night" variant="info" size="sm" />}
            </View>
          )}
        </View>
      </View>

      {/* AI Confirmation actions */}
      {isPendingAI && (
        <View style={styles.aiActions}>
          <View style={styles.aiInfo}>
            <Text style={styles.aiInfoText}>
              🤖 AI suggests: <Text style={styles.aiCategory}>{tx.aiSuggestedCategory}</Text> (
              {Math.round((tx.aiConfidence || 0) * 100)}% confident)
            </Text>
          </View>
          <View style={styles.aiButtons}>
            <TouchableOpacity style={[styles.aiButton, styles.aiReject]} onPress={onReject}>
              <Text style={styles.aiRejectText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.aiButton, styles.aiApprove]} onPress={onConfirm}>
              <Text style={styles.aiApproveText}>✓ Approve</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Card>
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

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    Food: Tints.errorBg,
    Shopping: 'rgba(167, 139, 250, 0.16)',
    Transport: Tints.aiBg,
    Entertainment: 'rgba(244, 114, 182, 0.16)',
    Bills: Tints.warningBg,
    Health: Tints.successBg,
    Salary: Tints.successBg,
    Other: Colors.gray100,
  };
  return colors[category] || Colors.gray100;
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
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonIcon: {
    color: Colors.white,
    fontSize: 28,
    fontWeight: Typography.weights.bold,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    height: 48,
    ...Shadows.sm,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
  },
  filterIcon: {
    fontSize: 20,
    paddingHorizontal: Spacing.xs,
  },
  aiBanner: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.base,
    backgroundColor: Tints.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  aiBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiBannerIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  aiBannerTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  aiBannerSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  filterTabs: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
    marginRight: Spacing.sm,
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
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  dateHeader: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textSecondary,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  txItem: {
    marginBottom: Spacing.sm,
  },
  txItemPending: {
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  txMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  txIconText: {
    fontSize: 20,
  },
  txContent: {
    flex: 1,
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
    color: Colors.textPrimary,
  },
  txAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    marginLeft: Spacing.sm,
  },
  txBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  txMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    flex: 1,
  },
  txTime: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm,
  },
  tagRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  // AI Actions
  aiActions: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  aiInfo: {
    marginBottom: Spacing.sm,
  },
  aiInfoText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  aiCategory: {
    color: Colors.primary,
    fontWeight: Typography.weights.semiBold,
  },
  aiButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  aiButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.base,
    alignItems: 'center',
  },
  aiReject: {
    backgroundColor: Colors.gray100,
  },
  aiRejectText: {
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  aiApprove: {
    backgroundColor: Colors.success,
  },
  aiApproveText: {
    color: Colors.white,
    fontWeight: Typography.weights.semiBold,
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
  filterLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
  },
  typeChipText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
  typeChipTextActive: {
    color: Colors.white,
  },
});
