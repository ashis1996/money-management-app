'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import type { NotificationPreferences } from '@/types';
import { QK } from './queryKeys';

export function useNotifications(unread?: boolean) {
  return useQuery({
    queryKey: QK.notifications(unread),
    queryFn: async () => (await notificationsApi.getAll(unread)).data,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: QK.notificationsUnreadCount,
    queryFn: async () => (await notificationsApi.getUnreadCount()).data.count,
    // Poll once a minute so the badge in the topbar/sidebar stays roughly
    // fresh without flooding the proxy.
    refetchInterval: 60_000,
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: QK.notificationPreferences,
    queryFn: async () => (await notificationsApi.getPreferences()).data,
  });
}

function useInvalidateNotificationsScope() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotificationsScope();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotificationsScope();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });
}

export function useDeleteNotification() {
  const invalidate = useInvalidateNotificationsScope();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: invalidate,
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: Partial<NotificationPreferences>) =>
      notificationsApi.updatePreferences(prefs),
    // Optimistic-style: write the new value back into the cache so the
    // toggle UI reflects the change immediately. The backend reply
    // replaces it on success.
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: QK.notificationPreferences });
      const prev = qc.getQueryData<NotificationPreferences>(QK.notificationPreferences);
      if (prev) {
        qc.setQueryData<NotificationPreferences>(QK.notificationPreferences, {
          ...prev,
          ...next,
        });
      }
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK.notificationPreferences, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QK.notificationPreferences }),
  });
}
