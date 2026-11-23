import { affinityLabel, defaultAffinity, type AffinityMatrix } from '../../../engine';
import { pairKey, type Overrides, type Slot } from '../../store/draft';

/** Current feelings on the board: the seeded defaults with manual edits on top. */
export function boardAffinity(slots: Slot[], seed: number, base: 'random' | 'neutral', overrides: Overrides): AffinityMatrix {
  const ids = slots.filter((s) => s.name.trim()).map((s) => s.key);
  const quirks = Object.fromEntries(slots.filter((s) => s.name.trim() && s.quirk).map((s) => [s.key, s.quirk!]));
  const m = defaultAffinity(ids, seed, base, quirks);
  for (const a of ids) for (const b of ids) if (a !== b && pairKey(a, b) in overrides) m[a]![b] = overrides[pairKey(a, b)]!;
  return m;
}

/** Red (hates) → grey (neutral) → green (loyal). */
export function affinityColour(v: number): string {
  const t = Math.min(1, Math.abs(v) / 100);
  const mix = (a: number[], b: number[]) => a.map((x, i) => Math.round(x + (b[i]! - x) * t));
  const grey = [138, 145, 163];
  const [r, g, b] = v < 0 ? mix(grey, [255, 90, 95]) : mix(grey, [95, 211, 141]);
  return `rgb(${r}, ${g}, ${b})`;
}

export { affinityLabel };

export const PRESETS: { name: string; ab: number; ba: number }[] = [
  { name: 'Best friends', ab: 80, ba: 80 },
  { name: 'Allies', ab: 50, ba: 50 },
  { name: 'Rivals', ab: -60, ba: -60 },
  { name: 'Sworn enemies', ab: -90, ba: -90 },
  { name: 'One-sided', ab: 60, ba: -20 },
];
