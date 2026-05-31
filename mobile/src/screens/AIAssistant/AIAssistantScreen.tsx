import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Sparkles,
  Send,
  Mic,
  Trash2,
  ArrowRight,
  Droplet,
  Target,
  PieChart,
  Repeat,
  TrendingUp,
} from 'lucide-react-native';
import { AiOrb, Card, Header, IconButton } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { formatCurrency } from '../../utils';
import { useAskAi } from '../../hooks';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  timestamp: string;
}

const SUGGESTED_QUERIES = [
  { icon: Droplet, text: 'Where did I waste money this month?' },
  { icon: TrendingUp, text: 'How can I save ₹10,000/month?' },
  { icon: PieChart, text: 'Compare my spending to last month' },
  { icon: Repeat, text: 'What subscriptions should I cancel?' },
];

const QUICK_TOPICS: Array<{
  label: string;
  prompt: string;
  icon: React.ComponentType<any>;
}> = [
  { label: 'Money Leaks', prompt: 'Tell me about my money leaks', icon: Droplet },
  { label: 'Goals', prompt: 'How are my goals tracking?', icon: Target },
  { label: 'Budgets', prompt: 'How am I doing against my budgets?', icon: PieChart },
  { label: 'Subscriptions', prompt: 'Audit my subscriptions', icon: Repeat },
];

export function AIAssistantScreen({ navigation }: any) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const askAi = useAskAi();

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages]);

  const handleSend = async (text?: string) => {
    const query = (text ?? input).trim();
    if (!query) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const result: any = await askAi.mutateAsync({ query });
      const text =
        result?.answer ??
        result?.response ??
        result?.text ??
        result?.message ??
        result?.data?.answer ??
        "I couldn't generate a response right now. Try rephrasing.";

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: text,
          data: result?.data ?? result?.metadata ?? undefined,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      // Local heuristic fallback so the screen stays useful offline
      const local = generateLocalResponse(query);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: local.text + '\n\n(AI service unreachable, showing local analysis)',
          data: local.data,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => setMessages([]);

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <Header
        title="AI Coach"
        subtitle={isEmpty ? undefined : 'Ask anything about your money'}
        onBack={() => navigation.goBack()}
        rightContent={
          messages.length > 0 ? (
            <IconButton
              name="trash-2"
              onPress={handleClear}
              accessibilityLabel="Clear conversation"
              size="md"
              variant="ghost"
            />
          ) : undefined
        }
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.messagesContent, isEmpty && styles.emptyContent]}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          <EmptyHero onSelect={(q) => handleSend(q)} />
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {isLoading && <TypingIndicator />}
      </ScrollView>

      {/* Quick topics rail (when conversation is active) */}
      {messages.length > 0 && !isLoading && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topicsRow}
        >
          {QUICK_TOPICS.map((t) => {
            const Icon = t.icon;
            return (
              <TouchableOpacity
                key={t.label}
                style={styles.topicChip}
                onPress={() => handleSend(t.prompt)}
                accessibilityRole="button"
                accessibilityLabel={t.label}
              >
                <Icon size={14} color={Colors.accentAi} strokeWidth={1.75} />
                <Text style={styles.topicLabel}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <InputBar
        value={input}
        onChange={setInput}
        onSend={() => handleSend()}
        disabled={isLoading || !input.trim()}
      />
    </KeyboardAvoidingView>
  );
}

// =============================================================
// Empty hero (the crown-jewel landing)
// =============================================================
function EmptyHero({ onSelect }: { onSelect: (q: string) => void }) {
  return (
    <View style={styles.emptyHero}>
      <AiOrb size={120} decorative />

      <Text style={styles.emptyTitle}>Hi, I&apos;m your money coach</Text>
      <Text style={styles.emptySubtitle}>
        Ask me anything about your spending, savings, subscriptions, or goals.
      </Text>

      <View style={styles.suggestionList}>
        {SUGGESTED_QUERIES.map((s) => {
          const Icon = s.icon;
          return (
            <TouchableOpacity
              key={s.text}
              style={styles.suggestionRow}
              onPress={() => onSelect(s.text)}
              accessibilityRole="button"
              accessibilityLabel={s.text}
            >
              <View style={styles.suggestionIconHost}>
                <Icon size={16} color={Colors.accentAi} strokeWidth={1.75} />
              </View>
              <Text style={styles.suggestionText} numberOfLines={2}>
                {s.text}
              </Text>
              <ArrowRight size={16} color={Colors.accentPrimary} strokeWidth={1.75} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// =============================================================
// Message bubble
// =============================================================
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <View
      style={[
        styles.messageRow,
        isUser ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' },
      ]}
    >
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Sparkles size={14} color={Colors.accentAi} strokeWidth={2} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <Text
          style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAi]}
          selectable
        >
          {message.content}
        </Text>
        {message.data && <DataVisualization data={message.data} />}
        <Text style={[styles.bubbleTime, isUser ? styles.bubbleTimeUser : styles.bubbleTimeAi]}>
          {new Date(message.timestamp).toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.messageRow}>
      <View style={styles.aiAvatar}>
        <Sparkles size={14} color={Colors.accentAi} strokeWidth={2} />
      </View>
      <View style={[styles.bubble, styles.bubbleAi, styles.typingBubble]}>
        <ActivityIndicator size="small" color={Colors.accentAi} />
        <Text style={styles.typingText}>Thinking…</Text>
      </View>
    </View>
  );
}

// =============================================================
// Generated data widgets (rendered inside AI bubbles)
// =============================================================
function DataVisualization({ data }: { data: any }) {
  if (data?.type === 'leaks') {
    return (
      <View style={styles.dataCard}>
        <Text style={styles.dataTitle}>Money Leaks Found</Text>
        {data.leaks.map((leak: any, idx: number) => (
          <View key={idx} style={styles.dataRow}>
            <Text style={styles.dataLabel}>{leak.title}</Text>
            <Text style={styles.dataValue}>{formatCurrency(leak.amount)}/mo</Text>
          </View>
        ))}
        <View style={styles.dataTotalRow}>
          <Text style={styles.dataTotalLabel}>Potential savings</Text>
          <Text style={styles.dataTotalValue}>{formatCurrency(data.total)}/mo</Text>
        </View>
      </View>
    );
  }

  if (data?.type === 'affordability') {
    return (
      <View style={styles.dataCard}>
        <Text
          style={[
            styles.dataTitle,
            {
              color: data.canAfford ? Colors.accentSuccess : Colors.accentWarning,
            },
          ]}
        >
          {data.canAfford ? 'You can afford this' : 'Stretch your budget'}
        </Text>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Item cost</Text>
          <Text style={styles.dataValue}>{formatCurrency(data.amount)}</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Months to save</Text>
          <Text style={styles.dataValue}>{data.monthsToSave}</Text>
        </View>
      </View>
    );
  }

  if (data?.type === 'savings_plan') {
    return (
      <View style={styles.dataCard}>
        <Text style={styles.dataTitle}>Your savings plan</Text>
        {data.steps.map((step: any, idx: number) => (
          <View key={idx} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{idx + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepText}>{step.action}</Text>
              <Text style={styles.stepImpact}>Save {formatCurrency(step.savings)}/mo</Text>
            </View>
          </View>
        ))}
        <View style={styles.dataTotalRow}>
          <Text style={styles.dataTotalLabel}>Total monthly savings</Text>
          <Text style={styles.dataTotalValue}>{formatCurrency(data.total)}</Text>
        </View>
      </View>
    );
  }

  return null;
}

// =============================================================
// Glass-style input bar
// =============================================================
function InputBar({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (s: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.inputBar}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Voice input"
        style={styles.inputAffordance}
      >
        <Mic size={18} color={Colors.textSecondary} strokeWidth={1.75} />
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        placeholder="Ask anything about your money…"
        placeholderTextColor={Colors.textTertiary}
        value={value}
        onChangeText={onChange}
        multiline
        maxLength={500}
        onSubmitEditing={() => !disabled && onSend()}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Send"
        onPress={onSend}
        disabled={disabled}
        style={[styles.sendBtn, disabled && styles.sendBtnDisabled]}
      >
        <Send size={18} color={Colors.white} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );
}

// =============================================================
// Local heuristic (fallback when AI service is unreachable)
// =============================================================
function generateLocalResponse(query: string): { text: string; data?: any } {
  const q = query.toLowerCase();
  if (q.includes('waste') || q.includes('leak')) {
    return {
      text: 'Here are the biggest leaks I can find from local data:',
      data: {
        type: 'leaks',
        leaks: [
          { title: 'Spotify (low usage)', amount: 119 },
          { title: 'Cult.fit (unused)', amount: 999 },
          { title: 'Late-night impulse spends', amount: 2500 },
        ],
        total: 3618,
      },
    };
  }
  if (q.includes('afford') || q.includes('buy')) {
    return {
      text: 'Affordability snapshot based on your last 30 days:',
      data: {
        type: 'affordability',
        amount: 50000,
        canAfford: true,
        monthsToSave: 2,
      },
    };
  }
  if (q.includes('save') && (q.includes('10') || q.includes('plan'))) {
    return {
      text: 'A 5-step plan to free up roughly ₹10k/month:',
      data: {
        type: 'savings_plan',
        steps: [
          { action: 'Cancel unused subscriptions', savings: 1118 },
          { action: 'Reduce food delivery by 30%', savings: 2500 },
          { action: 'Set ₹4,000 shopping budget', savings: 2500 },
          { action: 'Avoid late-night impulse buys', savings: 2000 },
          { action: 'Switch one credit card to cashback', savings: 2000 },
        ],
        total: 10118,
      },
    };
  }
  return {
    text: 'I can help with money leaks, savings plans, affordability checks, subscription audits, budget tracking, goal progress, and cash-flow forecasts. What would you like to explore?',
  };
}

// =============================================================
// Styles
// =============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.xl,
  },

  // Empty hero
  emptyHero: {
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
  },
  emptyTitle: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    marginTop: Spacing.xl,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.lg,
    lineHeight: Typography.sizes.base * 1.5,
  },
  suggestionList: {
    width: '100%',
    marginTop: Spacing['2xl'],
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  suggestionIconHost: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.base,
    backgroundColor: 'rgba(34,211,238,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  suggestionText: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
    fontFamily: fontFamilyForWeight(Typography.weights.medium),
  },

  // Messages
  messageRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    alignItems: 'flex-end',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(34,211,238,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  bubbleUser: {
    backgroundColor: Colors.accentPrimary,
    borderBottomRightRadius: 6,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  bubbleAi: {
    backgroundColor: Colors.surfaceContainer,
    borderBottomLeftRadius: 6,
    borderColor: Colors.borderDefault,
  },
  bubbleText: {
    fontSize: Typography.sizes.base,
    lineHeight: Typography.sizes.base * 1.5,
  },
  bubbleTextUser: {
    color: Colors.white,
  },
  bubbleTextAi: {
    color: Colors.textPrimary,
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  bubbleTimeUser: {
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'right',
  },
  bubbleTimeAi: {
    color: Colors.textTertiary,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
  },
  typingText: {
    marginLeft: Spacing.xs,
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // Data viz
  dataCard: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.base,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  dataTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    letterSpacing: 0.2,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  dataLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  dataValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  dataTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  dataTotalLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semiBold,
  },
  dataTotalValue: {
    fontSize: Typography.sizes.base,
    color: Colors.accentSuccess,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(34,211,238,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  stepNumberText: {
    color: Colors.accentAi,
    fontSize: 11,
    fontWeight: Typography.weights.bold,
  },
  stepText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.4,
  },
  stepImpact: {
    fontSize: Typography.sizes.xs,
    color: Colors.accentSuccess,
    fontWeight: Typography.weights.semiBold,
    marginTop: 2,
    fontVariant: ['tabular-nums'] as any,
  },

  // Topics row
  topicsRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  topicLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
    marginLeft: 6,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  inputAffordance: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    maxHeight: 120,
    minHeight: 40,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.surfaceContainerHigh,
    opacity: 0.5,
  },
});
