import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../styles/theme';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback. If omitted the default crash card is shown. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Side-effect hook for logging to Sentry/etc. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * App-level error boundary. Catches synchronous render errors in any
 * descendant and displays a friendly retry surface so the user can
 * recover without force-quitting the app.
 *
 * NOTE: Async errors inside event handlers / effects are **not** caught
 * by error boundaries by design — those should be handled inline (e.g.
 * via React Query's `error` state).
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      // Surface in Metro console — easy to spot during development.
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info);
    }
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return <DefaultFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.subtitle}>
        We hit an unexpected error. Tap retry to reload the screen.
      </Text>
      {__DEV__ && (
        <View style={styles.devBox}>
          <Text style={styles.devLabel}>DEV ONLY</Text>
          <Text style={styles.devError}>{error.message}</Text>
          {error.stack ? (
            <Text style={styles.devStack} numberOfLines={20}>
              {error.stack}
            </Text>
          ) : null}
        </View>
      )}
      <Button title="Try again" onPress={onReset} fullWidth />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  icon: {
    fontSize: 56,
    marginBottom: Spacing.base,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    maxWidth: 320,
  },
  devBox: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
  },
  devLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.error,
    marginBottom: Spacing.xs,
  },
  devError: {
    fontSize: Typography.sizes.sm,
    color: Colors.error,
    fontWeight: Typography.weights.semiBold,
    marginBottom: Spacing.sm,
  },
  devStack: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
});
