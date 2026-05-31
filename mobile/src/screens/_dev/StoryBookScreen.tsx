/**
 * StoryBookScreen — visual reference for every design-system primitive.
 *
 * Why this exists:
 *   - Designers need a single screen to verify spacing/typography/colour
 *     decisions without poking through real product surfaces (which
 *     mix product logic with primitives).
 *   - When a primitive's API changes, this screen makes the impact
 *     obvious — every variant is rendered side-by-side.
 *   - It is wired into the navigator unconditionally so debug builds
 *     can deeplink to it (`navigation.navigate('StoryBook')`); we
 *     don't gate it behind an env flag because Expo's stripping passes
 *     don't reliably DCE a screen referenced from the stack.
 *
 * Not a Storybook (the npm package). We intentionally avoid that
 * dependency on mobile because it doubles the bundle size and we only
 * need a flat catalogue, not the full add-on ecosystem.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Glass,
  IconButton,
  Input,
  ProgressBar,
  ProgressRing,
  Section,
  Skeleton,
} from '../../components/shared';
import { Colors, Spacing, Typography, Tints } from '../../styles/theme';

export function StoryBookScreen() {
  const [text, setText] = React.useState('');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={styles.title}>Storybook</Text>
      <Text style={styles.subtitle}>
        Every design-system primitive in one place. Use this to spot
        regressions before shipping a token change.
      </Text>

      {/* ============================================================== */}
      <H2>Typography</H2>
      <View style={styles.row}>
        <SwatchType label="display" size={36} weight={Typography.weights.bold} />
        <SwatchType label="2xl" size={24} weight={Typography.weights.semiBold} />
        <SwatchType label="xl" size={20} weight={Typography.weights.semiBold} />
      </View>
      <View style={styles.row}>
        <SwatchType label="lg" size={18} weight={Typography.weights.medium} />
        <SwatchType label="base" size={14} weight={Typography.weights.regular} />
        <SwatchType label="sm" size={12} weight={Typography.weights.regular} />
      </View>

      {/* ============================================================== */}
      <H2>Colour swatches</H2>
      <View style={styles.swatches}>
        <Swatch name="primary" color={Colors.accentPrimary} />
        <Swatch name="ai" color={Colors.accentAi} />
        <Swatch name="success" color={Colors.accentSuccess} />
        <Swatch name="warning" color={Colors.accentWarning} />
        <Swatch name="error" color={Colors.accentError} />
        <Swatch name="surface" color={Colors.surface} border />
        <Swatch name="container" color={Colors.surfaceContainer} border />
        <Swatch name="container-high" color={Colors.surfaceContainerHigh} border />
      </View>

      {/* ============================================================== */}
      <H2>Buttons</H2>
      <View style={styles.row}>
        <Button title="Primary" variant="primary" onPress={() => {}} />
        <Button title="Secondary" variant="secondary" onPress={() => {}} />
      </View>
      <View style={styles.row}>
        <Button title="AI" variant="ai" onPress={() => {}} />
        <Button title="Ghost" variant="ghost" onPress={() => {}} />
        <Button title="Destructive" variant="destructive" onPress={() => {}} />
      </View>
      <View style={styles.row}>
        <Button title="Loading" variant="primary" onPress={() => {}} loading />
        <Button title="Disabled" variant="primary" onPress={() => {}} disabled />
      </View>
      <View style={styles.row}>
        <Button title="Small" variant="primary" size="sm" onPress={() => {}} />
        <Button title="Medium" variant="primary" size="md" onPress={() => {}} />
        <Button title="Large" variant="primary" size="lg" onPress={() => {}} />
      </View>

      {/* ============================================================== */}
      <H2>Icon buttons</H2>
      <View style={styles.row}>
        <IconButton name="heart" accessibilityLabel="Like" onPress={() => {}} />
        <IconButton
          name="mail"
          variant="primary"
          accessibilityLabel="Open mail"
          onPress={() => {}}
        />
        <IconButton
          name="trash-2"
          variant="ghost"
          accessibilityLabel="Delete"
          onPress={() => {}}
          iconColor={Colors.accentError}
        />
        <IconButton
          name="bell"
          accessibilityLabel="Notifications"
          showBadge
          onPress={() => {}}
        />
      </View>

      {/* ============================================================== */}
      <H2>Badges</H2>
      <View style={styles.row}>
        <Badge text="Primary" variant="primary" />
        <Badge text="AI" variant="ai" />
        <Badge text="Success" variant="success" />
        <Badge text="Warning" variant="warning" />
        <Badge text="Error" variant="error" />
        <Badge text="Gray" variant="gray" />
      </View>

      {/* ============================================================== */}
      <H2>Cards</H2>
      <Card>
        <Text style={styles.cardLabel}>Default card</Text>
        <Text style={styles.cardBody}>
          Surface container background, 1px white/6% border, 16px radius.
        </Text>
      </Card>
      <View style={{ height: Spacing.md }} />
      <Card variant="hero">
        <Text style={styles.cardLabel}>Hero card</Text>
        <Text style={styles.cardBody}>
          Gradient surface, used for the dashboard greeting and per-screen
          summary stats.
        </Text>
      </Card>
      <View style={{ height: Spacing.md }} />
      <Card variant="ai">
        <Text style={[styles.cardLabel, { color: Colors.accentAi }]}>AI card</Text>
        <Text style={styles.cardBody}>
          Animated cyan border + matching icon — only for AI surfaces.
        </Text>
      </Card>
      <View style={{ height: Spacing.md }} />
      <Glass>
        <Text style={styles.cardLabel}>Glass</Text>
        <Text style={styles.cardBody}>
          Frosted-glass background; layers above hero gradients.
        </Text>
      </Glass>

      {/* ============================================================== */}
      <H2>Progress</H2>
      <View style={styles.row}>
        <ProgressRing progress={72} size={88} color={Colors.accentSuccess} />
        <ProgressRing progress={45} size={88} color={Colors.accentWarning} />
        <ProgressRing progress={12} size={88} color={Colors.accentError} />
      </View>
      <View style={{ height: Spacing.md }} />
      <ProgressBar progress={20} color={Colors.accentSuccess} />
      <View style={{ height: Spacing.sm }} />
      <ProgressBar progress={60} color={Colors.accentWarning} />
      <View style={{ height: Spacing.sm }} />
      <ProgressBar progress={95} color={Colors.accentError} />

      {/* ============================================================== */}
      <H2>Inputs</H2>
      <Input
        label="Standard"
        value={text}
        onChangeText={setText}
        placeholder="Type here…"
      />
      <Input label="With error" value="" onChangeText={() => {}} error="Required" />
      <Input
        label="Disabled"
        value="Read only"
        onChangeText={() => {}}
        editable={false}
      />

      {/* ============================================================== */}
      <H2>Skeleton</H2>
      <Skeleton height={20} width="60%" />
      <View style={{ height: Spacing.sm }} />
      <Skeleton height={80} />

      {/* ============================================================== */}
      <H2>Empty state</H2>
      <Section title="No transactions">
        <EmptyState
          title="Nothing yet"
          message="Add your first transaction to start tracking."
          actionLabel="Add"
          onAction={() => Alert.alert('Tapped action')}
        />
      </Section>

      {/* ============================================================== */}
      <H2>Tints (background + border + text)</H2>
      <View style={styles.tintsRow}>
        <TintBox
          label="primary"
          bg={Tints.primaryBg}
          border={Tints.primaryBorder}
          text={Tints.primaryText}
        />
        <TintBox label="ai" bg={Tints.aiBg} border={Tints.aiBorder} text={Tints.aiText} />
        <TintBox
          label="success"
          bg={Tints.successBg}
          border={Tints.successBorder}
          text={Tints.successText}
        />
      </View>
      <View style={styles.tintsRow}>
        <TintBox
          label="warning"
          bg={Tints.warningBg}
          border={Tints.warningBorder}
          text={Tints.warningText}
        />
        <TintBox
          label="error"
          bg={Tints.errorBg}
          border={Tints.errorBorder}
          text={Tints.errorText}
        />
        <TintBox
          label="neutral"
          bg={Tints.neutralBg}
          border={Tints.neutralBorder}
          text={Tints.neutralText}
        />
      </View>

      <View style={{ height: Spacing['4xl'] }} />
    </ScrollView>
  );
}

// ===============================================================
// Local helpers — kept inline so the screen has zero new deps.
// ===============================================================
function H2({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

function Swatch({
  name,
  color,
  border,
}: {
  name: string;
  color: string;
  border?: boolean;
}) {
  return (
    <View style={styles.swatchCol}>
      <View
        style={[
          styles.swatchBox,
          { backgroundColor: color },
          border && { borderWidth: 1, borderColor: Colors.borderDefault },
        ]}
      />
      <Text style={styles.swatchName}>{name}</Text>
    </View>
  );
}

function SwatchType({
  label,
  size,
  weight,
}: {
  label: string;
  size: number;
  weight: '400' | '500' | '600' | '700';
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.swatchName, { marginBottom: 4 }]}>{label}</Text>
      <Text style={{ fontSize: size, fontWeight: weight, color: Colors.onSurface }}>
        Sample
      </Text>
    </View>
  );
}

function TintBox({
  label,
  bg,
  border,
  text,
}: {
  label: string;
  bg: string;
  border: string;
  text: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: Spacing.md,
        borderRadius: 12,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text style={{ color: text, fontWeight: '600', textTransform: 'capitalize' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  subtitle: {
    marginTop: Spacing.xs,
    color: Colors.onSurfaceVariant,
    fontSize: 14,
  },
  h2: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  cardBody: {
    marginTop: Spacing.xs,
    color: Colors.onSurfaceVariant,
    fontSize: 14,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  swatchCol: {
    width: 86,
    alignItems: 'center',
  },
  swatchBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginBottom: 6,
  },
  swatchName: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tintsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
});
