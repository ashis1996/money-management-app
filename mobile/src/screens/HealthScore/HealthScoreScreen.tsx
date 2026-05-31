import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Card,
  Badge,
  ProgressRing,
  ProgressBar,
  Header,
  EmptyState,
} from '../../components/shared';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  HealthScoreColors,
  Tints,
} from '../../styles/theme';
import { useHealthScore } from '../../hooks';

interface HealthComponent {
  key: string;
  name: string;
  weight: number;
  score: number;
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_WORK' | 'CRITICAL';
  description: string;
  details: string;
  improvementTips: string[];
  icon: string;
}

const COMPONENT_DEFS: Record<string, Pick<HealthComponent, 'key' | 'name' | 'weight' | 'icon'>> = {
  savings_rate: { key: 'savings_rate', name: 'Savings Rate', weight: 25, icon: '💰' },
  budget_adherence: {
    key: 'budget_adherence',
    name: 'Budget Adherence',
    weight: 20,
    icon: '📊',
  },
  subscription_health: {
    key: 'subscription_health',
    name: 'Subscription Health',
    weight: 15,
    icon: '🔄',
  },
  spending_consistency: {
    key: 'spending_consistency',
    name: 'Spending Consistency',
    weight: 15,
    icon: '📈',
  },
  impulse_control: {
    key: 'impulse_control',
    name: 'Impulse Control',
    weight: 10,
    icon: '🎯',
  },
  goal_progress: { key: 'goal_progress', name: 'Goal Progress', weight: 10, icon: '🎯' },
  credit_utilization: {
    key: 'credit_utilization',
    name: 'Credit Utilization',
    weight: 5,
    icon: '💳',
  },
};

function statusFromScore(score: number): HealthComponent['status'] {
  if (score >= 85) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 55) return 'FAIR';
  if (score >= 40) return 'NEEDS_WORK';
  return 'CRITICAL';
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

  const history: number[] = apiResponse.history ?? apiResponse.scoreHistory ?? [score];

  return {
    score,
    rating: statusFromScore(score),
    trend: 'stable' as 'up' | 'down' | 'stable',
    trendValue: 0,
    history,
    components,
  };
}

function getRatingInfo(score: number) {
  if (score >= 85) return { label: 'Excellent', color: HealthScoreColors.excellent, emoji: '🎉' };
  if (score >= 70) return { label: 'Good', color: HealthScoreColors.good, emoji: '👍' };
  if (score >= 55) return { label: 'Fair', color: HealthScoreColors.fair, emoji: '👌' };
  if (score >= 40) return { label: 'Needs Work', color: HealthScoreColors.poor, emoji: '⚠️' };
  return { label: 'Critical', color: HealthScoreColors.critical, emoji: '🚨' };
}

function getStatusColor(status: string) {
  switch (status) {
    case 'EXCELLENT':
      return Colors.success;
    case 'GOOD':
      return Colors.successLight;
    case 'FAIR':
      return Colors.warning;
    case 'NEEDS_WORK':
      return Colors.error;
    case 'CRITICAL':
      return Colors.error;
    default:
      return Colors.gray400;
  }
}

export function HealthScoreScreen({ navigation }: any) {
  const healthQuery = useHealthScore();
  const healthData = useMemo(() => buildHealthData(healthQuery.data), [healthQuery.data]);

  if (healthQuery.isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!healthData) {
    return (
      <View style={styles.container}>
        <Header title="Health Score" onBack={() => navigation.goBack()} />
        <EmptyState
          icon="📊"
          title="Score not yet calculated"
          message="Add transactions and refresh to see your financial health score"
          actionLabel="Retry"
          onAction={() => healthQuery.refetch()}
        />
      </View>
    );
  }

  const ratingInfo = getRatingInfo(healthData.score);

  // Sort components by weighted contribution (lowest score first)
  const sortedComponents = [...healthData.components].sort((a, b) => a.score - b.score);

  // Calculate next-level threshold
  const nextLevel =
    healthData.score >= 85 ? null : healthData.score >= 70 ? 85 : healthData.score >= 55 ? 70 : 55;

  return (
    <View style={styles.container}>
      <Header
        title="Financial Health"
        subtitle="Your money score breakdown"
        onBack={() => navigation.goBack()}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero score card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroContent}>
            <ProgressRing
              progress={healthData.score}
              size={180}
              strokeWidth={16}
              color={ratingInfo.color}
              backgroundColor={Colors.gray100}
            >
              <Text style={styles.heroEmoji}>{ratingInfo.emoji}</Text>
              <Text style={[styles.heroScore, { color: ratingInfo.color }]}>
                {healthData.score}
              </Text>
              <Text style={styles.heroMax}>out of 100</Text>
            </ProgressRing>
          </View>
          <Badge text={ratingInfo.label} variant="success" />
          <View style={styles.trendRow}>
            <Text
              style={[
                styles.trendIcon,
                {
                  color:
                    healthData.trend === 'up'
                      ? Colors.success
                      : healthData.trend === 'down'
                        ? Colors.error
                        : Colors.textSecondary,
                },
              ]}
            >
              {healthData.trend === 'up' ? '↑' : healthData.trend === 'down' ? '↓' : '→'}
            </Text>
            <Text style={styles.trendText}>+{healthData.trendValue} from last week</Text>
          </View>
        </Card>

        {/* History sparkline */}
        <Card style={styles.historyCard}>
          <Text style={styles.historyTitle}>Score History (7 weeks)</Text>
          <View style={styles.sparkline}>
            {healthData.history.map((score, idx) => {
              const max = Math.max(...healthData.history);
              const heightRatio = score / max;
              const isLatest = idx === healthData.history.length - 1;
              return (
                <View key={idx} style={styles.sparkBar}>
                  <View
                    style={[
                      styles.sparkBarFill,
                      {
                        height: `${heightRatio * 100}%`,
                        backgroundColor: isLatest ? ratingInfo.color : Colors.gray300,
                      },
                    ]}
                  />
                  <Text style={styles.sparkLabel}>{score}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Next level */}
        {nextLevel && (
          <Card style={styles.nextLevelCard}>
            <View style={styles.nextLevelHeader}>
              <Text style={styles.nextLevelIcon}>🎯</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextLevelTitle}>
                  {nextLevel - healthData.score} points to next level
                </Text>
                <Text style={styles.nextLevelSubtitle}>
                  Reach {nextLevel} to be{' '}
                  {nextLevel === 85 ? 'Excellent' : nextLevel === 70 ? 'Good' : 'Fair'}
                </Text>
              </View>
            </View>
            <ProgressBar
              progress={(healthData.score / nextLevel) * 100}
              color={ratingInfo.color}
              height={8}
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        )}

        {/* Component breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Score Breakdown</Text>
          <Text style={styles.sectionSubtitle}>Lowest scores first - focus on these</Text>
          {sortedComponents.map((comp) => (
            <ComponentCard key={comp.key} component={comp} />
          ))}
        </View>

        {/* What this means */}
        <Card style={styles.explainCard}>
          <Text style={styles.explainTitle}>📚 What is the Health Score?</Text>
          <Text style={styles.explainText}>
            Your Financial Health Score is like CIBIL but for spending behavior. It evaluates your
            habits across 7 dimensions weighted by importance.
          </Text>
          <View style={styles.scoreRanges}>
            <ScoreRange label="Excellent" range="85-100" color={HealthScoreColors.excellent} />
            <ScoreRange label="Good" range="70-84" color={HealthScoreColors.good} />
            <ScoreRange label="Fair" range="55-69" color={HealthScoreColors.fair} />
            <ScoreRange label="Needs Work" range="40-54" color={HealthScoreColors.poor} />
            <ScoreRange label="Critical" range="0-39" color={HealthScoreColors.critical} />
          </View>
        </Card>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

function ComponentCard({ component: comp }: { component: HealthComponent }) {
  const statusColor = getStatusColor(comp.status);

  return (
    <Card style={styles.componentCard}>
      <View style={styles.compHeader}>
        <Text style={styles.compIcon}>{comp.icon}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.compTitleRow}>
            <Text style={styles.compName}>{comp.name}</Text>
            <Text style={styles.compWeight}>{comp.weight}% weight</Text>
          </View>
          <Text style={styles.compDescription}>{comp.description}</Text>
        </View>
      </View>

      {/* Score */}
      <View style={styles.compScoreRow}>
        <Text style={[styles.compScoreValue, { color: statusColor }]}>{comp.score}</Text>
        <Text style={styles.compScoreMax}>/100</Text>
        <View style={styles.compScoreBadge}>
          <Badge
            text={comp.status.replace('_', ' ')}
            variant={
              comp.status === 'EXCELLENT'
                ? 'success'
                : comp.status === 'GOOD'
                  ? 'success'
                  : comp.status === 'FAIR'
                    ? 'warning'
                    : 'error'
            }
            size="sm"
          />
        </View>
      </View>

      <ProgressBar
        progress={comp.score}
        color={statusColor}
        height={8}
        style={{ marginVertical: Spacing.sm }}
      />

      <Text style={styles.compDetails}>{comp.details}</Text>

      {/* Improvement tips */}
      {comp.score < 80 && (
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsHeader}>💡 How to improve</Text>
          {comp.improvementTips.map((tip, idx) => (
            <View key={idx} style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipItem}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function ScoreRange({ label, range, color }: { label: string; range: string; color: string }) {
  return (
    <View style={styles.rangeRow}>
      <View style={[styles.rangeDot, { backgroundColor: color }]} />
      <Text style={styles.rangeLabel}>{label}</Text>
      <Text style={styles.rangeValue}>{range}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Hero
  heroCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroEmoji: {
    fontSize: 24,
  },
  heroScore: {
    fontSize: 56,
    fontWeight: Typography.weights.bold,
    lineHeight: 60,
  },
  heroMax: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  trendIcon: {
    fontSize: Typography.sizes.lg,
    marginRight: Spacing.xs,
  },
  trendText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  // History
  historyCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  historyTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    gap: Spacing.xs,
  },
  sparkBar: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sparkBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  sparkLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  // Next level
  nextLevelCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
    backgroundColor: Tints.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  nextLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextLevelIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  nextLevelTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  nextLevelSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  // Section
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.base,
  },
  // Component card
  componentCard: {
    marginBottom: Spacing.base,
  },
  compHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  compIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  compTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compName: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  compWeight: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
  },
  compDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  compScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  compScoreValue: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
  },
  compScoreMax: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  compScoreBadge: {
    marginLeft: 'auto',
  },
  compDetails: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  // Tips
  tipsContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  tipsHeader: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  tipRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  tipBullet: {
    color: Colors.primary,
    marginRight: 6,
    fontWeight: Typography.weights.bold,
  },
  tipItem: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * 1.4,
  },
  // Explain
  explainCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.gray50,
  },
  explainTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  explainText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sizes.sm * 1.6,
    marginBottom: Spacing.base,
  },
  scoreRanges: {
    marginTop: Spacing.sm,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rangeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  rangeLabel: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  rangeValue: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.semiBold,
  },
});
