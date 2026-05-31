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
import {
  Building,
  Wallet as WalletIcon,
  CreditCard,
  TrendingUp,
  Home as HomeIcon,
  Plus,
  X,
  Star,
  RefreshCw,
  Trash2,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react-native';
import { Badge, Button, Card, EmptyState, Header } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useSetPrimaryAccount,
  useRecomputeAccount,
} from '../../hooks';
import { formatCurrency } from '../../utils';

type AccountType = 'BANK' | 'WALLET' | 'CREDIT_CARD' | 'INVESTMENT' | 'LOAN';

interface Account {
  id: string;
  type: AccountType;
  name: string;
  provider: string;
  mask?: string;
  balance: number;
  currency: string;
  color: string;
  isPrimary: boolean;
  isActive: boolean;
  lastSync: string;
}

interface TypeOption {
  type: AccountType;
  label: string;
  icon: LucideIcon;
  color: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  { type: 'BANK', label: 'Bank account', icon: Building, color: Colors.accentPrimary },
  { type: 'WALLET', label: 'Wallet', icon: WalletIcon, color: '#A78BFA' },
  { type: 'CREDIT_CARD', label: 'Credit card', icon: CreditCard, color: '#F472B6' },
  { type: 'INVESTMENT', label: 'Investment', icon: TrendingUp, color: Colors.accentSuccess },
  { type: 'LOAN', label: 'Loan', icon: HomeIcon, color: Colors.accentWarning },
];

function typeOptFor(type: AccountType): TypeOption {
  return TYPE_OPTIONS.find((t) => t.type === type) ?? TYPE_OPTIONS[0];
}

type FilterType = 'all' | AccountType;

export function AccountsScreen({ navigation }: any) {
  const accountsQuery = useAccounts();
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const setPrimary = useSetPrimaryAccount();
  const recompute = useRecomputeAccount();

  const accounts: Account[] = useMemo(() => {
    const list = accountsQuery.data || [];
    return list.map((a: any) => {
      const opt = typeOptFor(a.accountType);
      return {
        id: a.id,
        type: a.accountType as AccountType,
        name: a.accountName,
        provider: a.providerName || '',
        mask: a.maskedAccountNumber || undefined,
        balance: Number(a.balance ?? 0),
        currency: a.currency || 'INR',
        color: a.color || opt.color,
        isPrimary: !!a.isPrimary,
        isActive: a.isActive !== false,
        lastSync: a.updatedAt || new Date().toISOString(),
      };
    });
  }, [accountsQuery.data]);

  const [filter, setFilter] = useState<FilterType>('all');
  const [showAdd, setShowAdd] = useState(false);

  const totals = useMemo(() => {
    const assets = accounts
      .filter((a) => a.balance > 0 && a.type !== 'LOAN')
      .reduce((s, a) => s + a.balance, 0);
    const liabilities = accounts
      .filter((a) => a.balance < 0 || a.type === 'LOAN')
      .reduce((s, a) => s + Math.abs(a.balance), 0);
    return { assets, liabilities, netWorth: assets - liabilities };
  }, [accounts]);

  const filtered = useMemo(() => {
    if (filter === 'all') return accounts;
    return accounts.filter((a) => a.type === filter);
  }, [accounts, filter]);

  const handleRemove = (acc: Account) =>
    Alert.alert(
      `Remove ${acc.name}?`,
      'Transactions will remain but the account will be unlinked.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteAccount.mutate(acc.id),
        },
      ],
    );

  const handleSync = (id: string) =>
    recompute.mutate(id, {
      onSuccess: () => Alert.alert('Synced', 'Balance refreshed from transactions.'),
      onError: (e: any) => Alert.alert('Sync failed', e?.message ?? 'Could not sync account.'),
    });

  if (accountsQuery.isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.accentAi} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Accounts"
        subtitle={`${accounts.length} linked`}
        onBack={() => navigation.goBack()}
        rightContent={
          <TouchableOpacity
            onPress={() => setShowAdd(true)}
            accessibilityRole="button"
            accessibilityLabel="Add account"
            style={styles.headerCta}
          >
            <Plus size={16} color={Colors.white} strokeWidth={2.5} />
            <Text style={styles.headerCtaText}>New</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Net worth hero */}
        <Card variant="hero" padding="xl">
          <Text style={styles.heroLabel}>NET WORTH</Text>
          <Text
            style={[
              styles.heroValue,
              {
                color: totals.netWorth >= 0 ? Colors.textPrimary : Colors.accentError,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {totals.netWorth < 0 ? '−' : ''}
            {formatCurrency(Math.abs(totals.netWorth))}
          </Text>

          <View style={styles.heroFooter}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroSubLabel}>ASSETS</Text>
              <Text style={[styles.heroSubValue, { color: Colors.accentSuccess }]}>
                {formatCurrency(totals.assets, { compact: true })}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.heroSubLabel}>LIABILITIES</Text>
              <Text style={[styles.heroSubValue, { color: Colors.accentError }]}>
                {formatCurrency(totals.liabilities, { compact: true })}
              </Text>
            </View>
          </View>
        </Card>

        {/* Filter chip rail */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabs}
        >
          {(['all', 'BANK', 'WALLET', 'CREDIT_CARD', 'INVESTMENT', 'LOAN'] as FilterType[]).map(
            (f) => {
              const active = filter === f;
              const opt = f !== 'all' ? typeOptFor(f) : null;
              const Icon = opt?.icon;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
                  accessibilityRole="button"
                  style={[styles.chip, active && styles.chipActive]}
                >
                  {Icon && (
                    <Icon
                      size={14}
                      color={active ? Colors.white : Colors.textSecondary}
                      strokeWidth={1.75}
                    />
                  )}
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {f === 'all' ? 'All' : opt?.label}
                  </Text>
                </TouchableOpacity>
              );
            },
          )}
        </ScrollView>

        {filtered.length === 0 ? (
          <EmptyState
            icon="🏦"
            title="No accounts yet"
            message="Add your first account to start tracking your net worth."
            actionLabel="Add account"
            onAction={() => setShowAdd(true)}
          />
        ) : (
          <View>
            {filtered.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                onSetPrimary={() => setPrimary.mutate(a.id)}
                onSync={() => handleSync(a.id)}
                onRemove={() => handleRemove(a)}
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>

      <AddAccountModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreate={(payload) => {
          createAccount.mutate(payload, {
            onSuccess: () => setShowAdd(false),
          });
        }}
      />
    </View>
  );
}

// =============================================================
// Account card
// =============================================================
function AccountCard({
  account,
  onSetPrimary,
  onSync,
  onRemove,
}: {
  account: Account;
  onSetPrimary: () => void;
  onSync: () => void;
  onRemove: () => void;
}) {
  const opt = typeOptFor(account.type);
  const Icon = opt.icon;
  const balanceColor =
    account.balance < 0
      ? Colors.accentError
      : account.type === 'LOAN'
        ? Colors.accentWarning
        : Colors.textPrimary;

  return (
    <Card padding="base" style={styles.accCard}>
      <View style={styles.accTopRow}>
        <View
          style={[
            styles.accIcon,
            {
              backgroundColor: opt.color + '22',
              borderColor: opt.color + '44',
            },
          ]}
        >
          <Icon size={18} color={opt.color} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.accNameRow}>
            <Text style={styles.accName} numberOfLines={1}>
              {account.name}
            </Text>
            {account.isPrimary && <Badge text="Primary" variant="ai" size="sm" />}
          </View>
          <Text style={styles.accProvider}>
            {account.provider}
            {account.mask ? ` • ${account.mask}` : ''}
          </Text>
        </View>
      </View>

      <Text style={[styles.accBalance, { color: balanceColor }]}>
        {account.balance < 0 ? '−' : ''}
        {formatCurrency(Math.abs(account.balance))}
      </Text>

      <View style={styles.accActions}>
        {!account.isPrimary && (
          <TouchableOpacity
            onPress={onSetPrimary}
            accessibilityRole="button"
            accessibilityLabel="Set as primary"
            style={styles.accActionBtn}
            hitSlop={4}
          >
            <Star size={14} color={Colors.textSecondary} strokeWidth={1.75} />
            <Text style={styles.accActionLabel}>Primary</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onSync}
          accessibilityRole="button"
          accessibilityLabel="Sync"
          style={styles.accActionBtn}
          hitSlop={4}
        >
          <RefreshCw size={14} color={Colors.textSecondary} strokeWidth={1.75} />
          <Text style={styles.accActionLabel}>Sync</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel="Remove"
          style={[styles.accActionBtn, { marginLeft: 'auto' }]}
          hitSlop={4}
        >
          <Trash2 size={14} color={Colors.accentError} strokeWidth={1.75} />
          <Text style={[styles.accActionLabel, { color: Colors.accentError }]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// =============================================================
// Add modal
// =============================================================
function AddAccountModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (payload: any) => void;
}) {
  const [type, setType] = useState<AccountType | null>(null);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [mask, setMask] = useState('');
  const [balance, setBalance] = useState('');

  const handleSubmit = () => {
    if (!type || !name.trim() || !provider.trim()) {
      Alert.alert('Missing fields', 'Pick a type and fill in name + provider.');
      return;
    }
    onCreate({
      accountType: type,
      accountName: name.trim(),
      providerName: provider.trim(),
      maskedAccountNumber: mask || undefined,
      balance: parseFloat(balance || '0'),
    });
    setType(null);
    setName('');
    setProvider('');
    setMask('');
    setBalance('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <ScrollView
          contentContainerStyle={styles.modalSheetScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Link account</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={20} color={Colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>TYPE</Text>
            <View style={styles.typeGrid}>
              {TYPE_OPTIONS.map((opt) => {
                const active = type === opt.type;
                const Icon = opt.icon;
                return (
                  <TouchableOpacity
                    key={opt.type}
                    onPress={() => setType(opt.type)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.typeTile,
                      active && {
                        borderColor: opt.color,
                        backgroundColor: opt.color + '14',
                      },
                    ]}
                  >
                    <Icon
                      size={20}
                      color={active ? opt.color : Colors.textSecondary}
                      strokeWidth={1.75}
                    />
                    <Text style={[styles.typeTileLabel, active && { color: opt.color }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalLabel}>NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Salary account"
              placeholderTextColor={Colors.textTertiary}
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>PROVIDER</Text>
            <TextInput
              value={provider}
              onChangeText={setProvider}
              placeholder="HDFC Bank, ICICI, Paytm…"
              placeholderTextColor={Colors.textTertiary}
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>LAST 4 DIGITS (OPTIONAL)</Text>
            <TextInput
              value={mask}
              onChangeText={setMask}
              placeholder="****1234"
              placeholderTextColor={Colors.textTertiary}
              style={styles.modalInput}
            />

            <Text style={styles.modalLabel}>BALANCE (₹)</Text>
            <TextInput
              value={balance}
              onChangeText={setBalance}
              placeholder="50000"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
              style={styles.modalInput}
            />

            <View style={{ marginTop: Spacing.xl }}>
              <Button
                title="Add account"
                onPress={handleSubmit}
                fullWidth
                size="lg"
                trailingIcon={<ArrowRight size={16} color={Colors.white} strokeWidth={2} />}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
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
  heroLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1.2,
    fontWeight: Typography.weights.medium,
  },
  heroValue: {
    marginTop: Spacing.xs,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -1.2,
    marginBottom: Spacing.base,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  heroSubLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    fontWeight: Typography.weights.medium,
  },
  heroSubValue: {
    marginTop: 2,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.4,
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.borderDefault,
    marginHorizontal: Spacing.base,
  },

  // Chips
  filterTabs: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
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

  // Account card
  accCard: {
    marginBottom: Spacing.sm,
  },
  accTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  accIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  accNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  accName: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
  },
  accProvider: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'] as any,
  },
  accBalance: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.6,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  accActions: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    gap: Spacing.sm,
  },
  accActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerHigh,
    gap: 4,
  },
  accActionLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textSecondary,
    letterSpacing: 0.4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheetScroll: {
    flexGrow: 1,
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

  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  typeTile: {
    flexBasis: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    gap: Spacing.sm,
  },
  typeTileLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textSecondary,
  },
});
