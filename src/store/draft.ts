// The game being set up (mode select → create screen). Kept in memory and sessionStorage.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Mode, Pace, PronounKey, QuirkId } from '../../engine';

export type Slot = {
  key: string;
  name: string;
  pronouns: PronounKey;
  district?: number;
  /** 256×256 JPEG data URL. */
  photo?: string;
  /** Optional quirk (everyone is equal without one). */
  quirk?: QuirkId;
  /** Set when this person came from (or was saved to) the contestant pool. */
  poolId?: string;
};

/** Manual relationship edits, keyed "fromKey>toKey". */
export type Overrides = Record<string, number>;
export const pairKey = (from: string, to: string) => `${from}>${to}`;

type Draft = {
  mode: Mode;
  pace: Pace;
  slots: Slot[];
  affinitySeed: number;
  affinityBase: 'random' | 'neutral';
  overrides: Overrides;
  start: (mode: Mode, count: number, pace: Pace) => void;
  update: (key: string, patch: Partial<Slot>) => void;
  clearSlot: (key: string) => void;
  addSlot: () => void;
  removeSlot: (key: string) => void;
  setAll: (slots: Slot[]) => void;
  swap: (a: string, b: string) => void;
  setPair: (a: string, b: string, ab: number, ba: number) => void;
  randomise: () => void;
  neutral: () => void;
};

const key = () => Math.random().toString(36).slice(2, 10);
const seed = () => (Math.floor(Math.random() * 2 ** 31) || 1) >>> 0;
const empty = (district?: number): Slot => ({ key: key(), name: '', pronouns: 'they', ...(district ? { district } : {}) });

/** Overrides that mention a slot key are dropped when that slot is cleared or removed. */
const without = (o: Overrides, k: string) => Object.fromEntries(Object.entries(o).filter(([p]) => !p.split('>').includes(k)));

export const useDraft = create<Draft>()(
  persist(
    (set) => ({
      mode: 'classic',
      pace: 'standard',
      slots: [],
      affinitySeed: seed(),
      affinityBase: 'random',
      overrides: {},
      start: (mode, count, pace) =>
        set({
          mode,
          pace,
          affinitySeed: seed(),
          affinityBase: 'random',
          overrides: {},
          slots: mode === 'classic' ? Array.from({ length: 24 }, (_, i) => empty(Math.floor(i / 2) + 1)) : Array.from({ length: count }, () => empty()),
        }),
      update: (k, patch) => set((s) => ({ slots: s.slots.map((x) => (x.key === k ? { ...x, ...patch } : x)) })),
      // A cleared slot gets a fresh key, so it's a new person as far as relationships go.
      clearSlot: (k) => set((s) => ({ slots: s.slots.map((x) => (x.key === k ? empty(x.district) : x)), overrides: without(s.overrides, k) })),
      addSlot: () => set((s) => (s.slots.length >= 48 ? s : { slots: [...s.slots, empty()] })),
      removeSlot: (k) => set((s) => (s.slots.length <= 2 ? s : { slots: s.slots.filter((x) => x.key !== k), overrides: without(s.overrides, k) })),
      setAll: (slots) => set({ slots }),
      // Swap two people; districts stay with the board positions.
      swap: (a, b) =>
        set((s) => {
          const i = s.slots.findIndex((x) => x.key === a);
          const j = s.slots.findIndex((x) => x.key === b);
          if (i < 0 || j < 0 || i === j) return s;
          const next = s.slots.slice();
          const [x, y] = [next[i]!, next[j]!];
          next[i] = { ...y, district: x.district };
          next[j] = { ...x, district: y.district };
          if (!x.district) delete next[i]!.district;
          if (!y.district) delete next[j]!.district;
          return { slots: next };
        }),
      setPair: (a, b, ab, ba) => set((s) => ({ overrides: { ...s.overrides, [pairKey(a, b)]: ab, [pairKey(b, a)]: ba } })),
      randomise: () => set({ affinitySeed: seed(), affinityBase: 'random', overrides: {} }),
      neutral: () => set({ affinityBase: 'neutral', overrides: {} }),
    }),
    {
      name: 'icehg-draft',
      storage: createJSONStorage(() => sessionStorage),
      version: 2,
      migrate: () => ({ slots: [] }) as unknown as Draft,
    },
  ),
);
