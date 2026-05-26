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
import { Card, Header } from '../../components/shared';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../../styles/theme';
import { useAskAi } from '../../hooks';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  timestamp: string;
}

const SUGGESTED_QUERIES = [
  { icon: '💧', text: 'Where did I waste money this month?' },
  { icon: '💰', text: 'How can I save ₹10,000/month?' },
  { icon: '📱', text: 'Can I afford a ₹50,000 phone?' },
  { icon: '🔄', text: 'What subscriptions should I cancel?' },
  { icon: '📊', text: 'Compare my spending to last month' },
  { icon: '🔮', text: 'Will I have money left at month end?' },
];

const QUICK_TOPICS = [
  { icon: '💧', label: 'Money Leaks' },
  { icon: '🎯', label: 'Goals' },
  { icon: '📊', label: 'Budgets' },
  { icon: '🔄', label: 'Subscriptions' },
];

export function AIAssistantScreen({ navigation }: any) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const askAi = useAskAi();

  useEffect(() => {
    // Initial greeting
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content:
          "Hi! I'm your AI financial assistant. I can help you understand your spending, find money leaks, plan savings, and answer questions about your finances. What would you like to know?",
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
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
        "I couldn't generate a response right now. Try rephrasing your question.";

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
    } catch (e: any) {
      // Fallback to local heuristic so the UI stays useful when offline
      const response = generateResponse(query);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content:
            response.text +
            '\n\n_(AI service unavailable, showing local analysis)_',
          data: response.data,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: "Hi again! How can I help with your finances?",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <Header
        title="AI Assistant"
        subtitle="Ask anything about your money"
        onBack={() => navigation.goBack()}
        rightIcon="🗑️"
        onRightPress={handleClear}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <View style={styles.typingContainer}>
            <View style={styles.aiAvatar}>
              <Text style={styles.aiAvatarIcon}>🤖</Text>
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.typingText}>Thinking...</Text>
            </View>
          </View>
        )}

        {/* Suggested queries (only on first message) */}
        {messages.length === 1 && !isLoading && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Try asking:</Text>
            {SUGGESTED_QUERIES.map((s, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.suggestion}
                onPress={() => handleSend(s.text)}
              >
                <Text style={styles.suggestionIcon}>{s.icon}</Text>
                <Text style={styles.suggestionText}>{s.text}</Text>
                <Text style={styles.suggestionArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Quick Topics */}
      {messages.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topicsRow}
        >
          {QUICK_TOPICS.map((t) => (
            <TouchableOpacity
              key={t.label}
              style={styles.topicChip}
              onPress={() => handleSend(`Tell me about my ${t.label.toLowerCase()}`)}
            >
              <Text style={styles.topicIcon}>{t.icon}</Text>
              <Text style={styles.topicLabel}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.voiceBtn}>
          <Text style={styles.voiceIcon}>🎤</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Ask about your finances..."
          placeholderTextColor={Colors.textTertiary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          onSubmitEditing={() => handleSend()}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || isLoading}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAi]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarIcon}>🤖</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAi,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isUser ? styles.bubbleTextUser : styles.bubbleTextAi,
          ]}
        >
          {message.content}
        </Text>

        {message.data && <DataVisualization data={message.data} />}

        <Text
          style={[
            styles.bubbleTime,
            isUser ? styles.bubbleTimeUser : styles.bubbleTimeAi,
          ]}
        >
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

function DataVisualization({ data }: { data: any }) {
  if (data?.type === 'leaks') {
    return (
      <View style={styles.dataCard}>
        <Text style={styles.dataTitle}>💧 Money Leaks Found</Text>
        {data.leaks.map((leak: any, idx: number) => (
          <View key={idx} style={styles.dataRow}>
            <Text style={styles.dataLabel}>{leak.title}</Text>
            <Text style={styles.dataValue}>₹{leak.amount}/mo</Text>
          </View>
        ))}
        <View style={styles.dataTotalRow}>
          <Text style={styles.dataTotalLabel}>Total Potential Savings</Text>
          <Text style={styles.dataTotalValue}>₹{data.total}/mo</Text>
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
            { color: data.canAfford ? Colors.success : Colors.warning },
          ]}
        >
          {data.canAfford ? '✓ You can afford this' : '⚠️ Stretch your budget'}
        </Text>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Item Cost</Text>
          <Text style={styles.dataValue}>₹{data.amount?.toLocaleString()}</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>Months to save</Text>
          <Text style={styles.dataValue}>{data.monthsToSave}</Text>
        </View>
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>% of monthly savings</Text>
          <Text style={styles.dataValue}>{data.percentOfSavings}%</Text>
        </View>
      </View>
    );
  }

  if (data?.type === 'savings_plan') {
    return (
      <View style={styles.dataCard}>
        <Text style={styles.dataTitle}>💰 Your Savings Plan</Text>
        {data.steps.map((step: any, idx: number) => (
          <View key={idx} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{idx + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepText}>{step.action}</Text>
              <Text style={styles.stepImpact}>Save ₹{step.savings}/mo</Text>
            </View>
          </View>
        ))}
        <View style={styles.dataTotalRow}>
          <Text style={styles.dataTotalLabel}>Total Monthly Savings</Text>
          <Text style={styles.dataTotalValue}>₹{data.total}</Text>
        </View>
      </View>
    );
  }

  return null;
}

function generateResponse(query: string): { text: string; data?: any } {
  const q = query.toLowerCase();

  if (q.includes('waste') || q.includes('leak')) {
    return {
      text: 'I found 5 money leaks totaling ₹4,500/month. Here are the biggest ones:',
      data: {
        type: 'leaks',
        leaks: [
          { title: 'Spotify (low usage)', amount: 119 },
          { title: 'Cult.fit (unused)', amount: 999 },
          { title: 'Late-night impulse spending', amount: 2500 },
          { title: 'Duplicate music apps', amount: 248 },
          { title: 'Netflix price hike', amount: 150 },
        ],
        total: 4016,
      },
    };
  }

  if (q.includes('afford') || q.includes('buy')) {
    const match = q.match(/₹?\s*(\d{1,3}(?:,?\d{3})*|\d+k)/);
    let amount = 50000;
    if (match) {
      const cleaned = match[1].replace(',', '').toLowerCase();
      amount = cleaned.endsWith('k') ? parseInt(cleaned) * 1000 : parseInt(cleaned);
    }
    const monthlySavings = 30000;
    const monthsToSave = Math.ceil(amount / monthlySavings);
    return {
      text: `Based on your savings rate of 40% (₹30,000/month), here's the breakdown for a ₹${amount.toLocaleString()} purchase:`,
      data: {
        type: 'affordability',
        amount,
        canAfford: amount <= monthlySavings * 2,
        monthsToSave,
        percentOfSavings: Math.round((amount / monthlySavings) * 100),
      },
    };
  }

  if (q.includes('save') && (q.includes('10,000') || q.includes('10000') || q.includes('10k'))) {
    return {
      text: "Here's your personalized plan to save ₹10,000/month:",
      data: {
        type: 'savings_plan',
        steps: [
          { action: 'Cancel unused subscriptions (Spotify, Cult.fit)', savings: 1118 },
          { action: 'Reduce food delivery by 30%', savings: 2500 },
          { action: 'Set ₹4000 shopping budget (vs ₹6500 now)', savings: 2500 },
          { action: 'Avoid late-night impulse purchases', savings: 2000 },
          { action: 'Optimize subscription duplicates', savings: 2000 },
        ],
        total: 10118,
      },
    };
  }

  if (q.includes('subscription')) {
    return {
      text: "You have 7 active subscriptions costing ₹3,500/month total. I recommend reviewing:\n\n🎵 Spotify (₹119/mo) - Only 15% usage in last 30 days\n🏋️ Cult.fit (₹999/mo) - 0 visits in 30 days\n🎬 Netflix - Price increased from ₹499 to ₹649 (+30%)\n\nYou could save ₹1,118/month by canceling unused services.",
    };
  }

  if (q.includes('compare') || q.includes('last month')) {
    return {
      text: "Here's how this month compares to last month:\n\n📈 Spending: ₹45,000 (up 7% from ₹42,000)\n📈 Savings: ₹30,000 (up 7% from ₹28,000)\n\nNotable changes:\n• Shopping: +35% (₹6,500 vs ₹4,800) ⚠️\n• Food: +18% (₹12,500 vs ₹10,600)\n• Transport: -8% (₹4,200 vs ₹4,600)\n\nYour shopping increase is concerning. Consider setting a budget.",
    };
  }

  if (q.includes('forecast') || q.includes('left') || q.includes('runway') || q.includes('end')) {
    return {
      text: "🔮 Based on your current spending pace:\n\n• Days money will last: 18 days\n• Predicted month-end balance: ₹27,500\n• Daily average spending: ₹1,500\n• If you slow down by 20%, you'll have ₹35,000 left\n\nYou're on track but watch your weekend spending.",
    };
  }

  if (q.includes('goal')) {
    return {
      text: "You have 3 active goals:\n\n🛡️ Emergency Fund: 65% complete (₹65k/₹100k) - On track\n🏖️ Goa Vacation: 64% complete (₹32k/₹50k) - On track\n📱 New iPhone: 19% complete (₹15k/₹80k) - Need ₹5,500/mo more to reach goal\n\nTip: Redirect the ₹4,500 from money leaks to accelerate your goals!",
    };
  }

  if (q.includes('budget')) {
    return {
      text: "📊 Your budget status:\n\n🍔 Food: ₹8,500/₹10,000 (85% used) ⚠️\n🛍️ Shopping: ₹6,500/₹5,000 (130% - OVER) 🚨\n🚗 Transport: ₹1,800/₹4,000 (45%) ✓\n🎬 Entertainment: ₹850/₹3,000 (28%) ✓\n\nYou're over your shopping budget. Consider pausing purchases until next month.",
    };
  }

  return {
    text: "I can help with:\n\n💧 Finding money leaks\n💰 Creating savings plans\n📱 Affordability checks\n🔄 Subscription audits\n📊 Budget tracking\n🎯 Goal progress\n🔮 Cash flow forecasts\n\nWhat would you like to explore?",
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  // Message
  messageRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    alignItems: 'flex-end',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAi: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
    marginBottom: 4,
  },
  aiAvatarIcon: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '80%',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.lg,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
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
  },
  bubbleTimeUser: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  bubbleTimeAi: {
    color: Colors.textTertiary,
  },
  // Typing
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.sm,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: 4,
  },
  typingText: {
    marginLeft: Spacing.xs,
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  // Data visualization
  dataCard: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.base,
  },
  dataTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  dataLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  dataValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  dataTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dataTotalLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  dataTotalValue: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.success,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
    marginTop: 2,
  },
  stepNumberText: {
    color: Colors.white,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  stepText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.4,
  },
  stepImpact: {
    fontSize: Typography.sizes.xs,
    color: Colors.success,
    fontWeight: Typography.weights.semiBold,
    marginTop: 2,
  },
  // Suggestions
  suggestionsContainer: {
    marginTop: Spacing.lg,
    padding: Spacing.base,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
  },
  suggestionsTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  suggestionIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  suggestionText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  suggestionArrow: {
    fontSize: 18,
    color: Colors.primary,
  },
  // Topics row
  topicsRow: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  topicIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  topicLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  voiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  voiceIcon: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    maxHeight: 100,
    minHeight: 40,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.gray300,
  },
  sendIcon: {
    fontSize: 18,
    color: Colors.white,
  },
});
