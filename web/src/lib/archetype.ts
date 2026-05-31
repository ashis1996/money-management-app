import type { Archetype } from '@/types';

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  SPEND_HEAVY: 'Spend Heavy',
  SAVINGS_FOCUSED: 'Saver',
  CREDIT_USER: 'Credit User',
  SUBSCRIPTION_HEAVY: 'Subscription Heavy',
  BALANCED: 'Balanced',
};

export function getArchetypeLabel(archetype: Archetype | string | undefined): string {
  if (!archetype) return ARCHETYPE_LABELS.BALANCED;
  return ARCHETYPE_LABELS[archetype as Archetype] ?? ARCHETYPE_LABELS.BALANCED;
}

/**
 * Order in which dashboard widgets should appear for each archetype.
 * Mirrors mobile/src/utils/archetype.ts so a user logged into both
 * apps sees their dashboard composed identically.
 */
export const WIDGET_ORDER_BY_ARCHETYPE: Record<Archetype, string[]> = {
  SPEND_HEAVY: ['leaks', 'health', 'actions', 'spending', 'subscriptions', 'goals', 'forecast'],
  SAVINGS_FOCUSED: ['goals', 'health', 'spending', 'forecast', 'actions', 'subscriptions', 'leaks'],
  CREDIT_USER: ['payments', 'health', 'spending', 'leaks', 'actions', 'goals', 'forecast'],
  SUBSCRIPTION_HEAVY: [
    'subscriptions',
    'leaks',
    'actions',
    'health',
    'payments',
    'spending',
    'goals',
  ],
  BALANCED: ['health', 'spending', 'goals', 'actions', 'leaks', 'subscriptions', 'forecast'],
};

export function widgetOrderFor(archetype: Archetype | string | undefined): string[] {
  if (!archetype) return WIDGET_ORDER_BY_ARCHETYPE.BALANCED;
  return WIDGET_ORDER_BY_ARCHETYPE[archetype as Archetype] ?? WIDGET_ORDER_BY_ARCHETYPE.BALANCED;
}

export function getHealthRating(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  return 'Needs Work';
}

/** Maps a score to a CSS variable name for the health colour. */
export function getHealthColorVar(score: number): string {
  if (score >= 85) return 'var(--accent-success)';
  if (score >= 70) return 'var(--accent-success)';
  if (score >= 55) return 'var(--accent-warning)';
  return 'var(--accent-error)';
}
