import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert,
} from 'react-native';
import { Button } from '../../components/shared';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../../styles/theme';
import { registerForPushNotifications } from '../../services/push';
import {
  smsReadingAvailability,
  requestSmsRuntimePermission,
} from '../../services/sms';
import {
  upiCaptureAvailability,
  openUpiPermissionSettings,
  isUpiListenerAvailable,
} from '../../services/upi-listener';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  id: string;
  emoji: string;
  title: string;
  description: string;
  bullets?: string[];
  color: string;
  background: string;
}

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    emoji: '💰',
    title: 'Welcome to MoneyMind',
    description:
      "More than expense tracking — your AI-powered financial control system that detects, predicts, and acts.",
    bullets: [
      'Detect hidden money leaks',
      'Predict your financial future',
      'Get AI-powered recommendations',
    ],
    color: Colors.primary,
    background: '#EEF2FF',
  },
  {
    id: 'capture',
    emoji: '📩',
    title: 'Auto-capture transactions',
    description:
      "Forget manual entry. We automatically detect transactions from SMS, email, and UPI notifications.",
    bullets: [
      'Bank SMS (HDFC, ICICI, SBI, Axis...)',
      'UPI (GPay, PhonePe, Paytm)',
      'Email statements & invoices',
      'Or use voice: "Spent ₹200 on chai"',
    ],
    color: Colors.success,
    background: '#D1FAE5',
  },
  {
    id: 'leaks',
    emoji: '💧',
    title: 'Find money leaks',
    description:
      "We expose hidden costs draining your wallet — silent price hikes, unused subscriptions, duplicate services.",
    bullets: [
      "Netflix went from ₹199 → ₹649? You'll know.",
      'Spotify + YT Music? Cancel one, save ₹100.',
      'Cult.fit unused 30 days? Cancel and save ₹999.',
    ],
    color: Colors.warning,
    background: '#FEF3C7',
  },
  {
    id: 'ai',
    emoji: '🤖',
    title: 'AI Financial Assistant',
    description:
      "Ask questions in plain English. Get personalized insights, predictions, and money-saving tips.",
    bullets: [
      '"Where did I waste money this month?"',
      '"Can I afford a ₹50,000 phone?"',
      '"How can I save ₹10,000/month?"',
    ],
    color: Colors.info,
    background: '#DBEAFE',
  },
];

interface Permission {
  id: string;
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
  required: boolean;
}

export function OnboardingScreen({ navigation }: any) {
  const [page, setPage] = useState(0);
  const [showPermissions, setShowPermissions] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  const [permissions, setPermissions] = useState<Permission[]>([
    {
      id: 'sms',
      icon: '📩',
      title: 'Read SMS',
      description: 'Detect bank SMS for auto-capture (only transaction SMS)',
      enabled: true,
      required: false,
    },
    {
      id: 'upi',
      icon: '📱',
      title: 'UPI notifications',
      description: 'Capture GPay, PhonePe, Paytm transactions automatically',
      enabled: true,
      required: false,
    },
    {
      id: 'notif',
      icon: '🔔',
      title: 'Notifications',
      description: 'Bill reminders, budget alerts, weekly summaries',
      enabled: true,
      required: false,
    },
    {
      id: 'email',
      icon: '✉️',
      title: 'Email access',
      description: 'Parse statements & invoices for transactions',
      enabled: false,
      required: false,
    },
    {
      id: 'biometric',
      icon: '🔐',
      title: 'Biometric lock',
      description: 'Face ID / Fingerprint to secure your data',
      enabled: true,
      required: false,
    },
  ]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    const newPage = Math.round(offset / SCREEN_WIDTH);
    if (newPage !== page) setPage(newPage);
  };

  const goToPage = (idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
    setPage(idx);
  };

  const handleNext = () => {
    if (page < SLIDES.length - 1) {
      goToPage(page + 1);
    } else {
      setShowPermissions(true);
    }
  };

  const handleSkip = () => {
    setShowPermissions(true);
  };

  const togglePermission = (id: string) => {
    setPermissions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleComplete = async () => {
    // Actually request the OS permissions the user toggled on.
    const enabledIds = permissions.filter((p) => p.enabled).map((p) => p.id);

    if (enabledIds.includes('notif')) {
      try {
        const result = await registerForPushNotifications();
        if (!result.granted) {
          // User denied permission; still proceed but flag it
          console.info(`[onboarding] Notif permission: ${result.reason}`);
        }
      } catch (err) {
        console.warn('[onboarding] Push registration failed', err);
      }
    }

    // SMS: in a prebuild dev build we can call PermissionsAndroid directly.
    // In Expo Go that no-ops, so we fall back to an explainer.
    if (enabledIds.includes('sms')) {
      const sms = smsReadingAvailability();
      if (sms.available) {
        const granted = await requestSmsRuntimePermission();
        if (!granted) {
          Alert.alert(
            'SMS permission denied',
            'You can grant it later in Settings → Capture Modes → SMS parsing.',
          );
        }
      } else {
        Alert.alert(
          'SMS auto-capture',
          `${sms.message}\n\n${sms.fallback ?? ''}`,
          [{ text: 'Got it' }],
        );
      }
    }

    // UPI: notification-listener access cannot be granted in-app. We
    // remember the intent and open system settings — the user toggles
    // MoneyMind on and is bounced back to us with capture live.
    if (enabledIds.includes('upi')) {
      const upi = upiCaptureAvailability();
      if (upi.available && isUpiListenerAvailable()) {
        await new Promise<void>((resolve) => {
          Alert.alert(
            'Enable UPI capture',
            'We will open Notification Access settings. Find MoneyMind in the list and turn it on.',
            [{ text: 'Open settings', onPress: () => resolve() }],
          );
        });
        await openUpiPermissionSettings();
      } else {
        Alert.alert(
          'UPI auto-capture',
          `${upi.message}\n\n${upi.fallback ?? ''}`,
          [{ text: 'Got it' }],
        );
      }
    }

    Alert.alert(
      'All set! 🎉',
      "Let's create your account",
      [
        {
          text: 'Continue',
          onPress: () => navigation.replace('Register'),
        },
      ]
    );
  };

  // ==================== PERMISSIONS VIEW ====================

  if (showPermissions) {
    const enabledCount = permissions.filter((p) => p.enabled).length;
    return (
      <View style={[styles.container, { backgroundColor: Colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.permScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.permHeader}>
            <Text style={styles.permEmoji}>🔐</Text>
            <Text style={styles.permTitle}>Permissions</Text>
            <Text style={styles.permSubtitle}>
              We use these to give you the best experience. You can change these
              anytime in Settings.
            </Text>
          </View>

          {permissions.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.permCard,
                p.enabled && styles.permCardActive,
              ]}
              onPress={() => togglePermission(p.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.permIcon}>{p.icon}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.permTitleRow}>
                  <Text style={styles.permItemTitle}>{p.title}</Text>
                  {p.required && (
                    <Text style={styles.permRequired}>required</Text>
                  )}
                </View>
                <Text style={styles.permItemDesc}>{p.description}</Text>
              </View>
              <View
                style={[
                  styles.permToggle,
                  p.enabled && styles.permToggleActive,
                ]}
              >
                <View
                  style={[
                    styles.permToggleThumb,
                    p.enabled && styles.permToggleThumbActive,
                  ]}
                />
              </View>
            </TouchableOpacity>
          ))}

          <View style={styles.permPrivacy}>
            <Text style={styles.permPrivacyIcon}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.permPrivacyTitle}>Your data is private</Text>
              <Text style={styles.permPrivacyText}>
                Bank-level encryption. We never sell your data. Read-only
                access. You can revoke anytime.
              </Text>
            </View>
          </View>

          <Button
            title={enabledCount > 0 ? `Continue (${enabledCount} enabled)` : 'Continue without permissions'}
            onPress={handleComplete}
            variant="primary"
            size="lg"
            fullWidth
            style={{ marginTop: Spacing.lg }}
          />
          <TouchableOpacity onPress={handleComplete} style={styles.skipPerm}>
            <Text style={styles.skipPermText}>Decide later</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ==================== SLIDES VIEW ====================

  const currentSlide = SLIDES[page];

  return (
    <View
      style={[styles.container, { backgroundColor: currentSlide.background }]}
    >
      {/* Skip button */}
      <View style={styles.topBar}>
        <View />
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false, listener: handleScroll }
        )}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide) => (
          <View
            key={slide.id}
            style={[styles.slide, { backgroundColor: slide.background }]}
          >
            <Text style={styles.slideEmoji}>{slide.emoji}</Text>
            <Text style={[styles.slideTitle, { color: slide.color }]}>
              {slide.title}
            </Text>
            <Text style={styles.slideDescription}>{slide.description}</Text>
            {slide.bullets && (
              <View style={styles.bullets}>
                {slide.bullets.map((b, idx) => (
                  <View key={idx} style={styles.bulletRow}>
                    <View
                      style={[styles.bulletDot, { backgroundColor: slide.color }]}
                    />
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottom}>
        {/* Page dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => goToPage(idx)}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    idx === page ? currentSlide.color : Colors.gray300,
                  width: idx === page ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          {page > 0 && (
            <TouchableOpacity
              onPress={() => goToPage(page - 1)}
              style={styles.backBtn}
            >
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          <Button
            title={page === SLIDES.length - 1 ? "Let's go →" : 'Next'}
            onPress={handleNext}
            variant="primary"
            size="md"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['3xl'] + Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  skipText: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  // Slide
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing['4xl'],
  },
  slideEmoji: {
    fontSize: 96,
    marginBottom: Spacing.xl,
  },
  slideTitle: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  slideDescription: {
    fontSize: Typography.sizes.md,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: Typography.sizes.md * 1.6,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  bullets: {
    width: '100%',
    paddingHorizontal: Spacing.base,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.xs,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    marginRight: Spacing.sm,
  },
  bulletText: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.base * 1.6,
  },
  // Bottom
  bottom: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    paddingTop: Spacing.base,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  backBtnText: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
  },
  // Permissions
  permScrollContent: {
    padding: Spacing.lg,
    paddingTop: Spacing['3xl'] + Spacing.lg,
  },
  permHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  permEmoji: {
    fontSize: 64,
    marginBottom: Spacing.base,
  },
  permTitle: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  permSubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: Typography.sizes.base * 1.5,
  },
  permCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  permCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EEF2FF',
  },
  permIcon: {
    fontSize: 32,
    marginRight: Spacing.sm,
  },
  permTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  permItemTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  permRequired: {
    fontSize: Typography.sizes.xs,
    color: Colors.error,
    fontWeight: Typography.weights.semiBold,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  permItemDesc: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: Typography.sizes.sm * 1.5,
  },
  permToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.gray300,
    padding: 2,
    justifyContent: 'center',
  },
  permToggleActive: {
    backgroundColor: Colors.primary,
  },
  permToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  permToggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  permPrivacy: {
    flexDirection: 'row',
    backgroundColor: '#D1FAE5',
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  permPrivacyIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  permPrivacyTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: '#065F46',
  },
  permPrivacyText: {
    fontSize: Typography.sizes.sm,
    color: '#065F46',
    marginTop: 4,
    lineHeight: Typography.sizes.sm * 1.5,
  },
  skipPerm: {
    alignItems: 'center',
    paddingVertical: Spacing.base,
  },
  skipPermText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
});
