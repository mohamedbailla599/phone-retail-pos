import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { settingsApi, type StoreSettings } from '../api/settings';

interface SettingsStore {
  settings: StoreSettings | null;
  isLoading: boolean;
  error: string | null;
  fetchSettings: () => Promise<StoreSettings | null>;
  updateSettings: (partial: Partial<StoreSettings>) => Promise<StoreSettings>;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: null,
      isLoading: false,
      error: null,

      fetchSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          const data = await settingsApi.getSettings();
          set({ settings: data, isLoading: false });
          return data;
        } catch (err: any) {
          console.error('Failed to load store settings', err);
          set({ error: err.message || 'Erreur chargement paramètres', isLoading: false });
          return get().settings;
        }
      },

      updateSettings: async (partial: Partial<StoreSettings>) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await settingsApi.updateSettings(partial);
          set({ settings: updated, isLoading: false });
          return updated;
        } catch (err: any) {
          set({ isLoading: false, error: err.message || 'Erreur mise à jour paramètres' });
          throw err;
        }
      },
    }),
    {
      name: 'bighrissen-store-settings',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
