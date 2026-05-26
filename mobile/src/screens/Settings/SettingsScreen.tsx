import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import { Card, Badge, Button } from '../../components/shared';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  ArchetypeColors,
} from '../../styles/theme';
import { useHealthScore, useUnreadCount } from '../../hooks';
import { api } from '../../services/api';

interface MenuItem {
  icon: string;
  label: string;
  action: string;
  badge?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
  hint?: string;
}

export function SettingsScreen({ navigation }: any) {
  const { user, logout } = useAuthStore();
  const healthQuery = useHealthScore();
  const unreadCount = useUnreadCount();

  const healthScoreValue = Math.round(
    Number(healthQuery.data?.score ?? healthQuery.data?.healthScore ?? 0),
  );

  // Settings state
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
  const [darkMode, setDarkMode] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  const archetype = (user as any)?.archetype || 'BALANCED';
  const archetypeColor = ArchetypeColors[archetype] || Colors.primary;
  const archetypeLabels: Record<string, { label: string; emoji: string; description: string }> = {
    SPEND_HEAVY: { label: 'Spend Heavy', emoji: '💸', description: 'You enjoy life - we\'ll help you control it' },
    SAVINGS_FOCUSED: { label: 'Saver', emoji: '💰', description: 'Disciplined and goal-oriented' },
    CREDIT_USER: { label: 'Credit User', emoji: '💳', description: 'Cards are your tool of choice' },
    SUBSCRIPTION_HEAVY: { label: 'Subscription Heavy', emoji: '🔄', description: 'Many recurring services' },
    BALANCED: { label: 'Balanced', emoji: '⚖️', description: 'Well-managed across categories' },
  };
  const archInfo = archetypeLabels[archetype];

  const handleAction = (action: string) => {
    Alert.alert('Coming Soon', `${action} will be available soon`);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Hero */}
      <View style={styles.profileHero}>
        <View style={[styles.avatar, { backgroundColor: archetypeColor }]}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() ||
              user?.email?.charAt(0).toUpperCase() ||
              'U'}
          </Text>
        </View>
        <Text style={styles.profileName}>{user?.name || 'User'}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>

        {/* Archetype card */}
        <Card style={[styles.archetypeCard, { borderColor: archetypeColor }]}>
          <View style={styles.archetypeHeader}>
            <Text style={styles.archetypeEmoji}>{archInfo.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.archetypeLabel}>Your Archetype</Text>
              <Text style={[styles.archetypeName, { color: archetypeColor }]}>
                {archInfo.label}
              </Text>
            </View>
          </View>
          <Text style={styles.archetypeDescription}>{archInfo.description}</Text>
        </Card>
      </View>

      {/* Quick Settings */}
      <Section title="Capture Modes">
        <Row
          icon="🤖"
          label="Auto-capture"
          hint="Automatically capture from SMS, email, UPI"
          toggle
          toggleValue={autoCapture}
          onToggle={setAutoCapture}
        />
        <Row
          icon="📩"
          label="SMS parsing"
          hint="HDFC, ICICI, SBI, Axis, more"
          toggle
          toggleValue={smsParse}
          onToggle={setSmsParse}
          enabled={autoCapture}
        />
        <Row
          icon="✉️"
          label="Email parsing"
          hint="Bank statements, invoices"
          toggle
          toggleValue={emailParse}
          onToggle={setEmailParse}
          enabled={autoCapture}
        />
        <Row
          icon="📱"
          label="UPI notifications"
          hint="GPay, PhonePe, Paytm"
          toggle
          toggleValue={upiNotif}
          onToggle={setUpiNotif}
          enabled={autoCapture}
        />
        <Row
          icon="📨"
          label="Forward an SMS"
          hint="Paste a bank SMS to capture it manually"
          onPress={() => navigation.navigate('SmsForward')}
        />
        <Row
          icon="🔔"
          label="Send test push"
          hint="Verify push notifications are working"
          onPress={async () => {
            try {
              await api.post('/push/test', {
                title: 'Test from MoneyMind 💰',
                body: 'Push notifications are working',
              });
              Alert.alert('Sent', 'Check your notification tray.');
            } catch (e: any) {
              Alert.alert(
                'Could not send',
                e?.message ?? 'Make sure you registered a push token.',
              );
            }
          }}
        />
      </Section>

      <Section title="AI Features">
        <Row
          icon="✨"
          label="AI Insights"
          hint="Smart recommendations and tips"
          toggle
          toggleValue={aiInsights}
          onToggle={setAiInsights}
        />
        <Row
          icon="🎯"
          label="Behavioral Tags"
          hint="Tag impulse, late-night, weekend purchases"
          toggle
          toggleValue={behavioralTags}
          onToggle={setBehavioralTags}
        />
        <Row
          icon="🤖"
          label="AI Assistant"
          onPress={() => navigation.navigate('AIAssistant')}
        />
        <Row
          icon="❤️"
          label="Health Score"
          onPress={() => navigation.navigate('HealthScore')}
          badge={healthScoreValue > 0 ? String(healthScoreValue) : undefined}
        />
      </Section>

      <Section title="Notifications">
        <Row
          icon="🔔"
          label="Push Notifications"
          toggle
          toggleValue={pushNotif}
          onToggle={setPushNotif}
        />
        <Row
          icon="📊"
          label="Budget Alerts"
          hint="When you're nearing budget limits"
          toggle
          toggleValue={budgetAlerts}
          onToggle={setBudgetAlerts}
        />
        <Row
          icon="📅"
          label="Bill Reminders"
          hint="3 days before due date"
          toggle
          toggleValue={billReminders}
          onToggle={setBillReminders}
        />
        <Row
          icon="📆"
          label="Weekly Digest"
          hint="Sunday 8 PM summary"
          toggle
          toggleValue={weeklyDigest}
          onToggle={setWeeklyDigest}
        />
      </Section>

      <Section title="Preferences">
        <Row
          icon="🌙"
          label="Dark Mode"
          toggle
          toggleValue={darkMode}
          onToggle={setDarkMode}
        />
        <Row
          icon="📐"
          label="Compact Mode"
          hint="Show more on screen"
          toggle
          toggleValue={compactMode}
          onToggle={setCompactMode}
        />
        <Row
          icon="💱"
          label="Currency"
          rightText="₹ INR"
          onPress={() => handleAction('Currency')}
        />
        <Row
          icon="🌐"
          label="Language"
          rightText="English"
          onPress={() => handleAction('Language')}
        />
      </Section>

      <Section title="Data & Accounts">
        <Row
          icon="🏦"
          label="Linked Accounts"
          rightText="3 connected"
          onPress={() => navigation.navigate('Accounts')}
        />
        <Row
          icon="🔔"
          label="Notifications"
          hint="Risk alerts, reminders, insights"
          onPress={() => navigation.navigate('Notifications')}
          badge="3"
        />
        <Row
          icon="📆"
          label="Weekly Summary"
          hint="Your last week's recap"
          onPress={() => navigation.navigate('WeeklySummary')}
        />
        <Row
          icon="📥"
          label="Import data"
          hint="From CSV or other apps"
          onPress={() => handleAction('Import')}
        />
        <Row
          icon="📤"
          label="Export data"
          onPress={() => handleAction('Export')}
        />
        <Row
          icon="🗑️"
          label="Clear cache"
          onPress={() =>
            Alert.alert('Clear cache', 'This will not delete your data', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', onPress: () => Alert.alert('Done', 'Cache cleared') },
            ])
          }
        />
      </Section>

      <Section title="Privacy & Security">
        <Row icon="🔒" label="Change password" onPress={() => handleAction('Password')} />
        <Row
          icon="🔐"
          label="Biometric lock"
          hint="Face ID / Fingerprint"
          toggle
          toggleValue={false}
          onToggle={() => handleAction('Biometric')}
        />
        <Row icon="📋" label="Privacy Policy" onPress={() => handleAction('Privacy')} />
        <Row icon="📄" label="Terms of Service" onPress={() => handleAction('Terms')} />
      </Section>

      <Section title="Support">
        <Row icon="❓" label="Help Center" onPress={() => handleAction('Help')} />
        <Row icon="💬" label="Contact us" onPress={() => handleAction('Contact')} />
        <Row icon="⭐" label="Rate the app" onPress={() => handleAction('Rate')} />
        <Row icon="📤" label="Share with friends" onPress={() => handleAction('Share')} />
      </Section>

      {/* Logout */}
      <View style={styles.logoutSection}>
        <Button
          title="Logout"
          onPress={handleLogout}
          variant="danger"
          fullWidth
        />
      </View>

      {/* Danger zone */}
      <TouchableOpacity
        style={styles.dangerLink}
        onPress={() =>
          Alert.alert(
            'Delete account?',
            'This will permanently delete your data. This action cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => handleAction('Delete account'),
              },
            ]
          )
        }
      >
        <Text style={styles.dangerText}>Delete account</Text>
      </TouchableOpacity>

      {/* Version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>MoneyMind v1.0.0</Text>
        <Text style={styles.versionSubtext}>Build 2026.05</Text>
      </View>

      <View style={{ height: Spacing['2xl'] }} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
  icon,
  label,
  hint,
  badge,
  rightText,
  toggle,
  toggleValue,
  onToggle,
  onPress,
  enabled = true,
}: {
  icon: string;
  label: string;
  hint?: string;
  badge?: string;
  rightText?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
  enabled?: boolean;
}) {
  const content = (
    <View style={[styles.row, !enabled && styles.rowDisabled]}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      {badge && <Badge text={badge} variant="primary" size="sm" />}
      {rightText && <Text style={styles.rowRight}>{rightText}</Text>}
      {toggle && (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          disabled={!enabled}
          trackColor={{ false: Colors.gray300, true: Colors.primary }}
          thumbColor={Colors.white}
        />
      )}
      {onPress && !toggle && <Text style={styles.rowArrow}>›</Text>}
    </View>
  );

  if (onPress && !toggle) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  }
  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Profile hero
  profileHero: {
    alignItems: 'center',
    paddingTop: Spacing['3xl'] + Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
  },
  profileName: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  profileEmail: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  archetypeCard: {
    width: '100%',
    marginTop: Spacing.base,
    borderWidth: 2,
  },
  archetypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  archetypeEmoji: {
    fontSize: 32,
    marginRight: Spacing.sm,
  },
  archetypeLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  archetypeName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
  },
  archetypeDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  // Section
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
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
    borderBottomColor: Colors.gray100,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowIcon: {
    fontSize: 22,
    marginRight: Spacing.sm,
    width: 28,
  },
  rowLabel: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
  },
  rowHint: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rowRight: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
  rowArrow: {
    fontSize: 24,
    color: Colors.textTertiary,
    marginLeft: Spacing.xs,
  },
  // Logout
  logoutSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  dangerLink: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  dangerText: {
    fontSize: Typography.sizes.sm,
    color: Colors.error,
    fontWeight: Typography.weights.medium,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  versionText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
  },
  versionSubtext: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});
