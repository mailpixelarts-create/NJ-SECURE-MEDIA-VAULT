import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  failedAttempts: number;
  isLocked: boolean;
  lockoutUntil: number | null;

  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  resetFailedAttempts: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: false,
  error: null,
  failedAttempts: 0,
  isLocked: false,
  lockoutUntil: null,

  login: async (password: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.auth.login(password);

      if (result) {
        set({
          isAuthenticated: true,
          isLoading: false,
          failedAttempts: 0,
          error: null
        });
        return true;
      }

      set({ isLoading: false });
      return false;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message,
        failedAttempts: get().failedAttempts + 1
      });
      return false;
    }
  },

  logout: async () => {
    try {
      await window.electronAPI.auth.logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
    set({
      isAuthenticated: false,
      error: null
    });
  },

  checkAuth: async () => {
    try {
      const isLoggedIn = await window.electronAPI.auth.isLoggedIn();
      set({ isAuthenticated: isLoggedIn });
    } catch (err) {
      console.error('Check auth failed:', err);
      set({ isAuthenticated: false });
    }
  },

  resetFailedAttempts: () => {
    set({ failedAttempts: 0, error: null });
  }
}));
