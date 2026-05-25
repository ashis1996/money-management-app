import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../styles/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const buttonStyle = [
    styles.base,
    styles[`${variant}Button`],
    styles[`${size}Button`],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ];

  const textStyleCombined = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={buttonStyle}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.white}
          size="small"
        />
      ) : (
        <View style={styles.content}>
          {icon && <Text style={[textStyleCombined, styles.icon]}>{icon}</Text>}
          <Text style={textStyleCombined}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: Spacing.sm,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  // Variants
  primaryButton: { backgroundColor: Colors.primary },
  secondaryButton: { backgroundColor: Colors.gray100 },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghostButton: { backgroundColor: 'transparent' },
  dangerButton: { backgroundColor: Colors.error },
  successButton: { backgroundColor: Colors.success },
  // Sizes
  smButton: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.base },
  mdButton: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
  lgButton: { paddingVertical: Spacing.base, paddingHorizontal: Spacing['2xl'] },
  // Text
  text: { fontWeight: Typography.weights.semiBold },
  primaryText: { color: Colors.white },
  secondaryText: { color: Colors.textPrimary },
  outlineText: { color: Colors.primary },
  ghostText: { color: Colors.primary },
  dangerText: { color: Colors.white },
  successText: { color: Colors.white },
  smText: { fontSize: Typography.sizes.sm },
  mdText: { fontSize: Typography.sizes.base },
  lgText: { fontSize: Typography.sizes.md },
  disabledText: {},
});
