import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../services/api';
import { queryKeys } from './queryKeys';

export function useHealthScore() {
  return useQuery({
    queryKey: queryKeys.ai.healthScore,
    queryFn: async () => {
      const res = await aiApi.getHealthScore();
      return res.data;
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h
  });
}

export function useMoneyLeaks() {
  return useQuery({
    queryKey: queryKeys.ai.leaks,
    queryFn: async () => {
      const res = await aiApi.detectLeaks();
      return res.data;
    },
    staleTime: 60 * 60 * 1000, // 1h
  });
}

export function useArchetype() {
  return useQuery({
    queryKey: queryKeys.ai.archetype,
    queryFn: async () => {
      const res = await aiApi.determineArchetype();
      return res.data;
    },
    staleTime: 7 * 24 * 60 * 60 * 1000, // weekly
  });
}

export function useBehaviorAnalysis() {
  return useQuery({
    queryKey: queryKeys.ai.behavior,
    queryFn: async () => {
      const res = await aiApi.analyzeBehavior();
      return res.data;
    },
  });
}

export function usePersonalizedDashboard() {
  return useQuery({
    queryKey: queryKeys.ai.dashboard,
    queryFn: async () => {
      const res = await aiApi.getPersonalizedDashboard();
      return res.data;
    },
  });
}

export function useAskAi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      query,
      context,
    }: {
      query: string;
      context?: any;
    }) => {
      const res = await aiApi.ask(query, context);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ai.dashboard }),
  });
}
