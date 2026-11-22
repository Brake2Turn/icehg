// Picking templates, binding roles, weighing (§6.7), applying effects and building feed entries.
import type { Effect, EventTemplate, Outcome, WeightMod } from '../../events/schema';
import { zoneHas, zoneLabel } from '../core/arena';
import type { Rng } from '../core/rng';
import { renderText, type TextBinding, type TextContext } from '../core/text';
import type { FightSummary, Item, NameColour, Rarity, Visual, Weapon, ZoneId } from '../core/types';
import type { World } from '../core/world';
import {
  AFFINITY_INFLUENCE,
  BETRAYAL_KNOWER_PENALTY,
  GRIEF_LIKE_MIN,
  MAX_GROUP,
  RARITY_WEIGHT,
  WITNESS_LIKE_MIN,
  WITNESS_PENALTY,
  WITNESS_VENGEFUL_MIN,
} from '../tuning';
import type { Compiled } from './compile';
import { resolveFight } from './fight';
import { travelTime } from './movement';

export type Bind = { A?: string; B?: string; C?: string; X?: string; G?: string[]; H?: string[] };
type RoleName = keyof Bind;

export const ITEM_LABEL: Record<Item, string> = {
  food: 'food',
  water: 'water bottle',
  medkit: 'medkit',
  rope: 'rope',
  trap: 'snare',
  sleepingBag: 'sleeping bag',
  matches: 'matches',
  map: 'map',
};
export const WEAPON_LABEL: Record<Weapon, string> = {
  none: 'bare hands',
  knife: 'knife',
  spear: 'spear',
  bow: 'bow',
  axe: 'axe',
  sword: 'sword',
  mace: 'mace',
};
const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'veryRare', 'legendary'];

export function ids(b: Bind, role: string): string[] {
  if (role === 'G' || role === 'H') return (b[role] ?? []).slice();
  const v = b[role as RoleName];
  return typeof v === 'string' ? [v] : [];
}

export function allIds(b: Bind): string[] {
  const s = new Set<string>();
  for (const r of ['A', 'B', 'C', 'X'] as const) if (b[r]) s.add(b[r]!);
  for (const id of b.G ?? []) s.add(id);
  for (const id of b.H ?? []) s.add(id);
  return [...s];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// ------------------------------------------------------------------ eligibility
export function checkWhen(w: World, t: EventTemplate, zone: ZoneId): boolean {
  const wh = t.when;
  if (!wh) return true;
  if (wh.timeOfDay && !wh.timeOfDay.includes(w.band)) return false;
  if (wh.day) {
    if (wh.day.min !== undefined && w.day < wh.day.min) return false;
    if (wh.day.max !== undefined && w.day > wh.day.max) return false;
  }
  if (wh.alive) {
    const n = w.aliveCount();
    if (wh.alive.min !== undefined && n < wh.alive.min) return false;
    if (wh.alive.max !== undefined && n > wh.alive.max) return false;
  }
  if (wh.zoneTags && !wh.zoneTags.some((tag) => zoneHas(zone, tag))) return false;
  if (wh.zones && !wh.zones.includes(zone)) return false;
  return true;
}

export function checkRequires(w: World, t: EventTemplate, b: Bind): boolean {
  const r = t.requires;
  if (!r) return true;
  const everyone = allIds(b);
  for (const req of r.tags ?? []) {
    const who = ids(b, req.who);
    if (who.length === 0) return false;
    for (const tag of req.has ?? []) {
      if (tag === 'vengeful') {
        // Vengeful toward someone else in this event (or toward anyone, in a solo event).
        const others = everyone.filter((x) => !who.includes(x));
        const ok = who.some((id) => {
          const targets = w.vengefulTargets(id);
          return others.length ? targets.some((tg) => others.includes(tg)) : targets.length > 0;
        });
        if (!ok) return false;
      } else if (!who.some((id) => w.hasTag(id, tag))) return false;
    }
    for (const tag of req.lacks ?? []) if (who.some((id) => w.hasTag(id, tag))) return false;
  }
  for (const req of r.needs ?? []) {
    const v = avg(ids(b, req.who).map((id) => w.c[id]![req.need]));
    if (req.min !== undefined && v < req.min) return false;
    if (req.max !== undefined && v > req.max) return false;
  }
  for (const req of r.health ?? []) if (!ids(b, req.who).some((id) => req.is.includes(w.c[id]!.health))) return false;
  for (const req of r.hasItem ?? []) if (!ids(b, req.who).some((id) => w.c[id]!.items.includes(req.item))) return false;
  for (const req of r.lacksItem ?? []) if (ids(b, req.who).some((id) => w.c[id]!.items.includes(req.item))) return false;
  for (const role of r.hasWeapon ?? []) if (!ids(b, role).some((id) => w.c[id]!.weapon !== 'none')) return false;
  for (const role of r.unarmed ?? []) if (ids(b, role).some((id) => w.c[id]!.weapon !== 'none')) return false;
  for (const req of r.inGroup ?? []) {
    const g = ids(b, req.group);
    if (!ids(b, req.who).every((id) => g.includes(id))) return false;
  }
  for (const role of r.solo ?? []) if (ids(b, role).some((id) => w.c[id]!.groupId)) return false;
  for (const set of r.notSameGroup ?? []) {
    for (let i = 0; i < set.length; i++)
      for (let j = i + 1; j < set.length; j++)
        for (const x of ids(b, set[i]!))
          for (const y of ids(b, set[j]!)) {
            const gx = w.c[x]!.groupId;
            if (gx && gx === w.c[y]!.groupId) return false;
          }
  }
  for (const req of r.affinity ?? []) {
    const v = affBetween(w, ids(b, req.from), ids(b, req.to));
    if (v === null) return false;
    if (req.min !== undefined && v < req.min) return false;
    if (req.max !== undefined && v > req.max) return false;
  }
  for (const role of r.asleep ?? []) if (!ids(b, role).every((id) => w.c[id]!.asleep)) return false;
  for (const role of r.awake ?? []) if (ids(b, role).some((id) => w.c[id]!.asleep)) return false;
  return true;
}

/** Average directed affinity from one set to another (self-pairs ignored). */
export function affBetween(w: World, from: string[], to: string[]): number | null {
  let sum = 0;
  let n = 0;
  for (const a of from)
    for (const b of to)
      if (a !== b) {
        sum += w.getAff(a, b);
        n++;
      }
  return n ? sum / n : null;
}

export function modsMult(w: World, mods: WeightMod[] | undefined, b: Bind): number {
  if (!mods) return 1;
  let m = 1;
  for (const mod of mods) {
    let f = 1;
    switch (mod.kind) {
      case 'trait':
        f = 1 + mod.per * (avg(ids(b, mod.who).map((id) => w.c[id]!.traits[mod.trait])) - 5);
        break;
      case 'traitDiff':
        f =
          1 +
          mod.per *
            (avg(ids(b, mod.a).map((id) => w.c[id]!.traits[mod.trait])) -
              avg(ids(b, mod.b).map((id) => w.c[id]!.traits[mod.trait])));
        break;
      case 'need':
        f = 1 + (mod.per * avg(ids(b, mod.who).map((id) => w.c[id]![mod.need]))) / 100;
        break;
      case 'hasWeapon':
        f = ids(b, mod.who).some((id) => w.c[id]!.weapon !== 'none') ? mod.mult : 1;
        break;
      case 'hasItem':
        f = ids(b, mod.who).some((id) => w.c[id]!.items.includes(mod.item)) ? mod.mult : 1;
        break;
      case 'health':
        f = ids(b, mod.who).some((id) => w.c[id]!.health === mod.is) ? mod.mult : 1;
        break;
      case 'groupSize':
        f = 1 + mod.per * (ids(b, mod.who).length - 1);
        break;
      case 'timeOfDay':
        f = w.band === mod.is ? mod.mult : 1;
        break;
      case 'alive':
        f = 1 + mod.per * (1 - w.aliveCount() / w.startCount);
        break;
      case 'day':
        f = 1 + mod.per * (w.day - 1);
        break;
      case 'hasTag':
        f = ids(b, mod.who).some((id) => w.hasTag(id, mod.tag)) ? mod.mult : 1;
        break;
    }
    m *= Math.max(0, f);
  }
  return Math.max(0, m);
}

export function toneMult(w: World, t: EventTemplate, b: Bind): number {
  if (t.tone === 'neutral') return 1;
  if (t.tone === 'cooperative') {
    const p = allIds(b).filter((id) => id !== b.X);
    const m = affBetween(w, p, p);
    return m === null ? 1 : Math.exp((AFFINITY_INFLUENCE * m) / 100);
  }
  let actor = b.A ? [b.A] : (b.G ?? []);
  let target = b.B ? [b.B] : (b.H ?? []);
  if (target.length === 0 && b.A && b.G && b.G.includes(b.A)) {
    actor = b.G.filter((x) => x !== b.A);
    target = [b.A];
  } else if (b.A && b.B && b.G && b.G.includes(b.A) && !b.H) {
    actor = [b.A];
    target = [b.B];
  }
  const h = affBetween(w, actor, target);
  return h === null ? 1 : Math.exp((-AFFINITY_INFLUENCE * h) / 100);
}

// ------------------------------------------------------------------ choosing
export type Choice = { c: Compiled; b: Bind };

/**
 * Weigh every template (base rarity × mean binding multiplier) and pick one, then a binding,
 * then an outcome. Templates with no eligible outcome are dropped and the pick is repeated.
 */
export function choose(
  w: World,
  list: Compiled[],
  zone: ZoneId,
  bindGen: (c: Compiled) => Bind[],
  extraMult?: (c: Compiled, b: Bind) => number,
): { c: Compiled; b: Bind; o: Outcome } | null {
  type Cand = { c: Compiled; binds: Bind[]; mults: number[]; weight: number };
  const cands: Cand[] = [];
  for (const c of list) {
    if (!checkWhen(w, c.t, zone)) continue;
    const binds: Bind[] = [];
    const mults: number[] = [];
    for (const b of bindGen(c)) {
      if (!checkRequires(w, c.t, b)) continue;
      const m = toneMult(w, c.t, b) * modsMult(w, c.t.mods, b) * (extraMult ? extraMult(c, b) : 1);
      binds.push(b);
      mults.push(m);
    }
    if (binds.length === 0) continue;
    const weight = RARITY_WEIGHT[c.t.rarity] * avg(mults);
    if (weight > 0) cands.push({ c, binds, mults, weight });
  }
  while (cands.length) {
    const i = w.rng.weightedIndex(cands.map((x) => x.weight));
    if (i < 0) return null;
    const cand = cands[i]!;
    const bi = w.rng.weightedIndex(cand.mults);
    const b = cand.binds[bi < 0 ? 0 : bi]!;
    const o = chooseOutcome(w, cand.c, b, cand.c.t.outcomes);
    if (o) return { c: cand.c, b, o };
    cands.splice(i, 1);
  }
  return null;
}

export function chooseOutcome(w: World, c: Compiled | null, b: Bind, outcomes: Outcome[], exclude?: (o: Outcome) => boolean): Outcome | null {
  const ok = outcomes.filter((o) => outcomeEligible(w, c, b, o) && !(exclude && exclude(o)));
  if (!ok.length) return null;
  const i = w.rng.weightedIndex(ok.map((o) => RARITY_WEIGHT[o.rarity] * modsMult(w, o.mods, b)));
  return i < 0 ? null : ok[i]!;
}

/** Never-wipe rule and the group size cap. */
export function outcomeEligible(w: World, c: Compiled | null, b: Bind, o: Outcome): boolean {
  const deaths = deathsFrom(b, o.effects).filter((id) => w.c[id]!.alive);
  if (w.aliveCount() - new Set(deaths).size < 1) return false;
  for (const e of o.effects) {
    if (e.kind === 'formGroup') {
      const members = new Set(e.members.flatMap((r) => ids(b, r)));
      // existing group of any member counts toward the size
      let biggest = 0;
      for (const id of members) {
        const g = w.c[id]!.groupId;
        if (g) {
          const outside = w.groups.get(g)!.members.filter((m) => !members.has(m)).length;
          biggest = Math.max(biggest, outside);
        }
      }
      if (members.size + biggest > MAX_GROUP) return false;
    }
    if (e.kind === 'joinGroup') {
      const g = ids(b, 'G');
      if (g.length + 1 > MAX_GROUP) return false;
    }
  }
  void c;
  return true;
}

function deathsFrom(b: Bind, effects: Effect[]): string[] {
  const out: string[] = [];
  for (const e of effects) {
    if (e.kind !== 'kill') continue;
    if (e.target === 'G.all') out.push(...ids(b, 'G'));
    else if (e.target === 'H.all') out.push(...ids(b, 'H'));
    else if (e.target === 'G.first') out.push(...ids(b, 'G').slice(0, 1));
    else out.push(...ids(b, e.target));
  }
  return out;
}

// ------------------------------------------------------------------ running an event
type Flag = 'died' | 'betrayer' | 'killer' | 'injured' | 'good';

export class EventCtx {
  flags = new Map<string, Set<Flag>>();
  extra: string[] = [];
  moves: { who: string[]; to: ZoneId }[] = [];
  private movedUnits = new Map<string, ZoneId>();
  participants = new Set<string>();
  fight?: FightSummary;
  entryTags = new Set<'betrayal' | 'fight' | 'groupFormed' | 'mercy' | 'suicide'>();
  visualOverride?: Visual;

  constructor(
    public w: World,
    public b: Bind,
    public zone: ZoneId,
  ) {
    for (const id of allIds(b)) this.participants.add(id);
  }
  flag(id: string, f: Flag) {
    let s = this.flags.get(id);
    if (!s) this.flags.set(id, (s = new Set()));
    s.add(f);
    this.participants.add(id);
  }
  colours(): Record<string, NameColour> {
    const out: Record<string, NameColour> = {};
    for (const id of this.participants) {
      const s = this.flags.get(id);
      out[id] = !s
        ? 'white'
        : s.has('died')
          ? 'red'
          : s.has('betrayer')
            ? 'purple'
            : s.has('killer')
              ? 'gold'
              : s.has('injured')
                ? 'orange'
                : s.has('good')
                  ? 'green'
                  : 'white';
    }
    return out;
  }
  /** Queue a unit move (deduplicated per group/person per event). */
  queueMove(id: string, to: 'adjacent' | ZoneId, rng: Rng, avoid?: ZoneId) {
    const c = this.w.c[id]!;
    if (!c.alive) return;
    const key = c.groupId ?? id;
    if (this.movedUnits.has(key)) return;
    let dest: ZoneId;
    if (to === 'adjacent') {
      const opts = this.w.openNeighbours(c.zone).filter((z) => z !== avoid);
      dest = opts.length ? rng.pick(opts) : 'cornucopia';
    } else dest = this.w.closed.has(to) ? rng.pick(this.w.openNeighbours(c.zone)) : to;
    if (dest === c.zone) return;
    this.movedUnits.set(key, dest);
    this.moves.push({ who: this.w.unitOf(id), to: dest });
  }
  destinationOf(id: string): ZoneId | undefined {
    const c = this.w.c[id]!;
    return this.movedUnits.get(c.groupId ?? id);
  }
}

export function textBinding(w: World, people: string[], isUnit: boolean): TextBinding {
  return { people: people.map((id) => ({ id, pronouns: w.c[id]!.pronouns })), isUnit };
}

export function textContext(w: World, b: Bind, zone: ZoneId, effects: Effect[]): TextContext {
  const roles: TextContext['roles'] = {};
  for (const r of ['A', 'B', 'C', 'X'] as const) if (b[r]) roles[r] = textBinding(w, [b[r]!], false);
  if (b.G) roles.G = textBinding(w, b.G, true);
  if (b.H) roles.H = textBinding(w, b.H, true);
  // {R}: the rest of group G, excluding the single roles (A, B, C).
  if (b.G) {
    const rest = b.G.filter((id) => id !== b.A && id !== b.B && id !== b.C);
    if (rest.length) roles.R = textBinding(w, rest, true);
  }
  let item: Item | undefined;
  let weapon: Weapon | undefined;
  for (const e of effects) {
    if (!item && (e.kind === 'gainItem' || e.kind === 'loseItem')) item = e.item;
    if (!item && e.kind === 'transferItem' && e.item !== 'all') item = e.item;
    if (!weapon && e.kind === 'setWeapon') weapon = e.weapon;
  }
  if (!weapon) {
    const holder = [b.A, ...(b.G ?? []), b.X].find((id) => id && w.c[id]!.weapon !== 'none');
    weapon = holder ? w.c[holder]!.weapon : 'none';
  }
  return { roles, zone: zoneLabel(zone), item: ITEM_LABEL[item ?? 'food'], weapon: WEAPON_LABEL[weapon] };
}

/** Apply one outcome's effects. Returns nothing; changes are recorded on ctx and in w.cur. */
export function applyEffects(ctx: EventCtx, effects: Effect[]) {
  const { w, b } = ctx;
  const rng = w.rng;
  for (const e of effects) {
    switch (e.kind) {
      case 'kill': {
        let victims: string[];
        if (e.target === 'G.all') victims = ids(b, 'G');
        else if (e.target === 'H.all') victims = ids(b, 'H');
        else if (e.target === 'G.first') victims = ids(b, 'G').slice(0, 1);
        else victims = ids(b, e.target);
        for (const v of victims) {
          if (!w.c[v]!.alive) continue;
          if (w.aliveCount() <= 1) break; // never-wipe safety net
          let by: string | null = null;
          if (e.by === 'G') {
            const opts = ids(b, 'G').filter((x) => x !== v && w.c[x]!.alive);
            by = opts.length ? rng.pick(opts) : null;
          } else if (e.by) {
            by = ids(b, e.by)[0] ?? null;
            if (by === v) by = null;
          }
          killWithWitnesses(ctx, v, by);
        }
        break;
      }
      case 'injure':
        for (const id of ids(b, e.target)) injure(ctx, id, e.severity);
        break;
      case 'heal':
        for (const id of ids(b, e.target)) {
          const c = w.c[id]!;
          if (!c.alive || c.health === 'healthy') continue;
          w.setHealth(id, c.health === 'critical' ? 'wounded' : 'healthy');
          ctx.flag(id, 'good');
        }
        break;
      case 'need':
        for (const id of ids(b, e.who)) {
          const c = w.c[id]!;
          c[e.need] = Math.max(0, Math.min(100, c[e.need] + e.delta));
        }
        break;
      case 'gainItem':
        for (const id of ids(b, e.who)) {
          if (!w.c[id]!.alive) continue;
          w.addItem(id, e.item);
          ctx.flag(id, 'good');
        }
        break;
      case 'loseItem':
        for (const id of ids(b, e.who)) w.removeItem(id, e.item);
        break;
      case 'transferItem': {
        const to = ids(b, e.to).find((id) => w.c[id]!.alive);
        if (!to) break;
        for (const from of ids(b, e.from)) {
          if (from === to) continue;
          if (e.item === 'all') {
            const fc = w.c[from]!;
            if (fc.items.length) {
              w.setItems(to, [...w.c[to]!.items, ...fc.items]);
              w.setItems(from, []);
              ctx.flag(to, 'good');
            }
            if (w.weaponBonus(fc.weapon) > w.weaponBonus(w.c[to]!.weapon)) {
              w.setWeapon(to, fc.weapon);
              w.setWeapon(from, 'none');
              ctx.flag(to, 'good');
            }
          } else if (w.removeItem(from, e.item)) {
            w.addItem(to, e.item);
            ctx.flag(to, 'good');
          }
        }
        break;
      }
      case 'setWeapon':
        for (const id of ids(b, e.who)) {
          const c = w.c[id]!;
          if (!c.alive) continue;
          if (e.weapon === 'none') w.setWeapon(id, 'none');
          else if (w.weaponBonus(e.weapon) >= w.weaponBonus(c.weapon)) {
            w.setWeapon(id, e.weapon);
            ctx.flag(id, 'good');
          }
        }
        break;
      case 'affinity': {
        const from = ids(b, e.from);
        const to = ids(b, e.to);
        for (const x of from)
          for (const y of to) {
            if (x === y) continue;
            w.addAff(x, y, e.delta);
            if (e.mutual) w.addAff(y, x, e.delta);
          }
        break;
      }
      case 'affinitySet':
        for (const x of ids(b, e.from)) for (const y of ids(b, e.to)) w.setAff(x, y, e.value);
        break;
      case 'formGroup':
        formGroup(
          ctx,
          e.members.flatMap((r) => ids(b, r)),
        );
        break;
      case 'joinGroup': {
        const g = ids(b, 'G');
        formGroup(ctx, [...g, ...ids(b, e.who)]);
        break;
      }
      case 'leaveGroup':
        for (const id of ids(b, e.who)) if (w.c[id]!.groupId) w.setGroup(id, null);
        break;
      case 'ditch':
        for (const id of ids(b, e.who)) {
          if (!w.c[id]!.alive) continue;
          if (w.c[id]!.groupId) w.setGroup(id, null);
          w.addTag(id, 'abandoned');
        }
        break;
      case 'addTag':
        for (const id of ids(b, e.who)) {
          if (!w.c[id]!.alive) continue;
          if (e.tag === 'vengeful') {
            const target = allIds(b).find((x) => x !== id && w.c[x]!.alive);
            if (target) w.addTag(id, 'vengeful', target);
          } else w.addTag(id, e.tag);
        }
        break;
      case 'removeTag':
        for (const id of ids(b, e.who)) w.removeTag(id, e.tag);
        break;
      case 'move':
        for (const r of e.who) for (const id of ids(b, r)) ctx.queueMove(id, e.to, rng);
        break;
      case 'fight':
        resolveFight(ctx, ids(b, e.attackers), ids(b, e.defenders), !!e.ambush);
        break;
    }
  }
}

export function injure(ctx: EventCtx, id: string, severity: 'wounded' | 'critical') {
  const w = ctx.w;
  const c = w.c[id]!;
  if (!c.alive) return;
  const next = severity === 'critical' || c.health !== 'healthy' ? 'critical' : 'wounded';
  w.setHealth(id, next);
  ctx.flag(id, 'injured');
}

export function killWithWitnesses(ctx: EventCtx, victim: string, by: string | null) {
  const w = ctx.w;
  const vz = w.c[victim]!.zone;
  if (!w.kill(victim, by)) return;
  ctx.flag(victim, 'died');
  if (by) ctx.flag(by, 'killer');
  // Witnessing (§6.6): people present who liked the victim turn on the killer.
  const killerGroup = by ? w.c[by]!.groupId : null;
  for (const cid of w.order) {
    if (cid === victim || cid === by) continue;
    const c = w.c[cid]!;
    if (!c.alive) continue;
    const present = (c.zone === vz && !w.isTravelling(c)) || (killerGroup !== null && c.groupId === killerGroup);
    if (!present) continue;
    const liked = w.getAff(cid, victim);
    if (by && liked >= WITNESS_LIKE_MIN) {
      w.addAff(cid, by, WITNESS_PENALTY);
      if (liked >= WITNESS_VENGEFUL_MIN) w.addTag(cid, 'vengeful', by);
    }
    if (liked >= GRIEF_LIKE_MIN) w.addTag(cid, 'grieving');
  }
}

export function formGroup(ctx: EventCtx, memberIds: string[]) {
  const w = ctx.w;
  const living = [...new Set(memberIds)].filter((id) => w.c[id]!.alive);
  if (living.length < 2) return;
  // Keep the existing group holding the most of these people, if any.
  const counts = new Map<string, number>();
  for (const id of living) {
    const g = w.c[id]!.groupId;
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let target: string | null = null;
  let best = 0;
  for (const [g, n] of counts) if (n > best) [target, best] = [g, n];
  if (!target) {
    target = w.newGroup().id;
    ctx.entryTags.add('groupFormed');
  }
  for (const id of living) {
    if (w.c[id]!.groupId !== target) {
      w.setGroup(id, target);
      ctx.flag(id, 'good');
    }
  }
  if (best === 0) for (const id of living) ctx.flag(id, 'good');
}

/** Finalise: push the feed entry, then the queued moves. */
export function commitEvent(
  ctx: EventCtx,
  meta: { templateId: string; category: EventTemplate['category']; severity: EventTemplate['severity']; rarity: Rarity; visual: Visual },
  text: string,
) {
  const w = ctx.w;
  const patches = w.cur ?? [];
  w.cur = null;
  const full = [text, ...ctx.extra].filter(Boolean).join(' ');
  const participants = [...ctx.participants];
  for (const id of participants) w.acted.add(id);
  w.pushEntry({
    kind: 'event',
    templateId: meta.templateId,
    category: meta.category,
    severity: meta.severity,
    rarity: meta.rarity,
    text: full,
    participants,
    nameColours: ctx.colours(),
    zone: ctx.zone,
    visual: ctx.visualOverride ?? meta.visual,
    patches,
    ...(ctx.entryTags.size ? { tags: [...ctx.entryTags] } : {}),
    ...(ctx.fight ? { fight: ctx.fight } : {}),
  });
  for (const m of ctx.moves) {
    const living = m.who.filter((id) => w.c[id]!.alive && w.c[id]!.zone !== m.to);
    if (living.length) w.travel(living, m.to, travelTime(w, w.c[living[0]!]!.zone, m.to));
  }
  w.stats.templateUse[meta.templateId] = (w.stats.templateUse[meta.templateId] ?? 0) + 1;
  if (meta.rarity === 'legendary') w.stats.legendaryOutcomes++;
}

export function rarer(a: Rarity, b: Rarity): Rarity {
  return RARITY_ORDER.indexOf(a) >= RARITY_ORDER.indexOf(b) ? a : b;
}

/** Run a chosen template outcome as one feed entry. */
export function runTemplate(w: World, choice: { c: Compiled; b: Bind; o: Outcome }, zone: ZoneId, opts?: { betrayal?: boolean }) {
  const { c, b, o } = choice;
  w.cur = [];
  const ctx = new EventCtx(w, b, zone);
  const text = renderText(o.text, textContext(w, b, zone, o.effects));
  if (opts?.betrayal) {
    ctx.flag(b.A!, 'betrayer');
    ctx.entryTags.add('betrayal');
  }
  applyEffects(ctx, o.effects);
  if (opts?.betrayal) betrayalAftermath(ctx);
  commitEvent(
    ctx,
    { templateId: c.t.id, category: c.t.category, severity: c.t.severity, rarity: rarer(c.t.rarity, o.rarity), visual: o.visual ?? c.t.visual },
    text,
  );
  return ctx;
}

/** §6.9: after a betrayal, A leaves; the victim hates A; members who know dislike A. */
function betrayalAftermath(ctx: EventCtx) {
  const { w, b } = ctx;
  const a = b.A!;
  const victim = b.B!;
  const groupMembers = (b.G ?? []).filter((id) => id !== a && id !== victim);
  if (w.c[a]!.groupId) w.setGroup(a, null);
  if (w.c[victim]!.alive) {
    w.setAff(victim, a, -100);
    w.addTag(victim, 'betrayed');
  }
  for (const m of groupMembers) if (w.c[m]!.alive) w.addAff(m, a, BETRAYAL_KNOWER_PENALTY);
  w.stats.betrayals++;
}
