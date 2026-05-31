/**
 * MoneyMind design tokens — React Native scaffold.
 *
 * This file is the reference implementation of the tokens defined in
 * `tokens.yaml`. During Phase 2 of the implementation plan, the existing
 * `mobile/src/styles/theme.ts` should be replaced with these values.
 *
 * Why a hand-written scaffold instead of a generator?
 *   - Tokens won't change every day, so a build-step is overkill.
 *   - Hand-written gives us proper TS types (`as const`) for autocompletion
 *     and exhaustiveness checks at every consumption site.
 */

export const Colors = {
  // Material 3 surface roles
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
  inverseSurface: '#dce2f7',
  inverseOnSurface: '#293040',

  outline: '#909096',
  outlineVariant: '#46464c',

  // M3 colour roles
  primary: '#c3c6d4',
  onPrimary: '#2c303b',
  primaryContainer: '#0b0f19',
  onPrimaryContainer: '#787b88',
  inversePrimary: '#5a5e6a',
  secondary: '#adc6ff',
  onSecondary: '#002e6a',
  secondaryContainer: '#0566d9',
  onSecondaryContainer: '#e6ecff',
  tertiary: '#2fd9f4',
  onTertiary: '#00363e',
  tertiaryContainer: '#001216',
  onTertiaryContainer: '#00889b',

  // Brand accents (semantic)
  accentPrimary: '#3B82F6',
  accentAi: '#22D3EE',
  accentSuccess: '#10B981',
  accentWarning: '#fbbf24',
  accentError: '#ffb4ab',

  background: '#0c1322',
  onBackground: '#dce2f7',

  // Helpers expressed as RGBA strings for direct use in styles.
  borderDefault: 'rgba(255, 255, 255, 0.06)',
  borderGlass: 'rgba(255, 255, 255, 0.08)',
  pressScrim: 'rgba(255, 255, 255, 0.16)',
  glassTint60: 'rgba(25, 31, 47, 0.60)',
  modalTint80: 'rgba(46, 53, 69, 0.80)',
} as const;

export const Gradients = {
  ai: { colors: ['#22D3EE', '#3B82F6'] as const, angle: 135 },
  heroCard: { colors: ['#232a3a', '#191f2f'] as const, angle: 180 },
  heroGlow: '#3B82F6',
} as const;

/**
 * Mobile typography scale. Values are mobile-sized; consumers using
 * react-native should pull `size` and `lineHeight` directly into the
 * StyleSheet.
 */
export const Typography = {
  family: 'Inter',
  // Loaded via expo-font in App.tsx during Phase 2.
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  } as const,
  scale: {
    'display-xl':   { size: 48, lineHeight: 52, weight: '700', tracking: -1.92 }, // -0.04 * 48
    'display-lg':   { size: 40, lineHeight: 44, weight: '700', tracking: -1.20 },
    'headline-lg':  { size: 28, lineHeight: 34, weight: '600', tracking: -0.56 },
    'headline-md':  { size: 22, lineHeight: 28, weight: '600', tracking: -0.33 },
    'headline-sm':  { size: 18, lineHeight: 25, weight: '600', tracking: -0.18 },
    'body-lg':      { size: 16, lineHeight: 26, weight: '400', tracking: 0 },
    'body-md':      { size: 15, lineHeight: 24, weight: '400', tracking: 0 },
    'body-sm':      { size: 13, lineHeight: 20, weight: '400', tracking: 0 },
    'label-md':     { size: 13, lineHeight: 13, weight: '500', tracking: 0.26 },
    'label-sm':     { size: 11, lineHeight: 11, weight: '500', tracking: 0.44, transform: 'uppercase' as const },
    'mono-data':    { size: 14, lineHeight: 14, weight: '500', tracking: 0.70 },
  },
} as const;

export const Spacing = {
  unit: 4,
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
  s12: 48,
  s16: 64,
  marginMobile: 20,
  gutterMobile: 16,
} as const;

export const Radius = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/** Drop-shadow recipes. Note: most cards do NOT use shadows; only modals do. */
export const Elevation = {
  modal: {
    // RN uses `shadow*` props. The blur+offset values approximate the
    // CSS recipe; final tuning happens during Phase 3.
    shadowColor: Gradients.heroGlow, // Electric Blue
    shadowOpacity: 0.20,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 30 },
    elevation: 24, // Android
  },
} as const;

export const Motion = {
  tap: { inMs: 80, outMs: 200, dampingSpring: 20, scale: 0.98 },
  snappy: { ms: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  soft: { ms: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  ambient: { ms: 1200, easing: 'ease-in-out' },
  stroke: { ms: 4000, easing: 'linear' },
} as const;

export const ZIndex = {
  base: 0,
  raised: 10,
  sticky: 50,
  drawer: 100,
  modal: 200,
  toast: 300,
  aiOrb: 400,
} as const;

export const Theme = {
  Colors,
  Gradients,
  Typography,
  Spacing,
  Radius,
  Elevation,
  Motion,
  ZIndex,
} as const;

export type ThemeShape = typeof Theme;
