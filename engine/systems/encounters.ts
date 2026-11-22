// Encounters (§6.5 step 4), the Bloodbath and the feast scramble.
import { ZONES } from '../core/arena';
import type { World } from '../core/world';
import { BLOODBATH_LETHAL_MULT, ENCOUNTER_RATE, FEAST_ENCOUNTER_MULT, STEALTH_VIS, VISIBILITY } from '../tuning';
import type { Compiled } from './compile';
import { choose, runTemplate, type Bind } from './resolve';
import { unitsByZone } from './movement';
import { inFeastWindow } from './gamemakers';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** All the ways two units can fill a two-unit template. */
export function encounterBinds(c: Compiled, U1: string[], U2: string[]): Bind[] {
  if (c.unitSlots.length !== 2) return [];
  const out: Bind[] = [];
  for (const [x, y] of [
    [U1, U2],
    [U2, U1],
  ] as const) {
    const base: Bind = {};
    let ok = true;
    for (const [slot, unit] of [
      [c.unitSlots[0]!, x],
      [c.unitSlots[1]!, y],
    ] as const) {
      if (unit.length < slot.min || unit.length > slot.max) ok = false;
      else if (slot.single) (base as Record<string, string>)[slot.role] = unit[0]!;
      else base[slot.role as 'G' | 'H'] = unit.slice();
    }
    if (!ok) continue;
    out.push(...expandInside(c, base));
  }
  return out;
}

/** Fill single roles that must be picked from inside a unit (every combination). */
export function expandInside(c: Compiled, base: Bind): Bind[] {
  let binds: Bind[] = [base];
  for (const ins of c.inside) {
    const next: Bind[] = [];
    for (const b of binds) {
      const used = new Set([b.A, b.B, b.C].filter(Boolean) as string[]);
      for (const m of b[ins.group] ?? []) {
        if (used.has(m)) continue;
        next.push({ ...b, [ins.role]: m });
      }
    }
    binds = next;
  }
  return binds;
}

export function encounterStep(w: World) {
  const band = w.band;
  const night = band === 'night';
  const feast = inFeastWindow(w);
  const byZone = unitsByZone(w);
  const zones = w.rng.shuffle([...byZone.keys()]);
  for (const zone of zones) {
    const units = byZone.get(zone)!;
    if (units.length < 2) continue;
    const pairs: [string[], string[]][] = [];
    for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) pairs.push([units[i]!, units[j]!]);
    for (const [u1, u2] of w.rng.shuffle(pairs)) {
      if (w.aliveCount() <= 1) return;
      const live = (u: string[]) => u.every((id) => w.c[id]!.alive && !w.acted.has(id) && w.c[id]!.zone === zone && !w.isTravelling(w.c[id]!));
      if (!live(u1) || !live(u2)) continue;
      const g1 = w.c[u1[0]!]!.groupId;
      if (g1 && g1 === w.c[u2[0]!]!.groupId) continue;
      const stealth = avg([...u1, ...u2].map((id) => w.c[id]!.traits.stealth));
      const vis = VISIBILITY[band] * Math.max(0.2, 1 - STEALTH_VIS * (stealth - 5) * (night ? 2 : 1));
      const crowd = feast && zone === 'cornucopia' ? FEAST_ENCOUNTER_MULT : 1;
      const p = 1 - Math.exp((-ENCOUNTER_RATE * vis * crowd) / ZONES[zone].size);
      if (!w.rng.chance(p)) continue;
      const list = feast && zone === 'cornucopia' ? w.db.byCategory.feast : w.db.byCategory.encounter;
      const choice = choose(w, list, zone, (c) => encounterBinds(c, u1, u2));
      if (choice) runTemplate(w, choice, zone);
    }
  }
}

// ------------------------------------------------------------------ the Bloodbath

/** Each living contestant gets one Bloodbath event, spread over BLOODBATH_TICKS ticks. */
export function bloodbathTick(w: World, tickIndex: number, totalTicks: number) {
  const bloodbathDone = w.bloodbathDone;
  const pool = () => w.order.filter((id) => w.c[id]!.alive && !w.acted.has(id) && !w.isTravelling(w.c[id]!) && !bloodbathDone.has(id));
  const remaining = pool();
  const quota = tickIndex === totalTicks - 1 ? Infinity : Math.ceil(remaining.length / (totalTicks - tickIndex));
  let done = 0;
  for (const id of w.rng.shuffle(remaining)) {
    if (done >= quota) break;
    if (w.aliveCount() <= 1) return;
    const c = w.c[id]!;
    if (!c.alive || w.acted.has(id) || bloodbathDone.has(id) || w.isTravelling(c)) continue;
    const others = pool().filter((x) => x !== id);
    const choice = choose(w, w.db.byCategory.bloodbath, 'cornucopia', (ct) => bloodbathBinds(w, ct, id, others), (ct) =>
      ct.t.severity === 'lethal' ? BLOODBATH_LETHAL_MULT : 1,
    );
    if (!choice) continue;
    const ctx = runTemplate(w, choice, 'cornucopia');
    for (const p of ctx.participants) bloodbathDone.add(p);
    done++;
  }
}

function bloodbathBinds(w: World, c: Compiled, actor: string, others: string[]): Bind[] {
  const singles = c.unitSlots.filter((s) => s.single).map((s) => s.role as 'A' | 'B' | 'C');
  if (!singles.includes('A') || c.unitSlots.some((s) => !s.single) || c.inside.length) return [];
  const need = singles.length - 1;
  if (others.length < need) return [];
  const out: Bind[] = [];
  const samples = need === 0 ? 1 : Math.min(8, others.length * 2);
  for (let i = 0; i < samples; i++) {
    const pick = w.rng.shuffle(others).slice(0, need);
    const b: Bind = { A: actor };
    singles.filter((r) => r !== 'A').forEach((r, j) => (b[r] = pick[j]!));
    out.push(b);
  }
  return out;
}
