import { create } from 'zustand';
import type { User } from '@/types';
import { authApi } from '@/lib/api';

/**
 * Auth store. The browser never holds a JWT — that's in an httpOnly
 * cookie. This store mirrors the *user shape* so components can render
 * "Hi, Akash" without a network round trip on every navigation.
 *
 * Rehydration happens once on app boot via `bootstrap()`, which calls
 * /api/auth/me to ask the server who the user is. If the server says
 * 401, cookies are cleared server-side and we render the unauthenticated
 * shell. If the server says 200 with a user, we cache it here.
 */
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  hasBootstrapped: boolean;

  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    email: string;
    password: string;
    name?: string;
    phone?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isBootstrapping: false,
  hasBootstrapped: false,

  bootstrap: async () => {
    if (get().hasBootstrapped || get().isBootstrapping) return;
    set({ isBootstrapping: true });
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (res.ok) {
        const body = (await res.json()) as { user: User | null };
        if (body.user) {
          set({
            user: body.user,
            isAuthenticated: true,
          });
        }
      }
    } catch {
      // Treat any error as "not signed in" — the user can still
      // explicitly log in.
    } finally {
      set({ isBootstrapping: false, hasBootstrapped: true });
    }
  },

  login: async (email, password) => {
    const { user } = await authApi.login(email, password);
    set({ user, isAuthenticated: true, hasBootstrapped: true });
    return user;
  },

  register: async (payload) => {
    const { user } = await authApi.register(payload);
    set({ user, isAuthenticated: true, hasBootstrapped: true });
    return user;
  },

  logout: async () => {
    await authApi.logout();
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),
}));
