import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetsApi } from '../services/api';
import { queryKeys } from './queryKeys';

export function useBudgets(filters?: { isActive?: boolean; period?: string }) {
  return useQuery({
    queryKey: queryKeys.budgets.list(filters),
    queryFn: async () => {
      const res = await budgetsApi.getAll(filters);
      return res.data;
    },
  });
}

export function useBudget(id?: string) {
  return useQuery({
    queryKey: id ? queryKeys.budgets.detail(id) : ['budgets', 'detail', 'none'],
    enabled: !!id,
    queryFn: async () => {
      const res = await budgetsApi.getById(id!);
      return res.data;
    },
  });
}

export function useBudgetsSummary() {
  return useQuery({
    queryKey: queryKeys.budgets.summary,
    queryFn: async () => {
      const res = await budgetsApi.getSummary();
      return res.data;
    },
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await budgetsApi.create(data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.budgets.all }),
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await budgetsApi.update(id, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.budgets.all }),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await budgetsApi.delete(id);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.budgets.all }),
  });
}
