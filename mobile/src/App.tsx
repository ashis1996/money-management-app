import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';

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
      <Text style={[styles.tabIconText, focused && styles.tabIconFocused]}>
        {icons[label] || '📍'}
      </Text>
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
        tabBarInactiveTintColor: Colors.gray400,
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

export default function App() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingIcon}>💰</Text>
        <Text style={styles.loadingTitle}>MoneyMind</Text>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.lg }} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer ref={navigationRef}>
          <StatusBar style="auto" />
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
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 8,
    paddingTop: 8,
    height: 60,
  },
  tabBarLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
  },
});
