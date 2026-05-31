'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi, aiApi, goalsApi, actionCardsApi, subscriptionsApi } from '@/lib/api';
import { QK } from './queryKeys';

export function useDashboard() {
  return useQuery({
    queryKey: QK.dashboard,
    queryFn: async () => (await dashboardApi.getStats()).data,
  });
}

export function useHealthScore() {
  return useQuery({
    queryKey: QK.health,
    queryFn: async () => (await aiApi.getHealthScore()).data,
    // The Python service can be a few hundred ms; don't refetch on
    // window focus or it feels janky.
    refetchOnWindowFocus: false,
  });
}

export function useArchetype() {
  return useQuery({
    queryKey: QK.archetype,
    queryFn: async () => (await aiApi.determineArchetype()).data,
    refetchOnWindowFocus: false,
  });
}

export function useMoneyLeaks() {
  return useQuery({
    queryKey: QK.leaks,
    queryFn: async () => (await aiApi.detectLeaks()).data,
    refetchOnWindowFocus: false,
  });
}

export function useGoals(params?: { isCompleted?: boolean }) {
  return useQuery({
    queryKey: QK.goals(params),
    queryFn: async () => (await goalsApi.getAll(params)).data,
  });
}

export function useActionCards(params?: { status?: string }) {
  return useQuery({
    queryKey: QK.actionCards(params),
    queryFn: async () => (await actionCardsApi.getAll(params)).data,
  });
}

export function useUpcomingSubscriptions(days = 14) {
  return useQuery({
    queryKey: QK.subscriptionsUpcoming(days),
    queryFn: async () => (await subscriptionsApi.getUpcoming(days)).data,
  });
}

export function useActiveSubscriptions() {
  return useQuery({
    queryKey: QK.subscriptions('ACTIVE'),
    queryFn: async () => (await subscriptionsApi.getAll('ACTIVE')).data,
  });
}
