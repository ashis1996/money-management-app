import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowLeft,
  ArrowRight,
  PiggyBank,
  TrendingDown,
  Repeat,
  PieChart,
  Target,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth.store';
import { AiOrb, Badge, Button, Card, Input } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';

const STEPS = ['Account', 'You', 'Goals'];

interface GoalOption {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'save_more',
    icon: PiggyBank,
    label: 'Save more',
    description: 'Build an emergency fund',
  },
  {
    id: 'reduce_spending',
    icon: TrendingDown,
    label: 'Reduce spending',
    description: 'Cut wasteful expenses',
  },
  {
    id: 'track_subs',
    icon: Repeat,
    label: 'Manage subscriptions',
    description: 'Audit recurring spend',
  },
  {
    id: 'budget',
    icon: PieChart,
    label: 'Stick to budgets',
    description: 'Stop overshooting',
  },
  {
    id: 'goal_save',
    icon: Target,
    label: 'Save for a goal',
    description: 'A house, a trip, a bike',
  },
  {
    id: 'all',
    icon: Sparkles,
    label: 'All of the above',
    description: 'Maximum AI assistance',
  },
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register } = useAuthStore();

  const handleNext = () => {
    setSubmitError(null);
    if (step === 0) {
      if (!email || !password) {
        return setSubmitError('Email and password are required.');
      }
      if (!/\S+@\S+\.\S+/.test(email)) return setSubmitError('Please enter a valid email.');
      if (password.length < 8) return setSubmitError('Password must be at least 8 characters.');
      if (password !== confirmPassword) return setSubmitError('Passwords do not match.');
    }
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleRegister();
  };

  const handleBack = () => {
    setSubmitError(null);
    if (step === 0) navigation.goBack();
    else setStep(step - 1);
  };

  const handleRegister = async () => {
    setIsLoading(true);
    setSubmitError(null);
    try {
      await register(email, password, name, phone || undefined);
    } catch (error: any) {
      setSubmitError(error?.message || 'Could not create your account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View
          style={{
            position: 'absolute',
            top: -120,
            right: -120,
            width: 360,
            height: 360,
            borderRadius: 180,
            backgroundColor: 'rgba(34, 211, 238, 0.10)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -120,
            left: -120,
            width: 360,
            height: 360,
            borderRadius: 180,
            backgroundColor: 'rgba(59, 130, 246, 0.10)',
          }}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header with progress */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={styles.backBtn}
          >
            <ArrowLeft size={20} color={Colors.textPrimary} strokeWidth={1.75} />
          </TouchableOpacity>
          <Badge
            text={`Step ${step + 1} of ${STEPS.length} — ${STEPS[step]}`}
            variant="primary"
            size="sm"
          />
          <View style={{ width: 36 }} />
        </View>

        {/* Step content */}
        <Card variant="glass" padding="xl" style={styles.card}>
          {step === 0 && (
            <AccountStep
              name={name}
              email={email}
              password={password}
              confirmPassword={confirmPassword}
              setName={setName}
              setEmail={setEmail}
              setPassword={setPassword}
              setConfirmPassword={setConfirmPassword}
            />
          )}
          {step === 1 && (
            <PersonalStep
              phone={phone}
              setPhone={setPhone}
              monthlyIncome={monthlyIncome}
              setMonthlyIncome={setMonthlyIncome}
            />
          )}
          {step === 2 && <GoalStep primaryGoal={primaryGoal} setPrimaryGoal={setPrimaryGoal} />}

          {submitError && (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <Text style={styles.errorBannerText}>{submitError}</Text>
            </View>
          )}

          <Button
            title={step === STEPS.length - 1 ? 'Create account' : 'Continue'}
            onPress={handleNext}
            loading={isLoading}
            fullWidth
            size="lg"
            style={{ marginTop: Spacing.base }}
            trailingIcon={
              !isLoading && <ArrowRight size={16} color={Colors.white} strokeWidth={2} />
            }
          />

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.signinRow}>
            <Text style={styles.signinText}>
              Already have an account? <Text style={{ color: Colors.accentPrimary }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </Card>

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// =============================================================
// Step 1 — Account
// =============================================================
function AccountStep({
  name,
  email,
  password,
  confirmPassword,
  setName,
  setEmail,
  setPassword,
  setConfirmPassword,
}: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  setName: (v: string) => void;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setConfirmPassword: (v: string) => void;
}) {
  return (
    <View>
      <View style={styles.stepHero}>
        <AiOrb size={56} decorative />
      </View>
      <Text style={styles.stepTitle}>Create your account</Text>
      <Text style={styles.stepSubtitle}>
        We&apos;ll keep your data private and use AI to help you save.
      </Text>

      <Input
        label="NAME"
        leadingIcon={<User size={16} color={Colors.textSecondary} strokeWidth={1.75} />}
        placeholder="Your name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <Input
        label="EMAIL"
        leadingIcon={<Mail size={16} color={Colors.textSecondary} strokeWidth={1.75} />}
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Input
        label="PASSWORD"
        leadingIcon={<Lock size={16} color={Colors.textSecondary} strokeWidth={1.75} />}
        placeholder="At least 8 characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <Input
        label="CONFIRM PASSWORD"
        leadingIcon={<Lock size={16} color={Colors.textSecondary} strokeWidth={1.75} />}
        placeholder="Repeat your password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
    </View>
  );
}

// =============================================================
// Step 2 — Personal
// =============================================================
function PersonalStep({
  phone,
  setPhone,
  monthlyIncome,
  setMonthlyIncome,
}: {
  phone: string;
  setPhone: (v: string) => void;
  monthlyIncome: string;
  setMonthlyIncome: (v: string) => void;
}) {
  return (
    <View>
      <View style={styles.stepHero}>
        <AiOrb size={56} decorative />
      </View>
      <Text style={styles.stepTitle}>About you</Text>
      <Text style={styles.stepSubtitle}>Optional. Helps us tailor your dashboard.</Text>

      <Input
        label="PHONE (OPTIONAL)"
        leadingIcon={<Phone size={16} color={Colors.textSecondary} strokeWidth={1.75} />}
        placeholder="+91 98765 43210"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <Input
        label="MONTHLY INCOME (OPTIONAL)"
        leadingIcon={<PiggyBank size={16} color={Colors.textSecondary} strokeWidth={1.75} />}
        placeholder="50000"
        value={monthlyIncome}
        onChangeText={setMonthlyIncome}
        keyboardType="numeric"
      />
      <Text style={styles.hint}>
        We never share this information. It&apos;s only used to set your baseline budget and savings
        rate.
      </Text>
    </View>
  );
}

// =============================================================
// Step 3 — Goal
// =============================================================
function GoalStep({
  primaryGoal,
  setPrimaryGoal,
}: {
  primaryGoal: string | null;
  setPrimaryGoal: (id: string) => void;
}) {
  return (
    <View>
      <View style={styles.stepHero}>
        <AiOrb size={56} decorative />
      </View>
      <Text style={styles.stepTitle}>What&apos;s your top priority?</Text>
      <Text style={styles.stepSubtitle}>We&apos;ll personalise your dashboard around this.</Text>

      <View style={styles.goalsList}>
        {GOAL_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = primaryGoal === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => setPrimaryGoal(option.id)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: active }}
              style={[styles.goalRow, active && styles.goalRowActive]}
            >
              <View
                style={[
                  styles.goalIcon,
                  active && {
                    backgroundColor: 'rgba(34,211,238,0.15)',
                    borderColor: Colors.accentAi,
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
                <Text style={styles.goalLabel}>{option.label}</Text>
                <Text style={styles.goalDescription}>{option.description}</Text>
              </View>
              {active && (
                <View style={styles.goalCheck}>
                  <View style={styles.goalCheckDot} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['3xl'] + Spacing.lg,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  stepHero: {
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  stepTitle: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.lg,
    lineHeight: Typography.sizes.sm * 1.5,
  },

  hint: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },

  errorBanner: {
    backgroundColor: 'rgba(255, 180, 171, 0.10)',
    borderColor: 'rgba(255, 180, 171, 0.30)',
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  errorBannerText: {
    fontSize: Typography.sizes.sm,
    color: Colors.accentError,
  },

  signinRow: {
    alignItems: 'center',
    paddingVertical: Spacing.base,
  },
  signinText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },

  // Goals
  goalsList: {
    marginTop: Spacing.xs,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    marginBottom: Spacing.sm,
  },
  goalRowActive: {
    backgroundColor: 'rgba(34,211,238,0.06)',
    borderColor: 'rgba(34,211,238,0.40)',
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  goalLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },
  goalDescription: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  goalCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accentAi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCheckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
});
