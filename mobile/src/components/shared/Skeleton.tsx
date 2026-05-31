import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Colors, BorderRadius } from '../../styles/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: keyof typeof BorderRadius | number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shimmer skeleton. A horizontal gradient slides across the surface
 * over 1.4s, looping forever. Honours `prefers-reduced-motion`.
 *
 * Implementation note: instead of layering a real LinearGradient (which
 * needs `react-native-svg` again), we shift a translucent stripe via
 * `translateX`. Same visual effect at a fraction of the cost.
 */
export function Skeleton({ width = '100%', height = 16, radius = 'sm', style }: SkeletonProps) {
  const x = useSharedValue(-1);

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

      x.value = withRepeat(withTiming(2, { duration: 1400, easing: Easing.linear }), -1, false);
    }
    void start();
    return () => {
      cancelled = true;
      cancelAnimation(x);
    };
  }, [x]);

  // The stripe is sized at 50% of the container's width via styles
  // below; we animate translateX in absolute device-pixels by reading
  // the container width on layout. Until layout has run we keep the
  // stripe at -100% (off-screen left) so it doesn't flash on first
  // paint.
  const containerWidth = useSharedValue(0);
  const stripeStyle = useAnimatedStyle(() => {
    const w = containerWidth.value;
    if (w === 0) return { transform: [{ translateX: -200 }] };
    // x.value sweeps -1 -> 2 over 1.4s; map to translate range
    // [-w/2 .. 2w] so the stripe enters from the left and exits the
    // right edge cleanly.
    const tx = -w * 0.5 + x.value * w;
    return { transform: [{ translateX: tx }] };
  });

  const computedRadius = typeof radius === 'number' ? radius : BorderRadius[radius];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => {
        containerWidth.value = e.nativeEvent.layout.width;
      }}
      style={[
        styles.container,
        {
          width: width as any,
          height: height as any,
          borderRadius: computedRadius,
        },
        style,
      ]}
    >
      <Animated.View style={[styles.stripe, stripeStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceContainer,
    overflow: 'hidden',
  },
  stripe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
});
