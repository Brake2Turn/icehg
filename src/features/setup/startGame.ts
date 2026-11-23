import { simulate, START_MINUTE_VALUE, type GameSetup, type Mode, type Pace } from './engineBridge';
import { eventDb } from '../../../events';
import { games } from '../../data/repositories';
import type { GameRecord } from '../../data/db';
import type { Slot } from '../../store/draft';

export function newSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]! || 1;
}

export function newId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export type Relationships = { seed: number; base: 'random' | 'neutral'; overrides: Record<string, number> };

/** Roll the whole game (§4.2), save it, and return its id. */
export async function startGame(mode: Mode, pace: Pace, slots: Slot[], rel?: Relationships, seed = newSeed()): Promise<string> {
  const keys = new Set(slots.map((s) => s.key));
  const affinityOverrides = Object.entries(rel?.overrides ?? {})
    .map(([k, value]) => {
      const [from, to] = k.split('>') as [string, string];
      return { from, to, value };
    })
    .filter((o) => keys.has(o.from) && keys.has(o.to));
  const setup: GameSetup = {
    mode,
    pace,
    seed,
    contestants: slots.map((s) => ({
      id: s.key,
      name: s.name.trim(),
      pronouns: s.pronouns,
      ...(s.quirk ? { quirk: s.quirk } : {}),
      ...(mode === 'classic' && s.district ? { district: s.district } : {}),
    })),
    ...(rel ? { affinitySeed: rel.seed, affinityBase: rel.base } : {}),
    ...(affinityOverrides.length ? { affinityOverrides } : {}),
  };
  const result = simulate(setup, eventDb);
  const now = Date.now();
  const date = new Date(now).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const rec: GameRecord = {
    id: newId(),
    title: `${mode === 'classic' ? 'Classic' : 'Custom'} · ${setup.contestants.length} · ${date}`,
    createdAt: now,
    updatedAt: now,
    status: 'running',
    setup,
    log: result.log,
    traits: result.traits,
    victor: result.victor,
    endMinute: result.endMinute,
    clock: { anchorWallMs: now, anchorGameMin: START_MINUTE_VALUE, speed: 1, paused: false, pace },
    seenMidnights: [],
    photos: Object.fromEntries(slots.filter((s) => s.photo).map((s) => [s.key, s.photo!])),
  };
  await games.save(rec);
  return rec.id;
}
