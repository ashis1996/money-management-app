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
import { Card, Badge, Button, Header, EmptyState } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, Tints } from '../../styles/theme';
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useSetPrimaryAccount,
  useRecomputeAccount,
} from '../../hooks';

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
  icon: string;
  isPrimary: boolean;
  isActive: boolean;
  // Credit card specific
  creditLimit?: number;
  dueDate?: string;
  dueAmount?: number;
  // Loan specific
  emiAmount?: number;
  emiNextDate?: string;
  loanRemaining?: number;
  lastSync: string;
}

const TYPE_OPTIONS: {
  type: AccountType;
  label: string;
  icon: string;
  color: string;
}[] = [
  { type: 'BANK', label: 'Bank Account', icon: '🏦', color: '#4F46E5' },
  { type: 'WALLET', label: 'Wallet', icon: '📱', color: '#8B5CF6' },
  { type: 'CREDIT_CARD', label: 'Credit Card', icon: '💳', color: '#EC4899' },
  { type: 'INVESTMENT', label: 'Investment', icon: '📈', color: '#10B981' },
  { type: 'LOAN', label: 'Loan', icon: '🏠', color: '#F59E0B' },
];

const TYPE_LABELS: Record<AccountType, string> = {
  BANK: 'Bank',
  WALLET: 'Wallet',
  CREDIT_CARD: 'Credit Card',
  INVESTMENT: 'Investment',
  LOAN: 'Loan',
};

const mockAccounts: Account[] = [];

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
      const typeOpt = TYPE_OPTIONS.find((t) => t.type === a.accountType);
      return {
        id: a.id,
        type: a.accountType,
        name: a.accountName,
        provider: a.providerName || '',
        mask: a.maskedAccountNumber || undefined,
        balance: Number(a.balance ?? 0),
        currency: a.currency || 'INR',
        color: a.color || typeOpt?.color || Colors.primary,
        icon: a.icon || typeOpt?.icon || '🏦',
        isPrimary: !!a.isPrimary,
        isActive: a.isActive !== false,
        lastSync: a.updatedAt || new Date().toISOString(),
      };
    });
  }, [accountsQuery.data]);

  const [filter, setFilter] = useState<FilterType>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedType, setSelectedType] = useState<AccountType | null>(null);
  const [newAccount, setNewAccount] = useState({
    name: '',
    provider: '',
    mask: '',
    balance: '',
  });

  const totals = useMemo(() => {
    const assets = accounts
      .filter((a) => a.balance > 0 && a.type !== 'LOAN')
      .reduce((s, a) => s + a.balance, 0);
    const liabilities = accounts
      .filter((a) => a.balance < 0)
      .reduce((s, a) => s + Math.abs(a.balance), 0);
    const netWorth = assets - liabilities;
    return { assets, liabilities, netWorth };
  }, [accounts]);

  const filtered = useMemo(() => {
    if (filter === 'all') return accounts;
    return accounts.filter((a) => a.type === filter);
  }, [accounts, filter]);

  const grouped = useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      BANK: [],
      WALLET: [],
      CREDIT_CARD: [],
      INVESTMENT: [],
      LOAN: [],
    };
    filtered.forEach((a) => groups[a.type].push(a));
    return groups;
  }, [filtered]);

  const handleSetPrimary = (id: string) => {
    setPrimary.mutate(id);
  };

  const handleSync = (id: string) => {
    recompute.mutate(id, {
      onSuccess: () => Alert.alert('Synced', 'Account refreshed from transaction history'),
      onError: (e: any) => Alert.alert('Sync failed', e?.message ?? 'Could not sync account'),
    });
  };

  const handleRemove = (acc: Account) => {
    Alert.alert(
      `Remove ${acc.name}?`,
      'Transactions will remain but the account will be unlinked',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteAccount.mutate(acc.id),
        },
      ],
    );
  };

  const handleAddAccount = async () => {
    if (!selectedType || !newAccount.name || !newAccount.provider) {
      Alert.alert('Missing fields', 'Please fill all required fields');
      return;
    }
    try {
      await createAccount.mutateAsync({
        accountType: selectedType,
        accountName: newAccount.name,
        providerName: newAccount.provider,
        maskedAccountNumber: newAccount.mask || undefined,
        balance: parseFloat(newAccount.balance || '0'),
        isPrimary: accounts.length === 0,
      });
      setShowAdd(false);
      setSelectedType(null);
      setNewAccount({ name: '', provider: '', mask: '', balance: '' });
    } catch (e: any) {
      Alert.alert('Could not add account', e?.message ?? 'Unknown error');
    }
  };

  if (accountsQuery.isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Accounts"
        onBack={() => navigation.goBack()}
        rightIcon="+"
        onRightPress={() => setShowAdd(true)}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Net worth card */}
        <Card style={styles.netWorthCard}>
          <Text style={styles.netWorthLabel}>Net Worth</Text>
          <Text
            style={[
              styles.netWorthValue,
              { color: totals.netWorth >= 0 ? Colors.white : Colors.error },
            ]}
          >
            ₹{totals.netWorth.toLocaleString()}
          </Text>
          <View style={styles.nwBreakdown}>
            <View style={styles.nwItem}>
              <Text style={styles.nwLabel}>Assets</Text>
              <Text style={[styles.nwValue, { color: Tints.successBorder }]}>
                +₹{totals.assets.toLocaleString()}
              </Text>
            </View>
            <View style={styles.nwDivider} />
            <View style={styles.nwItem}>
              <Text style={styles.nwLabel}>Liabilities</Text>
              <Text style={[styles.nwValue, { color: Colors.error }]}>
                -₹{totals.liabilities.toLocaleString()}
              </Text>
            </View>
          </View>
        </Card>

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'BANK', label: '🏦 Banks' },
              { key: 'CREDIT_CARD', label: '💳 Cards' },
              { key: 'WALLET', label: '📱 Wallets' },
              { key: 'INVESTMENT', label: '📈 Investments' },
              { key: 'LOAN', label: '🏠 Loans' },
            ] as { key: FilterType; label: string }[]
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, filter === tab.key && styles.tabActive]}
              onPress={() => setFilter(tab.key)}
            >
              <Text style={[styles.tabText, filter === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Account groups */}
        {Object.entries(grouped).map(([type, accs]) =>
          accs.length === 0 ? null : (
            <View key={type} style={styles.group}>
              <Text style={styles.groupTitle}>
                {TYPE_LABELS[type as AccountType]} ({accs.length})
              </Text>
              {accs.map((acc) => (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  onPrimary={() => handleSetPrimary(acc.id)}
                  onSync={() => handleSync(acc.id)}
                  onRemove={() => handleRemove(acc)}
                  onPress={() => Alert.alert(acc.name, `View transactions for ${acc.name}`)}
                />
              ))}
            </View>
          ),
        )}

        {filtered.length === 0 && (
          <EmptyState
            icon="🏦"
            title="No accounts yet"
            message="Link your bank, wallet, or credit card to get started"
            actionLabel="Add Account"
            onAction={() => setShowAdd(true)}
          />
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      {/* Add account modal */}
      <Modal
        visible={showAdd}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAdd(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Account</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowAdd(false);
                    setSelectedType(null);
                  }}
                >
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {!selectedType ? (
                <>
                  <Text style={styles.fieldLabel}>Account type</Text>
                  <View style={styles.typeGrid}>
                    {TYPE_OPTIONS.map((t) => (
                      <TouchableOpacity
                        key={t.type}
                        style={[styles.typeCard, { borderColor: t.color }]}
                        onPress={() => setSelectedType(t.type)}
                      >
                        <Text style={styles.typeIcon}>{t.icon}</Text>
                        <Text style={styles.typeName}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.typeBanner}>
                    <Text style={styles.typeBannerIcon}>
                      {TYPE_OPTIONS.find((t) => t.type === selectedType)?.icon}
                    </Text>
                    <Text style={styles.typeBannerLabel}>
                      {TYPE_OPTIONS.find((t) => t.type === selectedType)?.label}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedType(null)}>
                      <Text style={styles.linkText}>Change</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.fieldLabel}>Account Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Salary Account"
                    placeholderTextColor={Colors.textTertiary}
                    value={newAccount.name}
                    onChangeText={(t) => setNewAccount({ ...newAccount, name: t })}
                  />

                  <Text style={styles.fieldLabel}>Provider</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., HDFC Bank, Paytm, Visa"
                    placeholderTextColor={Colors.textTertiary}
                    value={newAccount.provider}
                    onChangeText={(t) => setNewAccount({ ...newAccount, provider: t })}
                  />

                  <Text style={styles.fieldLabel}>Last 4 digits (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1234"
                    placeholderTextColor={Colors.textTertiary}
                    value={newAccount.mask}
                    onChangeText={(t) => setNewAccount({ ...newAccount, mask: t })}
                    keyboardType="numeric"
                    maxLength={4}
                  />

                  <Text style={styles.fieldLabel}>
                    Current Balance{' '}
                    {selectedType === 'CREDIT_CARD' || selectedType === 'LOAN'
                      ? '(amount owed)'
                      : ''}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    value={newAccount.balance}
                    onChangeText={(t) => setNewAccount({ ...newAccount, balance: t })}
                    keyboardType="numeric"
                  />

                  <View style={styles.linkOption}>
                    <Text style={styles.linkOptionIcon}>🔗</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.linkOptionTitle}>Auto-link via SMS / UPI</Text>
                      <Text style={styles.linkOptionText}>
                        We'll detect transactions automatically once linked
                      </Text>
                    </View>
                  </View>

                  <Button
                    title="Add Account"
                    onPress={handleAddAccount}
                    variant="primary"
                    fullWidth
                    style={{ marginTop: Spacing.lg }}
                  />
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

interface AccountCardProps {
  account: Account;
  onPrimary: () => void;
  onSync: () => void;
  onRemove: () => void;
  onPress: () => void;
}

function AccountCard({ account, onPrimary, onSync, onRemove, onPress }: AccountCardProps) {
  const isCredit = account.type === 'CREDIT_CARD';
  const isLoan = account.type === 'LOAN';
  const utilizationPct =
    isCredit && account.creditLimit
      ? Math.round((Math.abs(account.balance) / account.creditLimit) * 100)
      : 0;

  const dueInDays = account.dueDate
    ? Math.ceil((new Date(account.dueDate).getTime() - Date.now()) / (24 * 3600 * 1000))
    : null;

  return (
    <Card style={styles.accCard} onPress={onPress} onLongPress={onRemove}>
      <View style={[styles.accColorBar, { backgroundColor: account.color }]} />
      <View style={styles.accContent}>
        <View style={styles.accHeader}>
          <View style={[styles.accIcon, { backgroundColor: account.color + '20' }]}>
            <Text style={styles.accIconText}>{account.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.accTitleRow}>
              <Text style={styles.accName}>{account.name}</Text>
              {account.isPrimary && <Badge text="Primary" variant="primary" size="sm" />}
            </View>
            <Text style={styles.accProvider}>
              {account.provider}
              {account.mask && ` ${account.mask}`}
            </Text>
          </View>
          <Text
            style={[
              styles.accBalance,
              { color: account.balance >= 0 ? Colors.textPrimary : Colors.error },
            ]}
          >
            {account.balance < 0 ? '-' : ''}₹{Math.abs(account.balance).toLocaleString()}
          </Text>
        </View>

        {/* Credit card utilization */}
        {isCredit && account.creditLimit && (
          <View style={styles.creditSection}>
            <View style={styles.creditRow}>
              <Text style={styles.creditLabel}>Utilized</Text>
              <Text style={styles.creditValue}>
                ₹{Math.abs(account.balance).toLocaleString()} / ₹
                {account.creditLimit.toLocaleString()}
              </Text>
            </View>
            <View style={styles.utilTrack}>
              <View
                style={[
                  styles.utilFill,
                  {
                    width: `${Math.min(utilizationPct, 100)}%`,
                    backgroundColor:
                      utilizationPct > 70
                        ? Colors.error
                        : utilizationPct > 30
                          ? Colors.warning
                          : Colors.success,
                  },
                ]}
              />
            </View>
            <View style={styles.creditFooter}>
              <Text style={styles.creditFooterText}>{utilizationPct}% used (keep below 30%)</Text>
              {dueInDays !== null && account.dueAmount && (
                <Badge
                  text={`Due in ${dueInDays}d • ₹${account.dueAmount.toLocaleString()}`}
                  variant={dueInDays <= 3 ? 'error' : dueInDays <= 7 ? 'warning' : 'info'}
                  size="sm"
                />
              )}
            </View>
          </View>
        )}

        {/* Loan EMI */}
        {isLoan && account.emiAmount && (
          <View style={styles.creditSection}>
            <View style={styles.creditRow}>
              <Text style={styles.creditLabel}>Next EMI</Text>
              <Text style={styles.creditValue}>₹{account.emiAmount.toLocaleString()}</Text>
            </View>
            <View style={styles.creditFooter}>
              <Text style={styles.creditFooterText}>
                Remaining: ₹{account.loanRemaining?.toLocaleString()}
              </Text>
              {account.emiNextDate && (
                <Badge
                  text={`Due ${new Date(account.emiNextDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}`}
                  variant="warning"
                  size="sm"
                />
              )}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.accActions}>
          <Text style={styles.lastSync}>🔄 Synced {formatRelativeTime(account.lastSync)}</Text>
          <View style={styles.accActionBtns}>
            {!account.isPrimary && account.type === 'BANK' && (
              <TouchableOpacity onPress={onPrimary} style={styles.accBtn}>
                <Text style={styles.accBtnText}>Make Primary</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onSync} style={styles.accBtn}>
              <Text style={styles.accBtnText}>Sync</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Card>
  );
}

function formatRelativeTime(iso: string): string {
  const ago = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ago / 60000);
  const hrs = Math.floor(ago / 3600000);
  const days = Math.floor(ago / (24 * 3600000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Net worth
  netWorthCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    backgroundColor: Colors.primary,
  },
  netWorthLabel: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  netWorthValue: {
    fontSize: Typography.sizes['4xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginVertical: 4,
  },
  nwBreakdown: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  nwItem: {
    flex: 1,
  },
  nwDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  nwLabel: {
    fontSize: Typography.sizes.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  nwValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    marginTop: 2,
  },
  // Tabs
  tabs: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  tab: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
    marginRight: Spacing.sm,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  // Group
  group: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  groupTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  // Account card
  accCard: {
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    padding: 0,
  },
  accColorBar: {
    width: 4,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  accContent: {
    padding: Spacing.base,
    paddingLeft: Spacing.base + 4,
  },
  accHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  accIconText: {
    fontSize: 22,
  },
  accTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  accName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  accProvider: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  accBalance: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
  },
  // Credit
  creditSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  creditLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  creditValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  utilTrack: {
    height: 6,
    backgroundColor: Colors.gray200,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  utilFill: {
    height: '100%',
    borderRadius: 3,
  },
  creditFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  creditFooterText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  // Actions
  accActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  lastSync: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
  },
  accActionBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  accBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  accBtnText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.semiBold,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalScrollContent: {
    flexGrow: 1,
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
  fieldLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
    textTransform: 'uppercase',
  },
  input: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.base,
    padding: Spacing.base,
    marginBottom: Spacing.xs,
  },
  // Type grid
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeCard: {
    width: '48%',
    padding: Spacing.lg,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
  },
  typeIcon: {
    fontSize: 36,
    marginBottom: Spacing.xs,
  },
  typeName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  typeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Tints.primaryBg,
    padding: Spacing.sm,
    borderRadius: BorderRadius.base,
    marginBottom: Spacing.base,
  },
  typeBannerIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  typeBannerLabel: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  linkText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.semiBold,
  },
  linkOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Tints.successBg,
    padding: Spacing.sm,
    borderRadius: BorderRadius.base,
    marginTop: Spacing.sm,
  },
  linkOptionIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  linkOptionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.success,
  },
  linkOptionText: {
    fontSize: Typography.sizes.xs,
    color: Colors.success,
    marginTop: 2,
  },
});
