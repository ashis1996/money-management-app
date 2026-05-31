'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { goalsApi } from '@/lib/api';
import type { Goal } from '@/types';
import { QK } from './queryKeys';

export function useGoals(includeCompleted = true) {
  return useQuery({
    queryKey: QK.goals({ includeCompleted }),
    queryFn: async () => (await goalsApi.getAll({ includeCompleted })).data,
  });
}

export function useGoalsSummary() {
  return useQuery({
    queryKey: ['goals', 'summary'] as const,
    queryFn: async () => (await goalsApi.getSummary()).data,
  });
}

function useInvalidateGoalsScope() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['goals'] });
    qc.invalidateQueries({ queryKey: QK.dashboard });
  };
}

export function useCreateGoal() {
  const invalidate = useInvalidateGoalsScope();
  return useMutation({
    mutationFn: (data: Parameters<typeof goalsApi.create>[0]) => goalsApi.create(data),
    onSuccess: invalidate,
  });
}

export function useUpdateGoal() {
  const invalidate = useInvalidateGoalsScope();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Goal> }) => goalsApi.update(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteGoal() {
  const invalidate = useInvalidateGoalsScope();
  return useMutation({
    mutationFn: (id: string) => goalsApi.delete(id),
    onSuccess: invalidate,
  });
}

export function useContributeGoal() {
  const invalidate = useInvalidateGoalsScope();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      goalsApi.contribute(id, amount),
    onSuccess: invalidate,
  });
}
