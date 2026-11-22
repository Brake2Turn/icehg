import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Pace } from '../../engine';

type Settings = {
  defaultPace: Pace;
  devTools: boolean;
  setDefaultPace: (p: Pace) => void;
  setDevTools: (on: boolean) => void;
};

// Small per-device preferences; localStorage is fine for these (games live in IndexedDB).
export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      defaultPace: 'standard',
      devTools: false,
      setDefaultPace: (defaultPace) => set({ defaultPace }),
      setDevTools: (devTools) => set({ devTools }),
    }),
    { name: 'icehg-settings' },
  ),
);
