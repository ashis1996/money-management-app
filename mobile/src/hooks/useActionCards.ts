import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { actionCardsApi, aiApi } from '../services/api';
import { queryKeys } from './queryKeys';

export function useActionCards(filters?: {
  status?: string;
  priority?: string;
  type?: string;
}) {
  return useQuery({
    queryKey: queryKeys.actionCards.list(filters),
    queryFn: async () => {
      const res = await actionCardsApi.getAll(filters);
      return res.data;
    },
  });
}

export function useActionCardsSummary() {
  return useQuery({
    queryKey: queryKeys.actionCards.summary,
    queryFn: async () => {
      const res = await actionCardsApi.getSummary();
      return res.data;
    },
  });
}

export function useDismissActionCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await actionCardsApi.dismiss(id);
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.actionCards.all }),
  });
}

export function useCompleteActionCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await actionCardsApi.complete(id);
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.actionCards.all }),
  });
}

export function useGenerateActionCards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await aiApi.generateActionCards();
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.actionCards.all }),
  });
}
