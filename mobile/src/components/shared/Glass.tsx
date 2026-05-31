import React from 'react';
import { View, StyleSheet, Platform, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius, Spacing } from '../../styles/theme';

type GlassIntensity = 'subtle' | 'default' | 'strong';

interface GlassProps {
  children: React.ReactNode;
  /**
   * Visual intensity of the frosted-glass effect.
   *  - subtle  : 20  — for chrome surfaces (sticky bars, segmented controls)
   *  - default : 40  — for cards, modals
   *  - strong  : 60  — for full-screen sheets
   */
  intensity?: GlassIntensity;
  /** Border radius. Defaults to `BorderRadius.lg` (16px). */
  radius?: number;
  /** Optional padding. Defaults to `base` (16px). Pass `'none'` to opt out. */
  padding?: keyof typeof Spacing | 'none';
  /** Tap handler. Switches the wrapper to a TouchableOpacity. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const intensityMap: Record<GlassIntensity, number> = {
  subtle: 20,
  default: 40,
  strong: 60,
};

/**
 * Frosted-glass surface — the design-system primitive for modals,
 * popovers, and "AI hero" cards.
 *
 * Implementation notes:
 *  - On iOS, expo-blur uses native UIVisualEffectView and looks great.
 *  - On Android, expo-blur falls back to a software emulation that
 *    can be slow on older devices. We keep a `tint="dark"` semi-opaque
 *    background so the surface still reads as "glass" if the blur
 *    fails to render (e.g. when reduce-transparency is enabled).
 *  - Web is unsupported by expo-blur; we render a plain translucent
 *    container with `backdropFilter` via inline style so the look
 *    survives if a screen ever runs in `expo start --web`.
 */
export function Glass({
  children,
  intensity = 'default',
  radius = BorderRadius.lg,
  padding = 'base',
  onPress,
  style,
}: GlassProps) {
  const blurIntensity = intensityMap[intensity];
  const padStyle: ViewStyle | undefined =
    padding !== 'none' ? { padding: Spacing[padding] } : undefined;

  const containerStyle: StyleProp<ViewStyle> = [
    styles.container,
    { borderRadius: radius },
    padStyle,
    style,
  ];

  // Web fallback: plain View with translucent bg + CSS backdrop-filter.
  if (Platform.OS === 'web') {
    // `backdropFilter` is a valid CSS property on RN-Web but isn't in
    // the RN ViewStyle types — cast through `unknown` rather than
    // sprinkling a single ts-expect-error that flips on/off as the RN
    // types evolve.
    const webStyle = [
      containerStyle,
      {
        backgroundColor: Colors.glassTint60,
        backdropFilter: `blur(${blurIntensity}px)`,
        WebkitBackdropFilter: `blur(${blurIntensity}px)`,
        borderWidth: 1,
        borderColor: Colors.borderGlass,
      } as unknown as ViewStyle,
    ];
    if (onPress) {
      return (
        <TouchableOpacity style={webStyle} onPress={onPress} activeOpacity={0.85}>
          {children}
        </TouchableOpacity>
      );
    }
    return <View style={webStyle}>{children}</View>;
  }

  const Wrapper: any = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[containerStyle, styles.fallbackBg, styles.borderGlass, { overflow: 'hidden' }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <BlurView tint="dark" intensity={blurIntensity} style={StyleSheet.absoluteFill} />
      <View style={styles.content}>{children}</View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
  },
  // Visible base color the BlurView floats on top of. Picks up the
  // `glassTint60` formula from the design tokens (60% surface-container).
  fallbackBg: {
    backgroundColor: Colors.glassTint60,
  },
  borderGlass: {
    borderWidth: 1,
    borderColor: Colors.borderGlass,
  },
  content: {
    position: 'relative',
  },
});
