// Time helpers and the viewing clock (§4.2, §6.3, §9).
import { DAY_MIN, GAME_MIN_PER_SEC, QUIET_REAL_SECONDS, TICK_MIN } from '../tuning';
import type { Pace, TimeBand } from './types';

export type GameClock = {
  anchorWallMs: number;
  anchorGameMin: number;
  speed: number;
  paused: boolean;
  pace: Pace;
};

/** Current game minute shown on screen. Never changes what happens, only what you see. */
export function gameNow(c: GameClock, wallNowMs: number): number {
  if (c.paused) return c.anchorGameMin;
  return c.anchorGameMin + ((wallNowMs - c.anchorWallMs) / 1000) * c.speed * GAME_MIN_PER_SEC[c.pace];
}

/** Re-anchor (call before changing speed/pause). */
export function reanchor(c: GameClock, wallNowMs: number): GameClock {
  return { ...c, anchorGameMin: gameNow(c, wallNowMs), anchorWallMs: wallNowMs };
}

export function setPaused(c: GameClock, paused: boolean, wallNowMs: number): GameClock {
  return { ...reanchor(c, wallNowMs), paused };
}

export function setSpeed(c: GameClock, speed: number, wallNowMs: number): GameClock {
  return { ...reanchor(c, wallNowMs), speed };
}

export function jumpTo(c: GameClock, gameMin: number, wallNowMs: number): GameClock {
  return { ...c, anchorGameMin: gameMin, anchorWallMs: wallNowMs };
}

export function dayOf(minute: number): number {
  return 1 + Math.floor(minute / DAY_MIN);
}

export function minuteOfDay(minute: number): number {
  return ((minute % DAY_MIN) + DAY_MIN) % DAY_MIN;
}

export function timeBand(minute: number): TimeBand {
  const h = minuteOfDay(minute) / 60;
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 18) return 'day';
  if (h >= 18 && h < 20) return 'dusk';
  return 'night';
}

/** "Day 3 · 21:40" */
export function formatGameTime(minute: number): string {
  const m = Math.floor(minuteOfDay(minute));
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `Day ${dayOf(minute)} · ${hh}:${mm}`;
}

/** Quiet window after midnight in game minutes (≈8 real seconds at 1x). */
export function quietWindowMinutes(pace: Pace): number {
  return QUIET_REAL_SECONDS * GAME_MIN_PER_SEC[pace];
}

export function quietWindowTicks(pace: Pace): number {
  return Math.max(1, Math.ceil(quietWindowMinutes(pace) / TICK_MIN));
}
