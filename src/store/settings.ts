import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Settings = {
  devTools: boolean;
  setDevTools: (on: boolean) => void;
};

// Small per-device preferences; localStorage is fine for these (games live in IndexedDB).
export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      devTools: false,
      setDevTools: (devTools) => set({ devTools }),
    }),
    { name: 'icehg-settings' },
  ),
);
