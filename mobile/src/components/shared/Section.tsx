import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, Typography, Spacing, fontFamilyForWeight } from '../../styles/theme';

interface SectionProps {
  title: string;
  subtitle?: string;
  /** Right-aligned text affordance ("See all" etc.). */
  actionLabel?: string;
  onActionPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When true, the title uses the AI cyan colour. Use sparingly. */
  highlightTitle?: boolean;
}

/**
 * Section — header (`headline-md`) + optional subtitle + optional
 * right-aligned action + body. Replaces ad-hoc per-screen
 * "title row" implementations.
 */
export function Section({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  children,
  style,
  highlightTitle = false,
}: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.header}>
        <View style={styles.titleColumn}>
          <Text style={[styles.title, highlightTitle && { color: Colors.accentAi }]}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {actionLabel && (
          <TouchableOpacity
            onPress={onActionPress}
            accessibilityRole="link"
            accessibilityLabel={actionLabel}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Text style={styles.action}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  titleColumn: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  title: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  action: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    fontFamily: fontFamilyForWeight(Typography.weights.medium),
    color: Colors.accentPrimary,
    letterSpacing: 0.1,
  },
});
