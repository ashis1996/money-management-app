import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  StyleProp,
  TouchableOpacity,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  /** Legacy emoji icon. Prefer `leadingIcon`. */
  icon?: string;
  leadingIcon?: React.ReactNode;
  rightIcon?: string;
  trailingIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Form input. Focused state lights up the AI cyan accent and
 * animates a soft outer "bloom" — implemented via a second
 * absolutely-positioned View at low alpha (RN doesn't expose CSS
 * box-shadow on Views, so we approximate the bloom).
 */
export function Input({
  label,
  error,
  hint,
  icon,
  leadingIcon,
  rightIcon,
  trailingIcon,
  onRightIconPress,
  containerStyle,
  style,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const bloom = useSharedValue(0);

  React.useEffect(() => {
    bloom.value = withTiming(focused && !error ? 1 : 0, { duration: 200 });
  }, [focused, error, bloom]);

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloom.value,
    transform: [{ scale: 1 + bloom.value * 0.005 }],
  }));

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View>
        {/* Bloom: a soft cyan halo behind the input, animated in on focus. */}
        <Animated.View pointerEvents="none" style={[styles.bloom, bloomStyle]} />

        <View
          style={[
            styles.inputContainer,
            focused && !error && styles.focused,
            !!error && styles.error,
          ]}
        >
          {leadingIcon ? (
            <View style={styles.iconHost}>{leadingIcon}</View>
          ) : icon ? (
            <Text style={styles.iconLegacy}>{icon}</Text>
          ) : null}
          <TextInput
            style={[styles.input, style]}
            placeholderTextColor={Colors.textTertiary}
            onFocus={(e) => {
              setFocused(true);
              rest.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              rest.onBlur?.(e);
            }}
            {...rest}
          />
          {trailingIcon ? (
            onRightIconPress ? (
              <TouchableOpacity onPress={onRightIconPress} hitSlop={8}>
                <View style={styles.iconHost}>{trailingIcon}</View>
              </TouchableOpacity>
            ) : (
              <View style={styles.iconHost}>{trailingIcon}</View>
            )
          ) : rightIcon ? (
            <TouchableOpacity onPress={onRightIconPress} hitSlop={8}>
              <Text style={styles.iconLegacy}>{rightIcon}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {hint && !error && <Text style={styles.hintText}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.base,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    fontFamily: fontFamilyForWeight(Typography.weights.medium),
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    letterSpacing: 0.2,
  },
  bloom: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: BorderRadius.base + 4,
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.base,
    paddingHorizontal: Spacing.base,
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: Colors.borderDefault,
  },
  focused: {
    borderColor: Colors.accentAi,
  },
  error: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontFamily: fontFamilyForWeight(Typography.weights.regular),
    color: Colors.textPrimary,
    paddingVertical: Spacing.md,
  },
  iconHost: {
    marginHorizontal: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLegacy: {
    fontSize: Typography.sizes.lg,
    color: Colors.textSecondary,
    marginHorizontal: Spacing.xs,
  },
  errorText: {
    fontSize: Typography.sizes.sm,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  hintText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
});
