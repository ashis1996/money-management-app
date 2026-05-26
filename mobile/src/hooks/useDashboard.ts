import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/api';
import { queryKeys } from './queryKeys';

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () => {
      const res = await dashboardApi.getStats();
      return res.data;
    },
  });
}
