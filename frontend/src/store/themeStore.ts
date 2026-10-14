import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeStore {
  theme: ThemeMode;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

const getSystemTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyThemeToDom = (resolved: 'dark' | 'light') => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
  }
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      resolvedTheme: 'dark',

      setTheme: (theme: ThemeMode) => {
        const resolved = theme === 'system' ? getSystemTheme() : theme;
        applyThemeToDom(resolved);
        set({ theme, resolvedTheme: resolved });
      },

      toggleTheme: () => {
        const current = get().resolvedTheme;
        const next = current === 'dark' ? 'light' : 'dark';
        get().setTheme(next);
      },

      initTheme: () => {
        const { theme } = get();
        const resolved = theme === 'system' ? getSystemTheme() : theme;
        applyThemeToDom(resolved);
        set({ resolvedTheme: resolved });

        // Listen for OS system theme changes
        if (typeof window !== 'undefined') {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          const listener = (e: MediaQueryListEvent) => {
            if (get().theme === 'system') {
              const newResolved = e.matches ? 'dark' : 'light';
              applyThemeToDom(newResolved);
              set({ resolvedTheme: newResolved });
            }
          };
          mediaQuery.addEventListener('change', listener);
        }
      },
    }),
    {
      name: 'bighrissen-theme',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
