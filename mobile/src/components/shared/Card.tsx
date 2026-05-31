import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../styles/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof Spacing | 'none';
  variant?: 'elevated' | 'outlined' | 'flat';
}

/**
 * Default card surface. On dark mode we deliberately avoid a heavy
 * black drop shadow on `elevated` cards — depth is communicated via a
 * 1px white/6% inner border (per design spec). The `Shadows.base`
 * still applies a faint shadow so iOS doesn't lose the lift entirely.
 */
export function Card({
  children,
  onPress,
  onLongPress,
  style,
  padding = 'base',
  variant = 'elevated',
}: CardProps) {
  const cardStyle = [
    styles.base,
    styles[variant],
    padding !== 'none' && { padding: Spacing[padding] },
    style,
  ];

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        style={cardStyle}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  elevated: {
    ...Shadows.base,
  },
  outlined: {
    // `outlined` keeps a slightly stronger border to differentiate
    // from the default elevated style (whose border is intentionally
    // very subtle).
    borderColor: Colors.border,
  },
  flat: {
    backgroundColor: Colors.surfaceContainerLow,
    borderColor: 'transparent',
  },
});
