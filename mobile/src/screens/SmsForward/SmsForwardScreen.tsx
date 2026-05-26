import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Button, Card, Header } from '../../components/shared';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../../styles/theme';
import { ingestSms, smsReadingAvailability } from '../../services/sms';

const PLACEHOLDER = `Example:
Rs.549.00 debited from a/c **4521 on 25-MAY-26 for UPI/SWIGGY/order 45289. Avl bal: Rs.24,567.00 - HDFCBank`;

/**
 * Manual SMS forwarding screen. Users paste their bank SMS here
 * and our parser extracts a transaction.
 *
 * This is the workhorse fallback when SMS auto-reading isn't
 * available (iOS, Expo Go, or denied permission).
 */
export function SmsForwardScreen({ navigation }: any) {
  const [body, setBody] = useState('');
  const [sender, setSender] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const availability = smsReadingAvailability();

  const handleSubmit = async () => {
    if (body.trim().length < 20) {
      Alert.alert('Too short', 'Paste the full SMS body for accurate parsing.');
      return;
    }

    setSubmitting(true);
    setLastResult(null);

    try {
      const result = await ingestSms({
        body: body.trim(),
        sender: sender.trim() || 'MANUAL',
      });

      setLastResult(result);

      if (result.transactionCreated) {
        Alert.alert(
          'Transaction added',
          `${result.parsed?.transactionType ?? 'Transaction'} of ₹${
            result.parsed?.amount?.toLocaleString() ?? '?'
          } at ${result.parsed?.merchant ?? 'unknown'}`,
          [
            { text: 'Add another', onPress: () => setBody('') },
            {
              text: 'View',
              onPress: () =>
                result.transactionId
                  ? navigation.navigate('TransactionDetail', {
                      id: result.transactionId,
                    })
                  : navigation.navigate('Tabs', { screen: 'Transactions' }),
            },
          ],
        );
      } else if (result.parsed) {
        Alert.alert(
          'Could not auto-create',
          'We parsed the SMS but couldn\'t determine the amount or type. Try editing the SMS or use Manual Entry instead.',
        );
      } else {
        Alert.alert(
          'Parse failed',
          (result as any)?.error ?? 'Server could not parse this SMS.',
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Forward SMS"
        subtitle="Paste a bank SMS to capture the transaction"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {!availability.available && (
          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>ℹ️ {availability.message}</Text>
            {availability.fallback && (
              <Text style={styles.infoBody}>{availability.fallback}</Text>
            )}
          </Card>
        )}

        <Text style={styles.label}>Sender (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="VK-HDFCBK, AM-ICICIB, ..."
          placeholderTextColor={Colors.textTertiary}
          value={sender}
          onChangeText={setSender}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={11}
        />

        <Text style={styles.label}>SMS body</Text>
        <TextInput
          style={[styles.input, styles.bodyInput]}
          placeholder={PLACEHOLDER}
          placeholderTextColor={Colors.textTertiary}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />

        <Text style={styles.hint}>
          We extract the amount, merchant, type, and category automatically.
          Nothing else from your SMS is read.
        </Text>

        <Button
          title={submitting ? 'Parsing…' : 'Capture Transaction'}
          onPress={handleSubmit}
          variant="primary"
          fullWidth
          disabled={submitting}
          style={{ marginTop: Spacing.lg }}
        />

        {submitting && (
          <ActivityIndicator
            size="small"
            color={Colors.primary}
            style={{ marginTop: Spacing.base }}
          />
        )}

        {lastResult?.parsed && (
          <Card style={styles.resultCard}>
            <Text style={styles.resultTitle}>Last parsed</Text>
            <ResultRow label="Amount" value={`₹${lastResult.parsed.amount?.toLocaleString() ?? '?'}`} />
            <ResultRow label="Type" value={lastResult.parsed.transactionType ?? '—'} />
            <ResultRow label="Merchant" value={lastResult.parsed.merchant ?? '—'} />
            <ResultRow label="Category" value={lastResult.parsed.category ?? '—'} />
            <ResultRow
              label="Confidence"
              value={`${Math.round((lastResult.parsed.confidence ?? 0) * 100)}%`}
            />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  infoCard: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.gray100,
  },
  infoTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
  infoBody: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
    marginTop: Spacing.base,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bodyInput: {
    minHeight: 140,
    paddingTop: Spacing.sm,
  },
  hint: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    marginTop: 6,
    lineHeight: 16,
  },
  resultCard: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.gray100,
  },
  resultTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.sm,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  resultLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  resultValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
  },
});
