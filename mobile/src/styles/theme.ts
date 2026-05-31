/**
 * MoneyMind theme tokens.
 *
 * Phase 2 of the design-system rollout: this file used to define a light
 * palette. It is now the canonical dark-mode palette derived from
 * `.kiro/specs/moneymind-design-system/tokens/theme.mobile.ts`.
 *
 * IMPORTANT — backwards compatibility:
 *   Every legacy export name (Colors.primary, Colors.gray100, Spacing.xs,
 *   Typography.sizes.base, BorderRadius.lg, Shadows.md, ...) is still
 *   present so existing screens keep compiling. Their *values* now point
 *   at MoneyMind dark tokens. The `gray*` ramp is intentionally inverted
 *   from light → dark: `gray50` is the deepest surface, `gray800`+ are
 *   the lightest text colours. Any consumer treating `gray100` as a
 *   "very subtle background" still gets a sensible value (a slightly
 *   raised surface above the page background).
 *
 *   New code should prefer the M3-named tokens (`Colors.surface`,
 *   `Colors.surfaceContainer`, `Colors.onSurface`, ...) or the brand
 *   accents (`Colors.accentPrimary`, `Colors.accentAi`, ...).
 */

// =============================================================
// Internal palette (single source of truth for this file)
// =============================================================
const M3 = {
  surface: '#0c1322',
  surfaceDim: '#0c1322',
  surfaceBright: '#323949',
  surfaceContainerLowest: '#070e1d',
  surfaceContainerLow: '#141b2b',
  surfaceContainer: '#191f2f',
  surfaceContainerHigh: '#232a3a',
  surfaceContainerHighest: '#2e3545',
  surfaceVariant: '#2e3545',

  onSurface: '#dce2f7',
  onSurfaceVariant: '#c6c6cc',

  outline: '#909096',
  outlineVariant: '#46464c',
} as const;

const Brand = {
  primary: '#3B82F6', // Electric Blue — primary CTAs, links
  primaryLight: '#60A5FA',
  primaryDark: '#1E40AF',

  ai: '#22D3EE', // Neon Cyan — AI surfaces
  aiLight: '#67e8f9',

  success: '#10B981',
  successLight: '#34D399',

  warning: '#fbbf24',
  warningLight: '#fcd34d',

  error: '#ffb4ab',
  errorLight: '#ffcdc6',
} as const;

// =============================================================
// withAlpha: produce an rgba() string from a #RRGGBB hex.
// Useful when the theme can't pre-bake every alpha permutation.
// =============================================================
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// =============================================================
// Colors — drop-in compatible with the legacy theme. Every legacy
// key is preserved; values are remapped to MoneyMind dark.
// =============================================================
export const Colors = {
  // ---------- Brand accents ----------
  primary: Brand.primary,
  primaryLight: Brand.primaryLight,
  primaryDark: Brand.primaryDark,

  // ---------- Semantic ----------
  success: Brand.success,
  successLight: Brand.successLight,
  warning: Brand.warning,
  warningLight: Brand.warningLight,
  error: Brand.error,
  errorLight: Brand.errorLight,
  // `info` legacy slot reused for the AI accent so any "info" badge in
  // the current code lights up cyan, matching the design spec.
  info: Brand.ai,
  infoLight: Brand.aiLight,

  // ---------- Neutrals ----------
  white: '#FFFFFF',
  black: '#000000',

  // Inverted gray ramp: low number = deepest surface, high number = lightest text.
  // Most legacy callers used `gray50` as a "barely visible background"
  // and `gray500`+ as text/border colours; both meanings still hold on dark.
  gray50: M3.surfaceContainerLowest, // #070e1d
  gray100: M3.surfaceContainerLow, // #141b2b
  gray200: M3.surfaceContainer, // #191f2f
  gray300: M3.surfaceContainerHigh, // #232a3a
  gray400: M3.surfaceContainerHighest, // #2e3545
  gray500: M3.outlineVariant, // #46464c
  gray600: M3.outline, // #909096
  gray700: M3.onSurfaceVariant, // #c6c6cc
  gray800: M3.onSurface, // #dce2f7
  gray900: '#FFFFFF',

  // ---------- Categories (kept saturated; readable on dark) ----------
  food: '#EF4444',
  transport: '#3B82F6',
  shopping: '#A78BFA',
  entertainment: '#F472B6',
  bills: '#FBBF24',
  health: '#10B981',
  subscription: '#818CF8',
  income: '#34D399',
  other: M3.outline,

  // ---------- Backgrounds ----------
  background: M3.surface, // page bg
  card: M3.surfaceContainer, // default card bg
  inputBg: M3.surfaceContainerLowest, // form input bg

  // ---------- Text ----------
  textPrimary: M3.onSurface,
  textSecondary: M3.onSurfaceVariant,
  textTertiary: M3.outline,
  textInverse: M3.surface, // for the rare "dark text on light fill" case

  // ---------- Borders ----------
  border: M3.outlineVariant,
  borderDark: M3.outline,
  /** 1px inner-card border at white/6%. Use for default cards. */
  borderDefault: 'rgba(255, 255, 255, 0.06)',
  /** 1px glass-card border at white/8%. */
  borderGlass: 'rgba(255, 255, 255, 0.08)',

  // ---------- MoneyMind M3 tokens (additive, prefer these in new code) ----------
  surface: M3.surface,
  surfaceDim: M3.surfaceDim,
  surfaceBright: M3.surfaceBright,
  surfaceContainerLowest: M3.surfaceContainerLowest,
  surfaceContainerLow: M3.surfaceContainerLow,
  surfaceContainer: M3.surfaceContainer,
  surfaceContainerHigh: M3.surfaceContainerHigh,
  surfaceContainerHighest: M3.surfaceContainerHighest,
  surfaceVariant: M3.surfaceVariant,
  onSurface: M3.onSurface,
  onSurfaceVariant: M3.onSurfaceVariant,
  outline: M3.outline,
  outlineVariant: M3.outlineVariant,

  // ---------- Brand accent semantic names (additive) ----------
  accentPrimary: Brand.primary,
  accentAi: Brand.ai,
  accentSuccess: Brand.success,
  accentWarning: Brand.warning,
  accentError: Brand.error,

  /** Glass card formula: 60% surface-container + 30px backdrop blur. */
  glassTint60: 'rgba(25, 31, 47, 0.60)',
} as const;

// =============================================================
// Tints — pre-baked translucent backgrounds + matching borders/text
// for the recurring "tinted card" pattern. Replaces the dozen+ light
// pastel literals scattered across screens.
//
// Convention:
//   <variant>Bg     -> background tint (~12% alpha)
//   <variant>Border -> matching border (~30% alpha)
//   <variant>Text   -> readable foreground colour
// =============================================================
export const Tints = {
  // primary / "info-like"
  primaryBg: withAlpha(Brand.primary, 0.12),
  primaryBorder: withAlpha(Brand.primary, 0.3),
  primaryText: Brand.primary,

  // AI / cyan
  aiBg: withAlpha(Brand.ai, 0.12),
  aiBorder: withAlpha(Brand.ai, 0.3),
  aiText: Brand.ai,

  // success / emerald
  successBg: withAlpha(Brand.success, 0.12),
  successBorder: withAlpha(Brand.success, 0.3),
  successText: Brand.success,

  // warning / amber
  warningBg: withAlpha(Brand.warning, 0.12),
  warningBorder: withAlpha(Brand.warning, 0.3),
  warningText: Brand.warning,

  // error / coral
  errorBg: withAlpha(Brand.error, 0.12),
  errorBorder: withAlpha(Brand.error, 0.3),
  errorText: Brand.error,

  // generic neutral surface lift
  neutralBg: M3.surfaceContainerHigh,
  neutralBorder: 'rgba(255, 255, 255, 0.06)',
  neutralText: M3.onSurface,
} as const;

// =============================================================
// Typography
//
// `Typography.family` is added so the app can switch the default font
// family on once Inter is loaded. The legacy `sizes` and `weights`
// shapes are unchanged for backwards compatibility.
//
// `Typography.fonts` is the canonical mapping from weight to the
// loaded Inter family name (Phase 2 loads all four weights via
// @expo-google-fonts/inter).
// =============================================================
export const Typography = {
  family: 'Inter_400Regular',
  fonts: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  } as const,
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
} as const;

/**
 * Map a fontWeight value to the loaded Inter family. Use this in
 * new components so weight changes pick the matching glyph file
 * instead of relying on synthetic OS bolding.
 */
export function fontFamilyForWeight(
  weight: '400' | '500' | '600' | '700' | string = '400',
): string {
  switch (weight) {
    case '700':
    case 'bold':
      return Typography.fonts.bold;
    case '600':
    case 'semibold':
      return Typography.fonts.semiBold;
    case '500':
    case 'medium':
      return Typography.fonts.medium;
    default:
      return Typography.fonts.regular;
  }
}

// =============================================================
// Spacing / Radius
// =============================================================
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

export const BorderRadius = {
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

// =============================================================
// Shadows
//
// Cards on dark mode shouldn't drop a heavy black shadow — it bleeds
// into the surface and looks muddy. We keep the legacy keys but tune
// down opacity. Modal-level shadow uses an Electric Blue glow per the
// design spec.
// =============================================================
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  /** Modal-level glow shadow (Electric Blue), per design spec. */
  modal: {
    shadowColor: Brand.primary,
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 24,
  },
} as const;

// =============================================================
// Domain palettes
// =============================================================
export const ArchetypeColors: Record<string, string> = {
  SPEND_HEAVY: '#EF4444',
  SAVINGS_FOCUSED: Brand.success,
  CREDIT_USER: Brand.warning,
  SUBSCRIPTION_HEAVY: '#A78BFA',
  BALANCED: Brand.primary,
};

export const HealthScoreColors = {
  excellent: Brand.success,
  good: '#34D399',
  fair: Brand.warning,
  poor: '#F87171',
  critical: '#DC2626',
};

export const PriorityColors = {
  URGENT: Brand.error,
  HIGH: Brand.warning,
  MEDIUM: Brand.primary,
  LOW: M3.outline,
};

// =============================================================
// Gradients (used by AI surfaces)
// =============================================================
export const Gradients = {
  ai: { colors: [Brand.ai, Brand.primary] as const, angle: 135 },
  heroCard: {
    colors: [M3.surfaceContainerHigh, M3.surfaceContainer] as const,
    angle: 180,
  },
  heroGlow: Brand.primary,
} as const;

// =============================================================
// Motion (Phase 3 will consume these in animated components)
// =============================================================
export const Motion = {
  tap: { inMs: 80, outMs: 200, dampingSpring: 20, scale: 0.98 },
  snappy: { ms: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  soft: { ms: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  ambient: { ms: 1200, easing: 'ease-in-out' },
  stroke: { ms: 4000, easing: 'linear' },
} as const;
