import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';
import { authApi } from '@/services/api';
import { registerForPushNotifications, unregisterPushToken } from '@/services/push';

/**
 * Auth store.
 *
 * Storage policy (important):
 *
 *   - Access + refresh tokens live ONLY in `expo-secure-store` (Keychain
 *     on iOS, EncryptedSharedPreferences on Android). They are NOT
 *     written to AsyncStorage.
 *
 *   - Non-sensitive UI state (the `user` profile object,
 *     `isAuthenticated` flag) is persisted via Zustand's middleware to
 *     AsyncStorage so the app can render the post-auth UI immediately on
 *     cold start without waiting on the network.
 *
 * Previously this store's `partialize` included `accessToken` and
 * `refreshToken`, which meant the same secrets were duplicated to
 * AsyncStorage in plaintext. On a rooted device that's a free token.
 * The two-tier scheme below keeps the convenience of cold-start
 * rehydration while ensuring secrets only sit in encrypted storage.
 *
 * Cold-start sequence:
 *   1. Zustand rehydrates `user` + `isAuthenticated` from AsyncStorage.
 *   2. `onRehydrateStorage` callback fires `loadUser()`.
 *   3. `loadUser()` reads tokens from SecureStore, populates the
 *      in-memory state, and validates the access token by calling
 *      `authApi.getProfile()`. A 401 wipes the in-memory state and
 *      both stores so the user lands on the login screen.
 */

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

interface AuthState {
  user: User | null;
  // Tokens are runtime-only. They're loaded from SecureStore on cold
  // start in `loadUser()` and never written to the persisted layer.
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  clearError: () => void;
}

/**
 * Drop both tokens from secure storage AND in-memory state.
 * Centralised here so every "log out" path (manual logout, expired
 * token detected during loadUser, etc.) clears the same surface.
 */
async function wipeTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => undefined),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined),
  ]);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      // `isLoading` defaults to `true` so the App splash sticks until
      // `loadUser` finishes its SecureStore round-trip on cold start.
      // Without this, the navigator briefly renders the auth stack
      // before the user is rehydrated — a visible flicker on every
      // launch for already-logged-in users.
      isLoading: true,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login(email, password);
          const { user, accessToken, refreshToken } = response.data;

          await Promise.all([
            SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
            SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
          ]);

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          // Fire-and-forget push registration so a permission prompt /
          // network blip never blocks login.
          registerForPushNotifications().catch(() => undefined);
        } catch (error: any) {
          set({
            error: error?.response?.data?.message || 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      register: async (email, password, name, phone) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register(email, password, name, phone);
          const { user, accessToken, refreshToken } = response.data;

          await Promise.all([
            SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
            SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
          ]);

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });

          registerForPushNotifications().catch(() => undefined);
        } catch (error: any) {
          set({
            error: error?.response?.data?.message || 'Registration failed',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          await unregisterPushToken().catch(() => undefined);
          const { refreshToken } = get();
          if (refreshToken) {
            await authApi.logout(refreshToken).catch(() => undefined);
          }
        } finally {
          await wipeTokens();
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
        }
      },

      /**
       * Cold-start rehydration. Run from `onRehydrateStorage` below.
       *
       * Reads tokens from SecureStore (the ONLY place they live now),
       * populates the in-memory state, and validates the access token
       * by calling `authApi.getProfile()`. The validation call doubles
       * as the trigger for the Axios interceptor's refresh flow if the
       * access token expired while the app was backgrounded.
       *
       * Always clears `isLoading` at the end so the App splash dismisses.
       */
      loadUser: async () => {
        try {
          const [accessToken, refreshToken] = await Promise.all([
            SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
            SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
          ]);

          if (!accessToken) {
            await wipeTokens();
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return;
          }

          set({ accessToken, refreshToken });

          try {
            const response = await authApi.getProfile();
            set({ user: response.data, isAuthenticated: true, isLoading: false });
          } catch {
            await wipeTokens();
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch {
          // SecureStore can throw on first launch on some Androids when
          // the keystore isn't ready. Treat it as logged-out rather
          // than blocking the app forever on a splash.
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      updateUser: (data) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...data } : null,
        }));
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      // AsyncStorage is the right backing store for non-sensitive UI
      // state. Tokens are deliberately excluded via `partialize` below
      // — they ONLY live in SecureStore.
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // PERSISTED (AsyncStorage): the user profile and the auth flag
        // so the post-login UI renders immediately on cold start.
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // NOT PERSISTED (intentionally): accessToken, refreshToken,
        // isLoading, error. Tokens live in SecureStore.
      }),
      onRehydrateStorage: () => (state) => {
        // Fire `loadUser` after AsyncStorage has been read so the
        // Zustand state is consistent before the SecureStore round-trip.
        state?.loadUser();
      },
    },
  ),
);
