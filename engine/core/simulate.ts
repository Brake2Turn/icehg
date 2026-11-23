// Roll a whole game forward one tick at a time (§4.2). Never looks ahead, never aims for a length.
import type { EventDb } from '../../events/types';
import { BLOODBATH_TICKS, TICK_MIN } from '../tuning';
import { compileDb, type CompiledDb } from '../systems/compile';
import { midnight } from '../systems/affinity';
import { bloodbathTick, encounterStep } from '../systems/encounters';
import { gong, hazardStep, scheduledStep } from '../systems/gamemakers';
import { groupStep } from '../systems/groups';
import { movementStep } from '../systems/movement';
import { needsStep, woundsStep } from '../systems/needs';
import { soloStep } from '../systems/solo';
import { minuteOfDay, quietWindowTicks } from './clock';
import { blankView } from './stateAt';
import type { GameResult, GameSetup } from './types';
import { World } from './world';

export type SimHooks = {
  /** Called after each tick has been written to the log. */
  onTickEnd?: (w: World, tickStart: number) => void;
};

const compiledCache = new WeakMap<EventDb, CompiledDb>();
export function compiled(db: EventDb): CompiledDb {
  let c = compiledCache.get(db);
  if (!c) compiledCache.set(db, (c = compileDb(db)));
  return c;
}

export function simulate(setup: GameSetup, db: EventDb, hooks?: SimHooks): GameResult {
  if (setup.contestants.length < 2) throw new Error('A game needs at least 2 contestants');
  const w = new World(setup, compiled(db));
  const quietTicks = quietWindowTicks(setup.pace);
  let quietLeft = 0;
  let tick = 0;
  const over = () => w.aliveCount() <= 1;

  while (true) {
    const t = w.minute;
    w.acted.clear();
    if (minuteOfDay(t) === 0) {
      midnight(w);
      quietLeft = quietTicks;
    }
    w.expireTags();
    const quiet = quietLeft > 0;
    needsStep(w, quiet);
    if (!quiet) {
      if (tick === 0) gong(w);
      if (tick < BLOODBATH_TICKS) {
        bloodbathTick(w, tick, BLOODBATH_TICKS);
        if (tick === BLOODBATH_TICKS - 1) w.stats.bloodbathDeaths = w.startCount - w.aliveCount();
      } else {
        const steps = [scheduledStep, hazardStep, woundsStep, movementStep, soloStep, encounterStep, groupStep];
        for (const step of steps) {
          if (over()) break;
          step(w);
        }
      }
    }
    if (quietLeft > 0) quietLeft--;
    if (over()) {
      const last = w.alive()[0]!;
      w.declareVictor(last.id);
    }
    w.flush(t, TICK_MIN);
    hooks?.onTickEnd?.(w, t);
    if (w.victor) break;
    w.minute += TICK_MIN;
    tick++;
  }

  w.stats.victorEverInGroup = w.everInGroup.has(w.victor!);
  return {
    setup,
    log: w.log,
    initial: blankView(setup),
    victor: w.victor!,
    endMinute: w.minute,
    traits: w.traits,
    stats: w.stats,
  };
}
