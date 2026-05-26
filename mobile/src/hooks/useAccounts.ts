import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '../services/api';
import { queryKeys } from './queryKeys';

export function useAccounts(filters?: {
  accountType?: string;
  isActive?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.accounts.list(filters),
    queryFn: async () => {
      const res = await accountsApi.getAll(filters);
      return res.data;
    },
  });
}

export function useAccount(id?: string) {
  return useQuery({
    queryKey: id ? queryKeys.accounts.detail(id) : ['accounts', 'detail', 'none'],
    enabled: !!id,
    queryFn: async () => {
      const res = await accountsApi.getById(id!);
      return res.data;
    },
  });
}

export function useNetWorth() {
  return useQuery({
    queryKey: queryKeys.accounts.netWorth,
    queryFn: async () => {
      const res = await accountsApi.getNetWorth();
      return res.data;
    },
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await accountsApi.create(data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.accounts.all }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await accountsApi.update(id, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.accounts.all }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await accountsApi.delete(id);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.accounts.all }),
  });
}

export function useSetPrimaryAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await accountsApi.setPrimary(id);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.accounts.all }),
  });
}

export function useRecomputeAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await accountsApi.recompute(id);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.accounts.all }),
  });
}
