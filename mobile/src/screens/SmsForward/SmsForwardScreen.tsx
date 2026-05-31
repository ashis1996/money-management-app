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
import { Inbox, ShieldCheck, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react-native';
import { Badge, Button, Card, Header } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { ingestSms, smsReadingAvailability } from '../../services/sms';

const PLACEHOLDER = `Rs.549.00 debited from a/c **4521 on 25-MAY-26 for UPI/SWIGGY/order 45289. Avl bal: Rs.24,567.00 - HDFCBank`;

/**
 * Manual SMS forwarding fallback. Users paste a bank SMS and our
 * parser extracts a transaction. This is the workhorse path when
 * auto-reading isn't available (iOS, Expo Go, or permission denied).
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
          "We parsed the SMS but couldn't determine the amount or type. Try editing the SMS or use Manual Entry.",
        );
      } else {
        Alert.alert(
          'Not recognised',
          "This doesn't look like a bank SMS. Try pasting the original message.",
        );
      }
    } catch (e: any) {
      Alert.alert('Could not parse', e?.message ?? 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Forward SMS"
        subtitle="Paste a bank SMS to auto-capture"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Availability note */}
        {!availability.available && (
          <Card variant="ai" padding="base">
            <View style={styles.noteRow}>
              <View style={styles.noteIcon}>
                <ShieldCheck size={16} color={Colors.accentAi} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noteTitle}>Why this screen exists</Text>
                <Text style={styles.noteBody}>{availability.message}</Text>
                {availability.fallback && (
                  <Text style={styles.noteFallback}>{availability.fallback}</Text>
                )}
              </View>
            </View>
          </Card>
        )}

        {/* SMS body */}
        <Text style={styles.label}>SMS BODY</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={PLACEHOLDER}
          placeholderTextColor={Colors.textTertiary}
          multiline
          textAlignVertical="top"
          style={[styles.input, { minHeight: 140 }]}
        />
        <Text style={styles.hint}>
          Paste the full message — sender, amount, merchant, balance — for the best parsing.
        </Text>

        {/* Sender */}
        <Text style={[styles.label, { marginTop: Spacing.lg }]}>SENDER (OPTIONAL)</Text>
        <TextInput
          value={sender}
          onChangeText={setSender}
          placeholder="VM-HDFCBK, AD-ICICIB, …"
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="characters"
          style={styles.input}
        />

        {/* Last result preview */}
        {lastResult?.parsed && (
          <Card padding="base" style={{ marginTop: Spacing.lg }}>
            <View style={styles.resultHeader}>
              <View style={styles.resultIcon}>
                <Sparkles size={16} color={Colors.accentAi} strokeWidth={1.75} />
              </View>
              <Text style={styles.resultTitle}>Last parse</Text>
              <Badge
                text={lastResult.transactionCreated ? 'Created' : 'Parsed only'}
                variant={lastResult.transactionCreated ? 'success' : 'warning'}
                size="sm"
              />
            </View>
            <View style={styles.resultGrid}>
              <ResultCell
                label="Amount"
                value={
                  lastResult.parsed.amount ? `₹${lastResult.parsed.amount.toLocaleString()}` : '—'
                }
              />
              <ResultCell label="Type" value={lastResult.parsed.transactionType ?? '—'} />
              <ResultCell label="Merchant" value={lastResult.parsed.merchant ?? '—'} />
              <ResultCell label="Bank" value={lastResult.parsed.bank ?? '—'} />
            </View>
          </Card>
        )}

        {/* Tips */}
        <Card padding="base" style={{ marginTop: Spacing.lg }}>
          <View style={styles.tipsRow}>
            <View style={styles.tipsIcon}>
              <Inbox size={18} color={Colors.textSecondary} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipsTitle}>Tips for accurate parsing</Text>
              <Text style={styles.tipsBody}>
                • Include the sender ID (e.g. VM-HDFCBK).{'\n'}• Keep the amount and merchant text
                intact.{'\n'}• Don\u2019t edit the message before pasting.
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>

      <View style={styles.submitBar}>
        <Button
          title={submitting ? 'Parsing…' : 'Parse and capture'}
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
          fullWidth
          size="lg"
          trailingIcon={
            !submitting && <ArrowRight size={16} color={Colors.white} strokeWidth={2} />
          }
        />
      </View>
    </View>
  );
}

function ResultCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resultCell}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },

  // Note
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noteIcon: {
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
  noteTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.accentAi,
  },
  noteBody: {
    marginTop: 4,
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sizes.sm * 1.5,
  },
  noteFallback: {
    marginTop: Spacing.xs,
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

  // Form
  label: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    fontWeight: Typography.weights.semiBold,
    letterSpacing: 0.6,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.base,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    fontFamily: 'monospace',
  },
  hint: {
    marginTop: Spacing.xs,
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // Result
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  resultIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.base,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },
  resultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  resultCell: {
    flexBasis: '47%',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.base,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  resultLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  resultValue: {
    marginTop: 2,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },

  // Tips
  tipsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipsIcon: {
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
  tipsTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
  },
  tipsBody: {
    marginTop: 4,
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sizes.sm * 1.6,
  },

  // Submit
  submitBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    backgroundColor: Colors.surfaceContainerLow,
  },
});
