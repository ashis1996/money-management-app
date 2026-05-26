import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '../services/api';
import { queryKeys } from './queryKeys';

export function useTransactions(filters?: {
  from?: string;
  to?: string;
  category?: string;
  search?: string;
  type?: 'CREDIT' | 'DEBIT';
}) {
  return useQuery({
    queryKey: queryKeys.transactions.list(filters),
    queryFn: async () => {
      const res = await transactionsApi.getAll(filters);
      return res.data;
    },
  });
}

export function useTransaction(id?: string) {
  return useQuery({
    queryKey: id ? queryKeys.transactions.detail(id) : ['transactions', 'detail', 'none'],
    enabled: !!id,
    queryFn: async () => {
      const res = await transactionsApi.getById(id!);
      return res.data;
    },
  });
}

export function useCategoryBreakdown(from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.transactions.categories(from, to),
    queryFn: async () => {
      const res = await transactionsApi.getCategories(from, to);
      return res.data;
    },
  });
}

export function useMonthlyStats(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.transactions.monthlyStats(year, month),
    queryFn: async () => {
      const res = await transactionsApi.getMonthlyStats(year, month);
      return res.data;
    },
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await transactionsApi.create(data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await transactionsApi.update(id, data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({
        queryKey: queryKeys.transactions.detail(variables.id),
      });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await transactionsApi.delete(id);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
