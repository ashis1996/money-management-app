import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors, Typography, fontFamilyForWeight } from '../../styles/theme';

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  /** Render an AI cyan→blue gradient stroke instead of a solid colour. */
  gradient?: boolean;
  showPercentage?: boolean;
  label?: string;
  children?: React.ReactNode;
}

/**
 * Concentric ring with a track + indicator. Consumers can render a
 * custom centre via `children`; otherwise the percentage and an
 * optional label are shown.
 *
 * `gradient` swaps the indicator for the AI cyan→blue stroke (use on
 * AI surfaces only, e.g. the Health Score card).
 */
export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = Colors.accentSuccess,
  backgroundColor,
  gradient = false,
  showPercentage = true,
  label,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  const stroke = gradient ? 'url(#ringGrad)' : color;
  const trackColor = backgroundColor ?? 'rgba(70, 70, 76, 0.40)';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {gradient && (
          <Defs>
            <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#22D3EE" />
              <Stop offset="100%" stopColor="#3B82F6" />
            </LinearGradient>
          </Defs>
        )}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.content}>
        {children || (
          <>
            {showPercentage && (
              <Text style={[styles.percentage, { color: gradient ? Colors.textPrimary : color }]}>
                {Math.round(clampedProgress)}
              </Text>
            )}
            {label && <Text style={styles.label}>{label}</Text>}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentage: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    letterSpacing: -1,
  },
  label: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
