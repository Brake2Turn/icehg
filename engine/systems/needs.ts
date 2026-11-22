// Needs, sleep and wounds (§6.5 step 1).
import { zoneHas } from '../core/arena';
import type { Trigger } from '../../events/types';
import type { World } from '../core/world';
import {
  DRINK_IN_WATER_ZONE,
  EAT_CARRIED_THRESHOLD,
  FATIGUE_PER_TICK_ASLEEP,
  FATIGUE_PER_TICK_AWAKE,
  GRAZE_CHANCE,
  GRAZE_RELIEF,
  HUNGER_CRISIS,
  HUNGER_PER_TICK,
  ITEM_FOOD_RELIEF,
  ITEM_WATER_RELIEF,
  P_CRITICAL_EVENT,
  P_NEED_CRISIS,
  P_REST_HEAL,
  P_WOUND_WORSEN,
  SLEEP_FATIGUE_MIN,
  THIRST_CRISIS,
  THIRST_PER_TICK,
  WAKE_FATIGUE,
} from '../tuning';
import { choose, runTemplate, type Bind } from './resolve';

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Silent bookkeeping: needs rise, people eat/drink/sleep, rest slowly heals. */
export function needsStep(w: World, quiet: boolean) {
  const band = w.band;
  for (const id of w.order) {
    const c = w.c[id]!;
    if (!c.alive) continue;
    if (c.travelUntil !== null && c.travelUntil <= w.minute) c.travelUntil = null;
    const travelling = w.isTravelling(c);

    // Sleep
    if (quiet) {
      if (!travelling) c.asleep = true;
    } else if (band === 'night') {
      if (!c.asleep && !travelling && c.fatigue >= SLEEP_FATIGUE_MIN && w.rng.chance(0.35)) c.asleep = true;
      if (c.asleep && c.fatigue <= WAKE_FATIGUE && w.rng.chance(0.3)) c.asleep = false;
    } else if (c.asleep && (c.fatigue <= WAKE_FATIGUE + 20 || w.rng.chance(0.4))) c.asleep = false;

    c.fatigue = clamp(c.fatigue + (c.asleep ? FATIGUE_PER_TICK_ASLEEP : FATIGUE_PER_TICK_AWAKE * (travelling ? 1.4 : 1)));
    c.hunger = clamp(c.hunger + HUNGER_PER_TICK);
    c.thirst = clamp(c.thirst + THIRST_PER_TICK * (band === 'day' ? 1.2 : 0.8));

    if (!travelling) {
      if (zoneHas(c.zone, 'water') && c.thirst > 20) c.thirst = clamp(c.thirst - DRINK_IN_WATER_ZONE);
      if (zoneHas(c.zone, 'food') && c.hunger > 30 && w.rng.chance(GRAZE_CHANCE * (0.5 + c.traits.survival / 10)))
        c.hunger = clamp(c.hunger - GRAZE_RELIEF);
    }
    if (c.thirst > EAT_CARRIED_THRESHOLD && c.items.includes('water')) {
      w.removeItem(id, 'water');
      c.thirst = clamp(c.thirst - ITEM_WATER_RELIEF);
    }
    if (c.hunger > EAT_CARRIED_THRESHOLD && c.items.includes('food')) {
      w.removeItem(id, 'food');
      c.hunger = clamp(c.hunger - ITEM_FOOD_RELIEF);
    }
    if (c.asleep && c.health !== 'healthy' && w.rng.chance(P_REST_HEAL * (c.items.includes('sleepingBag') ? 2 : 1))) {
      w.setHealth(id, c.health === 'critical' ? 'wounded' : 'healthy');
    }
  }
}

/** Run a system-triggered solo template for one contestant. */
export function runTrigger(w: World, trigger: Trigger, id: string): boolean {
  const list = w.db.byTrigger[trigger];
  if (!list?.length) return false;
  const c = w.c[id]!;
  const choice = choose(w, list, c.zone, (ct) => (ct.unitSlots.length === 1 && ct.unitSlots[0]!.role === 'A' ? [{ A: id } as Bind] : []));
  if (!choice) return false;
  runTemplate(w, choice, c.zone);
  return true;
}

/** Visible consequences of wounds, thirst and hunger. */
export function woundsStep(w: World) {
  for (const id of w.rng.shuffle(w.order)) {
    if (w.aliveCount() <= 1) return;
    const c = w.c[id]!;
    if (!c.alive || w.acted.has(id) || w.isTravelling(c)) continue;
    if (c.health === 'critical' && w.rng.chance(P_CRITICAL_EVENT)) {
      runTrigger(w, 'succumb', id);
    } else if (c.health === 'wounded' && w.rng.chance(P_WOUND_WORSEN)) {
      runTrigger(w, 'woundWorsen', id);
    } else if (c.thirst >= THIRST_CRISIS && w.rng.chance(P_NEED_CRISIS)) {
      runTrigger(w, 'dehydration', id);
    } else if (c.hunger >= HUNGER_CRISIS && w.rng.chance(P_NEED_CRISIS)) {
      runTrigger(w, 'starvation', id);
    }
  }
}
