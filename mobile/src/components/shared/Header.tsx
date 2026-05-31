import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Typography, Spacing, BorderRadius, fontFamilyForWeight } from '../../styles/theme';
import { IconButton } from './IconButton';

function LegacyEmojiAction({ emoji, onPress }: { emoji: string; onPress?: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={emoji}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      style={{
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.surfaceContainer,
        borderWidth: 1,
        borderColor: Colors.borderDefault,
      }}
    >
      <Text style={{ fontSize: 18, color: Colors.textPrimary }}>{emoji}</Text>
    </TouchableOpacity>
  );
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /**
   * Optional right-side action. Either pass a Feather icon name (and
   * `onRightPress`) or a fully-rendered React node for richer chrome.
   */
  rightIconName?: React.ComponentProps<typeof IconButton>['name'];
  onRightPress?: () => void;
  rightContent?: React.ReactNode;
  /**
   * Legacy emoji-as-icon prop. Older screens pass a string here (e.g.
   * "✏️") expecting the previous Header. Kept for back-compat so
   * this PR doesn't ripple into every screen file. Phase 4 will
   * migrate these to the proper `rightIconName` prop.
   */
  rightIcon?: string;
  /**
   * When true, the header floats over the screen with a frosted-glass
   * background instead of a solid surface. Use on screens with a hero
   * card directly under the header.
   */
  floating?: boolean;
}

/**
 * Top-of-screen header. Either a solid surface (default) or a frosted
 * glass strip (`floating`) — the latter gives the feeling of content
 * scrolling underneath.
 */
export function Header({
  title,
  subtitle,
  onBack,
  rightIconName,
  onRightPress,
  rightContent,
  rightIcon,
  floating = false,
}: HeaderProps) {
  const right =
    rightContent ??
    (rightIconName ? (
      <IconButton
        name={rightIconName}
        onPress={onRightPress}
        accessibilityLabel={String(rightIconName)}
        size="md"
      />
    ) : rightIcon ? (
      // Legacy: emoji string. Render via a small Pressable so the
      // touch target matches the Feather variant.
      <LegacyEmojiAction emoji={rightIcon} onPress={onRightPress} />
    ) : null);

  const content = (
    <View style={styles.row}>
      <View style={styles.left}>
        {onBack && (
          <IconButton
            name="arrow-left"
            onPress={onBack}
            accessibilityLabel="Go back"
            size="md"
            variant="ghost"
            style={{ marginLeft: -Spacing.sm, marginRight: Spacing.xs }}
          />
        )}
        <View style={styles.titleColumn}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {right}
    </View>
  );

  if (!floating) {
    return <View style={[styles.container, styles.solidBg]}>{content}</View>;
  }

  return (
    <View style={[styles.container, styles.glassWrap]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 80}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glassTint} />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['2xl'] + Spacing.lg,
    paddingBottom: Spacing.base,
  },
  solidBg: {
    backgroundColor: Colors.background,
  },
  glassWrap: {
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 27, 43, 0.55)', // surface-container-low @ 55%
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleColumn: {
    flex: 1,
  },
  title: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    fontFamily: fontFamilyForWeight(Typography.weights.bold),
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
