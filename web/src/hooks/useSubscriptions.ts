'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '@/lib/api';
import type { SubscriptionStatus } from '@/types';
import { QK } from './queryKeys';

export function useSubscriptions(status?: SubscriptionStatus | string) {
  return useQuery({
    queryKey: QK.subscriptions(status),
    queryFn: async () => (await subscriptionsApi.getAll(status)).data,
  });
}

export function useSubscriptionsSummary() {
  return useQuery({
    queryKey: QK.subscriptionsSummary,
    queryFn: async () => (await subscriptionsApi.getSummary()).data,
  });
}

function useInvalidateSubsScope() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['subscriptions'] });
    qc.invalidateQueries({ queryKey: QK.dashboard });
  };
}

export function useCancelSubscription() {
  const invalidate = useInvalidateSubsScope();
  return useMutation({
    mutationFn: (id: string) => subscriptionsApi.cancel(id),
    onSuccess: invalidate,
  });
}

export function usePauseSubscription() {
  const invalidate = useInvalidateSubsScope();
  return useMutation({
    mutationFn: (id: string) => subscriptionsApi.pause(id),
    onSuccess: invalidate,
  });
}

export function useResumeSubscription() {
  const invalidate = useInvalidateSubsScope();
  return useMutation({
    mutationFn: (id: string) => subscriptionsApi.resume(id),
    onSuccess: invalidate,
  });
}

export function useDetectSubscriptions() {
  const invalidate = useInvalidateSubsScope();
  return useMutation({
    mutationFn: () => subscriptionsApi.detect(),
    onSuccess: invalidate,
  });
}
