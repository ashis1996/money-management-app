/**
 * Formatting helpers shared across the app. Centralising this here
 * means we can swap the locale/currency in one place when we add i18n
 * (today everything is INR / en-IN).
 */

export const DEFAULT_LOCALE = 'en-IN';
export const DEFAULT_CURRENCY = 'INR';

export interface FormatCurrencyOptions {
  locale?: string;
  currency?: string;
  /** Show as "1.2k" / "12.3k" / "1.5M" instead of full digits. */
  compact?: boolean;
  /** If true, the number is shown without fractional digits (default true). */
  hideFraction?: boolean;
}

export function formatCurrency(
  amount: number | null | undefined,
  opts: FormatCurrencyOptions = {},
): string {
  const value = Number(amount ?? 0);
  const {
    locale = DEFAULT_LOCALE,
    currency = DEFAULT_CURRENCY,
    compact = false,
    hideFraction = true,
  } = opts;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: hideFraction ? 0 : 2,
      minimumFractionDigits: hideFraction ? 0 : 2,
    }).format(value);
  } catch {
    // Older Hermes builds without ICU fall back to a plain string.
    return `${currency === 'INR' ? '₹' : ''}${value.toLocaleString()}`;
  }
}

export function formatNumber(
  value: number | null | undefined,
  opts: { compact?: boolean; locale?: string } = {},
): string {
  const n = Number(value ?? 0);
  const { compact = false, locale = DEFAULT_LOCALE } = opts;
  try {
    return new Intl.NumberFormat(locale, {
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 2,
    }).format(n);
  } catch {
    return n.toLocaleString();
  }
}

export function formatPercent(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `${Math.round(n)}%`;
}

/** "in 3 days", "in 1 day", "today", "yesterday", "5 days ago" */
export function formatRelativeDays(target: string | Date): string {
  const date = typeof target === 'string' ? new Date(target) : target;
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays > 0) return `in ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

export function formatDate(
  target: string | Date,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  locale = DEFAULT_LOCALE,
): string {
  const date = typeof target === 'string' ? new Date(target) : target;
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(locale, opts).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

export function dayDiff(target: string | Date): number {
  const date = typeof target === 'string' ? new Date(target) : target;
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(
    0,
    Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
}

export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
