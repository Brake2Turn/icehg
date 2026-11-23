// Starting affinity (§6.6). Each pair gets its own little dice roll from (seed, pair), so the
// create screen can show the same starting feelings the game will use, and adding or removing
// a slot doesn't reshuffle everyone else's.
import { AFF_RECIPROCITY, AFF_START_SD, QUIRK_EFFECTS } from '../tuning';
import type { QuirkId } from './quirks';
import { Rng } from './rng';

export type AffinityBase = 'random' | 'neutral';
export type AffinityMatrix = Record<string, Record<string, number>>;

export const clampAff = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Default feelings before any manual edits: Normal(0, 25) with reciprocity, or all zero. */
export function defaultAffinity(ids: string[], seed: number, base: AffinityBase = 'random', quirks: Record<string, QuirkId> = {}): AffinityMatrix {
  const m: AffinityMatrix = {};
  for (const a of ids) m[a] = {};
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = [ids[i]!, ids[j]!].sort() as [string, string];
      if (base === 'neutral') {
        m[a]![b] = 0;
        m[b]![a] = 0;
        continue;
      }
      const rng = new Rng(hash(`${seed}|${a}|${b}`));
      const ab = clampAff(rng.normal(0, AFF_START_SD));
      const ba = clampAff(AFF_RECIPROCITY * ab + (1 - AFF_RECIPROCITY) * rng.normal(0, AFF_START_SD));
      m[a]![b] = ab;
      m[b]![a] = ba;
    }
  }
  // Some quirks change how everyone else feels about that person.
  for (const b of ids) {
    const shift = quirks[b] ? (QUIRK_EFFECTS[quirks[b]!].othersFeel ?? 0) : 0;
    if (shift) for (const a of ids) if (a !== b) m[a]![b] = clampAff(m[a]![b]! + shift);
  }
  return m;
}

/** Labels from §5.4. */
export function affinityLabel(v: number): 'Hates' | 'Dislikes' | 'Neutral' | 'Likes' | 'Loyal' {
  if (v <= -60) return 'Hates';
  if (v <= -20) return 'Dislikes';
  if (v < 20) return 'Neutral';
  if (v < 60) return 'Likes';
  return 'Loyal';
}
