import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { insightsApi } from '@/services/api';

const INSIGHT_ICONS: Record<string, string> = {
  SPENDING_ANALYSIS: '📊',
  TREND: '📈',
  ANOMALY: '⚠️',
  RECOMMENDATION: '💡',
  PREDICTION: '🔮',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
};

export function InsightsScreen() {
  const { data: insights, isLoading, refetch } = useQuery({
    queryKey: ['insights'],
    queryFn: async () => {
      const response = await insightsApi.getAll();
      return response.data;
    },
  });

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const response = await insightsApi.getRecommendations();
      return response.data;
    },
  });

  if (isLoading && !insights) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const spending = insights?.spending;
  const cats = spending?.byCategory || [];

  return (
    <ScrollView style={styles.container}>
      {/* Spending Summary */}
      {spending && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spending Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Spent</Text>
                <Text style={styles.summaryValue}>₹{spending.totalSpent.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={[styles.summaryValue, styles.income]}>
                  ₹{spending.totalIncome.toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Savings</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    spending.netSavings >= 0 ? styles.income : styles.expense,
                  ]}
                >
                  ₹{spending.netSavings.toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={styles.savingsRateContainer}>
              <Text style={styles.savingsRateLabel}>Savings Rate</Text>
              <Text style={styles.savingsRateValue}>{spending.savingsRate.toFixed(1)}%</Text>
            </View>
          </View>
        </View>
      )}

      {/* Category Breakdown */}
      {cats.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By Category</Text>
          {cats.map((cat: any) => (
            <View key={cat.category} style={styles.categoryItem}>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{cat.category.replace(/_/g, ' ')}</Text>
                <Text style={styles.categoryPercentage}>{cat.percentage.toFixed(1)}%</Text>
              </View>
              <View style={styles.categoryBarContainer}>
                <View
                  style={[
                    styles.categoryBar,
                    { width: `${Math.min(cat.percentage, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.categoryAmount}>₹{cat.amount.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Recommendations */}
      {recommendations?.recommendations && recommendations.recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {recommendations.recommendations.map((rec: any) => (
            <TouchableOpacity key={rec.id} style={styles.recommendationCard}>
              <View style={styles.recommendationHeader}>
                <Text style={styles.recommendationIcon}>
                  {INSIGHT_ICONS[rec.type] || '💡'}
                </Text>
                <View
                  style={[
                    styles.priorityBadge,
                    { backgroundColor: PRIORITY_COLORS[rec.priority] || '#6B7280' },
                  ]}
                >
                  <Text style={styles.priorityText}>{rec.priority}</Text>
                </View>
              </View>
              <Text style={styles.recommendationTitle}>{rec.title}</Text>
              <Text style={styles.recommendationDescription}>{rec.description}</Text>
              {rec.potential_savings && (
                <Text style={styles.potentialSavings}>
                  Potential savings: ₹{rec.potential_savings.toLocaleString()}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Top Merchants */}
      {spending?.topMerchants && spending.topMerchants.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Merchants</Text>
          {spending.topMerchants.map((merchant: any, index: number) => (
            <View key={index} style={styles.merchantItem}>
              <View style={styles.merchantRank}>{index + 1}</View>
              <View style={styles.merchantInfo}>
                <Text style={styles.merchantName}>{merchant.merchant}</Text>
                <Text style={styles.merchantCount}>
                  {merchant.transactionCount} transactions
                </Text>
              </View>
              <Text style={styles.merchantAmount}>₹{merchant.amount.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
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
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  summaryValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  income: {
    color: '#10B981',
  },
  expense: {
    color: '#EF4444',
  },
  savingsRateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  savingsRateLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  savingsRateValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  categoryItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  categoryPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  categoryBarContainer: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryBar: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  categoryAmount: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  recommendationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationIcon: {
    fontSize: 24,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  potentialSavings: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 8,
  },
  merchantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  merchantRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  merchantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  merchantCount: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  merchantAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
});
