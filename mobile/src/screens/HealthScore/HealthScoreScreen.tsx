import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {
  PiggyBank,
  PieChart,
  Repeat,
  TrendingUp,
  Target as TargetIcon,
  CreditCard,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Badge,
  Card,
  EmptyState,
  Header,
  ProgressBar,
  ProgressRing,
  Section,
} from '../../components/shared';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { useHealthScore } from '../../hooks';
import { getHealthRating } from '../../utils';

interface HealthComponent {
  key: string;
  name: string;
  weight: number;
  score: number;
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_WORK' | 'CRITICAL';
  description: string;
  details: string;
  improvementTips: string[];
  icon: LucideIcon;
}

// =============================================================
// Component definitions — icon + display name + weight per the
// scoring model. Data fields (score, status, tips) come from the
// AI service.
// =============================================================
const COMPONENT_DEFS: Record<string, Pick<HealthComponent, 'key' | 'name' | 'weight' | 'icon'>> = {
  savings_rate: {
    key: 'savings_rate',
    name: 'Savings Rate',
    weight: 25,
    icon: PiggyBank,
  },
  budget_adherence: {
    key: 'budget_adherence',
    name: 'Budget Adherence',
    weight: 20,
    icon: PieChart,
  },
  subscription_health: {
    key: 'subscription_health',
    name: 'Subscription Health',
    weight: 15,
    icon: Repeat,
  },
  spending_consistency: {
    key: 'spending_consistency',
    name: 'Spending Consistency',
    weight: 15,
    icon: TrendingUp,
  },
  impulse_control: {
    key: 'impulse_control',
    name: 'Impulse Control',
    weight: 10,
    icon: TargetIcon,
  },
  goal_progress: {
    key: 'goal_progress',
    name: 'Goal Progress',
    weight: 10,
    icon: TargetIcon,
  },
  credit_utilization: {
    key: 'credit_utilization',
    name: 'Credit Utilisation',
    weight: 5,
    icon: CreditCard,
  },
};

function statusFromScore(score: number): HealthComponent['status'] {
  if (score >= 85) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 55) return 'FAIR';
  if (score >= 40) return 'NEEDS_WORK';
  return 'CRITICAL';
}

function colorForStatus(status: HealthComponent['status']): string {
  switch (status) {
    case 'EXCELLENT':
      return Colors.accentSuccess;
    case 'GOOD':
      return '#34D399';
    case 'FAIR':
      return Colors.accentWarning;
    case 'NEEDS_WORK':
      return '#F87171';
    case 'CRITICAL':
      return Colors.accentError;
  }
}

function statusLabel(status: HealthComponent['status']): string {
  switch (status) {
    case 'EXCELLENT':
      return 'Excellent';
    case 'GOOD':
      return 'Good';
    case 'FAIR':
      return 'Fair';
    case 'NEEDS_WORK':
      return 'Needs work';
    case 'CRITICAL':
      return 'Critical';
  }
}

function buildHealthData(apiResponse: any) {
  if (!apiResponse) return null;
  const score = Number(apiResponse.score ?? apiResponse.healthScore ?? 0);
  const componentsRaw = apiResponse.components ?? apiResponse.componentScores ?? {};

  const components: HealthComponent[] = Object.entries(COMPONENT_DEFS).map(([key, def]) => {
    const componentData = componentsRaw[key] ?? {};
    const compScore = Number(
      typeof componentData === 'number' ? componentData : (componentData.score ?? 0),
    );
    return {
      ...def,
      score: compScore,
      status: statusFromScore(compScore),
      description: componentData.description ?? '',
      details: componentData.details ?? '',
      improvementTips: componentData.tips ?? componentData.improvementTips ?? [],
    };
  });

  const recommendations: string[] = Array.isArray(apiResponse.recommendations)
    ? apiResponse.recommendations
    : [];

  const history: number[] = apiResponse.history ?? apiResponse.scoreHistory ?? [score];

  return {
    score,
    rating: statusFromScore(score),
    components,
    recommendations,
    history,
  };
}

export function HealthScoreScreen({ navigation }: any) {
  const healthQuery = useHealthScore();
  const data = useMemo(() => buildHealthData(healthQuery.data), [healthQuery.data]);

  if (healthQuery.isLoading && !data) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.accentAi} />
        <Text style={styles.loadingText}>Calculating your health score…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <Header title="Health Score" onBack={() => navigation.goBack()} />
        <EmptyState
          icon="📊"
          title="No health score yet"
          message="We need a few weeks of transactions to compute your score. Add transactions or wait for SMS auto-capture to fill in."
          actionLabel="Refresh"
          onAction={() => healthQuery.refetch()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Health Score" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero score card */}
        <Card variant="ai" padding="xl" style={{ alignItems: 'center' }}>
          <ProgressRing progress={data.score} size={200} strokeWidth={14} gradient>
            <Text style={styles.heroScore}>{Math.round(data.score)}</Text>
            <Text style={styles.heroScoreUnit}>OUT OF 100</Text>
          </ProgressRing>

          <View style={styles.ratingRow}>
            <Sparkles size={14} color={Colors.accentAi} strokeWidth={2} />
            <Text style={styles.ratingText}>{getHealthRating(data.score)}</Text>
          </View>

          {data.history.length > 1 && (
            <View style={styles.historyBlock}>
              <Text style={styles.historyLabel}>30-DAY HISTORY</Text>
              <SparkBar values={data.history.slice(-12)} />
            </View>
          )}
        </Card>

        {/* Components */}
        <Section
          title="What drives your score"
          subtitle="Each factor is weighted by how strongly it influences your overall score."
          style={{ marginTop: Spacing.lg }}
        >
          <View>
            {data.components.map((c) => (
              <ComponentRow key={c.key} component={c} />
            ))}
          </View>
        </Section>

        {/* AI recommendations */}
        {data.recommendations.length > 0 && (
          <Section
            title="AI recommendations"
            subtitle="Top actions to improve your score this month"
            highlightTitle
            style={{ marginTop: Spacing.lg }}
          >
            <View>
              {data.recommendations.slice(0, 5).map((rec, idx) => (
                <Card key={idx} variant="ai" padding="base" style={{ marginBottom: Spacing.sm }}>
                  <View style={styles.recRow}>
                    <View style={styles.recIcon}>
                      <Lightbulb size={16} color={Colors.accentAi} strokeWidth={1.75} />
                    </View>
                    <Text style={styles.recText}>{rec}</Text>
                  </View>
                </Card>
              ))}
            </View>
          </Section>
        )}

        {/* Score scale legend */}
        <Section title="Score guide" style={{ marginTop: Spacing.lg }}>
          <Card padding="base">
            <ScoreRange label="Excellent" range="85–100" color={Colors.accentSuccess} />
            <ScoreRange label="Good" range="70–84" color="#34D399" />
            <ScoreRange label="Fair" range="55–69" color={Colors.accentWarning} />
            <ScoreRange label="Needs work" range="40–54" color="#F87171" />
            <ScoreRange label="Critical" range="0–39" color={Colors.accentError} isLast />
          </Card>
        </Section>

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </View>
  );
}

// =============================================================
// Component row
// =============================================================
function ComponentRow({ component }: { component: HealthComponent }) {
  const Icon = component.icon;
  const color = colorForStatus(component.status);

  return (
    <Card padding="base" style={{ marginBottom: Spacing.sm }}>
      <View style={styles.componentRow}>
        <View
          style={[
            styles.componentIcon,
            {
              backgroundColor: color + '22',
              borderColor: color + '44',
            },
          ]}
        >
          <Icon size={18} color={color} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.componentTitleRow}>
            <Text style={styles.componentName}>{component.name}</Text>
            <Text style={[styles.componentScore, { color }]}>{Math.round(component.score)}</Text>
          </View>
          <View style={{ marginTop: 4 }}>
            <ProgressBar progress={component.score} color={color} />
          </View>
          <View style={styles.componentMeta}>
            <Text style={styles.componentWeight}>Weight: {component.weight}%</Text>
            <Badge
              text={statusLabel(component.status)}
              variant={
                component.status === 'EXCELLENT'
                  ? 'success'
                  : component.status === 'GOOD'
                    ? 'success'
                    : component.status === 'FAIR'
                      ? 'warning'
                      : 'error'
              }
              size="sm"
            />
          </View>
          {component.description ? (
            <Text style={styles.componentDescription}>{component.description}</Text>
          ) : null}
          {component.improvementTips.length > 0 && (
            <View style={styles.tipsBlock}>
              {component.improvementTips.slice(0, 2).map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <CheckCircle2 size={12} color={Colors.accentAi} strokeWidth={2} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

function ScoreRange({
  label,
  range,
  color,
  isLast,
}: {
  label: string;
  range: string;
  color: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.scoreRangeRow, !isLast && styles.scoreRangeBordered]}>
      <View style={[styles.scoreRangeDot, { backgroundColor: color }]} />
      <Text style={styles.scoreRangeLabel}>{label}</Text>
      <Text style={styles.scoreRangeValue}>{range}</Text>
    </View>
  );
}

// =============================================================
// Mini sparkline using stacked bars (no SVG dependency)
// =============================================================
function SparkBar({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <View style={styles.sparkRow}>
      {values.map((v, i) => {
        const h = Math.max(4, (v / max) * 28);
        const tone =
          v >= 70 ? Colors.accentSuccess : v >= 55 ? Colors.accentWarning : Colors.accentError;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              marginHorizontal: 2,
              height: h,
              borderRadius: 2,
              backgroundColor: tone,
              opacity: 0.4 + (i / values.length) * 0.6,
            }}
          />
        );
      })}
    </View>
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
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },

  // Hero
  heroScore: {
    fontSize: 72,
    lineHeight: 78,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -2,
  },
  heroScoreUnit: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1.2,
    fontWeight: Typography.weights.medium,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    gap: 6,
  },
  ratingText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.accentAi,
    letterSpacing: -0.2,
  },

  historyBlock: {
    width: '100%',
    marginTop: Spacing.xl,
  },
  historyLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1.2,
    fontWeight: Typography.weights.medium,
    marginBottom: Spacing.sm,
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 32,
  },

  // Component
  componentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  componentIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  componentTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  componentName: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
  },
  componentScore: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.4,
    marginLeft: Spacing.sm,
  },
  componentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  componentWeight: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    letterSpacing: 0.4,
  },
  componentDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    lineHeight: Typography.sizes.sm * 1.4,
  },
  tipsBlock: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    gap: 4,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  tipText: {
    flex: 1,
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    lineHeight: Typography.sizes.xs * 1.5,
  },

  // Recommendations
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  recIcon: {
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
  recText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.5,
  },

  // Score range legend
  scoreRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  scoreRangeBordered: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  scoreRangeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  scoreRangeLabel: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
  },
  scoreRangeValue: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'] as any,
  },
});
