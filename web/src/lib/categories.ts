import {
  Utensils,
  ShoppingBag,
  Car,
  Clapperboard,
  Zap,
  Pill,
  Repeat,
  Package,
  type LucideIcon,
} from 'lucide-react';

/**
 * Transaction-category vocabulary shared across web screens.
 *
 * Mirrors mobile/src/screens/Transactions/AddTransactionScreen so the
 * two surfaces look like the same product. Keep these in sync — when
 * the backend adds a new category, both lists need an entry.
 */
export interface CategoryOption {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Saturated palette colour. Tinted at 22% / 44% for bg/border. */
  color: string;
}

export const CATEGORIES: CategoryOption[] = [
  { id: 'food', label: 'Food', icon: Utensils, color: '#EF4444' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#A78BFA' },
  { id: 'transport', label: 'Transport', icon: Car, color: '#3B82F6' },
  { id: 'entertainment', label: 'Entertainment', icon: Clapperboard, color: '#F472B6' },
  { id: 'bills', label: 'Bills', icon: Zap, color: '#fbbf24' },
  { id: 'health', label: 'Health', icon: Pill, color: '#10B981' },
  { id: 'subscription', label: 'Subscription', icon: Repeat, color: '#818CF8' },
  { id: 'other', label: 'Other', icon: Package, color: '#909096' },
];

const FALLBACK = CATEGORIES[CATEGORIES.length - 1];

export function categoryFor(id: string | undefined): CategoryOption {
  if (!id) return FALLBACK;
  return CATEGORIES.find((c) => c.id === id) ?? FALLBACK;
}

/**
 * Deterministic palette pick for per-merchant glyph backgrounds.
 * Used by transaction rows so different merchants don't all look the
 * same. The hash is intentionally tiny — collisions are fine.
 */
const GLYPH_PALETTE = ['#3B82F6', '#22D3EE', '#10B981', '#fbbf24', '#ffb4ab', '#A78BFA', '#F472B6'];
export function glyphColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return GLYPH_PALETTE[Math.abs(hash) % GLYPH_PALETTE.length];
}
