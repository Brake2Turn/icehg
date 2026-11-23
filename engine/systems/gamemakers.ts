// The Gamemakers (§6.11): hazards, the feast, the shrinking arena and the backstop.
import type { HazardTemplate } from '../../events/types';
import { RING, zoneHas, zoneLabel } from '../core/arena';
import { minuteOfDay } from '../core/clock';
import { renderText } from '../core/text';
import type { ZoneId } from '../core/types';
import type { World } from '../core/world';
import {
  BACKSTOP_DAY,
  DAY_MIN,
  FEAST_FROM_DAY,
  FEAST_HOUR,
  FEAST_WINDOW_MIN,
  GM_BORED_HOURS,
  GM_DAY_EXP,
  GM_LETHAL_MOOD_EXP,
  GM_LETHAL_MULT,
  P_ARENA_WIDE,
  REPEAT_DECAY,
  RESCUE_AFF_K,
  RESCUE_BASE,
  MIN_OPEN_OUTER,
  P_FEAST_ANNOUNCE,
  P_GM,
  RARITY_WEIGHT,
  SHRINK_FROM_DAY,
  SHRINK_MAX,
  SHRINK_PER_DAY,
  SUDDEN_DEATH_DAY,
} from '../tuning';
import type { Outcome } from '../../events/types';
import { applyEffects, choose, chooseOutcome, commitEvent, EventCtx, modsMult, rarer, repeatMult, runTemplate, textContext } from './resolve';
import { travelTime } from './movement';

export function inFeastWindow(w: World): boolean {
  return w.feastMinute !== null && w.minute >= w.feastMinute && w.minute < w.feastMinute + FEAST_WINDOW_MIN;
}

function announce(w: World, trigger: 'feastAnnounce' | 'feastDrop' | 'gong', zone: ZoneId = 'cornucopia') {
  const list = w.db.byTrigger[trigger];
  if (!list?.length) return;
  const c = w.rng.weighted(list, (x) => RARITY_WEIGHT[x.t.rarity])!;
  runTemplate(w, { c, b: {}, o: c.t.outcomes[0]! }, zone);
}

export function gong(w: World) {
  announce(w, 'gong');
}

/** Things that happen at the start of particular ticks (dawn, feast time). */
export function scheduledStep(w: World) {
  const mod = minuteOfDay(w.minute);
  if (mod === 5 * 60) {
    // Backstop: Day 30 dawn closes everything but the Cornucopia.
    if (w.day >= BACKSTOP_DAY) {
      for (const z of w.openOuter()) closeZone(w, z);
    } else if (w.day >= SHRINK_FROM_DAY && gmAvailable(w)) {
      const p = Math.min(SHRINK_MAX, SHRINK_PER_DAY * w.gmMood * (w.day - SHRINK_FROM_DAY + 1));
      const open = w.openOuter();
      if (open.length > MIN_OPEN_OUTER && w.rng.chance(p)) {
        w.gmDay = w.day;
        closeZone(w, w.rng.pick(open));
      }
    }
    // The feast is the day's Gamemaker event (announcement day and feast day).
    if (w.feast === 'none' && w.day >= FEAST_FROM_DAY && gmAvailable(w) && w.rng.chance(P_FEAST_ANNOUNCE)) {
      w.gmDay = w.day;
      w.setFeast('announced');
      w.feastMinute = (w.day) * DAY_MIN + FEAST_HOUR * 60; // next morning
      announce(w, 'feastAnnounce');
    }
  }
  if (w.feast === 'announced' && w.feastMinute === w.minute) {
    w.gmDay = w.day;
    w.setFeast('done');
    announce(w, 'feastDrop');
  }
}

/** At most one Gamemaker event per day (owner's request); the backstop and sudden death are exempt. */
export function gmAvailable(w: World): boolean {
  return w.gmDay !== w.day;
}

/**
 * Gamemaker hazards (§6.11, reworked): rare early, likelier each day, never more than one a day.
 * Runs at the start of the tick, so everyone caught in it gets a line about their fate.
 */
export function hazardStep(w: World) {
  if (w.aliveCount() <= 1) return;
  if (w.day >= SUDDEN_DEATH_DAY) {
    if (w.rng.chance(0.5)) runHazard(w, 'cornucopia', 'zone', true);
    return;
  }
  if (!gmAvailable(w)) return;
  const hoursSinceDeath = (w.minute - w.lastDeathMinute) / 60;
  const p = P_GM * w.gmMood * w.day ** GM_DAY_EXP * (1 + hoursSinceDeath / GM_BORED_HOURS);
  if (!w.rng.chance(p)) return;
  if (w.rng.chance(P_ARENA_WIDE) && w.db.hazards.some((t) => t.scope === 'arena')) {
    w.gmDay = w.day;
    runHazard(w, 'cornucopia', 'arena', false);
    return;
  }
  const zones = (['cornucopia', ...RING] as ZoneId[]).filter((z) => !w.closed.has(z) && victimsIn(w, z).length > 0);
  if (!zones.length) return;
  w.gmDay = w.day;
  runHazard(w, w.rng.pick(zones), 'zone', false);
}

function victimsIn(w: World, zone: ZoneId): string[] {
  return w.order.filter((id) => {
    const c = w.c[id]!;
    return c.alive && c.zone === zone && !w.isTravelling(c) && !w.acted.has(id);
  });
}

function hazardFits(t: HazardTemplate, zone: ZoneId): boolean {
  if (t.when?.zoneTags && !t.when.zoneTags.some((tag) => zoneHas(zone, tag))) return false;
  if (t.when?.zones && !t.when.zones.includes(zone)) return false;
  return true;
}

function runHazard(w: World, zone: ZoneId, scope: 'arena' | 'zone', ignoreZone: boolean) {
  const list = w.db.hazards.filter((t) => (t.scope ?? 'zone') === scope && (scope === 'arena' || ignoreZone || hazardFits(t, zone)));
  const t = w.rng.weighted(list, (x) => RARITY_WEIGHT[x.rarity] * modsMult(w, x.mods, {}) * repeatMult(w, x.id));
  if (!t) return;
  const victims = scope === 'arena' ? w.order.filter((id) => w.c[id]!.alive && !w.acted.has(id)) : victimsIn(w, zone);
  runPerVictim(w, t, zone, victims, scope);
}

const harmful = (o: Outcome) => o.effects.some((e) => e.kind === 'kill' || e.kind === 'injure');

/**
 * One feed entry: the intro, then a line for each person caught in it (died, hurt, survived, or saved by someone).
 * Someone nearby who cares about a victim may pull them out (cyan), likelier the more they like them.
 */
export function runPerVictim(w: World, t: HazardTemplate, zone: ZoneId, victims: string[], scope: 'arena' | 'zone' = 'zone') {
  if (!victims.length) return;
  w.cur = [];
  const ctx = new EventCtx(w, {}, zone);
  ctx.scope = scope;
  const intro = renderText(t.intro, { roles: {}, zone: scope === 'arena' ? 'arena' : zoneLabel(zone) });
  let rarity = t.rarity;
  const outcomeUse = new Map<Outcome, number>();
  const rescuers = new Set<string>();
  for (const x of victims) {
    if (!w.c[x]!.alive) continue;
    ctx.participants.add(x);
    const xz = w.c[x]!.zone;
    // Vary the lines: each outcome already used in this event is less likely again.
    // Crueller Gamemakers (a high per-game mood) make their events deadlier.
    const cruelty = (oc: Outcome) => (oc.effects.some((e) => e.kind === 'kill') ? w.gmMood ** GM_LETHAL_MOOD_EXP * GM_LETHAL_MULT : 1);
    const o = chooseOutcome(w, null, { X: x }, t.perVictim, undefined, (oc) => REPEAT_DECAY ** (outcomeUse.get(oc) ?? 0) * cruelty(oc));
    if (!o) continue;
    outcomeUse.set(o, (outcomeUse.get(o) ?? 0) + 1);
    if (harmful(o)) {
      const near = victims.filter(
        (r) => r !== x && !rescuers.has(r) && w.c[r]!.alive && w.c[r]!.zone === xz && !w.isTravelling(w.c[r]!) && !w.isTravelling(w.c[x]!),
      );
      const saver = w.rng
        .shuffle(near)
        .find((r) => w.rng.chance(Math.min(0.9, RESCUE_BASE * (w.quirk(r).saves ?? 1) * Math.exp((RESCUE_AFF_K * w.getAff(r, x)) / 100))));
      if (saver) {
        const list = w.db.byTrigger.hazardRescue ?? [];
        const choice = choose(w, list, xz, () => [{ A: saver, B: x }]);
        if (choice) {
          rescuers.add(saver);
          ctx.participants.add(saver);
          ctx.b = { A: saver, B: x };
          ctx.saves.push([saver, x]);
          ctx.lines.push(renderText(choice.o.text, textContext(w, { A: saver, B: x }, xz, choice.o.effects)));
          applyEffects(ctx, choice.o.effects);
          w.stats.templateUse[choice.c.t.id] = (w.stats.templateUse[choice.c.t.id] ?? 0) + 1;
          continue;
        }
      }
    }
    rarity = rarer(rarity, o.rarity);
    ctx.b = { X: x };
    ctx.lines.push(renderText(o.text, textContext(w, { X: x }, xz, o.effects)));
    applyEffects(ctx, o.effects);
  }
  commitEvent(ctx, { templateId: t.id, category: 'gamemaker', severity: t.severity, rarity, visual: t.visual }, intro);
}

export function closeZone(w: World, zone: ZoneId) {
  const open = w.openOuter();
  if (!open.includes(zone)) return;
  w.closeZone(zone);
  const t = w.rng.weighted(w.db.closures, (x) => RARITY_WEIGHT[x.rarity])!;
  const present = victimsIn(w, zone);
  if (t && present.length) runPerVictim(w, t, zone, present, 'zone');
  else if (t) {
    // Nobody inside: still announce it.
    w.cur = [];
    const ctx = new EventCtx(w, {}, zone);
    commitEvent(ctx, { templateId: t.id, category: 'gamemaker', severity: 'flavour', rarity: t.rarity, visual: t.visual }, renderText(t.intro, { roles: {}, zone: zoneLabel(zone) }));
  }
  // Anyone still inside (or walking in) is forced out.
  const seen = new Set<string>();
  for (const id of w.order) {
    const c = w.c[id]!;
    if (!c.alive || c.zone !== zone || seen.has(id)) continue;
    const unit = w.unitOf(id).filter((m) => w.c[m]!.alive && w.c[m]!.zone === zone);
    unit.forEach((m) => seen.add(m));
    const opts = w.openNeighbours(zone);
    const dest = opts.length ? w.rng.pick(opts) : 'cornucopia';
    w.travel(unit, dest, travelTime(w, zone, dest));
  }
}
