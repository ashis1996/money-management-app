import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle, StyleProp, AccessibilityRole } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Colors, BorderRadius } from '../../styles/theme';

type FeatherName = keyof typeof Feather.glyphMap;
type Variant = 'surface' | 'ghost' | 'primary';
type Size = 'sm' | 'md' | 'lg';

interface IconButtonProps {
  /** Feather icon name (single-stroke geometric, 1.5px style). */
  name: FeatherName;
  onPress?: () => void;
  onLongPress?: () => void;
  size?: Size;
  variant?: Variant;
  /** Tiny dot in the top-right (e.g. unread count). */
  showBadge?: boolean;
  badgeColor?: string;
  accessibilityLabel: string;
  accessibilityRole?: AccessibilityRole;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Override icon colour. Defaults to a sensible per-variant tone. */
  iconColor?: string;
}

const SIZE_MAP: Record<Size, { container: number; icon: number }> = {
  sm: { container: 36, icon: 16 },
  md: { container: 44, icon: 20 },
  lg: { container: 52, icon: 24 },
};

/**
 * IconButton — replaces emoji-as-button with proper Feather glyphs.
 *
 *  - `surface` : filled neutral surface (default chrome icon)
 *  - `ghost`   : transparent, hover-style press feedback
 *  - `primary` : Electric-Blue tinted background, primary-coloured icon
 */
export function IconButton({
  name,
  onPress,
  onLongPress,
  size = 'md',
  variant = 'surface',
  showBadge,
  badgeColor = Colors.error,
  accessibilityLabel,
  accessibilityRole = 'button',
  disabled = false,
  style,
  iconColor,
}: IconButtonProps) {
  const dim = SIZE_MAP[size];

  const scale = useSharedValue(1);
  const handlePressIn = () => {
    scale.value = withTiming(0.94, { duration: 80 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 220 });
  };
  const tapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const containerStyle: ViewStyle = {
    width: dim.container,
    height: dim.container,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.4 : 1,
  };

  const variantStyle: ViewStyle = (() => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'rgba(59, 130, 246, 0.20)',
          borderWidth: 1,
          borderColor: 'rgba(59, 130, 246, 0.40)',
        };
      case 'ghost':
        return { backgroundColor: 'transparent' };
      default:
        return {
          backgroundColor: Colors.surfaceContainer,
          borderWidth: 1,
          borderColor: Colors.borderDefault,
        };
    }
  })();

  const resolvedIconColor =
    iconColor ?? (variant === 'primary' ? Colors.accentPrimary : Colors.textSecondary);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={style}
      hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
    >
      <Animated.View style={[containerStyle, variantStyle, tapStyle]}>
        <Feather name={name} size={dim.icon} color={resolvedIconColor} />
        {showBadge && <View style={[styles.badge, { backgroundColor: badgeColor }]} />}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
