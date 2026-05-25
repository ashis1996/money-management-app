import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { subscriptionsApi } from '@/services/api';
import { Subscription } from '@/types';

const FREQUENCY_ICONS: Record<string, string> = {
  DAILY: '📅',
  WEEKLY: '📆',
  MONTHLY: '🗓️',
  QUARTERLY: '📊',
  YEARLY: '🎉',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10B981',
  PAUSED: '#F59E0B',
  CANCELLED: '#6B7280',
  EXPIRED: '#EF4444',
};

export function SubscriptionsScreen() {
  const { data: subscriptions, isLoading, refetch } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const response = await subscriptionsApi.getAll('ACTIVE');
      return response.data as Subscription[];
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['subscriptions-summary'],
    queryFn: async () => {
      const response = await subscriptionsApi.getSummary();
      return response.data;
    },
  });

  const renderSubscription = ({ item }: { item: Subscription }) => (
    <TouchableOpacity style={styles.subscriptionItem}>
      <View style={styles.subscriptionIcon}>
        <Text style={styles.subscriptionIconText}>
          {FREQUENCY_ICONS[item.frequency] || '🔄'}
        </Text>
      </View>
      <View style={styles.subscriptionInfo}>
        <Text style={styles.subscriptionName}>{item.name}</Text>
        <Text style={styles.subscriptionMerchant}>{item.merchant}</Text>
        <View style={styles.subscriptionMeta}>
          <Text style={styles.subscriptionFrequency}>
            {item.frequency.toLowerCase()}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: STATUS_COLORS[item.status] || '#6B7280' },
            ]}
          >
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
      </View>
      <View style={styles.subscriptionAmountContainer}>
        <Text style={styles.subscriptionAmount}>₹{item.amount.toLocaleString()}</Text>
        {item.nextBillingDate && (
          <Text style={styles.nextBillingDate}>
            Next: {new Date(item.nextBillingDate).toLocaleDateString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (isLoading && !subscriptions) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Card */}
      {summary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Subscription Overview</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{summary.activeSubscriptions || 0}</Text>
              <Text style={styles.summaryStatLabel}>Active</Text>
            </View>
            <View style={styles.summaryStatDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>
                ₹{summary.totalMonthlySpend?.toLocaleString() || '0'}
              </Text>
              <Text style={styles.summaryStatLabel}>Monthly</Text>
            </View>
          </View>
        </View>
      )}

      {/* Subscriptions List */}
      <FlatList
        data={subscriptions || []}
        renderItem={renderSubscription}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔄</Text>
            <Text style={styles.emptyText}>No subscriptions yet</Text>
            <Text style={styles.emptySubtext}>
              Your recurring payments will be automatically detected
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: '#4F46E5',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  summaryTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  summaryStats: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryStatLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  summaryStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 16,
  },
  listContent: {
    paddingBottom: 16,
  },
  subscriptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
  },
  subscriptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscriptionIconText: {
    fontSize: 24,
  },
  subscriptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  subscriptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  subscriptionMerchant: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  subscriptionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  subscriptionFrequency: {
    fontSize: 12,
    color: '#4F46E5',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  subscriptionAmountContainer: {
    alignItems: 'flex-end',
  },
  subscriptionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  nextBillingDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
});
