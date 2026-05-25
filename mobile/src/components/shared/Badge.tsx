import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../styles/theme';

type Variant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'gray';

interface BadgeProps {
  text: string;
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: string;
}

const variantColors: Record<Variant, { bg: string; text: string }> = {
  primary: { bg: '#EEF2FF', text: Colors.primary },
  success: { bg: '#D1FAE5', text: '#065F46' },
  warning: { bg: '#FEF3C7', text: '#92400E' },
  error: { bg: '#FEE2E2', text: '#991B1B' },
  info: { bg: '#DBEAFE', text: '#1E40AF' },
  gray: { bg: Colors.gray100, text: Colors.gray700 },
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
