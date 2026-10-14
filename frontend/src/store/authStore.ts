import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../api/auth';

interface AuthStore {
  isAuthenticated: boolean;
  user: User | null;
  operator: User | null;
  isLoading: boolean;
  setAuth: (user: User | null) => void;
  setOperator: (operator: User | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      operator: null,
      isLoading: true, // Start loading as we need to check session on mount
      setAuth: (user) => set({ isAuthenticated: !!user, user }),
      setOperator: (operator) => set({ operator }),
      setLoading: (loading) => set({ isLoading: loading }),
      clearAuth: () => {
        set({ isAuthenticated: false, user: null, operator: null });
        localStorage.removeItem('auth-storage');
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        operator: state.operator,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

