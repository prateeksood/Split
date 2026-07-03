import { Platform } from 'react-native';
import { create } from 'zustand';
import { deleteSecureItem, getSecureItem, setSecureItem } from '../services/secureStorage';

const ACCESS_TOKEN_KEY = 'split_access_token';
const REFRESH_TOKEN_KEY = 'split_refresh_token';

// On web, the durable refresh token lives in an httpOnly cookie (not JS-readable),
// so we never persist it to localStorage. Native uses encrypted SecureStore.
const isWeb = Platform.OS === 'web';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string) => Promise<void>;
  clearTokens: () => Promise<void>;
  loadTokens: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  isAuthenticated: false,

  setTokens: async (access, refresh) => {
    await setSecureItem(ACCESS_TOKEN_KEY, access);
    if (!isWeb) await setSecureItem(REFRESH_TOKEN_KEY, refresh);
    set({ accessToken: access, refreshToken: refresh, isAuthenticated: true });
  },

  clearTokens: async () => {
    await deleteSecureItem(ACCESS_TOKEN_KEY);
    await deleteSecureItem(REFRESH_TOKEN_KEY);
    set({ accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  loadTokens: async () => {
    try {
      const access = await getSecureItem(ACCESS_TOKEN_KEY);
      const refresh = await getSecureItem(REFRESH_TOKEN_KEY);
      set({
        accessToken: access,
        refreshToken: refresh,
        isAuthenticated: !!access,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
