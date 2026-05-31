'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { budgetsApi } from '@/lib/api';
import type { Budget } from '@/types';
import { QK } from './queryKeys';

export function useBudgets(activeOnly = true) {
  return useQuery({
    queryKey: QK.budgets({ activeOnly }),
    queryFn: async () => (await budgetsApi.getAll({ activeOnly })).data,
  });
}

export function useBudgetSummary() {
  return useQuery({
    queryKey: ['budgets', 'summary'] as const,
    queryFn: async () => (await budgetsApi.getSummary()).data,
  });
}

function useInvalidateBudgetScope() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['budgets'] });
    qc.invalidateQueries({ queryKey: QK.dashboard });
  };
}

export function useCreateBudget() {
  const invalidate = useInvalidateBudgetScope();
  return useMutation({
    mutationFn: (data: Parameters<typeof budgetsApi.create>[0]) => budgetsApi.create(data),
    onSuccess: invalidate,
  });
}

export function useUpdateBudget() {
  const invalidate = useInvalidateBudgetScope();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Budget> }) =>
      budgetsApi.update(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteBudget() {
  const invalidate = useInvalidateBudgetScope();
  return useMutation({
    mutationFn: (id: string) => budgetsApi.delete(id),
    onSuccess: invalidate,
  });
}
