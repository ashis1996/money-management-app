import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import {
  Trash2,
  Edit3,
  Tag,
  Zap,
  Moon,
  PartyPopper,
  Repeat,
  Split,
  Building,
  Calendar,
  X,
  Sparkles,
  Utensils,
  ShoppingBag,
  Car,
  Clapperboard,
  Pill,
  Package,
  type LucideIcon,
} from 'lucide-react-native';
import { Badge, Button, Card, Header } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { useTransaction, useUpdateTransaction, useDeleteTransaction } from '../../hooks';
import { formatCurrency, formatDate } from '../../utils';

interface CategoryOption {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const CATEGORIES: CategoryOption[] = [
  { id: 'food', label: 'Food', icon: Utensils, color: '#EF4444' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#A78BFA' },
  { id: 'transport', label: 'Transport', icon: Car, color: Colors.accentPrimary },
  { id: 'entertainment', label: 'Entertainment', icon: Clapperboard, color: '#F472B6' },
  { id: 'bills', label: 'Bills', icon: Zap, color: Colors.accentWarning },
  { id: 'health', label: 'Health', icon: Pill, color: Colors.accentSuccess },
  { id: 'subscription', label: 'Subscription', icon: Repeat, color: '#818CF8' },
  { id: 'other', label: 'Other', icon: Package, color: Colors.outline },
];

interface TransactionDetail {
  id: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  categoryId: string;
  merchant: string;
  description: string;
  date: string;
  source: string;
  account: string;
  rawSms?: string;
  isImpulse: boolean;
  isLateNight: boolean;
  isWeekend: boolean;
  isSubscription: boolean;
}

const EMPTY_TX: TransactionDetail = {
  id: '',
  amount: 0,
  type: 'DEBIT',
  categoryId: 'other',
  merchant: 'Unknown',
  description: '',
  date: new Date().toISOString(),
  source: 'MANUAL',
  account: '',
  isImpulse: false,
  isLateNight: false,
  isWeekend: false,
  isSubscription: false,
};

function backendToTxDetail(t: any): TransactionDetail {
  if (!t) return EMPTY_TX;
  return {
    id: t.id,
    amount: Number(t.amount ?? 0),
    type: t.type,
    categoryId: t.categoryId || 'other',
    merchant: t.merchantName || 'Unknown',
    description: t.description || '',
    date: t.transactionDate,
    source: t.source || 'MANUAL',
    account: t.account?.accountName || t.accountId || '',
    rawSms: t.rawSmsText,
    isImpulse: !!t.isImpulse,
    isLateNight: !!t.isLateNight,
    isWeekend: !!t.isWeekend,
    isSubscription: !!t.isSubscription,
  };
}

function categoryFor(id: string): CategoryOption {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[7];
}

export function TransactionDetailScreen({ navigation, route }: any) {
  const id = route?.params?.id;
  const txQuery = useTransaction(id);
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const tx: TransactionDetail = useMemo(() => backendToTxDetail(txQuery.data), [txQuery.data]);

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showEditNote, setShowEditNote] = useState(false);
  const [editedNote, setEditedNote] = useState('');

  useEffect(() => {
    setEditedNote(tx.description);
  }, [tx.id, tx.description]);

  const handleDelete = () =>
    Alert.alert('Delete transaction?', 'This action cannot be undone.', [
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

  const handleChangeCategory = (cat: CategoryOption) => {
    if (!tx.id) return;
    updateTx.mutate({ id: tx.id, data: { categoryId: cat.id } });
    setShowCategoryPicker(false);
  };

  const handleSaveNote = () => {
    if (!tx.id) return;
    updateTx.mutate({ id: tx.id, data: { description: editedNote } });
    setShowEditNote(false);
  };

  const handleToggleImpulse = () => {
    if (!tx.id) return;
    updateTx.mutate({ id: tx.id, data: { isImpulse: !tx.isImpulse } });
  };

  if (txQuery.isLoading || !tx.id) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.accentAi} />
      </View>
    );
  }

  const cat = categoryFor(tx.categoryId);
  const CatIcon = cat.icon;

  return (
    <View style={styles.container}>
      <Header
        title="Transaction"
        onBack={() => navigation.goBack()}
        rightContent={
          <TouchableOpacity
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete"
            hitSlop={8}
            style={styles.headerBtn}
          >
            <Trash2 size={16} color={Colors.accentError} strokeWidth={2} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <Card variant="hero" padding="xl" style={{ alignItems: 'center' }}>
          <Text style={styles.heroLabel}>
            {tx.type === 'CREDIT' ? 'RECEIVED FROM' : 'SPENT AT'}
          </Text>
          <Text style={styles.heroMerchant} numberOfLines={1}>
            {tx.merchant}
          </Text>
          <Text
            style={[styles.heroAmount, tx.type === 'CREDIT' && { color: Colors.accentSuccess }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {tx.type === 'CREDIT' ? '+' : '−'}
            {formatCurrency(tx.amount)}
          </Text>
          <Text style={styles.heroDate}>
            {formatDate(tx.date, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>

          {/* Tag chips */}
          {(tx.isImpulse || tx.isLateNight || tx.isWeekend) && (
            <View style={styles.tagsRow}>
              {tx.isImpulse && <Badge text="Impulse" variant="warning" size="sm" />}
              {tx.isLateNight && <Badge text="Late night" variant="ai" size="sm" />}
              {tx.isWeekend && <Badge text="Weekend" variant="primary" size="sm" />}
              {tx.isSubscription && <Badge text="Subscription" variant="primary" size="sm" />}
            </View>
          )}
        </Card>

        {/* Category card */}
        <Card
          padding="base"
          style={{ marginTop: Spacing.lg }}
          onPress={() => setShowCategoryPicker(true)}
        >
          <View style={styles.metaRow}>
            <View
              style={[
                styles.metaIcon,
                {
                  backgroundColor: cat.color + '22',
                  borderColor: cat.color + '44',
                },
              ]}
            >
              <CatIcon size={18} color={cat.color} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>CATEGORY</Text>
              <Text style={styles.metaValue}>{cat.label}</Text>
            </View>
            <Edit3 size={14} color={Colors.textTertiary} strokeWidth={2} />
          </View>
        </Card>

        {/* Account / source */}
        <Card padding="base" style={{ marginTop: Spacing.sm }}>
          <View style={styles.metaRow}>
            <View style={styles.metaIcon}>
              <Building size={18} color={Colors.textSecondary} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>ACCOUNT</Text>
              <Text style={styles.metaValue}>{tx.account || 'No account'}</Text>
            </View>
            <Badge text={tx.source.toLowerCase()} variant="gray" size="sm" />
          </View>
        </Card>

        {/* Notes */}
        <Card
          padding="base"
          style={{ marginTop: Spacing.sm }}
          onPress={() => setShowEditNote(true)}
        >
          <View style={styles.metaRow}>
            <View style={styles.metaIcon}>
              <Tag size={18} color={Colors.textSecondary} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>NOTES</Text>
              <Text
                style={[
                  styles.metaValue,
                  !tx.description && {
                    color: Colors.textTertiary,
                    fontStyle: 'italic',
                  },
                ]}
                numberOfLines={2}
              >
                {tx.description || 'Tap to add a note'}
              </Text>
            </View>
            <Edit3 size={14} color={Colors.textTertiary} strokeWidth={2} />
          </View>
        </Card>

        {/* Raw SMS */}
        {tx.rawSms && (
          <Card padding="base" style={{ marginTop: Spacing.sm }}>
            <Text style={styles.metaLabel}>SMS SOURCE</Text>
            <Text style={styles.rawSms}>{tx.rawSms}</Text>
          </Card>
        )}

        {/* AI insight (impulse toggle) */}
        <Card variant="ai" padding="base" style={{ marginTop: Spacing.lg }}>
          <View style={styles.metaRow}>
            <View style={styles.metaIconAi}>
              <Sparkles size={18} color={Colors.accentAi} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.metaLabel, { color: Colors.accentAi }]}>AI ASSISTANT</Text>
              <Text style={styles.metaValue}>
                {tx.isImpulse ? 'Marked as impulse buy' : 'Was this an impulse purchase?'}
              </Text>
            </View>
            <Button
              title={tx.isImpulse ? 'Unmark' : 'Mark'}
              size="sm"
              variant={tx.isImpulse ? 'secondary' : 'ai'}
              onPress={handleToggleImpulse}
              leadingIcon={
                <Zap
                  size={14}
                  color={tx.isImpulse ? Colors.textPrimary : Colors.accentAi}
                  strokeWidth={2}
                />
              }
            />
          </View>
        </Card>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <Button
            title="Split"
            variant="secondary"
            size="md"
            onPress={() => navigation.navigate('SplitExpense', { transactionId: tx.id })}
            leadingIcon={<Split size={14} color={Colors.textPrimary} strokeWidth={2} />}
            style={{ flex: 1 }}
          />
        </View>

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>

      {/* Category picker modal */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)} hitSlop={8}>
                <X size={20} color={Colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.categoryGrid}>
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = c.id === tx.categoryId;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => handleChangeCategory(c)}
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
                    <Text style={[styles.categoryLabel, active && { color: c.color }]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit note modal */}
      <Modal
        visible={showEditNote}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditNote(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit note</Text>
              <TouchableOpacity onPress={() => setShowEditNote(false)} hitSlop={8}>
                <X size={20} color={Colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={editedNote}
              onChangeText={setEditedNote}
              placeholder="What was this for?"
              placeholderTextColor={Colors.textTertiary}
              multiline
              autoFocus
              style={[styles.modalInput, { minHeight: 100, textAlignVertical: 'top' }]}
            />
            <View style={{ marginTop: Spacing.lg }}>
              <Button title="Save" onPress={handleSaveNote} fullWidth />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,180,171,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
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
  heroMerchant: {
    marginTop: Spacing.xs,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  heroAmount: {
    marginTop: Spacing.sm,
    fontSize: 48,
    lineHeight: 52,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -1.5,
    color: Colors.textPrimary,
  },
  heroDate: {
    marginTop: Spacing.xs,
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'] as any,
  },
  tagsRow: {
    marginTop: Spacing.base,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },

  // Meta rows
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.base,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  metaIconAi: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.base,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  metaLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    fontWeight: Typography.weights.medium,
  },
  metaValue: {
    marginTop: 2,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },
  rawSms: {
    marginTop: Spacing.xs,
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
    lineHeight: Typography.sizes.sm * 1.5,
  },

  actionsRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
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
  },
  categoryTile: {
    flexBasis: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    gap: Spacing.sm,
  },
  categoryLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textSecondary,
  },
});
