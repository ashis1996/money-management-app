import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../styles/theme';

interface ProgressBarProps {
  progress: number; // 0-100
  color?: string;
  backgroundColor?: string;
  height?: number;
  style?: ViewStyle;
  /** Disable the leading-edge glow when stacking many bars (perf). */
  showGlow?: boolean;
  animated?: boolean;
}

/**
 * Progress bar — 4px height by default, fully rounded. The leading
 * edge gets a 16px white-at-25% glow lozenge so the bar feels "alive".
 *
 * `progress` is clamped to 0-100. If you have a value/max ratio,
 * compute the percentage at the call-site.
 */
export function ProgressBar({
  progress,
  color = Colors.accentSuccess,
  backgroundColor,
  height = 4,
  style,
  showGlow = true,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={[
        styles.container,
        {
          backgroundColor: backgroundColor ?? 'rgba(70, 70, 76, 0.40)', // outline-variant @ 40%
          height,
          borderRadius: height / 2,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: `${clamped}%`,
            borderRadius: height / 2,
          },
        ]}
      >
        {showGlow && clamped > 2 && (
          <View
            pointerEvents="none"
            style={[
              styles.glow,
              {
                width: 16,
                borderRadius: height / 2,
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  glow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.30)',
  },
});
