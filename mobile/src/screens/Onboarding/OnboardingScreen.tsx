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
import {
  Wallet,
  Inbox,
  Droplet,
  Sparkles,
  Bell,
  ShieldCheck,
  Target,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react-native';
import { AiOrb, Button, Card } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { registerForPushNotifications } from '../../services/push';
import { smsReadingAvailability } from '../../services/sms';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// =============================================================
// Slides
// =============================================================
interface Slide {
  id: string;
  icon: LucideIcon;
  /** When true, render the slide hero as a pulsing AiOrb instead of an icon. */
  showOrb?: boolean;
  title: string;
  description: string;
  bullets?: string[];
  toneFg: string;
  toneBg: string;
  toneBorder: string;
}

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    icon: Wallet,
    showOrb: true,
    title: 'Welcome to MoneyMind',
    description:
      'More than expense tracking — your AI-powered financial control system that detects, predicts, and acts.',
    bullets: [
      'Detect hidden money leaks',
      'Predict your financial future',
      'Get AI-powered recommendations',
    ],
    toneFg: Colors.accentPrimary,
    toneBg: 'rgba(59,130,246,0.12)',
    toneBorder: 'rgba(59,130,246,0.30)',
  },
  {
    id: 'capture',
    icon: Inbox,
    title: 'Auto-capture transactions',
    description:
      'Forget manual entry. We detect transactions from SMS, email, and UPI notifications automatically.',
    bullets: [
      'Bank SMS (HDFC, ICICI, SBI, Axis, …)',
      'UPI (GPay, PhonePe, Paytm)',
      'Email statements & invoices',
      'Voice — "Spent ₹200 on chai"',
    ],
    toneFg: Colors.accentSuccess,
    toneBg: 'rgba(16,185,129,0.12)',
    toneBorder: 'rgba(16,185,129,0.30)',
  },
  {
    id: 'leaks',
    icon: Droplet,
    title: 'Find money leaks',
    description:
      'Hidden costs draining your wallet — silent price hikes, unused subscriptions, duplicate services.',
    bullets: [
      'Netflix went ₹199 → ₹649? You\u2019ll know.',
      'Spotify + YT Music? Cancel one, save ₹100/mo.',
      'Cult.fit unused 30 days? Save ₹999.',
    ],
    toneFg: Colors.accentWarning,
    toneBg: 'rgba(251,191,36,0.12)',
    toneBorder: 'rgba(251,191,36,0.30)',
  },
  {
    id: 'ai',
    icon: Sparkles,
    title: 'AI Financial Coach',
    description:
      'Ask in plain English. Get personalised insights, predictions, and money-saving tips.',
    bullets: [
      '"Where did I waste money this month?"',
      '"Can I afford a ₹50,000 phone?"',
      '"How can I save ₹10,000/month?"',
    ],
    toneFg: Colors.accentAi,
    toneBg: 'rgba(34,211,238,0.12)',
    toneBorder: 'rgba(34,211,238,0.30)',
  },
];

interface Permission {
  id: 'sms' | 'notif' | 'goals';
  icon: LucideIcon;
  title: string;
  description: string;
  enabled: boolean;
  required: boolean;
}

// =============================================================
// Screen
// =============================================================
export function OnboardingScreen({ navigation }: any) {
  const [page, setPage] = useState(0);
  const [showPermissions, setShowPermissions] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  const [permissions, setPermissions] = useState<Permission[]>([
    {
      id: 'sms',
      icon: Inbox,
      title: 'Read SMS',
      description:
        'Detect bank SMS for auto-capture. Only transaction SMS is read; nothing else leaves your device.',
      enabled: true,
      required: false,
    },
    {
      id: 'notif',
      icon: Bell,
      title: 'Notifications',
      description: 'Bill reminders, budget alerts, weekly summaries.',
      enabled: true,
      required: false,
    },
    {
      id: 'goals',
      icon: Target,
      title: 'Personalised goals',
      description: 'Track savings goals against your monthly cash flow.',
      enabled: true,
      required: false,
    },
  ]);

  const togglePermission = (id: string) => {
    setPermissions((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.setValue(e.nativeEvent.contentOffset.x);
    const newPage = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (newPage !== page) setPage(newPage);
  };

  const goToNext = () => {
    if (page < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({
        x: (page + 1) * SCREEN_WIDTH,
        animated: true,
      });
    } else {
      setShowPermissions(true);
    }
  };

  const handleComplete = async () => {
    const enabledIds = permissions.filter((p) => p.enabled).map((p) => p.id);

    if (enabledIds.includes('notif')) {
      try {
        const result = await registerForPushNotifications();
        if (!result.granted) {
          // eslint-disable-next-line no-console
          console.info(`[onboarding] notif permission: ${result.reason}`);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[onboarding] push registration failed', err);
      }
    }

    if (enabledIds.includes('sms')) {
      const sms = smsReadingAvailability();
      if (!sms.available) {
        Alert.alert('SMS auto-capture', `${sms.message}\n\n${sms.fallback ?? ''}`, [
          { text: 'Got it' },
        ]);
      }
    }

    navigation.replace('Register');
  };

  if (showPermissions) {
    return (
      <PermissionsView
        permissions={permissions}
        onToggle={togglePermission}
        onContinue={handleComplete}
        onBack={() => setShowPermissions(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <AmbientGlow />

      {/* Skip */}
      <View style={styles.topBar}>
        <View />
        <TouchableOpacity
          onPress={() => setShowPermissions(true)}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel="Skip"
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
      >
        {SLIDES.map((slide) => (
          <SlideView key={slide.id} slide={slide} />
        ))}
      </ScrollView>

      {/* Pagination + CTA */}
      <View style={styles.bottom}>
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <Button
          title={page < SLIDES.length - 1 ? 'Next' : 'Get started'}
          onPress={goToNext}
          fullWidth
          size="lg"
          trailingIcon={<ArrowRight size={16} color={Colors.white} strokeWidth={2} />}
        />
      </View>
    </View>
  );
}

// =============================================================
// Slide
// =============================================================
function SlideView({ slide }: { slide: Slide }) {
  const Icon = slide.icon;
  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View style={styles.slideHeroBlock}>
        {slide.showOrb ? (
          <AiOrb size={96} decorative />
        ) : (
          <View
            style={[
              styles.slideIconCircle,
              {
                backgroundColor: slide.toneBg,
                borderColor: slide.toneBorder,
              },
            ]}
          >
            <Icon size={36} color={slide.toneFg} strokeWidth={1.5} />
          </View>
        )}
      </View>

      <Text style={styles.slideTitle}>{slide.title}</Text>
      <Text style={styles.slideDescription}>{slide.description}</Text>

      {slide.bullets && (
        <View style={styles.bulletList}>
          {slide.bullets.map((b, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: slide.toneFg }]} />
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// =============================================================
// Permissions view
// =============================================================
function PermissionsView({
  permissions,
  onToggle,
  onContinue,
  onBack,
}: {
  permissions: Permission[];
  onToggle: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const enabled = permissions.filter((p) => p.enabled).length;
  return (
    <View style={styles.container}>
      <AmbientGlow />
      <ScrollView contentContainerStyle={styles.permContent} showsVerticalScrollIndicator={false}>
        <View style={styles.permHero}>
          <View style={styles.permLockIcon}>
            <ShieldCheck size={32} color={Colors.accentAi} strokeWidth={1.5} />
          </View>
          <Text style={styles.slideTitle}>Permissions</Text>
          <Text style={[styles.slideDescription, { marginBottom: 0 }]}>
            We use these to give you the best experience. Toggle anytime from Settings.
          </Text>
        </View>

        <View style={{ marginTop: Spacing.xl }}>
          {permissions.map((p) => {
            const Icon = p.icon;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => onToggle(p.id)}
                accessibilityRole="switch"
                accessibilityLabel={p.title}
                accessibilityState={{ checked: p.enabled }}
                activeOpacity={0.85}
              >
                <Card style={[styles.permCard, p.enabled && styles.permCardActive]} padding="base">
                  <View style={styles.permRow}>
                    <View style={[styles.permIcon, p.enabled && styles.permIconActive]}>
                      <Icon
                        size={18}
                        color={p.enabled ? Colors.accentAi : Colors.textSecondary}
                        strokeWidth={1.75}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.permItemTitle}>{p.title}</Text>
                      <Text style={styles.permItemDesc}>{p.description}</Text>
                    </View>
                    <Toggle on={p.enabled} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>

        <Card variant="ai" style={styles.privacyCard} padding="base">
          <View style={styles.permRow}>
            <View style={styles.permIcon}>
              <ShieldCheck size={18} color={Colors.accentAi} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.permItemTitle}>Your data is private</Text>
              <Text style={styles.permItemDesc}>
                Bank-level encryption. Read-only access. We never sell your data, and you can revoke
                access anytime.
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      <View style={styles.permFooter}>
        <Button title="Back" variant="secondary" size="lg" onPress={onBack} style={{ flex: 1 }} />
        <View style={{ width: Spacing.sm }} />
        <Button
          title={enabled > 0 ? `Continue (${enabled} enabled)` : 'Continue without'}
          onPress={onContinue}
          size="lg"
          style={{ flex: 2 }}
          trailingIcon={<ArrowRight size={16} color={Colors.white} strokeWidth={2} />}
        />
      </View>
    </View>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[styles.toggle, on && styles.toggleOn]}>
      <View style={[styles.toggleThumb, on && styles.toggleThumbOn]} />
    </View>
  );
}

// =============================================================
// Ambient glow background
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['3xl'] + Spacing.lg,
  },
  skipText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textSecondary,
    letterSpacing: 0.4,
  },

  // Slides
  scroll: {
    flex: 1,
  },
  slide: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['3xl'],
    alignItems: 'center',
  },
  slideHeroBlock: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  slideIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideTitle: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  slideDescription: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    lineHeight: Typography.sizes.base * 1.5,
    maxWidth: 400,
  },
  bulletList: {
    alignSelf: 'stretch',
    maxWidth: 400,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.xs,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    marginRight: Spacing.sm,
  },
  bulletText: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.base * 1.4,
  },

  // Pagination + CTA
  bottom: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.outlineVariant,
  },
  dotActive: {
    backgroundColor: Colors.accentPrimary,
    width: 24,
  },

  // Permissions view
  permContent: {
    paddingTop: Spacing['3xl'] + Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  permHero: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  permLockIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  permCard: {
    marginBottom: Spacing.sm,
  },
  permCardActive: {
    borderColor: 'rgba(34,211,238,0.40)',
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  permIcon: {
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
  permIconActive: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderColor: 'rgba(34,211,238,0.40)',
  },
  permItemTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },
  permItemDesc: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: Typography.sizes.sm * 1.4,
  },
  privacyCard: {
    marginTop: Spacing.xl,
  },
  permFooter: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
  },

  // Toggle
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surfaceContainerHigh,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  toggleOn: {
    backgroundColor: Colors.accentAi,
    borderColor: Colors.accentAi,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.outline,
  },
  toggleThumbOn: {
    backgroundColor: Colors.white,
    transform: [{ translateX: 18 }],
  },
});
