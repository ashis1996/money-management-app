import React, { useEffect, useRef } from 'react';
import {
  NavigationContainer,
  NavigationContainerRef,
  DarkTheme as NavDarkTheme,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { Text as RNText, View, StyleSheet, ActivityIndicator } from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { useAuthStore } from './store/auth.store';
import { Colors, Typography, Spacing } from './styles/theme';
import { addNotificationListeners } from './services/push';
import { startSmsAutoCapture } from './services/sms';
import { ErrorBoundary } from './components/shared';
import {
  // Auth
  LoginScreen,
  RegisterScreen,
  OnboardingScreen,
  // Tabs
  HomeScreen,
  TransactionsScreen,
  SubscriptionsScreen,
  InsightsScreen,
  SettingsScreen,
  // Stack
  AddTransactionScreen,
  TransactionDetailScreen,
  BudgetsScreen,
  GoalsScreen,
  AIAssistantScreen,
  MoneyLeaksScreen,
  HealthScoreScreen,
  NotificationsScreen,
  WeeklySummaryScreen,
  AccountsScreen,
  SplitExpenseScreen,
  SmsForwardScreen,
  StoryBookScreen,
} from './screens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const RootStack = createStackNavigator<any>();
const AuthStackNav = createStackNavigator<any>();
const Tab = createBottomTabNavigator<any>();

// =============================================================
// Theme glue for React Navigation
//
// Without this every navigation container falls back to the default
// LIGHT theme, which paints the "card" surface white and fights the
// MoneyMind dark palette wherever a navigator (modal, tab, stack)
// renders chrome of its own.
// =============================================================
const NavigationTheme = {
  ...NavDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    background: Colors.background,
    card: Colors.card,
    text: Colors.textPrimary,
    border: Colors.border,
    primary: Colors.primary,
    notification: Colors.error,
  },
};

// =============================================================
// Push notification deep-linking
// =============================================================

/**
 * Map a notification's `data.type` to a route + params.
 * Backend's notification.service stores actionRoute/actionParams in `data`,
 * so we honour that when present, otherwise fall back to a sensible default.
 */
function notificationDataToRoute(data: any): { route: string; params?: any } | null {
  if (!data) return null;
  if (data.actionRoute && typeof data.actionRoute === 'string') {
    return { route: data.actionRoute, params: data.actionParams };
  }
  switch (data.type) {
    case 'TRANSACTION':
      return data.transactionId
        ? { route: 'TransactionDetail', params: { id: data.transactionId } }
        : { route: 'Transactions' };
    case 'SUBSCRIPTION':
      return { route: 'Subscriptions' };
    case 'BUDGET_ALERT':
      return { route: 'Budgets' };
    case 'INSIGHT':
      return { route: 'Insights' };
    case 'SECURITY':
      return { route: 'Notifications' };
    default:
      return { route: 'Notifications' };
  }
}

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠',
    Transactions: '💳',
    Subscriptions: '🔄',
    Insights: '📊',
    Settings: '⚙️',
  };

  return (
    <View style={styles.tabIcon}>
      <RNText style={[styles.tabIconText, focused && styles.tabIconFocused]}>
        {icons[label] || '📍'}
      </RNText>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: any }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused }: { focused: boolean }) => TabIcon({ label: route.name, focused }),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function MainStack() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: Colors.background },
      }}
    >
      <RootStack.Screen name="Tabs" component={MainTabs} />

      {/* Modal-style stack screens */}
      <RootStack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{ presentation: 'modal', animationEnabled: true }}
      />
      <RootStack.Screen
        name="SplitExpense"
        component={SplitExpenseScreen}
        options={{ presentation: 'modal', animationEnabled: true }}
      />

      {/* Detail screens (push) */}
      <RootStack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
      <RootStack.Screen name="Notifications" component={NotificationsScreen} />
      <RootStack.Screen name="WeeklySummary" component={WeeklySummaryScreen} />
      <RootStack.Screen name="Accounts" component={AccountsScreen} />

      {/* Existing stack screens */}
      <RootStack.Screen name="Budgets" component={BudgetsScreen} />
      <RootStack.Screen name="Goals" component={GoalsScreen} />
      <RootStack.Screen name="AIAssistant" component={AIAssistantScreen} />
      <RootStack.Screen name="MoneyLeaks" component={MoneyLeaksScreen} />
      <RootStack.Screen name="HealthScore" component={HealthScoreScreen} />
      <RootStack.Screen name="SmsForward" component={SmsForwardScreen} />

      {/* Dev-only catalogue screen. Always wired so debug builds can
          deeplink to it (`navigation.navigate('StoryBook')`); not
          surfaced in product navigation. */}
      <RootStack.Screen name="StoryBook" component={StoryBookScreen} />
    </RootStack.Navigator>
  );
}

function AuthStack() {
  return (
    <AuthStackNav.Navigator
      initialRouteName="Onboarding"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: Colors.background },
      }}
    >
      <AuthStackNav.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="Register" component={RegisterScreen} />
    </AuthStackNav.Navigator>
  );
}

// =============================================================
// One-shot side effects: set the system UI bg to MoneyMind surface
// and apply Inter as the default font for every <Text>.
//
// `Text.defaultProps.style` is the canonical RN escape hatch for a
// global text style and is supported on RN 0.73. We apply it once,
// guarded by a module-level flag so a Fast Refresh cycle doesn't
// stack the style array indefinitely.
// =============================================================
SystemUI.setBackgroundColorAsync(Colors.background).catch(() => {
  /* iOS: no-op; this only matters on Android */
});

let textDefaultsApplied = false;
function applyDefaultTextStyle() {
  if (textDefaultsApplied) return;
  const TextAny = RNText as any;
  TextAny.defaultProps = TextAny.defaultProps || {};
  TextAny.defaultProps.allowFontScaling = true;
  TextAny.defaultProps.style = [
    TextAny.defaultProps.style,
    { fontFamily: Typography.fonts.regular, color: Colors.textPrimary },
  ];
  textDefaultsApplied = true;
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Load Inter weights up-front so render-time text doesn't flash
  // a system fallback before swapping. Phase 3 will add per-weight
  // family resolution to component styles.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (fontsLoaded) {
    applyDefaultTextStyle();
  }

  // Push notification taps: navigate to the right screen.
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = addNotificationListeners({
      onResponse: (response) => {
        const data = response.notification.request.content.data;
        const target = notificationDataToRoute(data);
        if (target && navigationRef.current?.isReady()) {
          navigationRef.current.navigate(target.route, target.params);
        }
      },
      onReceived: () => {
        // Foreground: rely on React Query refetch on focus + the
        // notification banner shown by the system.
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      },
    });

    return unsubscribe;
  }, [isAuthenticated]);

  // SMS auto-capture (no-op in Expo Go and on iOS).
  useEffect(() => {
    if (!isAuthenticated) return;
    const stop = startSmsAutoCapture();
    return stop;
  }, [isAuthenticated]);

  if (isLoading || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <RNText style={styles.loadingIcon}>💰</RNText>
        <RNText style={styles.loadingTitle}>MoneyMind</RNText>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.lg }} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer ref={navigationRef} theme={NavigationTheme}>
          <StatusBar style="light" backgroundColor={Colors.background} />
          {isAuthenticated ? <MainStack /> : <AuthStack />}
        </NavigationContainer>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingIcon: {
    fontSize: 64,
    marginBottom: Spacing.base,
  },
  loadingTitle: {
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconText: {
    fontSize: 22,
    opacity: 0.6,
  },
  tabIconFocused: {
    opacity: 1,
  },
  tabBar: {
    backgroundColor: Colors.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    paddingBottom: 8,
    paddingTop: 8,
    height: 60,
  },
  tabBarLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
  },
});
