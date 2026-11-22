import { eventDb } from '../../events';
import { makeCast } from '../analysis/stats';
import { simulate, type SimHooks } from '../core/simulate';
import type { GameResult, GameSetup } from '../core/types';

export const db = eventDb;

export function setup(n: number, seed: number, pace: GameSetup['pace'] = 'standard'): GameSetup {
  return { mode: n === 24 ? 'classic' : 'custom', pace, seed, contestants: makeCast(n) };
}

export function run(n: number, seed: number, hooks?: SimHooks): GameResult {
  return simulate(setup(n, seed), db, hooks);
}
