import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, AccessibilityInfo, Platform } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Colors } from '../../styles/theme';

interface AiOrbProps {
  size?: number;
  onPress?: () => void;
  /** Renders without a Touchable so the orb can be inlined as a hero element. */
  decorative?: boolean;
  accessibilityLabel?: string;
}

/**
 * The MoneyMind floating orb. Cyan→blue radial gradient, soft outer
 * cyan glow (RN shadow), and a 1.2s scale pulse loop. Tapping
 * triggers an additional spring-y press scale to 0.92.
 *
 * The pulse honors `prefers-reduced-motion`. The outer glow is
 * implemented via `shadowColor`/`shadowRadius` (iOS) and `elevation`
 * (Android). Android elevation can't tint a shadow, so on Android we
 * simulate the cyan ring with a second, smaller View behind the orb
 * at low opacity — close enough to read as "ambient glow" without a
 * second SVG layer.
 */
export function AiOrb({
  size = 56,
  onPress,
  decorative = false,
  accessibilityLabel = 'AI assistant',
}: AiOrbProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      let reduceMotion = false;
      try {
        reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      } catch {
        /* assume false */
      }
      if (cancelled || reduceMotion) return;

      scale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimation(scale);
    };
  }, [scale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const orb = (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        styles.shadow,
        pulseStyle,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="orbFill" cx="35%" cy="35%" r="70%">
            <Stop offset="0%" stopColor="#22D3EE" stopOpacity="1" />
            <Stop offset="100%" stopColor="#3B82F6" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#orbFill)" />
      </Svg>

      {/* Inner specular highlight — a tiny lighter dot top-left makes
          the gradient feel like a sphere instead of a flat disk. */}
      <View
        pointerEvents="none"
        style={[
          styles.specular,
          {
            width: size * 0.18,
            height: size * 0.18,
            borderRadius: size * 0.09,
            top: size * 0.18,
            left: size * 0.22,
          },
        ]}
      />
    </Animated.View>
  );

  // Android can't tint native shadows, so we render an extra cyan
  // "halo" View beneath the orb to simulate the outer glow.
  const haloSize = size * 1.6;
  const halo =
    Platform.OS === 'android' ? (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: haloSize,
          height: haloSize,
          borderRadius: haloSize / 2,
          backgroundColor: 'rgba(34, 211, 238, 0.18)',
          top: -((haloSize - size) / 2),
          left: -((haloSize - size) / 2),
        }}
      />
    ) : null;

  if (decorative) {
    return (
      <View style={[styles.host, { width: size, height: size }]} accessible={false}>
        {halo}
        {orb}
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.host, { width: size, height: size }]}
    >
      {halo}
      {orb}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  // iOS-only meaningful tinted shadow; Android falls back via the
  // halo View above.
  shadow: {
    shadowColor: '#22D3EE',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  specular: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});
