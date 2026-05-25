import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';

import { useAuthStore } from './store/auth.store';
import { Colors, Typography, Spacing } from './styles/theme';
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
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused }) => TabIcon({ label: route.name, focused }),
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingIcon}>💰</Text>
        <Text style={styles.loadingTitle}>MoneyMind</Text>
        <ActivityIndicator
          size="large"
          color={Colors.primary}
          style={{ marginTop: Spacing.lg }}
        />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <StatusBar style="auto" />
        {isAuthenticated ? <MainStack /> : <AuthStack />}
      </NavigationContainer>
    </QueryClientProvider>
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
