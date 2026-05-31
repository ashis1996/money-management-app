'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '@/lib/api';
import type { Account } from '@/types';
import { QK } from './queryKeys';

export function useAccounts(type?: string) {
  return useQuery({
    queryKey: type ? ([...QK.accounts, { type }] as const) : QK.accounts,
    queryFn: async () => (await accountsApi.getAll(type)).data,
  });
}

export function useNetWorth() {
  return useQuery({
    queryKey: QK.netWorth,
    queryFn: async () => (await accountsApi.getNetWorth()).data,
  });
}

/**
 * Account mutations all touch the same broad cache scope: the account
 * list, the net-worth aggregate, and the dashboard. We invalidate them
 * together rather than precisely because the dollar amounts in each are
 * derived from the same `Account` rows — partial invalidation would
 * leave the dashboard showing stale net worth after a sync.
 */
function useInvalidateAccountsScope() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['accounts'] });
    qc.invalidateQueries({ queryKey: QK.dashboard });
  };
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccountsScope();
  return useMutation({
    mutationFn: (data: Parameters<typeof accountsApi.create>[0]) => accountsApi.create(data),
    onSuccess: invalidate,
  });
}

export function useUpdateAccount() {
  const invalidate = useInvalidateAccountsScope();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Account> }) =>
      accountsApi.update(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteAccount() {
  const invalidate = useInvalidateAccountsScope();
  return useMutation({
    mutationFn: (id: string) => accountsApi.delete(id),
    onSuccess: invalidate,
  });
}

export function useSetPrimaryAccount() {
  const invalidate = useInvalidateAccountsScope();
  return useMutation({
    mutationFn: (id: string) => accountsApi.setPrimary(id),
    onSuccess: invalidate,
  });
}

export function useSyncAccount() {
  const invalidate = useInvalidateAccountsScope();
  return useMutation({
    mutationFn: (id: string) => accountsApi.sync(id),
    onSuccess: invalidate,
  });
}
