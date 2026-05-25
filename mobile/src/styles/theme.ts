/**
 * Theme configuration - Colors, typography, spacing for the app
 */

export const Colors = {
  // Primary
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',

  // Semantic
  success: '#10B981',
  successLight: '#34D399',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  error: '#EF4444',
  errorLight: '#F87171',
  info: '#3B82F6',
  infoLight: '#60A5FA',

  // Neutral
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Categories
  food: '#EF4444',
  transport: '#3B82F6',
  shopping: '#8B5CF6',
  entertainment: '#EC4899',
  bills: '#F59E0B',
  health: '#10B981',
  subscription: '#6366F1',
  income: '#22C55E',
  other: '#6B7280',

  // Backgrounds
  background: '#F9FAFB',
  card: '#FFFFFF',
  inputBg: '#F3F4F6',

  // Text
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Border
  border: '#E5E7EB',
  borderDark: '#D1D5DB',
};

export const Typography = {
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
};

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
};

export const BorderRadius = {
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const ArchetypeColors: Record<string, string> = {
  SPEND_HEAVY: '#EF4444',
  SAVINGS_FOCUSED: '#10B981',
  CREDIT_USER: '#F59E0B',
  SUBSCRIPTION_HEAVY: '#8B5CF6',
  BALANCED: '#4F46E5',
};

export const HealthScoreColors = {
  excellent: '#10B981',
  good: '#22C55E',
  fair: '#F59E0B',
  poor: '#EF4444',
  critical: '#991B1B',
};

export const PriorityColors = {
  URGENT: '#DC2626',
  HIGH: '#F59E0B',
  MEDIUM: '#3B82F6',
  LOW: '#6B7280',
};
