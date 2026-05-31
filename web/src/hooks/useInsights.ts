'use client';

import { useQuery } from '@tanstack/react-query';
import { aiApi, insightsApi } from '@/lib/api';
import { QK } from './queryKeys';

export function useSpendingInsights(period?: string) {
  return useQuery({
    queryKey: QK.insightsSpending(period),
    queryFn: async () => (await insightsApi.getSpending(period)).data,
  });
}

export function useBehaviorAnalysis() {
  return useQuery({
    queryKey: ['ai', 'behavior'],
    queryFn: async () => (await aiApi.analyzeBehavior()).data,
    refetchOnWindowFocus: false,
  });
}
