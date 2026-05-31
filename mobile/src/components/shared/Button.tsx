import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';

type Variant =
  | 'primary'
  | 'secondary'
  | 'ai'
  | 'ghost'
  | 'destructive'
  // Legacy variant aliases — kept so older screens keep compiling
  // without a screen-by-screen rename. Mapped to the closest spec
  // variant inside the component.
  | 'outline'
  | 'danger'
  | 'success';

type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  /** Legacy emoji icon. New code should pass `leadingIcon` instead. */
  icon?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

const SIZE_STYLES: Record<Size, { height: number; paddingX: number; fontSize: number }> = {
  sm: { height: 32, paddingX: Spacing.md, fontSize: Typography.sizes.sm },
  md: { height: 44, paddingX: Spacing.lg, fontSize: Typography.sizes.base },
  lg: { height: 52, paddingX: Spacing.xl, fontSize: Typography.sizes.md },
};

function resolveVariant(v: Variant): 'primary' | 'secondary' | 'ai' | 'ghost' | 'destructive' {
  switch (v) {
    case 'success':
      // Legacy "success" buttons mapped to primary tone.
      return 'primary';
    case 'danger':
      return 'destructive';
    case 'outline':
      return 'secondary';
    default:
      return v;
  }
}

/**
 * Button — five variants per the design spec, three sizes.
 *
 * Tap motion: scale to 0.98 on press in (80ms), spring back on press
 * out (200ms damping ~20). Replaces the prior TouchableOpacity 0.7
 * dim, which read as "disabled" on dark surfaces.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const v = resolveVariant(variant);
  const sz = SIZE_STYLES[size];

  const scale = useSharedValue(1);
  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 80 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 220 });
  };
  const tapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const containerBase: ViewStyle = {
    height: sz.height,
    paddingHorizontal: sz.paddingX,
    borderRadius: BorderRadius.base,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.4 : 1,
    width: fullWidth ? '100%' : undefined,
  };

  const labelColor = ((): string => {
    switch (v) {
      case 'primary':
        return Colors.white;
      case 'destructive':
        return Colors.error;
      case 'ai':
        return Colors.accentAi;
      default:
        return Colors.textPrimary;
    }
  })();

  const textNode = loading ? (
    <ActivityIndicator color={v === 'primary' ? Colors.white : Colors.primary} size="small" />
  ) : (
    <View style={styles.row}>
      {leadingIcon && <View style={styles.icon}>{leadingIcon}</View>}
      {!leadingIcon && icon && (
        <Text style={[{ color: labelColor, fontSize: sz.fontSize, marginRight: Spacing.sm }]}>
          {icon}
        </Text>
      )}
      <Text
        style={[
          {
            color: labelColor,
            fontSize: sz.fontSize,
            fontWeight: Typography.weights.semiBold,
            fontFamily: fontFamilyForWeight(Typography.weights.semiBold),
            letterSpacing: 0.2,
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
      {trailingIcon && <View style={[styles.icon, styles.trailingIcon]}>{trailingIcon}</View>}
    </View>
  );

  // ----- secondary: glass -----
  if (v === 'secondary') {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        style={style}
      >
        <Animated.View style={[containerBase, styles.secondary, tapStyle]}>
          <BlurView
            intensity={40}
            tint="dark"
            style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.base }]}
          />
          {textNode}
        </Animated.View>
      </Pressable>
    );
  }

  // ----- primary / ai / ghost / destructive -----
  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={style}
    >
      <Animated.View style={[containerBase, styles[v], tapStyle]}>{textNode}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: Spacing.xs,
  },
  trailingIcon: {
    marginRight: 0,
    marginLeft: Spacing.xs,
  },
  primary: {
    backgroundColor: Colors.accentPrimary,
    // 1px inset light border — implemented via a thin outer border at
    // higher alpha. Looks like a subtle inner glow on the press
    // surface.
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  secondary: {
    backgroundColor: 'rgba(35, 42, 58, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden',
  },
  ai: {
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.40)',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  destructive: {
    backgroundColor: 'rgba(255, 180, 171, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 180, 171, 0.40)',
  },
});
