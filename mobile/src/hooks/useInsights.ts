import { useQuery } from '@tanstack/react-query';
import { insightsApi } from '../services/api';
import { queryKeys } from './queryKeys';

export function useInsights() {
  return useQuery({
    queryKey: queryKeys.insights.all,
    queryFn: async () => {
      const res = await insightsApi.getAll();
      return res.data;
    },
  });
}

export function useSpendingInsights(period?: string) {
  return useQuery({
    queryKey: queryKeys.insights.spending(period),
    queryFn: async () => {
      const res = await insightsApi.getSpending(period);
      return res.data;
    },
  });
}

export function useRecommendations() {
  return useQuery({
    queryKey: queryKeys.insights.recommendations,
    queryFn: async () => {
      const res = await insightsApi.getRecommendations();
      return res.data;
    },
  });
}

export function usePredictions() {
  return useQuery({
    queryKey: queryKeys.insights.predictions,
    queryFn: async () => {
      const res = await insightsApi.getPredictions();
      return res.data;
    },
  });
}

export function useAnomalies() {
  return useQuery({
    queryKey: queryKeys.insights.anomalies,
    queryFn: async () => {
      const res = await insightsApi.getAnomalies();
      return res.data;
    },
  });
}
