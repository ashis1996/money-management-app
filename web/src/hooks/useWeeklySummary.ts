'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { weeklySummaryApi } from '@/lib/api';
import { QK } from './queryKeys';

export function useCurrentWeeklySummary() {
  return useQuery({
    queryKey: QK.weeklySummaryCurrent,
    queryFn: async () => (await weeklySummaryApi.getCurrent()).data,
  });
}

export function useWeeklySummaryHistory(limit = 12) {
  return useQuery({
    queryKey: QK.weeklySummaryHistory(limit),
    queryFn: async () => (await weeklySummaryApi.getHistory(limit)).data,
  });
}

export function useGenerateWeeklySummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => weeklySummaryApi.generate(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weekly-summary'] });
    },
  });
}
