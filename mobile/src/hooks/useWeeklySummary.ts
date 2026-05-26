import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { weeklySummaryApi } from '../services/api';
import { queryKeys } from './queryKeys';

export function useWeeklySummaryList(limit = 12) {
  return useQuery({
    queryKey: queryKeys.weeklySummary.list(limit),
    queryFn: async () => {
      const res = await weeklySummaryApi.getList(limit);
      return res.data;
    },
  });
}

export function useCurrentWeeklySummary() {
  return useQuery({
    queryKey: queryKeys.weeklySummary.current,
    queryFn: async () => {
      const res = await weeklySummaryApi.getCurrent();
      return res.data;
    },
  });
}

export function useWeeklySummary(id?: string) {
  return useQuery({
    queryKey: id
      ? queryKeys.weeklySummary.detail(id)
      : ['weekly-summary', 'detail', 'none'],
    enabled: !!id,
    queryFn: async () => {
      const res = await weeklySummaryApi.getById(id!);
      return res.data;
    },
  });
}

export function useGenerateWeeklySummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (forDate?: string) => {
      const res = await weeklySummaryApi.generate(forDate);
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.weeklySummary.all }),
  });
}
