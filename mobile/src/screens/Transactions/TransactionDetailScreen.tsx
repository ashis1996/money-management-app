import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Card, Badge, Button, Header, EmptyState } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, Tints } from '../../styles/theme';
import { useTransaction, useUpdateTransaction, useDeleteTransaction } from '../../hooks';

interface TransactionDetail {
  id: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  category: string;
  categoryIcon: string;
  categoryColor: string;
  merchant: string;
  description: string;
  date: string;
  source: string;
  captureMode: 'AUTO' | 'MANUAL' | 'ASSISTED';
  account: string;
  rawSms?: string;
  isImpulse?: boolean;
  isLateNight?: boolean;
  isWeekend?: boolean;
  isSubscription?: boolean;
  subscriptionName?: string;
  location?: { latitude: number; longitude: number; name?: string };
  tags: string[];
}

const CATEGORIES = [
  { id: 'food', label: 'Food & Dining', icon: '🍔' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'transport', label: 'Transport', icon: '🚗' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { id: 'bills', label: 'Bills', icon: '⚡' },
  { id: 'health', label: 'Health', icon: '💊' },
  { id: 'subscription', label: 'Subscription', icon: '🔄' },
  { id: 'other', label: 'Other', icon: '📦' },
];

// Default placeholder while transaction is loading or missing
const EMPTY_TX: TransactionDetail = {
  id: '',
  amount: 0,
  type: 'DEBIT',
  category: 'Other',
  categoryIcon: '📦',
  categoryColor: Colors.gray400,
  merchant: 'Unknown',
  description: '',
  date: new Date().toISOString(),
  source: 'MANUAL',
  captureMode: 'MANUAL',
  account: '',
  isImpulse: false,
  isLateNight: false,
  isWeekend: false,
  isSubscription: false,
  tags: [],
};

function backendToTxDetail(t: any): TransactionDetail {
  if (!t) return EMPTY_TX;
  const cat = CATEGORIES.find((c) => c.id === t.categoryId) ?? CATEGORIES[7];
  return {
    id: t.id,
    amount: Number(t.amount ?? 0),
    type: t.type,
    category: cat.label,
    categoryIcon: cat.icon,
    categoryColor: Colors.gray400,
    merchant: t.merchantName || 'Unknown',
    description: t.description || '',
    date: t.transactionDate,
    source: t.source || 'MANUAL',
    captureMode: t.captureMode || 'MANUAL',
    account: t.account?.accountName || t.accountId || '',
    rawSms: t.rawSmsText,
    isImpulse: !!t.isImpulse,
    isLateNight: !!t.isLateNight,
    isWeekend: !!t.isWeekend,
    isSubscription: !!t.isSubscription,
    tags: t.tags ?? [],
  };
}

const RELATED = [
  { id: 'r1', merchant: 'Swiggy', amount: 425, date: '2 days ago' },
  { id: 'r2', merchant: 'Swiggy', amount: 680, date: '4 days ago' },
  { id: 'r3', merchant: 'Swiggy', amount: 320, date: '1 week ago' },
];

export function TransactionDetailScreen({ navigation, route }: any) {
  const id = route?.params?.id;
  const txQuery = useTransaction(id);
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const tx: TransactionDetail = useMemo(() => backendToTxDetail(txQuery.data), [txQuery.data]);

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showEditNote, setShowEditNote] = useState(false);
  const [editedNote, setEditedNote] = useState('');
  const [showRawSms, setShowRawSms] = useState(false);

  // Sync local state when tx loads
  useEffect(() => {
    setEditedNote(tx.description);
  }, [tx.id, tx.description]);

  const handleDelete = () => {
    Alert.alert('Delete transaction?', 'This action cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!tx.id) return;
          try {
            await deleteTx.mutateAsync(tx.id);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Unknown error');
          }
        },
      },
    ]);
  };

  const handleChangeCategory = (cat: (typeof CATEGORIES)[0]) => {
    if (!tx.id) return;
    updateTx.mutate({ id: tx.id, data: { categoryId: cat.id } });
    setShowCategoryPicker(false);
  };

  const handleSaveNote = () => {
    if (!tx.id) return;
    updateTx.mutate({ id: tx.id, data: { description: editedNote } });
    setShowEditNote(false);
  };

  const handleSplit = () => {
    navigation.navigate('SplitExpense', { transactionId: tx.id });
  };

  const handleMarkImpulse = () => {
    if (!tx.id) return;
    updateTx.mutate({ id: tx.id, data: { isImpulse: !tx.isImpulse } });
  };

  if (txQuery.isLoading || !tx.id) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Transaction"
        onBack={() => navigation.goBack()}
        rightIcon="🗑️"
        onRightPress={handleDelete}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero amount */}
        <View
          style={[
            styles.hero,
            { backgroundColor: tx.type === 'CREDIT' ? Colors.success : Colors.primary },
          ]}
        >
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>{tx.categoryIcon}</Text>
          </View>
          <Text style={styles.heroAmount}>
            {tx.type === 'CREDIT' ? '+' : '-'}₹{tx.amount.toLocaleString()}
          </Text>
          <Text style={styles.heroMerchant}>{tx.merchant}</Text>
          <Text style={styles.heroDate}>
            {new Date(tx.date).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </Text>
        </View>

        {/* Behavioral tags */}
        {(tx.isImpulse || tx.isLateNight || tx.isWeekend) && (
          <Card style={styles.behaviorCard}>
            <Text style={styles.sectionLabel}>🧠 Behavioral Insights</Text>
            <View style={styles.behaviorTags}>
              {tx.isImpulse && <Badge text="🎯 Impulse" variant="warning" />}
              {tx.isLateNight && <Badge text="🌙 Late Night" variant="info" />}
              {tx.isWeekend && <Badge text="🎉 Weekend" variant="primary" />}
            </View>
            <Text style={styles.behaviorHint}>
              This transaction was flagged because it was made after 10 PM and fits an impulse
              pattern.
            </Text>
            <TouchableOpacity onPress={handleMarkImpulse}>
              <Text style={styles.linkText}>
                {tx.isImpulse ? "It wasn't impulsive" : 'Mark as impulse'}
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Details */}
        <Card style={styles.detailsCard}>
          <DetailRow label="Account" value={tx.account} icon="🏦" />
          <DetailRow label="Source" value={tx.source} icon="📱" />
          <DetailRow
            label="Capture Mode"
            value={tx.captureMode}
            icon={tx.captureMode === 'AUTO' ? '⚡' : tx.captureMode === 'ASSISTED' ? '🤖' : '✍️'}
          />
          <DetailRow
            label="Category"
            value={tx.category}
            icon={tx.categoryIcon}
            actionLabel="Change"
            onAction={() => setShowCategoryPicker(true)}
          />
          <DetailRow
            label="Note"
            value={tx.description}
            icon="📝"
            actionLabel="Edit"
            onAction={() => {
              setEditedNote(tx.description);
              setShowEditNote(true);
            }}
            multiline
          />
          {tx.location && (
            <DetailRow
              label="Location"
              value={tx.location.name || `${tx.location.latitude}, ${tx.location.longitude}`}
              icon="📍"
            />
          )}
          {tx.isSubscription && (
            <DetailRow
              label="Subscription"
              value={tx.subscriptionName || 'Linked'}
              icon="🔄"
              actionLabel="View"
              onAction={() => navigation.navigate('Subscriptions')}
            />
          )}
        </Card>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <ActionButton
            icon="🔄"
            label="Repeat"
            onPress={() => Alert.alert('Repeat', 'Add similar transaction')}
          />
          <ActionButton icon="🧾" label="Split" onPress={handleSplit} />
          <ActionButton icon="🏷️" label="Tag" onPress={() => Alert.alert('Tags', 'Add tags')} />
          <ActionButton icon="💾" label="Save" onPress={() => Alert.alert('Saved')} />
        </View>

        {/* Raw SMS */}
        {tx.rawSms && (
          <Card style={styles.rawCard}>
            <TouchableOpacity style={styles.rawHeader} onPress={() => setShowRawSms(!showRawSms)}>
              <Text style={styles.sectionLabel}>📩 Original SMS</Text>
              <Text style={styles.linkText}>{showRawSms ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
            {showRawSms && (
              <View style={styles.rawSmsBox}>
                <Text style={styles.rawSmsText}>{tx.rawSms}</Text>
              </View>
            )}
          </Card>
        )}

        {/* Related transactions */}
        <Card style={styles.relatedCard}>
          <Text style={styles.sectionLabel}>Recent at {tx.merchant}</Text>
          {RELATED.map((r) => (
            <TouchableOpacity key={r.id} style={styles.relatedRow}>
              <View style={styles.relatedLeft}>
                <Text style={styles.relatedMerchant}>{r.merchant}</Text>
                <Text style={styles.relatedDate}>{r.date}</Text>
              </View>
              <Text style={styles.relatedAmount}>-₹{r.amount}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.relatedFooter}>
            <Text style={styles.relatedTotal}>Total at Swiggy this month: ₹8,200</Text>
          </View>
        </Card>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      {/* Category picker modal */}
      <Modal
        visible={showCategoryPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.catGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catCard, tx.category === cat.label && styles.catCardActive]}
                  onPress={() => handleChangeCategory(cat)}
                >
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <Text
                    style={[styles.catLabel, tx.category === cat.label && styles.catLabelActive]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit note modal */}
      <Modal
        visible={showEditNote}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEditNote(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editNoteModal}>
            <Text style={styles.modalTitle}>Edit Note</Text>
            <TextInput
              style={styles.noteInput}
              value={editedNote}
              onChangeText={setEditedNote}
              placeholder="Add a note..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowEditNote(false)}
                variant="ghost"
                style={{ flex: 1 }}
              />
              <Button
                title="Save"
                onPress={handleSaveNote}
                variant="primary"
                style={{ flex: 1, marginLeft: Spacing.sm }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({
  label,
  value,
  icon,
  actionLabel,
  onAction,
  multiline,
}: {
  label: string;
  value: string;
  icon: string;
  actionLabel?: string;
  onAction?: () => void;
  multiline?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={multiline ? undefined : 1}>
          {value}
        </Text>
      </View>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.linkText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress}>
      <View style={styles.actionIconBox}>
        <Text style={styles.actionIcon}>{icon}</Text>
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Hero
  hero: {
    margin: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  heroIconText: {
    fontSize: 32,
  },
  heroAmount: {
    fontSize: Typography.sizes['4xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
  heroMerchant: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  heroDate: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  // Section
  sectionLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  // Behavior
  behaviorCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    backgroundColor: Tints.warningBg,
    borderWidth: 1,
    borderColor: Tints.warningBorder,
  },
  behaviorTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  behaviorHint: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sizes.sm * 1.5,
    marginBottom: Spacing.sm,
  },
  linkText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.semiBold,
  },
  // Details
  detailsCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  detailIcon: {
    fontSize: 22,
    marginRight: Spacing.sm,
    width: 28,
  },
  detailLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
    marginTop: 2,
  },
  // Actions
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  action: {
    flex: 1,
    alignItems: 'center',
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionIcon: {
    fontSize: 22,
  },
  actionLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  // Raw SMS
  rawCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  rawHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rawSmsBox: {
    backgroundColor: Colors.gray50,
    padding: Spacing.sm,
    borderRadius: BorderRadius.base,
    marginTop: Spacing.sm,
  },
  rawSmsText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
    lineHeight: Typography.sizes.sm * 1.5,
  },
  // Related
  relatedCard: {
    marginHorizontal: Spacing.lg,
  },
  relatedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  relatedLeft: {
    flex: 1,
  },
  relatedMerchant: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
  },
  relatedDate: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  relatedAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.error,
  },
  relatedFooter: {
    paddingTop: Spacing.sm,
  },
  relatedTotal: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
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
    maxHeight: '70%',
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
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  catCard: {
    width: '30%',
    padding: Spacing.base,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  catCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Tints.primaryBg,
  },
  catIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  catLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  catLabelActive: {
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  // Edit note
  editNoteModal: {
    backgroundColor: Colors.white,
    margin: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  noteInput: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.base,
    padding: Spacing.base,
    minHeight: 100,
    marginVertical: Spacing.base,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
  },
});
