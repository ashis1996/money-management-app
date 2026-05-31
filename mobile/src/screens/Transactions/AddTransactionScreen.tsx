import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Utensils,
  ShoppingBag,
  Car,
  Clapperboard,
  Zap,
  Pill,
  Repeat,
  Package,
  ArrowLeft,
  Sparkles,
  ArrowRight,
  Building,
  Wallet as WalletIcon,
  Coins,
  Smartphone,
  type LucideIcon,
} from 'lucide-react-native';
import { Badge, Button, Card, Section } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { useCreateTransaction, useAccounts } from '../../hooks';
import { formatCurrency } from '../../utils';

type TransactionType = 'CREDIT' | 'DEBIT';

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

function iconForAccount(type: string): LucideIcon {
  const t = type?.toLowerCase() ?? '';
  if (t.includes('wallet') || t.includes('paytm') || t.includes('upi')) return WalletIcon;
  if (t.includes('cash')) return Coins;
  if (t.includes('mobile') || t.includes('phone')) return Smartphone;
  return Building;
}

export function AddTransactionScreen({ navigation }: any) {
  const createTx = useCreateTransaction();
  const accountsQuery = useAccounts({ isActive: true });

  const accounts = (accountsQuery.data ?? []).map((a: any) => ({
    id: a.id,
    name: a.accountName,
    mask: a.maskedAccountNumber || '',
    type: a.accountType || a.type || '',
    balance: Number(a.balance ?? 0),
  }));

  const [type, setType] = useState<TransactionType>('DEBIT');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>(accounts[0]?.id ?? '');
  const [aiSuggestion, setAiSuggestion] = useState<{
    category: string;
    confidence: number;
    isRecurring: boolean;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // When merchant + amount are set, simulate an AI suggestion.
  useEffect(() => {
    if (merchant.length < 3 || !amount) {
      setAiSuggestion(null);
      return;
    }
    setIsAnalyzing(true);
    const timer = setTimeout(() => {
      setAiSuggestion(localAISuggestion(merchant));
      setIsAnalyzing(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [merchant, amount]);

  // Auto-pick the AI-suggested category if user hasn't picked one yet.
  useEffect(() => {
    if (aiSuggestion && !selectedCategory) {
      setSelectedCategory(aiSuggestion.category);
    }
  }, [aiSuggestion, selectedCategory]);

  // Default to the first account once they load.
  useEffect(() => {
    if (!selectedAccount && accounts[0]?.id) {
      setSelectedAccount(accounts[0].id);
    }
  }, [accounts, selectedAccount]);

  const handleSubmit = async () => {
    const value = Number(amount.replace(/[^0-9.]/g, ''));
    if (!value || value <= 0) return Alert.alert('Invalid amount', 'Enter a positive amount.');
    if (!selectedCategory)
      return Alert.alert('Pick a category', 'Choose a category for this transaction.');

    try {
      await createTx.mutateAsync({
        type,
        amount: value,
        merchant: merchant || undefined,
        description: description || undefined,
        categoryId: selectedCategory,
        accountId: selectedAccount || undefined,
        date: new Date().toISOString(),
      } as any);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={8}
          style={styles.headerBtn}
        >
          <ArrowLeft size={20} color={Colors.textPrimary} strokeWidth={1.75} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New transaction</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero amount entry */}
        <Card variant="hero" padding="xl">
          <View style={styles.typeToggle}>
            {(['DEBIT', 'CREDIT'] as const).map((t) => {
              const active = type === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setType(t)}
                  style={[
                    styles.typeChip,
                    active && (t === 'CREDIT' ? styles.typeChipCredit : styles.typeChipDebit),
                  ]}
                >
                  <Text style={[styles.typeChipLabel, active && styles.typeChipLabelActive]}>
                    {t === 'DEBIT' ? 'Spent' : 'Received'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.amountSign}>{type === 'CREDIT' ? '+' : '−'}</Text>
            <Text style={styles.amountSymbol}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={Colors.outline}
              keyboardType="numeric"
              style={[
                styles.amountInput,
                {
                  color: type === 'CREDIT' ? Colors.accentSuccess : Colors.textPrimary,
                },
              ]}
              autoFocus
            />
          </View>
        </Card>

        {/* Merchant */}
        <Section
          title="Merchant"
          subtitle="Where did this happen?"
          style={{ marginTop: Spacing.lg }}
        >
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="e.g. Swiggy, Amazon, Zomato"
            placeholderTextColor={Colors.textTertiary}
            style={styles.textInput}
            autoCapitalize="words"
          />
        </Section>

        {/* AI suggestion */}
        {(isAnalyzing || aiSuggestion) && (
          <Card variant="ai" padding="base" style={{ marginTop: Spacing.sm }}>
            <View style={styles.aiRow}>
              <View style={styles.aiIcon}>
                <Sparkles size={16} color={Colors.accentAi} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1 }}>
                {isAnalyzing ? (
                  <View style={styles.aiAnalyzingRow}>
                    <ActivityIndicator size="small" color={Colors.accentAi} />
                    <Text style={styles.aiAnalyzingText}>Analysing pattern…</Text>
                  </View>
                ) : aiSuggestion ? (
                  <>
                    <Text style={styles.aiSuggestionTitle}>
                      Looks like a{' '}
                      <Text style={{ color: Colors.accentAi }}>{aiSuggestion.category}</Text>{' '}
                      transaction
                      {aiSuggestion.isRecurring && ' (recurring)'}
                    </Text>
                    <Text style={styles.aiSuggestionMeta}>
                      {Math.round(aiSuggestion.confidence * 100)}% confident
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
          </Card>
        )}

        {/* Category */}
        <Section
          title="Category"
          subtitle="Tap to override the AI suggestion"
          style={{ marginTop: Spacing.lg }}
        >
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((c) => {
              const active = selectedCategory === c.id;
              const Icon = c.icon;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedCategory(c.id)}
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
                    size={20}
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
        </Section>

        {/* Account */}
        {accounts.length > 0 && (
          <Section title="Account" style={{ marginTop: Spacing.lg }}>
            <Card padding="none">
              {accounts.map((a, i) => {
                const Icon = iconForAccount(a.type);
                const active = selectedAccount === a.id;
                const isLast = i === accounts.length - 1;
                return (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => setSelectedAccount(a.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={[styles.accountRow, !isLast && styles.accountRowBorder]}
                  >
                    <View
                      style={[
                        styles.accountIcon,
                        active && {
                          backgroundColor: 'rgba(34,211,238,0.12)',
                          borderColor: 'rgba(34,211,238,0.40)',
                        },
                      ]}
                    >
                      <Icon
                        size={18}
                        color={active ? Colors.accentAi : Colors.textSecondary}
                        strokeWidth={1.75}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accountName}>{a.name}</Text>
                      {a.mask ? <Text style={styles.accountMask}>{a.mask}</Text> : null}
                    </View>
                    <Text style={styles.accountBalance}>
                      {formatCurrency(a.balance, { compact: true })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </Card>
          </Section>
        )}

        {/* Notes */}
        <Section title="Notes (optional)" style={{ marginTop: Spacing.lg }}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What was this for?"
            placeholderTextColor={Colors.textTertiary}
            style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top' }]}
            multiline
          />
        </Section>

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>

      <View style={styles.submitBar}>
        <Button
          title="Save transaction"
          onPress={handleSubmit}
          loading={createTx.isPending}
          fullWidth
          size="lg"
          trailingIcon={<ArrowRight size={16} color={Colors.white} strokeWidth={2} />}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// =============================================================
// Local AI heuristic — keyword match against the merchant string.
// Same shape the AI proxy returns so future swaps are zero-effort.
// =============================================================
function localAISuggestion(merchant: string): {
  category: string;
  confidence: number;
  isRecurring: boolean;
} {
  const m = merchant.toLowerCase();
  if (/swiggy|zomato|domino|kfc|mcd|food|cafe|restaurant/.test(m))
    return { category: 'food', confidence: 0.94, isRecurring: false };
  if (/amazon|flipkart|myntra|ajio|nykaa/.test(m))
    return { category: 'shopping', confidence: 0.91, isRecurring: false };
  if (/uber|ola|metro|petrol|fuel|cab/.test(m))
    return { category: 'transport', confidence: 0.9, isRecurring: false };
  if (/netflix|spotify|prime|hotstar|youtube/.test(m))
    return { category: 'subscription', confidence: 0.96, isRecurring: true };
  if (/electric|water|gas|bsnl|airtel|jio|vi/.test(m))
    return { category: 'bills', confidence: 0.92, isRecurring: true };
  if (/bms|pvr|inox|cinema|spotify|gaming/.test(m))
    return { category: 'entertainment', confidence: 0.85, isRecurring: false };
  if (/hospital|pharmacy|apollo|medplus/.test(m))
    return { category: 'health', confidence: 0.93, isRecurring: false };
  return { category: 'other', confidence: 0.6, isRecurring: false };
}

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
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },

  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },

  // Hero
  typeToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    alignSelf: 'center',
  },
  typeChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  typeChipDebit: {
    backgroundColor: 'rgba(255,180,171,0.16)',
    borderColor: Colors.accentError,
  },
  typeChipCredit: {
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderColor: Colors.accentSuccess,
  },
  typeChipLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
    letterSpacing: 0.4,
  },
  typeChipLabelActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.bold,
  },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  amountSign: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    color: Colors.textSecondary,
  },
  amountSymbol: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    color: Colors.textSecondary,
    marginRight: 2,
  },
  amountInput: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -2,
    minWidth: 100,
    textAlign: 'left',
    paddingVertical: 0,
  },

  // Inputs
  textInput: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.base,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },

  // AI
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIcon: {
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
  aiAnalyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  aiAnalyzingText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  aiSuggestionTitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.4,
  },
  aiSuggestionMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'] as any,
  },

  // Categories
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryTile: {
    flexBasis: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
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

  // Accounts
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  accountRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  accountIcon: {
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
  accountName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  accountMask: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    fontVariant: ['tabular-nums'] as any,
  },
  accountBalance: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },

  // Submit bar
  submitBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    backgroundColor: Colors.surfaceContainerLow,
  },
});
