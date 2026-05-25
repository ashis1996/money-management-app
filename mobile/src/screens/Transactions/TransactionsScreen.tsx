import React, { useState } from 'react';
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
import { transactionsApi } from '@/services/api';
import { Transaction } from '@/types';

const CATEGORY_ICONS: Record<string, string> = {
  FOOD_DINING: '🍔',
  SHOPPING: '🛍️',
  TRANSPORT: '🚗',
  ENTERTAINMENT: '🎬',
  BILLS_UTILITIES: '📱',
  HEALTHCARE: '🏥',
  SUBSCRIPTION: '🔄',
  ATM: '🏧',
  TRANSFER: '💸',
  INCOME: '💰',
  OTHER: '📦',
};

export function TransactionsScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: transactions, isLoading, refetch } = useQuery({
    queryKey: ['transactions', selectedCategory],
    queryFn: async () => {
      const response = await transactionsApi.getAll({
        category: selectedCategory || undefined,
      });
      return response.data as Transaction[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['transaction-categories'],
    queryFn: async () => {
      const response = await transactionsApi.getCategories();
      return response.data;
    },
  });

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TouchableOpacity style={styles.transactionItem}>
      <View style={styles.transactionIcon}>
        <Text style={styles.transactionIconText}>
          {CATEGORY_ICONS[item.category] || '📦'}
        </Text>
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionMerchant}>
          {item.merchant || item.description || 'Unknown'}
        </Text>
        <Text style={styles.transactionCategory}>{item.category?.replace(/_/g, ' ')}</Text>
      </View>
      <View style={styles.transactionAmountContainer}>
        <Text
          style={[
            styles.transactionAmount,
            item.type === 'CREDIT' ? styles.credit : styles.debit,
          ]}
        >
          {item.type === 'CREDIT' ? '+' : '-'}₹{item.amount.toLocaleString()}
        </Text>
        <Text style={styles.transactionDate}>
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const groupedTransactions = transactions?.reduce((acc, tx) => {
    const date = new Date(tx.date).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  if (isLoading && !transactions) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text
            style={[styles.filterChipText, !selectedCategory && styles.filterChipTextActive]}
          >
            All
          </Text>
        </TouchableOpacity>
        {categories?.map((cat: any) => (
          <TouchableOpacity
            key={cat.category}
            style={[styles.filterChip, selectedCategory === cat.category && styles.filterChipActive]}
            onPress={() => setSelectedCategory(cat.category)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedCategory === cat.category && styles.filterChipTextActive,
              ]}
            >
              {cat.category.replace(/_/g, ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions List */}
      <FlatList
        data={transactions || []}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>
              Your transactions will appear here once you start spending
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#4F46E5',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionIconText: {
    fontSize: 24,
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionMerchant: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  transactionCategory: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  credit: {
    color: '#10B981',
  },
  debit: {
    color: '#1F2937',
  },
  transactionDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
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
