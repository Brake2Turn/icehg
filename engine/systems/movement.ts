// Movement (§6.4): each tick, every unit that isn't travelling or asleep may set off for a neighbouring zone.
import { zoneHas } from '../core/arena';
import type { ZoneId } from '../core/types';
import type { World } from '../core/world';
import {
  FEAST_HOUR,
  MOVE_UTILITY as U,
  P_MOVE_DAY,
  P_MOVE_NIGHT,
  TRAVEL_ADJ_MAX,
  TRAVEL_ADJ_MIN,
  TRAVEL_CORN_MAX,
  TRAVEL_CORN_MIN,
} from '../tuning';

export function travelTime(w: World, from: ZoneId, to: ZoneId): number {
  if (from === 'cornucopia' || to === 'cornucopia') return w.rng.int(TRAVEL_CORN_MIN, TRAVEL_CORN_MAX);
  return w.rng.int(TRAVEL_ADJ_MIN, TRAVEL_ADJ_MAX);
}

/** Units that are present (not travelling) in their zone, grouped by zone. */
export function unitsByZone(w: World): Map<ZoneId, string[][]> {
  const seen = new Set<string>();
  const out = new Map<ZoneId, string[][]>();
  for (const id of w.order) {
    const c = w.c[id]!;
    if (!c.alive || seen.has(id) || w.isTravelling(c)) continue;
    const unit = w.unitOf(id).filter((m) => w.c[m]!.alive && !w.isTravelling(w.c[m]!));
    for (const m of unit) seen.add(m);
    if (!unit.length) continue;
    let list = out.get(c.zone);
    if (!list) out.set(c.zone, (list = []));
    list.push(unit);
  }
  return out;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function feastPull(w: World): boolean {
  if (w.feast !== 'announced' || w.feastMinute === null) return false;
  const until = w.feastMinute - w.minute;
  return until <= 10 * 60 && until > -60;
}

export function movementStep(w: World) {
  const night = w.band === 'night';
  const byZone = unitsByZone(w);
  const peopleIn = new Map<ZoneId, number>();
  for (const [z, units] of byZone) peopleIn.set(z, units.reduce((n, u) => n + u.length, 0));
  const pull = feastPull(w);

  for (const [zone, units] of byZone) {
    for (const unit of units) {
      const members = unit.map((id) => w.c[id]!);
      if (members.some((m) => m.asleep)) continue;
      if (members.some((m) => w.acted.has(m.id))) continue;
      const thirst = avg(members.map((m) => m.thirst));
      const hunger = avg(members.map((m) => m.hunger));
      const fatigue = avg(members.map((m) => m.fatigue));
      const ruth = avg(members.map((m) => m.traits.ruthlessness));
      const str = avg(members.map((m) => m.traits.strength));
      const venge = members.flatMap((m) => w.vengefulTargets(m.id)).filter((t) => w.c[t]!.alive);
      const lowSupply = members.every((m) => m.items.length === 0);
      const wounded = members.some((m) => m.health !== 'healthy');

      // Urgency raises the chance of moving at all.
      let urge = 1;
      if (zone === 'cornucopia' && !pull) urge += 6;
      if (!zoneHas(zone, 'water') && thirst > 45) urge += (thirst - 45) / 12;
      if (!zoneHas(zone, 'food') && hunger > 60) urge += (hunger - 60) / 25;
      if (venge.length && !venge.some((t) => w.c[t]!.zone === zone)) urge += 1.5;
      if (pull && zone !== 'cornucopia') urge += 1 + (lowSupply ? 1 : 0) + (wounded ? 1 : 0);
      if (members.some((m) => m.tags.some((t) => t.tag === 'hunted'))) urge += 1;
      // Hunters: ruthless, strong, healthy units go looking for people, more so as the field shrinks.
      const hunter = (ruth + str) / 20 - U.hunterThreshold;
      const field = Math.sqrt(w.startCount / Math.max(1, w.aliveCount()));
      const othersHere = (peopleIn.get(zone) ?? 0) - unit.length;
      if (hunter > 0 && !wounded && othersHere === 0) urge += U.hunterUrge * hunter * field;
      const p = (night ? P_MOVE_NIGHT : P_MOVE_DAY) * urge;
      if (!w.rng.chance(Math.min(0.9, p))) continue;

      const opts = w.openNeighbours(zone);
      if (!opts.length) continue;
      const util = opts.map((z) => {
        let u = 0;
        if (zoneHas(z, 'water')) u += U.water * (thirst / 100);
        if (zoneHas(z, 'food')) u += U.food * (hunger / 100);
        if (zoneHas(z, 'shelter') && (night || w.band === 'dusk')) u += U.shelter * (fatigue / 100);
        if (zoneHas(z, 'dangerous')) u += U.dangerous;
        const n = peopleIn.get(z) ?? 0;
        u += U.hunt * ((ruth + str) / 20 - 0.5) * Math.min(n, 6);
        if (hunter > 0 && !wounded && n > 0) u += U.hunterPull * hunter * 10 * field;
        u += U.crowd * n;
        if (venge.some((t) => w.c[t]!.zone === z)) u += U.vengeance;
        if (z === 'cornucopia') {
          if (pull) u += U.feast * (1 + (lowSupply ? 0.5 : 0) + (wounded ? 0.5 : 0));
          else u += U.cornucopiaAfterBloodbath;
        }
        return u;
      });
      const weights = util.map((u) => Math.exp(u / U.softmaxTemp));
      const i = w.rng.weightedIndex(weights);
      if (i < 0) continue;
      const dest = opts[i]!;
      w.travel(unit, dest, travelTime(w, zone, dest));
    }
  }
  void FEAST_HOUR;
}
