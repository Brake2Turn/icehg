// Betrayal (§6.9). Templates flagged `betrayal: true` are only ever chosen here.
import type { World } from '../core/world';
import {
  AFFINITY_INFLUENCE,
  BETRAYAL_ALL_IN_GROUP,
  BETRAYAL_BASE,
  BETRAYAL_FIELD_EXP,
  BETRAYAL_SCARCITY_MAX,
} from '../tuning';
import { expandInside } from './encounters';
import { choose, runTemplate, type Bind } from './resolve';

export function betrayalChance(w: World, a: string, groupMembers: string[]): number {
  const c = w.c[a]!;
  const others = groupMembers.filter((m) => m !== a);
  if (!others.length) return 0;
  const avgAff = others.reduce((s, m) => s + w.getAff(a, m), 0) / others.length;
  const scarcity = Math.min(
    BETRAYAL_SCARCITY_MAX,
    1 + (c.hunger + c.thirst) / 200 + (c.items.length === 0 ? 0.3 : 0),
  );
  const allInGroup = w.aliveCount() === groupMembers.length;
  return (
    BETRAYAL_BASE *
    Math.exp((-AFFINITY_INFLUENCE * avgAff) / 100) *
    (w.startCount / w.aliveCount()) ** BETRAYAL_FIELD_EXP *
    (0.5 + c.traits.ruthlessness / 10) *
    (1.5 - c.traits.loyalty / 10) *
    scarcity *
    (allInGroup ? BETRAYAL_ALL_IN_GROUP : 1) *
    (w.quirk(a).betrayal ?? 1)
  );
}

/** Returns true if a betrayal happened. */
export function betrayalCheck(w: World, groupId: string, forced = false): boolean {
  const g = w.groups.get(groupId);
  if (!g) return false;
  const members = g.members.slice();
  // Forced (last alliance standing): the likeliest traitor goes first.
  const order = forced ? members.slice().sort((x, y) => betrayalChance(w, y, members) - betrayalChance(w, x, members)) : w.rng.shuffle(members);
  for (const a of order) {
    if (!forced && !w.rng.chance(betrayalChance(w, a, members))) continue;
    const others = members.filter((m) => m !== a);
    // Aimed at the member A likes least, weighted by low affinity.
    const victim = w.rng.weighted(others, (m) => Math.exp((-AFFINITY_INFLUENCE * 2 * w.getAff(a, m)) / 100) * (w.quirk(m).betrayalTarget ?? 1))!;
    const zone = w.c[a]!.zone;
    const choice = choose(w, w.db.betrayal, zone, (c) => {
      const gSlot = c.unitSlots.find((s) => s.role === 'G');
      if (!gSlot || c.unitSlots.length !== 1) return [];
      if (members.length < gSlot.min || members.length > gSlot.max) return [];
      const base: Bind = { A: a, B: victim, G: members };
      const rest = { ...c, inside: c.inside.filter((x) => x.role !== 'A' && x.role !== 'B') };
      return expandInside(rest, base);
    });
    if (!choice) continue;
    runTemplate(w, choice, zone, { betrayal: true });
    return true;
  }
  return false;
}
