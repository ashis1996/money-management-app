import type { Archetype } from '../types';

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  SPEND_HEAVY: '💸 Spend Heavy',
  SAVINGS_FOCUSED: '💰 Saver',
  CREDIT_USER: '💳 Credit User',
  SUBSCRIPTION_HEAVY: '🔄 Subscription Heavy',
  BALANCED: '⚖️ Balanced',
};

export function getArchetypeLabel(archetype: Archetype | string | undefined): string {
  if (!archetype) return ARCHETYPE_LABELS.BALANCED;
  return ARCHETYPE_LABELS[archetype as Archetype] ?? ARCHETYPE_LABELS.BALANCED;
}

/**
 * Order in which dashboard widgets should appear for each archetype.
 * The Home/Dashboard screen consumes this directly; centralising it
 * here also lets the web app share the same logic.
 */
export const WIDGET_ORDER_BY_ARCHETYPE: Record<Archetype, string[]> = {
  SPEND_HEAVY: ['leaks', 'health', 'actions', 'spending', 'subscriptions', 'goals', 'forecast'],
  SAVINGS_FOCUSED: ['goals', 'health', 'spending', 'forecast', 'actions', 'subscriptions', 'leaks'],
  CREDIT_USER: ['payments', 'health', 'spending', 'leaks', 'actions', 'goals', 'forecast'],
  SUBSCRIPTION_HEAVY: ['subscriptions', 'leaks', 'actions', 'health', 'payments', 'spending', 'goals'],
  BALANCED: ['health', 'spending', 'goals', 'actions', 'leaks', 'subscriptions', 'forecast'],
};

export function widgetOrderFor(archetype: Archetype | string | undefined): string[] {
  if (!archetype) return WIDGET_ORDER_BY_ARCHETYPE.BALANCED;
  return (
    WIDGET_ORDER_BY_ARCHETYPE[archetype as Archetype] ??
    WIDGET_ORDER_BY_ARCHETYPE.BALANCED
  );
}
