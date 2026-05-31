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
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useAuthStore } from '../../store/auth.store';
import { AiOrb, Button, Card, Input } from '../../components/shared';
import { Colors, Typography, Spacing, fontFamilyForWeight } from '../../styles/theme';

/**
 * Login screen.
 *
 * Layout per `04-screens.md`:
 *   - Full-bleed dark surface with two ambient cyan/blue radial glows
 *   - Decorative AiOrb hero (smaller than the AI Coach hero — this is
 *     a brand cue, not an interactive surface)
 *   - Glass-style form card centered, max width 400px
 */
export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { login } = useAuthStore();

  const validate = () => {
    const errs: typeof errors = {};
    if (!email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Invalid email format';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    setSubmitError(null);
    if (!validate()) return;
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      // Inline banner instead of an Alert; reads better on dark and
      // doesn't break the keyboard flow.
      setSubmitError(error?.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Ambient glows — pointer-events:none, sit behind everything */}
      <AmbientGlow />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSpacer} />

        <View style={styles.brandBlock}>
          <AiOrb size={72} decorative />
          <Text style={styles.brandName}>MoneyMind</Text>
          <Text style={styles.brandTagline}>AI-powered finance control</Text>
        </View>

        <Card variant="glass" style={styles.card} padding="xl">
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSubtitle}>Sign in to your MoneyMind account</Text>

          <View style={{ marginTop: Spacing.lg }}>
            <Input
              label="EMAIL"
              leadingIcon={<Mail size={16} color={Colors.textSecondary} strokeWidth={1.75} />}
              placeholder="you@example.com"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              error={errors.email}
              autoComplete="email"
            />
            <Input
              label="PASSWORD"
              leadingIcon={<Lock size={16} color={Colors.textSecondary} strokeWidth={1.75} />}
              trailingIcon={
                showPassword ? (
                  <EyeOff size={16} color={Colors.textSecondary} strokeWidth={1.75} />
                ) : (
                  <Eye size={16} color={Colors.textSecondary} strokeWidth={1.75} />
                )
              }
              onRightIconPress={() => setShowPassword((v) => !v)}
              placeholder="••••••••"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              secureTextEntry={!showPassword}
              error={errors.password}
              autoComplete="current-password"
            />
          </View>

          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Reset password',
                'Password reset is coming soon. Try the demo flow for now.',
              )
            }
            style={styles.forgotRow}
            hitSlop={8}
          >
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </TouchableOpacity>

          {submitError && (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <Text style={styles.errorBannerText}>{submitError}</Text>
            </View>
          )}

          <Button
            title="Sign in"
            onPress={handleLogin}
            loading={isLoading}
            fullWidth
            size="lg"
            style={{ marginTop: Spacing.base }}
          />
        </Card>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New to MoneyMind?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')} hitSlop={8}>
            <Text style={styles.footerLink}>Create account</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// =============================================================
// AmbientGlow — two soft radial glows that paint the auth shell.
// Same visual recipe as the web app's BackgroundGlow.
// =============================================================
function AmbientGlow() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          top: -120,
          left: -120,
          width: 360,
          height: 360,
          borderRadius: 180,
          backgroundColor: 'rgba(34, 211, 238, 0.10)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -160,
          right: -160,
          width: 480,
          height: 480,
          borderRadius: 240,
          backgroundColor: 'rgba(59, 130, 246, 0.10)',
        }}
      />
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
  },
  heroSpacer: {
    height: Spacing['3xl'] + Spacing.xl,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  brandName: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    marginTop: Spacing.base,
  },
  brandTagline: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.4,
  },

  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  cardTitle: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  cardSubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  forgotRow: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.xs,
  },
  forgotLink: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.accentPrimary,
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

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.xs,
  },
  footerText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.accentPrimary,
  },
});
