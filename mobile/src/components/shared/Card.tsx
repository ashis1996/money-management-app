import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Colors, Spacing, BorderRadius, Shadows } from '../../styles/theme';
import { Glass } from './Glass';
import { AnimatedAiBorder } from './AnimatedAiBorder';

type Variant = 'default' | 'elevated' | 'outlined' | 'flat' | 'glass' | 'hero' | 'ai';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof Spacing | 'none';
  variant?: Variant;
  /**
   * Hero variant only — toggles the ambient cyan/blue radial halo
   * top-right. Defaults to true; pass `false` for a plain gradient
   * hero card.
   */
  ambientGlow?: boolean;
}

/**
 * Card surface — the workhorse container.
 *
 * Variants:
 *   default / elevated  : surface-container + 1px white/6% inner border + faint shadow
 *   outlined            : same as default with a slightly stronger border
 *   flat                : surface-container-low, no border (used for nested rows)
 *   glass               : frosted glass via Glass primitive (modals, popovers, AI hero)
 *   hero                : gradient bg + 24px radius + optional ambient cyan/blue halo
 *   ai                  : default surface wrapped in an animated 1px AI gradient border
 *
 * onPress / onLongPress switch the wrapper to a TouchableOpacity for
 * the default/elevated/outlined/flat/hero variants. Glass and AI both
 * forward their own touchable behaviour internally where applicable.
 */
export function Card({
  children,
  onPress,
  onLongPress,
  style,
  padding = 'lg',
  variant = 'default',
  ambientGlow = true,
}: CardProps) {
  const padStyle: ViewStyle | false = padding !== 'none' && { padding: Spacing[padding] };

  // ----- Glass: delegate entirely to the Glass primitive -----
  if (variant === 'glass') {
    return (
      <Glass
        radius={BorderRadius.lg}
        padding={padding === 'none' ? 'none' : padding}
        onPress={onPress}
        style={style}
      >
        {children}
      </Glass>
    );
  }

  // ----- AI: animated gradient border wrapping a default surface -----
  if (variant === 'ai') {
    const inner = <View style={[styles.aiInner, padStyle as ViewStyle]}>{children}</View>;
    const wrapped = (
      <AnimatedAiBorder radius={BorderRadius.lg} strokeWidth={1} style={[styles.aiOuter, style]}>
        {inner}
      </AnimatedAiBorder>
    );
    if (onPress || onLongPress) {
      return (
        <TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85}>
          {wrapped}
        </TouchableOpacity>
      );
    }
    return wrapped;
  }

  // ----- Hero: gradient bg + 24px radius + optional radial halo -----
  if (variant === 'hero') {
    const heroBody = (
      <View style={[styles.heroBase, padStyle as ViewStyle, style]}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id="heroBg" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#232a3a" stopOpacity="1" />
              <Stop offset="100%" stopColor="#191f2f" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            rx={BorderRadius.xl}
            ry={BorderRadius.xl}
            fill="url(#heroBg)"
          />
        </Svg>

        {ambientGlow && <View pointerEvents="none" style={styles.heroHalo} />}

        <View style={styles.heroChildren}>{children}</View>
      </View>
    );

    if (onPress || onLongPress) {
      return (
        <TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85}>
          {heroBody}
        </TouchableOpacity>
      );
    }
    return heroBody;
  }

  // ----- Default / elevated / outlined / flat -----
  const cardStyle: StyleProp<ViewStyle> = [
    styles.base,
    variant === 'elevated' && Shadows.base,
    variant === 'outlined' && styles.outlined,
    variant === 'flat' && styles.flat,
    padStyle,
    style,
  ];

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        style={cardStyle}
        activeOpacity={0.85}
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
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  outlined: {
    borderColor: Colors.border,
  },
  flat: {
    backgroundColor: Colors.surfaceContainerLow,
    borderColor: 'transparent',
  },

  // ai variant
  aiOuter: {
    borderRadius: BorderRadius.lg,
  },
  aiInner: {
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card,
  },

  // hero variant
  heroBase: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    minHeight: 80,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  heroHalo: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    // RN can't blur a View, so we lean on layered radial-ish color
    // patches and a low alpha to imply a halo. Looks close enough on
    // both platforms.
    opacity: 0.85,
  },
  heroChildren: {
    position: 'relative',
  },
});
