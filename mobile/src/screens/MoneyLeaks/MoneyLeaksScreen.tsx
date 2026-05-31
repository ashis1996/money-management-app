import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import {
  Droplet,
  Repeat,
  Copy,
  TrendingUp,
  Zap,
  Moon,
  Coins,
  Sparkles,
  CheckCircle2,
  Trash2,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Header,
  ProgressBar,
  Section,
} from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { useMoneyLeaks } from '../../hooks';
import { formatCurrency } from '../../utils';

type LeakType =
  | 'UNUSED_SUBSCRIPTION'
  | 'DUPLICATE_SERVICE'
  | 'PRICE_INCREASE'
  | 'IMPULSE_PURCHASE'
  | 'LATE_NIGHT'
  | 'SMALL_FREQUENT';

type LeakSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

interface MoneyLeak {
  id: string;
  type: LeakType;
  severity: LeakSeverity;
  title: string;
  description: string;
  monthlySavings: number;
  yearlySavings: number;
  merchant?: string;
  recommendation: string;
  isFixed: boolean;
}

type FilterType = 'all' | LeakSeverity;

const ICON_FOR_TYPE: Record<LeakType, LucideIcon> = {
  UNUSED_SUBSCRIPTION: Repeat,
  DUPLICATE_SERVICE: Copy,
  PRICE_INCREASE: TrendingUp,
  IMPULSE_PURCHASE: Zap,
  LATE_NIGHT: Moon,
  SMALL_FREQUENT: Coins,
};

const TYPE_LABEL: Record<LeakType, string> = {
  UNUSED_SUBSCRIPTION: 'Unused',
  DUPLICATE_SERVICE: 'Duplicate',
  PRICE_INCREASE: 'Price hike',
  IMPULSE_PURCHASE: 'Impulse',
  LATE_NIGHT: 'Late night',
  SMALL_FREQUENT: 'Small &amp; frequent',
};

function severityColor(severity: LeakSeverity): string {
  if (severity === 'HIGH') return Colors.accentError;
  if (severity === 'MEDIUM') return Colors.accentWarning;
  return Colors.outline;
}

function severityVariant(severity: LeakSeverity): 'error' | 'warning' | 'gray' {
  if (severity === 'HIGH') return 'error';
  if (severity === 'MEDIUM') return 'warning';
  return 'gray';
}

function aiToLeak(l: any, idx: number): MoneyLeak {
  const monthly = Number(l.monthlySavings ?? l.monthly_savings ?? l.potential_savings ?? 0) || 0;
  return {
    id: l.id ?? `leak-${idx}`,
    type: (l.type || 'IMPULSE_PURCHASE') as LeakType,
    severity: (l.severity || 'MEDIUM') as LeakSeverity,
    title: l.title || 'Leak detected',
    description: l.description || '',
    monthlySavings: monthly,
    yearlySavings: Number(l.yearlySavings ?? l.yearly_savings ?? monthly * 12) || 0,
    merchant: l.merchant,
    recommendation: l.recommendation || 'Review this spending pattern',
    isFixed: !!l.isFixed,
  };
}

// =============================================================
// Screen
// =============================================================
export function MoneyLeaksScreen({ navigation }: any) {
  const leaksQuery = useMoneyLeaks();

  const leaks: MoneyLeak[] = useMemo(() => {
    const items = (leaksQuery.data as any)?.leaks ?? [];
    return items.map((l: any, i: number) => aiToLeak(l, i));
  }, [leaksQuery.data]);

  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleLeaks = useMemo(
    () =>
      leaks
        .filter((l) => !dismissedIds.has(l.id))
        .map((l) => ({ ...l, isFixed: fixedIds.has(l.id) || l.isFixed })),
    [leaks, fixedIds, dismissedIds],
  );

  const [filter, setFilter] = useState<FilterType>('all');

  const stats = useMemo(() => {
    const active = visibleLeaks.filter((l) => !l.isFixed);
    const monthlySavings = active.reduce((sum, l) => sum + l.monthlySavings, 0);
    const yearlySavings = active.reduce((sum, l) => sum + l.yearlySavings, 0);
    const fixed = visibleLeaks.filter((l) => l.isFixed);
    const fixedSavings = fixed.reduce((sum, l) => sum + l.monthlySavings, 0);
    return {
      activeCount: active.length,
      monthlySavings,
      yearlySavings,
      fixedCount: fixed.length,
      fixedSavings,
    };
  }, [visibleLeaks]);

  const filteredLeaks = useMemo(() => {
    if (filter === 'all') return visibleLeaks.filter((l) => !l.isFixed);
    return visibleLeaks.filter((l) => !l.isFixed && l.severity === filter);
  }, [visibleLeaks, filter]);

  const handleFix = (leak: MoneyLeak) =>
    Alert.alert(
      'Mark this leak as fixed?',
      `${leak.recommendation}\n\nSave ${formatCurrency(leak.monthlySavings)}/month`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Mark fixed',
          onPress: () => setFixedIds((prev) => new Set(prev).add(leak.id)),
        },
      ],
    );

  const handleDismiss = (id: string) => setDismissedIds((prev) => new Set(prev).add(id));

  if (leaksQuery.isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.accentAi} />
        <Text style={styles.loadingText}>Detecting leaks…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Money Leaks"
        subtitle="Hidden spending hurting your savings"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero — potential savings as the wow figure */}
        <Card variant="hero" padding="xl">
          <Text style={styles.heroLabel}>POTENTIAL MONTHLY SAVINGS</Text>
          <Text
            style={styles.heroValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatCurrency(stats.monthlySavings)}
          </Text>
          <View style={styles.heroFooter}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroSubLabel}>YEARLY IMPACT</Text>
              <Text style={styles.heroSubValue}>{formatCurrency(stats.yearlySavings)}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.heroSubLabel}>ACTIVE LEAKS</Text>
              <Text style={styles.heroSubValue}>{stats.activeCount}</Text>
            </View>
          </View>
        </Card>

        {/* AI summary callout */}
        {stats.activeCount > 0 && (
          <Card variant="ai" padding="base" style={{ marginTop: Spacing.base }}>
            <View style={styles.aiSummaryRow}>
              <View style={styles.aiSummaryIcon}>
                <Sparkles size={16} color={Colors.accentAi} strokeWidth={1.75} />
              </View>
              <Text style={styles.aiSummaryText}>
                Fixing your top leak alone could save{' '}
                <Text style={styles.aiSummaryHighlight}>
                  {formatCurrency(Math.max(...leaks.map((l) => l.monthlySavings), 0), {
                    compact: true,
                  })}
                  /mo
                </Text>{' '}
                — start with the high-priority items below.
              </Text>
            </View>
          </Card>
        )}

        {/* Fixed leaks celebration */}
        {stats.fixedCount > 0 && (
          <Card padding="base" style={[styles.fixedCard, { marginTop: Spacing.base }]}>
            <View style={styles.fixedRow}>
              <View style={styles.fixedIconHost}>
                <CheckCircle2 size={20} color={Colors.accentSuccess} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fixedTitle}>
                  {stats.fixedCount} {stats.fixedCount === 1 ? 'leak' : 'leaks'} fixed!
                </Text>
                <Text style={styles.fixedSubtitle}>
                  Saving {formatCurrency(stats.fixedSavings)}/month
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabs}
        >
          {(['all', 'HIGH', 'MEDIUM', 'LOW'] as FilterType[]).map((f) => {
            const active = filter === f;
            const label = f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase();
            return (
              <View
                key={f}
                style={[styles.chip, active && styles.chipActive]}
                onTouchEnd={() => setFilter(f)}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Leak list */}
        {filteredLeaks.length === 0 ? (
          <EmptyState
            icon="✨"
            title="No leaks here"
            message={
              stats.activeCount > 0
                ? 'No leaks match this severity filter.'
                : 'Nothing is leaking. Run an analysis from the Insights screen to scan for new patterns.'
            }
          />
        ) : (
          <Section
            title="Active leaks"
            subtitle={`${filteredLeaks.length} ${filteredLeaks.length === 1 ? 'leak' : 'leaks'} found`}
            style={{ marginTop: Spacing.lg }}
          >
            <View>
              {filteredLeaks.map((leak) => (
                <LeakCard
                  key={leak.id}
                  leak={leak}
                  onFix={() => handleFix(leak)}
                  onDismiss={() => handleDismiss(leak.id)}
                />
              ))}
            </View>
          </Section>
        )}

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </View>
  );
}

// =============================================================
// Leak card
// =============================================================
function LeakCard({
  leak,
  onFix,
  onDismiss,
}: {
  leak: MoneyLeak;
  onFix: () => void;
  onDismiss: () => void;
}) {
  const Icon = ICON_FOR_TYPE[leak.type];
  const tone = severityColor(leak.severity);

  return (
    <Card padding="base" style={[styles.leakCard, { borderColor: tone + '40' }]}>
      <View style={styles.leakRow}>
        <View style={[styles.leakIcon, { backgroundColor: tone + '22', borderColor: tone + '44' }]}>
          <Icon size={18} color={tone} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.leakTitleRow}>
            <Text style={styles.leakTitle} numberOfLines={1}>
              {leak.title}
            </Text>
            <Badge
              text={TYPE_LABEL[leak.type]}
              variant={severityVariant(leak.severity)}
              size="sm"
            />
          </View>
          {leak.merchant && <Text style={styles.leakMerchant}>{leak.merchant}</Text>}
          {leak.description ? (
            <Text style={styles.leakDescription} numberOfLines={3}>
              {leak.description}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.leakSavingsRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.leakSavingsLabel}>SAVES PER MONTH</Text>
          <Text style={[styles.leakSavingsValue, { color: tone }]}>
            {formatCurrency(leak.monthlySavings)}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.leakSavingsLabel}>YEARLY</Text>
          <Text style={styles.leakYearlyValue}>{formatCurrency(leak.yearlySavings)}</Text>
        </View>
      </View>

      <View style={styles.leakRecommendation}>
        <Sparkles size={12} color={Colors.accentAi} strokeWidth={2} />
        <Text style={styles.leakRecommendationText}>{leak.recommendation}</Text>
      </View>

      <View style={styles.leakActions}>
        <Button
          title="Dismiss"
          variant="secondary"
          size="sm"
          onPress={onDismiss}
          leadingIcon={<Trash2 size={14} color={Colors.textPrimary} strokeWidth={2} />}
          style={{ flex: 1 }}
        />
        <View style={{ width: Spacing.sm }} />
        <Button
          title="Fix it"
          variant="primary"
          size="sm"
          onPress={onFix}
          trailingIcon={<ArrowRight size={14} color={Colors.white} strokeWidth={2} />}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: Spacing.base,
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
  },
  scroll: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },

  // Hero
  heroLabel: {
    fontSize: Typography.sizes.xs,
    letterSpacing: 1.2,
    color: Colors.onSurfaceVariant,
    fontWeight: Typography.weights.medium,
  },
  heroValue: {
    fontSize: 48,
    lineHeight: 52,
    color: Colors.accentSuccess,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -1.5,
    marginTop: Spacing.xs,
    marginBottom: Spacing.base,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  heroSubLabel: {
    fontSize: Typography.sizes.xs,
    letterSpacing: 0.6,
    color: Colors.onSurfaceVariant,
    fontWeight: Typography.weights.medium,
  },
  heroSubValue: {
    marginTop: 2,
    fontSize: Typography.sizes.lg,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.4,
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.borderDefault,
    marginHorizontal: Spacing.base,
  },

  // AI summary
  aiSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiSummaryIcon: {
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
  aiSummaryText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.5,
  },
  aiSummaryHighlight: {
    color: Colors.accentSuccess,
    fontWeight: Typography.weights.bold,
    fontVariant: ['tabular-nums'] as any,
  },

  // Fixed celebration
  fixedCard: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.30)',
  },
  fixedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fixedIconHost: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  fixedTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.accentSuccess,
  },
  fixedSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.accentSuccess,
    marginTop: 2,
  },

  // Chips
  filterTabs: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    marginRight: Spacing.sm,
  },
  chipActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  chipLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
  chipLabelActive: {
    color: Colors.white,
  },

  // Leak card
  leakCard: {
    marginBottom: Spacing.sm,
  },
  leakRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leakIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  leakTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  leakTitle: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
  },
  leakMerchant: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  leakDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    lineHeight: Typography.sizes.sm * 1.4,
  },

  leakSavingsRow: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  leakSavingsLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.6,
    fontWeight: Typography.weights.medium,
  },
  leakSavingsValue: {
    marginTop: 2,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.4,
  },
  leakYearlyValue: {
    marginTop: 2,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    fontVariant: ['tabular-nums'] as any,
  },

  leakRecommendation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(34,211,238,0.08)',
    borderRadius: BorderRadius.base,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.20)',
    gap: Spacing.xs,
  },
  leakRecommendationText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.4,
  },

  leakActions: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
});
