import React, { useEffect } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, AccessibilityInfo } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { BorderRadius, Motion } from '../../styles/theme';

const AnimatedStop = Animated.createAnimatedComponent(Stop);

interface AnimatedAiBorderProps {
  children: React.ReactNode;
  /** Border radius the children expect. Stroke matches automatically. */
  radius?: number;
  /** Stroke thickness in dp. Spec: 1px. */
  strokeWidth?: number;
  /** Override animation duration; defaults to Motion.stroke (4000ms). */
  durationMs?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Animated 1px gradient border for AI surfaces.
 *
 * RN doesn't expose conic-gradient. Instead of rotating the entire
 * stroke layer (which clips at corners on rounded rectangles), we
 * keep the stroke geometry static and animate the gradient stops
 * themselves so the cyan/blue band travels around the perimeter.
 * Cheap, jank-free, and respects rounded corners exactly.
 *
 * `prefers-reduced-motion` (iOS Reduce Motion / Android animation
 * scale) collapses the animation to a static gradient.
 */
export function AnimatedAiBorder({
  children,
  radius = BorderRadius.lg,
  strokeWidth = 1,
  durationMs = Motion.stroke.ms,
  style,
}: AnimatedAiBorderProps) {
  // `phase` runs 0 -> 1 over `durationMs`, looping forever.
  const phase = useSharedValue(0);

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

      phase.value = withRepeat(
        withTiming(1, {
          duration: durationMs,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimation(phase);
    };
  }, [phase, durationMs]);

  // Three stops keep the cyan/blue band visible at any phase. We
  // shift their offsets in lockstep, wrapping at 1.0 to create a
  // moving gradient.
  const stop1Props = useAnimatedProps(() => ({ offset: String((phase.value + 0.0) % 1) }) as any);
  const stop2Props = useAnimatedProps(() => ({ offset: String((phase.value + 0.5) % 1) }) as any);
  const stop3Props = useAnimatedProps(() => ({ offset: String((phase.value + 1.0) % 1) }) as any);

  return (
    <View style={[styles.wrapper, style]}>
      {/* Stroke layer floats above the children's borders. The Svg
          stretches to the wrapper, so the rectangle is exactly the
          card's footprint. */}
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        // The SVG itself doesn't rotate; we rely on offset animation.
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="aiStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <AnimatedStop animatedProps={stop1Props} stopColor="#22D3EE" />
            <AnimatedStop animatedProps={stop2Props} stopColor="#3B82F6" />
            <AnimatedStop animatedProps={stop3Props} stopColor="#22D3EE" />
          </LinearGradient>
        </Defs>
        <Rect
          x={strokeWidth / 2}
          y={strokeWidth / 2}
          // 100% - strokeWidth on each side keeps the stroke fully
          // inside the bounds (vs straddling them).
          width={`${100}%`}
          height={`${100}%`}
          // SVG `width="100%" - 1` doesn't exist; instead we trim the
          // rect with translate via x/y above and let it slightly
          // overflow — the parent's `overflow: hidden` clips cleanly.
          rx={radius}
          ry={radius}
          fill="transparent"
          stroke="url(#aiStroke)"
          strokeWidth={strokeWidth * 2}
        />
      </Svg>

      <View style={styles.children}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  children: {
    overflow: 'hidden',
  },
});
