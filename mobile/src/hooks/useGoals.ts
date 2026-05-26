import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsApi } from '../services/api';
import { queryKeys } from './queryKeys';

export function useGoals(filters?: { isCompleted?: boolean; category?: string }) {
  return useQuery({
    queryKey: queryKeys.goals.list(filters),
    queryFn: async () => {
      const res = await goalsApi.getAll(filters);
      return res.data;
    },
  });
}

export function useGoal(id?: string) {
  return useQuery({
    queryKey: id ? queryKeys.goals.detail(id) : ['goals', 'detail', 'none'],
    enabled: !!id,
    queryFn: async () => {
      const res = await goalsApi.getById(id!);
      return res.data;
    },
  });
}

export function useGoalsSummary() {
  return useQuery({
    queryKey: queryKeys.goals.summary,
    queryFn: async () => {
      const res = await goalsApi.getSummary();
      return res.data;
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await goalsApi.create(data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.goals.all });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await goalsApi.update(id, data);
      return res.data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.goals.all });
      qc.invalidateQueries({ queryKey: queryKeys.goals.detail(vars.id) });
    },
  });
}

export function useContributeGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      amount,
      note,
    }: {
      id: string;
      amount: number;
      note?: string;
    }) => {
      const res = await goalsApi.contribute(id, amount, note);
      return res.data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.goals.all });
      qc.invalidateQueries({ queryKey: queryKeys.goals.detail(vars.id) });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await goalsApi.delete(id);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.goals.all });
    },
  });
}
