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
  },
  elevated: {
    ...Shadows.base,
  },
  outlined: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  flat: {
    backgroundColor: Colors.gray50,
  },
});
