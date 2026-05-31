import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Tints } from '../../styles/theme';

type Variant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'ai' | 'gray';

interface BadgeProps {
  text: string;
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: string;
}

/**
 * Badge variant palette.
 *
 * Pre-Phase-2 these were hand-picked light pastels (#EEF2FF, #D1FAE5, ...).
 * They now resolve to the brand `Tints` set, which is dark-mode-correct
 * and shares its formula with the screen-level tinted-card pattern.
 */
const variantColors: Record<Variant, { bg: string; text: string }> = {
  primary: { bg: Tints.primaryBg, text: Tints.primaryText },
  success: { bg: Tints.successBg, text: Tints.successText },
  warning: { bg: Tints.warningBg, text: Tints.warningText },
  error: { bg: Tints.errorBg, text: Tints.errorText },
  info: { bg: Tints.aiBg, text: Tints.aiText },
  ai: { bg: Tints.aiBg, text: Tints.aiText },
  gray: { bg: Tints.neutralBg, text: Colors.onSurfaceVariant },
};

export function Badge({ text, variant = 'primary', size = 'md', icon }: BadgeProps) {
  const colors = variantColors[variant];

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' ? styles.smallBadge : styles.mediumBadge,
        { backgroundColor: colors.bg },
      ]}
    >
      {icon && <Text style={[styles.icon, { color: colors.text }]}>{icon}</Text>}
      <Text
        style={[
          styles.text,
          size === 'sm' ? styles.smallText : styles.mediumText,
          { color: colors.text },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  smallBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  mediumBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  text: {
    fontWeight: Typography.weights.semiBold,
  },
  smallText: { fontSize: Typography.sizes.xs },
  mediumText: { fontSize: Typography.sizes.sm },
  icon: {
    marginRight: 4,
    fontSize: 12,
  },
});
