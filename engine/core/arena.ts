import type { ZoneId, ZoneTag } from './types';

export type ZoneDef = { id: ZoneId; label: string; size: number; tags: ZoneTag[] };

/** Outer zones in ring order (each is adjacent to its two neighbours and the Cornucopia). */
export const RING: ZoneId[] = ['forest', 'river', 'lake', 'swamp', 'meadow', 'cliffs', 'caves', 'ruins'];

export const ZONES: Record<ZoneId, ZoneDef> = {
  cornucopia: { id: 'cornucopia', label: 'Cornucopia', size: 0.35, tags: ['supplies', 'exposed'] },
  forest: { id: 'forest', label: 'forest', size: 3, tags: ['shelter', 'food'] },
  river: { id: 'river', label: 'river', size: 2.2, tags: ['water', 'food'] },
  lake: { id: 'lake', label: 'lake', size: 2, tags: ['water'] },
  swamp: { id: 'swamp', label: 'swamp', size: 2, tags: ['water', 'dangerous'] },
  meadow: { id: 'meadow', label: 'meadow', size: 2.2, tags: ['food', 'exposed'] },
  cliffs: { id: 'cliffs', label: 'cliffs', size: 2.4, tags: ['highGround', 'dangerous'] },
  caves: { id: 'caves', label: 'caves', size: 1.6, tags: ['shelter', 'dark'] },
  ruins: { id: 'ruins', label: 'ruins', size: 2, tags: ['shelter'] },
};

export const ALL_ZONES: ZoneId[] = ['cornucopia', ...RING];

export function neighbours(zone: ZoneId): ZoneId[] {
  if (zone === 'cornucopia') return RING.slice();
  const i = RING.indexOf(zone);
  return [RING[(i + RING.length - 1) % RING.length]!, RING[(i + 1) % RING.length]!, 'cornucopia'];
}

export function zoneHas(zone: ZoneId, tag: ZoneTag): boolean {
  return ZONES[zone].tags.includes(tag);
}

/** How the zone is written inside event text: "the {zone}" → "the forest". */
export function zoneLabel(zone: ZoneId): string {
  return ZONES[zone].label;
}
