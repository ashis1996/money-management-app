'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pushApi, usersApi, type UpdateUserPayload } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

/**
 * Update the current user's profile. Mirrors the local auth store on
 * success so the avatar / greeting in the topbar reflects the change
 * without a round trip.
 */
export function useUpdateProfile() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (data: UpdateUserPayload) => usersApi.update(data),
    onSuccess: (res) => {
      // The backend returns the updated user object inside the standard
      // envelope. We push it into Zustand so the AppShell re-renders.
      if (res?.data) setUser(res.data);
      qc.invalidateQueries({ queryKey: ['users', 'me'] });
    },
  });
}

export function useSendTestPush() {
  return useMutation({
    mutationFn: ({ title, body }: { title?: string; body?: string } = {}) =>
      pushApi.test(title, body),
  });
}
