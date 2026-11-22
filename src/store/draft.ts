// The game being set up (mode select → create screen). Kept in memory and sessionStorage.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Mode, Pace, PronounKey } from '../../engine';

export type Slot = { key: string; name: string; pronouns: PronounKey; district?: number };

type Draft = {
  mode: Mode;
  pace: Pace;
  slots: Slot[];
  start: (mode: Mode, count: number, pace: Pace) => void;
  update: (key: string, patch: Partial<Slot>) => void;
  addSlot: () => void;
  removeSlot: (key: string) => void;
  setAll: (slots: Slot[]) => void;
};

const key = () => Math.random().toString(36).slice(2, 10);

export const useDraft = create<Draft>()(
  persist(
    (set) => ({
      mode: 'classic',
      pace: 'standard',
      slots: [],
      start: (mode, count, pace) =>
        set({
          mode,
          pace,
          slots:
            mode === 'classic'
              ? Array.from({ length: 24 }, (_, i) => ({ key: key(), name: '', pronouns: 'they' as const, district: Math.floor(i / 2) + 1 }))
              : Array.from({ length: count }, () => ({ key: key(), name: '', pronouns: 'they' as const })),
        }),
      update: (k, patch) => set((s) => ({ slots: s.slots.map((x) => (x.key === k ? { ...x, ...patch } : x)) })),
      addSlot: () => set((s) => (s.slots.length >= 48 ? s : { slots: [...s.slots, { key: key(), name: '', pronouns: 'they' }] })),
      removeSlot: (k) => set((s) => (s.slots.length <= 2 ? s : { slots: s.slots.filter((x) => x.key !== k) })),
      setAll: (slots) => set({ slots }),
    }),
    { name: 'icehg-draft', storage: createJSONStorage(() => sessionStorage) },
  ),
);
