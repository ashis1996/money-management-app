import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import {
  Bot,
  Inbox,
  Mail,
  Smartphone,
  Send,
  Bell,
  PieChart,
  Calendar,
  FileText,
  Heart,
  Sparkles,
  Tags,
  Moon,
  Compass,
  Lock,
  ShieldCheck,
  Database,
  HelpCircle,
  MessageSquare,
  Star,
  LogOut,
  ChevronRight,
  ArrowRight,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth.store';
import { Badge, Button, Card } from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { api } from '../../services/api';
import { useHealthScore, useUnreadCount } from '../../hooks';
import { getArchetypeLabel } from '../../utils';
import type { Archetype } from '../../types';

interface RowProps {
  icon: LucideIcon;
  label: string;
  hint?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
  enabled?: boolean;
  badge?: string;
  destructive?: boolean;
  rightLabel?: string;
}

const ARCHETYPE_DESCRIPTIONS: Record<Archetype, string> = {
  SPEND_HEAVY: 'You enjoy life — we help you control the spend',
  SAVINGS_FOCUSED: 'Disciplined and goal-oriented',
  CREDIT_USER: 'Cards are your tool of choice',
  SUBSCRIPTION_HEAVY: 'Many recurring services to optimise',
  BALANCED: 'Well-managed across categories',
};

export function SettingsScreen({ navigation }: any) {
  const { user, logout } = useAuthStore();
  const healthQuery = useHealthScore();
  const unreadCount = useUnreadCount();

  const healthScoreValue = Math.round(
    Number(healthQuery.data?.score ?? (healthQuery.data as any)?.healthScore ?? 0),
  );

  // Toggles — local state until preferences API is wired
  const [autoCapture, setAutoCapture] = useState(true);
  const [smsParse, setSmsParse] = useState(true);
  const [emailParse, setEmailParse] = useState(true);
  const [upiNotif, setUpiNotif] = useState(true);
  const [aiInsights, setAiInsights] = useState(true);
  const [behavioralTags, setBehavioralTags] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [billReminders, setBillReminders] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

  const archetype = ((user as any)?.archetype as Archetype) || 'BALANCED';

  const handleAction = (action: string) =>
    Alert.alert('Coming soon', `${action} is on the roadmap.`);

  const handleLogout = () =>
    Alert.alert('Log out', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);

  const handleSendTestPush = async () => {
    try {
      await api.post('/push/test', {
        title: 'Test from MoneyMind',
        body: 'Push notifications are working.',
      });
      Alert.alert('Sent', 'Check your notification tray.');
    } catch (e: any) {
      Alert.alert('Could not send', e?.message ?? 'Make sure your push token is registered.');
    }
  };

  const initial =
    user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Spacing['3xl'] }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile hero */}
      <View style={styles.heroBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{user?.name || 'User'}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <Card variant="hero" style={styles.archetypeCard} padding="base">
          <View style={styles.archetypeRow}>
            <View style={styles.archetypeIcon}>
              <Sparkles size={20} color={Colors.accentAi} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.archetypeLabel}>YOUR ARCHETYPE</Text>
              <Text style={styles.archetypeName}>{getArchetypeLabel(archetype)}</Text>
              <Text style={styles.archetypeDescription}>{ARCHETYPE_DESCRIPTIONS[archetype]}</Text>
            </View>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreValue}>{healthScoreValue}</Text>
              <Text style={styles.scoreLabel}>HEALTH</Text>
            </View>
          </View>
        </Card>
      </View>

      <SettingsSection title="Capture modes">
        <Row
          icon={Bot}
          label="Auto-capture"
          hint="Automatically capture from SMS, email, UPI"
          toggle
          toggleValue={autoCapture}
          onToggle={setAutoCapture}
        />
        <Row
          icon={Inbox}
          label="SMS parsing"
          hint="HDFC, ICICI, SBI, Axis, +30 more banks"
          toggle
          toggleValue={smsParse}
          onToggle={setSmsParse}
          enabled={autoCapture}
        />
        <Row
          icon={Mail}
          label="Email parsing"
          hint="Bank statements and invoices"
          toggle
          toggleValue={emailParse}
          onToggle={setEmailParse}
          enabled={autoCapture}
        />
        <Row
          icon={Smartphone}
          label="UPI notifications"
          hint="GPay, PhonePe, Paytm"
          toggle
          toggleValue={upiNotif}
          onToggle={setUpiNotif}
          enabled={autoCapture}
        />
        <Row
          icon={Send}
          label="Forward an SMS"
          hint="Paste a bank SMS to capture it manually"
          onPress={() => navigation.navigate('SmsForward')}
        />
        <Row
          icon={Bell}
          label="Send test push"
          hint="Verify push notifications work"
          onPress={handleSendTestPush}
        />
      </SettingsSection>

      <SettingsSection title="AI features">
        <Row
          icon={Sparkles}
          label="AI insights"
          hint="Daily nudges and personalised recommendations"
          toggle
          toggleValue={aiInsights}
          onToggle={setAiInsights}
        />
        <Row
          icon={Tags}
          label="Behavioural tagging"
          hint="Late-night, weekend, impulse pattern detection"
          toggle
          toggleValue={behavioralTags}
          onToggle={setBehavioralTags}
        />
      </SettingsSection>

      <SettingsSection title="Notifications">
        <Row
          icon={Bell}
          label="Push notifications"
          hint="Bills, alerts, weekly summaries"
          toggle
          toggleValue={pushNotif}
          onToggle={setPushNotif}
          rightLabel={unreadCount.data ? `${unreadCount.data}` : undefined}
        />
        <Row
          icon={PieChart}
          label="Budget alerts"
          hint="Notify when 80% of any budget is spent"
          toggle
          toggleValue={budgetAlerts}
          onToggle={setBudgetAlerts}
          enabled={pushNotif}
        />
        <Row
          icon={Calendar}
          label="Bill reminders"
          hint="Subscription renewals and recurring payments"
          toggle
          toggleValue={billReminders}
          onToggle={setBillReminders}
          enabled={pushNotif}
        />
        <Row
          icon={FileText}
          label="Weekly digest"
          hint="Sunday summary of your week"
          toggle
          toggleValue={weeklyDigest}
          onToggle={setWeeklyDigest}
          enabled={pushNotif}
        />
        <Row
          icon={Heart}
          label="View notification center"
          onPress={() => navigation.navigate('Notifications')}
        />
      </SettingsSection>

      <SettingsSection title="Appearance">
        <Row
          icon={Moon}
          label="Dark mode"
          hint="MoneyMind ships dark-first; light mode coming v2"
          toggle
          toggleValue={darkMode}
          onToggle={setDarkMode}
          enabled={false}
        />
        <Row
          icon={Compass}
          label="Compact lists"
          hint="Tighter row spacing for power users"
          toggle
          toggleValue={compactMode}
          onToggle={setCompactMode}
        />
      </SettingsSection>

      <SettingsSection title="Privacy &amp; security">
        <Row
          icon={Lock}
          label="App lock"
          hint="Require biometric to open"
          onPress={() => handleAction('Biometric lock')}
        />
        <Row
          icon={ShieldCheck}
          label="Data privacy"
          hint="What we collect and what we don\u2019t"
          onPress={() => handleAction('Data privacy')}
        />
        <Row
          icon={Database}
          label="Export data"
          hint="Download your transactions as CSV"
          onPress={() => handleAction('Export data')}
        />
      </SettingsSection>

      <SettingsSection title="Support">
        <Row icon={HelpCircle} label="Help center" onPress={() => handleAction('Help center')} />
        <Row icon={MessageSquare} label="Contact us" onPress={() => handleAction('Contact')} />
        <Row icon={Star} label="Rate MoneyMind" onPress={() => handleAction('Rate the app')} />
      </SettingsSection>

      <View style={styles.logoutBlock}>
        <Button
          title="Log out"
          onPress={handleLogout}
          variant="destructive"
          fullWidth
          leadingIcon={<LogOut size={16} color={Colors.accentError} strokeWidth={2} />}
        />
        <Text style={styles.versionText}>v1.0.0 (build 1)</Text>
      </View>
    </ScrollView>
  );
}

// =============================================================
// Section + Row
// =============================================================
function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card padding="none" style={styles.sectionCard}>
        {children}
      </Card>
    </View>
  );
}

function Row({
  icon: Icon,
  label,
  hint,
  toggle,
  toggleValue,
  onToggle,
  onPress,
  enabled = true,
  badge,
  destructive,
  rightLabel,
}: RowProps) {
  const dim = !enabled;
  return (
    <TouchableOpacity
      onPress={() => {
        if (toggle && onToggle) onToggle(!toggleValue);
        else onPress?.();
      }}
      disabled={dim}
      activeOpacity={0.85}
      style={[styles.row, dim && { opacity: 0.4 }]}
      accessibilityRole={toggle ? 'switch' : 'button'}
      accessibilityState={{ checked: toggleValue }}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.rowIconHost,
          destructive && {
            backgroundColor: 'rgba(255,180,171,0.10)',
            borderColor: 'rgba(255,180,171,0.30)',
          },
        ]}
      >
        <Icon
          size={18}
          color={destructive ? Colors.accentError : Colors.textSecondary}
          strokeWidth={1.75}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, destructive && { color: Colors.accentError }]}>{label}</Text>
        {hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>

      {badge && <Badge text={badge} variant="ai" size="sm" />}
      {rightLabel && (
        <View style={styles.rightLabelChip}>
          <Text style={styles.rightLabelText}>{rightLabel}</Text>
        </View>
      )}

      {toggle ? (
        <Toggle on={!!toggleValue} />
      ) : (
        <ChevronRight size={18} color={Colors.textTertiary} strokeWidth={1.5} />
      )}
    </TouchableOpacity>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[styles.toggle, on && styles.toggleOn]}>
      <View style={[styles.toggleThumb, on && styles.toggleThumbOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Hero
  heroBlock: {
    alignItems: 'center',
    paddingTop: Spacing['3xl'] + Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34, 211, 238, 0.16)',
    borderWidth: 2,
    borderColor: 'rgba(34, 211, 238, 0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  avatarText: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.accentAi,
  },
  name: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  email: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.lg,
  },

  archetypeCard: {
    width: '100%',
  },
  archetypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  archetypeIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  archetypeLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    fontWeight: Typography.weights.medium,
  },
  archetypeName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    marginTop: 2,
  },
  archetypeDescription: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scoreBadge: {
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.30)',
    marginLeft: Spacing.sm,
  },
  scoreValue: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.accentSuccess,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.6,
  },
  scoreLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.accentSuccess,
    letterSpacing: 0.6,
    fontWeight: Typography.weights.semiBold,
  },

  // Section
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  sectionCard: {
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  rowIconHost: {
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
  rowLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },
  rowHint: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: Typography.sizes.xs * 1.4,
  },
  rightLabelChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 180, 171, 0.16)',
    marginRight: Spacing.xs,
  },
  rightLabelText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.accentError,
    fontVariant: ['tabular-nums'] as any,
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

  // Logout
  logoutBlock: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    alignItems: 'center',
  },
  versionText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.lg,
    letterSpacing: 0.4,
  },
});
