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
  GM_DAY_FACTOR,
  MIN_OPEN_OUTER,
  P_FEAST_ANNOUNCE,
  P_GM,
  RARITY_WEIGHT,
  SHRINK_FROM_DAY,
  SHRINK_MAX,
  SHRINK_PER_DAY,
  SUDDEN_DEATH_DAY,
} from '../tuning';
import { applyEffects, chooseOutcome, commitEvent, EventCtx, modsMult, rarer, runTemplate, textContext } from './resolve';
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
    } else if (w.day >= SHRINK_FROM_DAY) {
      const p = Math.min(SHRINK_MAX, SHRINK_PER_DAY * w.gmMood * (w.day - SHRINK_FROM_DAY + 1));
      const open = w.openOuter();
      if (open.length > MIN_OPEN_OUTER && w.rng.chance(p)) closeZone(w, w.rng.pick(open));
    }
    if (w.feast === 'none' && w.day >= FEAST_FROM_DAY && w.rng.chance(P_FEAST_ANNOUNCE)) {
      w.setFeast('announced');
      w.feastMinute = (w.day) * DAY_MIN + FEAST_HOUR * 60; // next morning
      announce(w, 'feastAnnounce');
    }
  }
  if (w.feast === 'announced' && w.feastMinute === w.minute) {
    w.setFeast('done');
    announce(w, 'feastDrop');
  }
}

export function hazardStep(w: World) {
  if (w.aliveCount() <= 1) return;
  if (w.day >= SUDDEN_DEATH_DAY) {
    if (w.rng.chance(0.5)) runHazard(w, 'cornucopia', true);
    return;
  }
  const hoursSinceDeath = (w.minute - w.lastDeathMinute) / 60;
  const p = P_GM * w.gmMood * (1 + GM_DAY_FACTOR * w.day) * (1 + hoursSinceDeath / GM_BORED_HOURS);
  if (!w.rng.chance(p)) return;
  const zones = (['cornucopia', ...RING] as ZoneId[]).filter((z) => !w.closed.has(z) && victimsIn(w, z).length > 0);
  if (!zones.length) return;
  runHazard(w, w.rng.pick(zones), false);
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

function runHazard(w: World, zone: ZoneId, ignoreZone: boolean) {
  const list = w.db.hazards.filter((t) => ignoreZone || hazardFits(t, zone));
  const t = w.rng.weighted(list, (x) => RARITY_WEIGHT[x.rarity] * modsMult(w, x.mods, {}));
  if (!t) return;
  runPerVictim(w, t, zone, victimsIn(w, zone));
}

export function runPerVictim(w: World, t: HazardTemplate, zone: ZoneId, victims: string[]) {
  if (!victims.length) return;
  w.cur = [];
  const ctx = new EventCtx(w, {}, zone);
  const lines: string[] = [renderText(t.intro, { roles: {}, zone: zoneLabel(zone) })];
  let rarity = t.rarity;
  for (const x of victims) {
    if (!w.c[x]!.alive) continue;
    ctx.participants.add(x);
    ctx.b = { X: x };
    const o = chooseOutcome(w, null, { X: x }, t.perVictim);
    if (!o) continue;
    rarity = rarer(rarity, o.rarity);
    lines.push(renderText(o.text, textContext(w, { X: x }, zone, o.effects)));
    applyEffects(ctx, o.effects);
  }
  commitEvent(ctx, { templateId: t.id, category: 'gamemaker', severity: t.severity, rarity, visual: t.visual }, lines.join(' '));
}

export function closeZone(w: World, zone: ZoneId) {
  const open = w.openOuter();
  if (!open.includes(zone)) return;
  w.closeZone(zone);
  const t = w.rng.weighted(w.db.closures, (x) => RARITY_WEIGHT[x.rarity])!;
  const present = victimsIn(w, zone);
  if (t && present.length) runPerVictim(w, t, zone, present);
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
