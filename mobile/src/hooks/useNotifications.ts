import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../services/api';
import { queryKeys } from './queryKeys';

export function useNotifications(unread?: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications.list(unread),
    queryFn: async () => {
      const res = await notificationsApi.getAll(unread);
      return res.data;
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () => {
      const res = await notificationsApi.getUnreadCount();
      return res.data?.count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await notificationsApi.markAsRead(id);
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await notificationsApi.markAllAsRead();
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notifications.preferences,
    queryFn: async () => {
      const res = await notificationsApi.getPreferences();
      return res.data;
    },
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await notificationsApi.updatePreferences(data);
      return res.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.notifications.preferences }),
  });
}
