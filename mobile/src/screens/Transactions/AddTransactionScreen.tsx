import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Card, Button, Badge, Header } from '../../components/shared';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../../styles/theme';

type EntryMode = 'manual' | 'assisted' | 'voice';
type TransactionType = 'CREDIT' | 'DEBIT';

const CATEGORIES = [
  { id: 'food', label: 'Food', icon: '🍔', color: '#FEE2E2' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', color: '#EDE9FE' },
  { id: 'transport', label: 'Transport', icon: '🚗', color: '#DBEAFE' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', color: '#FCE7F3' },
  { id: 'bills', label: 'Bills', icon: '⚡', color: '#FEF3C7' },
  { id: 'health', label: 'Health', icon: '💊', color: '#D1FAE5' },
  { id: 'subscription', label: 'Subscription', icon: '🔄', color: '#E0E7FF' },
  { id: 'other', label: 'Other', icon: '📦', color: Colors.gray100 },
];

const ACCOUNTS = [
  { id: '1', name: 'HDFC Bank', mask: '****4521', icon: '🏦', balance: 45000 },
  { id: '2', name: 'ICICI Bank', mask: '****1234', icon: '🏦', balance: 12000 },
  { id: '3', name: 'Cash', mask: '', icon: '💵', balance: 3500 },
  { id: '4', name: 'Paytm Wallet', mask: '', icon: '📱', balance: 1200 },
];

interface AISuggestion {
  category: string;
  merchant: string;
  isRecurring: boolean;
  confidence: number;
  budgetImpact: { category: string; current: number; limit: number };
}

export function AddTransactionScreen({ navigation }: any) {
  const [mode, setMode] = useState<EntryMode>('assisted');
  const [type, setType] = useState<TransactionType>('DEBIT');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('1');
  const [voiceInput, setVoiceInput] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Simulate AI analysis when merchant or amount changes (assisted mode)
  useEffect(() => {
    if (mode === 'assisted' && merchant.length > 2 && amount) {
      setIsAnalyzing(true);
      const timer = setTimeout(() => {
        setAiSuggestion(generateAISuggestion(merchant, parseFloat(amount)));
        setIsAnalyzing(false);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setAiSuggestion(null);
    }
  }, [merchant, amount, mode]);

  const handleSubmit = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('Missing category', 'Please select a category');
      return;
    }

    Alert.alert(
      'Transaction Added',
      `${type === 'CREDIT' ? '+' : '-'}₹${amount} for ${merchant || 'transaction'}`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  const handleAcceptAI = () => {
    if (aiSuggestion) {
      const cat = CATEGORIES.find((c) => c.label.toLowerCase() === aiSuggestion.category.toLowerCase());
      if (cat) setSelectedCategory(cat.id);
      setMerchant(aiSuggestion.merchant);
    }
  };

  const handleVoiceInput = () => {
    // Simulate voice recognition
    Alert.alert('Voice Input', 'Listening... Say something like "Spent 200 on chai"', [
      {
        text: 'Use Sample',
        onPress: () => {
          setVoiceInput('Spent 200 on chai at tea stall');
          setAmount('200');
          setMerchant('Tea stall');
          setDescription('Chai');
          setSelectedCategory('food');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <Header
        title="Add Transaction"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode selector */}
        <View style={styles.modeRow}>
          <ModeButton
            label="✍️ Manual"
            active={mode === 'manual'}
            onPress={() => setMode('manual')}
          />
          <ModeButton
            label="🤖 Assisted"
            active={mode === 'assisted'}
            onPress={() => setMode('assisted')}
          />
          <ModeButton
            label="🎤 Voice"
            active={mode === 'voice'}
            onPress={() => setMode('voice')}
          />
        </View>

        {/* Voice mode */}
        {mode === 'voice' && (
          <Card style={styles.voiceCard}>
            <Text style={styles.voiceTitle}>Voice Entry</Text>
            <Text style={styles.voiceSubtitle}>
              Try: "Spent 200 on chai" or "Got 5000 cashback"
            </Text>
            <TouchableOpacity style={styles.voiceMic} onPress={handleVoiceInput}>
              <Text style={styles.voiceMicIcon}>🎤</Text>
              <Text style={styles.voiceMicText}>Tap to speak</Text>
            </TouchableOpacity>
            {voiceInput.length > 0 && (
              <View style={styles.voiceResult}>
                <Text style={styles.voiceResultLabel}>Heard:</Text>
                <Text style={styles.voiceResultText}>"{voiceInput}"</Text>
              </View>
            )}
          </Card>
        )}

        {/* Type Toggle */}
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[
              styles.typeOption,
              type === 'DEBIT' && styles.typeOptionActive,
              type === 'DEBIT' && { backgroundColor: Colors.error },
            ]}
            onPress={() => setType('DEBIT')}
          >
            <Text
              style={[
                styles.typeOptionText,
                type === 'DEBIT' && styles.typeOptionTextActive,
              ]}
            >
              💸 Expense
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeOption,
              type === 'CREDIT' && styles.typeOptionActive,
              type === 'CREDIT' && { backgroundColor: Colors.success },
            ]}
            onPress={() => setType('CREDIT')}
          >
            <Text
              style={[
                styles.typeOptionText,
                type === 'CREDIT' && styles.typeOptionTextActive,
              ]}
            >
              💰 Income
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount Input */}
        <Card style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount</Text>
          <View style={styles.amountInputRow}>
            <Text style={styles.amountCurrency}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </Card>

        {/* Merchant */}
        <Card style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>Merchant / Source</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="e.g., Swiggy, Uber, Salary"
            placeholderTextColor={Colors.textTertiary}
            value={merchant}
            onChangeText={setMerchant}
          />
        </Card>

        {/* AI Suggestions Panel */}
        {mode === 'assisted' && (isAnalyzing || aiSuggestion) && (
          <Card style={styles.aiCard}>
            <View style={styles.aiHeader}>
              <Text style={styles.aiIcon}>🤖</Text>
              <Text style={styles.aiTitle}>AI Suggestions</Text>
              {aiSuggestion && (
                <Badge
                  text={`${Math.round(aiSuggestion.confidence * 100)}% confident`}
                  variant="success"
                  size="sm"
                />
              )}
            </View>
            {isAnalyzing ? (
              <Text style={styles.aiAnalyzing}>Analyzing transaction...</Text>
            ) : aiSuggestion ? (
              <>
                <View style={styles.aiSuggestionRow}>
                  <Text style={styles.aiSuggestionLabel}>Category:</Text>
                  <Text style={styles.aiSuggestionValue}>{aiSuggestion.category}</Text>
                </View>
                <View style={styles.aiSuggestionRow}>
                  <Text style={styles.aiSuggestionLabel}>Merchant:</Text>
                  <Text style={styles.aiSuggestionValue}>{aiSuggestion.merchant}</Text>
                </View>
                {aiSuggestion.isRecurring && (
                  <View style={styles.aiAlert}>
                    <Text style={styles.aiAlertText}>
                      🔄 This looks like a recurring payment
                    </Text>
                  </View>
                )}
                {aiSuggestion.budgetImpact && (
                  <View style={styles.aiAlert}>
                    <Text style={styles.aiAlertText}>
                      📊 Will use {Math.round(((aiSuggestion.budgetImpact.current + parseFloat(amount || '0')) / aiSuggestion.budgetImpact.limit) * 100)}% of {aiSuggestion.budgetImpact.category} budget
                    </Text>
                  </View>
                )}
                <Button
                  title="Accept Suggestions"
                  onPress={handleAcceptAI}
                  variant="primary"
                  size="sm"
                  fullWidth
                  style={{ marginTop: Spacing.sm }}
                />
              </>
            ) : null}
          </Card>
        )}

        {/* Categories */}
        <View style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  { backgroundColor: cat.color },
                  selectedCategory === cat.id && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    selectedCategory === cat.id && styles.categoryLabelActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Account */}
        <Card style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>Account</Text>
          {ACCOUNTS.map((account) => (
            <TouchableOpacity
              key={account.id}
              style={[
                styles.accountRow,
                selectedAccount === account.id && styles.accountRowActive,
              ]}
              onPress={() => setSelectedAccount(account.id)}
            >
              <Text style={styles.accountIcon}>{account.icon}</Text>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{account.name}</Text>
                {account.mask && <Text style={styles.accountMask}>{account.mask}</Text>}
              </View>
              <Text style={styles.accountBalance}>₹{account.balance.toLocaleString()}</Text>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Description */}
        <Card style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={[styles.fieldInput, styles.textArea]}
            placeholder="Add a note..."
            placeholderTextColor={Colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </Card>

        {/* Submit */}
        <Button
          title={`Add ${type === 'CREDIT' ? 'Income' : 'Expense'}`}
          onPress={handleSubmit}
          variant={type === 'CREDIT' ? 'success' : 'primary'}
          size="lg"
          fullWidth
          style={{ marginTop: Spacing.lg, marginBottom: Spacing['3xl'] }}
        />
      </ScrollView>
    </View>
  );
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.modeBtn, active && styles.modeBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function generateAISuggestion(merchant: string, amount: number): AISuggestion {
  const lower = merchant.toLowerCase();
  let category = 'Other';
  let isRecurring = false;

  if (lower.includes('swiggy') || lower.includes('zomato') || lower.includes('food')) {
    category = 'Food';
  } else if (lower.includes('uber') || lower.includes('ola')) {
    category = 'Transport';
  } else if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('hotstar')) {
    category = 'Entertainment';
    isRecurring = true;
  } else if (lower.includes('amazon') || lower.includes('flipkart')) {
    category = 'Shopping';
  } else if (lower.includes('electric') || lower.includes('water') || lower.includes('jio')) {
    category = 'Bills';
    isRecurring = true;
  }

  return {
    category,
    merchant: merchant.charAt(0).toUpperCase() + merchant.slice(1).toLowerCase(),
    isRecurring,
    confidence: 0.85 + Math.random() * 0.13,
    budgetImpact: {
      category,
      current: 6500,
      limit: 10000,
    },
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  // Mode selector
  modeRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.base,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
  },
  modeBtnText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
  modeBtnTextActive: {
    color: Colors.white,
  },
  // Voice
  voiceCard: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  voiceTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  voiceSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  voiceMic: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceMicIcon: {
    fontSize: 40,
  },
  voiceMicText: {
    color: Colors.white,
    fontSize: Typography.sizes.xs,
    marginTop: 4,
  },
  voiceResult: {
    marginTop: Spacing.lg,
    padding: Spacing.base,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.base,
    width: '100%',
  },
  voiceResultLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  voiceResultText: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontStyle: 'italic',
  },
  // Type toggle
  typeToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  typeOption: {
    flex: 1,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    alignItems: 'center',
  },
  typeOptionActive: {},
  typeOptionText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textSecondary,
  },
  typeOptionTextActive: {
    color: Colors.white,
  },
  // Amount
  amountCard: {
    marginBottom: Spacing.base,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountCurrency: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginRight: Spacing.xs,
  },
  amountInput: {
    fontSize: Typography.sizes['4xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    minWidth: 100,
    textAlign: 'center',
  },
  // Field cards
  fieldCard: {
    marginBottom: Spacing.base,
  },
  fieldLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  fieldInput: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.base,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // AI Card
  aiCard: {
    marginBottom: Spacing.base,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  aiIcon: {
    fontSize: 20,
  },
  aiTitle: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  aiAnalyzing: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  aiSuggestionRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  aiSuggestionLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    width: 90,
  },
  aiSuggestionValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
    flex: 1,
  },
  aiAlert: {
    backgroundColor: Colors.white,
    padding: Spacing.sm,
    borderRadius: BorderRadius.base,
    marginTop: Spacing.xs,
  },
  aiAlertText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  // Categories
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryChipActive: {
    borderColor: Colors.primary,
  },
  categoryIcon: {
    fontSize: 18,
    marginRight: Spacing.xs,
  },
  categoryLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  categoryLabelActive: {
    fontWeight: Typography.weights.bold,
  },
  // Accounts
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.base,
    marginVertical: 2,
  },
  accountRowActive: {
    backgroundColor: '#EEF2FF',
  },
  accountIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  accountInfo: {
    flex: 1,
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
  },
  accountBalance: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
});
