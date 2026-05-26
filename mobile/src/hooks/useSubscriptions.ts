import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '../services/api';
import { queryKeys } from './queryKeys';

export function useSubscriptions(status?: string) {
  return useQuery({
    queryKey: queryKeys.subscriptions.list(status),
    queryFn: async () => {
      const res = await subscriptionsApi.getAll(status);
      return res.data;
    },
  });
}

export function useSubscriptionsSummary() {
  return useQuery({
    queryKey: queryKeys.subscriptions.summary,
    queryFn: async () => {
      const res = await subscriptionsApi.getSummary();
      return res.data;
    },
  });
}

export function useUpcomingSubscriptions(days = 7) {
  return useQuery({
    queryKey: queryKeys.subscriptions.upcoming(days),
    queryFn: async () => {
      const res = await subscriptionsApi.getUpcoming(days);
      return res.data;
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await subscriptionsApi.cancel(id);
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all }),
  });
}

export function usePauseSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await subscriptionsApi.pause(id);
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all }),
  });
}

export function useResumeSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await subscriptionsApi.resume(id);
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all }),
  });
}

export function useDetectSubscriptions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await subscriptionsApi.detect();
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all }),
  });
}
