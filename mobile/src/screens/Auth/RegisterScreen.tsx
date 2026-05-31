import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import { Button, Input } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, Tints } from '../../styles/theme';

const STEPS = [
  { id: 'account', label: 'Account' },
  { id: 'personal', label: 'You' },
  { id: 'finance', label: 'Goals' },
];

export function RegisterScreen({ navigation }: any) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState<string | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuthStore();

  const goalOptions = [
    { id: 'save_more', icon: '💰', label: 'Save more money' },
    { id: 'reduce_spending', icon: '📉', label: 'Reduce spending' },
    { id: 'track_subs', icon: '🔄', label: 'Manage subscriptions' },
    { id: 'budget', icon: '📊', label: 'Stick to budgets' },
    { id: 'goal_save', icon: '🎯', label: 'Save for a goal' },
    { id: 'all', icon: '✨', label: 'All of the above' },
  ];

  const handleNext = () => {
    if (step === 0) {
      if (!name || !email || !password) {
        Alert.alert('Missing fields', 'Please fill all required fields');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Mismatch', 'Passwords do not match');
        return;
      }
      if (password.length < 8) {
        Alert.alert('Weak password', 'Password must be at least 8 characters');
        return;
      }
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleRegister();
    }
  };

  const handleRegister = async () => {
    setIsLoading(true);
    try {
      await register(email, password, name, phone || undefined);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Progress dots */}
        <View style={styles.progressBar}>
          {STEPS.map((s, idx) => (
            <View key={s.id} style={styles.progressItem}>
              <View style={[styles.progressDot, idx <= step && styles.progressDotActive]} />
              <Text style={[styles.progressLabel, idx <= step && styles.progressLabelActive]}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Step header */}
        <View style={styles.header}>
          {step > 0 && (
            <TouchableOpacity onPress={() => setStep(step - 1)} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>{getStepTitle(step)}</Text>
          <Text style={styles.subtitle}>{getStepSubtitle(step)}</Text>
        </View>

        {/* Step content */}
        {step === 0 && (
          <View style={styles.form}>
            <Input
              label="Full Name"
              icon="👤"
              placeholder="John Doe"
              value={name}
              onChangeText={setName}
              editable={!isLoading}
            />
            <Input
              label="Email"
              icon="📧"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
            <Input
              label="Password"
              icon="🔒"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
            />
            <Input
              label="Confirm Password"
              icon="🔒"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!isLoading}
            />
          </View>
        )}

        {step === 1 && (
          <View style={styles.form}>
            <Input
              label="Phone (optional)"
              icon="📱"
              placeholder="+91 98765 43210"
              hint="We'll use this for SMS-based transaction tracking"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!isLoading}
            />
            <Input
              label="Monthly Income (optional)"
              icon="💰"
              placeholder="50000"
              hint="Helps personalize your dashboard"
              value={monthlyIncome}
              onChangeText={setMonthlyIncome}
              keyboardType="numeric"
              editable={!isLoading}
            />

            {/* Permissions preview */}
            <View style={styles.permissionsCard}>
              <Text style={styles.permissionsTitle}>📨 Auto-capture permissions</Text>
              <Text style={styles.permissionsText}>We'll request permission to:</Text>
              <Text style={styles.permissionItem}>• Read bank SMS messages</Text>
              <Text style={styles.permissionItem}>• Detect UPI notifications</Text>
              <Text style={styles.permissionItem}>• Access transaction emails</Text>
              <Text style={styles.permissionsFooter}>You can configure later in Settings.</Text>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.form}>
            <Text style={styles.questionLabel}>What's your main goal?</Text>
            <View style={styles.goalsGrid}>
              {goalOptions.map((goal) => (
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.goalCard, primaryGoal === goal.id && styles.goalCardActive]}
                  onPress={() => setPrimaryGoal(goal.id)}
                >
                  <Text style={styles.goalIcon}>{goal.icon}</Text>
                  <Text
                    style={[styles.goalLabel, primaryGoal === goal.id && styles.goalLabelActive]}
                  >
                    {goal.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.aiPreview}>
              <Text style={styles.aiPreviewIcon}>🤖</Text>
              <Text style={styles.aiPreviewText}>
                Based on your goals, we'll personalize your dashboard and detect what matters most
                for you.
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <Button
          title={step === STEPS.length - 1 ? 'Create Account' : 'Continue'}
          onPress={handleNext}
          variant="primary"
          size="lg"
          fullWidth
          loading={isLoading}
          style={{ marginTop: Spacing.lg }}
        />

        {step === 0 && (
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getStepTitle(step: number): string {
  return ['Create Account', 'Tell us about you', 'Your money goals'][step];
}

function getStepSubtitle(step: number): string {
  return [
    'Start your financial journey',
    'This helps us personalize your experience',
    "We'll tailor the app for what matters most to you",
  ][step];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingTop: Spacing['4xl'],
  },
  // Progress
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  progressItem: {
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.gray200,
    marginBottom: 4,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
  },
  progressLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
  },
  progressLabelActive: {
    color: Colors.primary,
    fontWeight: Typography.weights.semiBold,
  },
  // Header
  header: {
    marginBottom: Spacing.xl,
  },
  backBtn: {
    marginBottom: Spacing.sm,
  },
  backIcon: {
    fontSize: Typography.sizes['2xl'],
    color: Colors.textPrimary,
  },
  title: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  form: {
    width: '100%',
  },
  // Permissions
  permissionsCard: {
    backgroundColor: Tints.primaryBg,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    marginTop: Spacing.sm,
  },
  permissionsTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  permissionsText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  permissionItem: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    paddingVertical: 2,
    paddingLeft: Spacing.sm,
  },
  permissionsFooter: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },
  // Goals
  questionLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.base,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  goalCard: {
    width: '48%',
    padding: Spacing.base,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  goalCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Tints.primaryBg,
  },
  goalIcon: {
    fontSize: 32,
    marginBottom: Spacing.xs,
  },
  goalLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontWeight: Typography.weights.medium,
  },
  goalLabelActive: {
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
  },
  // AI preview
  aiPreview: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    alignItems: 'flex-start',
  },
  aiPreviewIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  aiPreviewText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sizes.sm * 1.5,
  },
  // Login link
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  loginText: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: Typography.sizes.base,
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
  },
});
