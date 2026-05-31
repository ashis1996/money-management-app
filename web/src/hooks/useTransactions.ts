'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, type TransactionFilters } from '@/lib/api';
import type { Transaction, TransactionType } from '@/types';
import { QK } from './queryKeys';

export function useTransactions(filters?: TransactionFilters) {
  return useQuery({
    queryKey: QK.transactions(filters as Record<string, unknown> | undefined),
    queryFn: async () => (await transactionsApi.getAll(filters)).data,
  });
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: QK.transactionById(id ?? ''),
    queryFn: async () => (await transactionsApi.getById(id!)).data,
    enabled: !!id,
  });
}

/**
 * Create / update / delete invalidate every transaction query plus
 * the dashboard and insights caches, since those derive from transactions.
 * The keys are wide on purpose — when in doubt, refetch.
 */
function useInvalidateTxScope() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: QK.dashboard });
    qc.invalidateQueries({ queryKey: QK.insights });
    qc.invalidateQueries({ queryKey: ['ai'] });
  };
}

export function useCreateTransaction() {
  const invalidate = useInvalidateTxScope();
  return useMutation({
    mutationFn: (data: Partial<Transaction> & { amount: number; type: TransactionType }) =>
      transactionsApi.create(data),
    onSuccess: invalidate,
  });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateTxScope();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Transaction> }) =>
      transactionsApi.update(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateTxScope();
  return useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: invalidate,
  });
}
