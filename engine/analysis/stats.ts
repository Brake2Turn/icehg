// Aggregate statistics over many simulated games (§6.14). Pure: runs in Node or the browser.
import type { EventDb } from '../../events/schema';
import { isHazard } from '../../events/schema';
import { dayOf } from '../core/clock';
import { simulate } from '../core/simulate';
import type { GameResult, GameSetup, PronounKey } from '../core/types';
import { START_MINUTE } from '../tuning';

export function makeCast(n: number, classic = n === 24): GameSetup['contestants'] {
  const p: PronounKey[] = ['he', 'she', 'they'];
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    name: `Tribute ${i + 1}`,
    pronouns: p[i % 3]!,
    ...(classic ? { district: Math.floor(i / 2) + 1 } : {}),
  }));
}

export type SimStats = {
  games: number;
  lengthDays: number[];
  bloodbathDeaths: number[];
  deathsPerDay: number[];
  eventsPerHourByDay: number[];
  firstHourEvents: number[];
  groupsFormed: number[];
  betrayals: number[];
  victorEverInGroupShare: number;
  legendaryPer100: number;
  fights: Record<string, { n: number; smallerWins: number; stalemates: number; deathsSmaller: number; deathsBigger: number }>;
  templateUse: Record<string, number>;
  fightLineUse: Record<string, number>;
  unusedTemplates: string[];
  unusedFightLines: string[];
  quietStretches: number;
};

export function runStats(db: EventDb, games: number, size = 24, seed0 = 1000, onProgress?: (i: number) => void): SimStats {
  const results: GameResult[] = [];
  for (let i = 0; i < games; i++) {
    results.push(simulate({ mode: size === 24 ? 'classic' : 'custom', pace: 'standard', seed: seed0 + i, contestants: makeCast(size) }, db));
    onProgress?.(i);
  }
  return summarise(db, results);
}

export function summarise(db: EventDb, results: GameResult[]): SimStats {
  const lengthDays: number[] = [];
  const deathsByDay: number[] = [];
  const eventsByDay: number[] = [];
  const hoursByDay: number[] = [];
  const firstHourEvents: number[] = [];
  const fights: SimStats['fights'] = {};
  const templateUse: Record<string, number> = {};
  const fightLineUse: Record<string, number> = {};
  let quietStretches = 0;
  let legendary = 0;
  let victorInGroup = 0;
  for (const r of results) {
    const endDay = dayOf(r.endMinute);
    lengthDays.push(endDay);
    let firstHour = 0;
    let lastEventMin = START_MINUTE;
    for (const e of r.log) {
      if (e.kind !== 'event') continue;
      const d = dayOf(e.gameMinute) - 1;
      eventsByDay[d] = (eventsByDay[d] ?? 0) + 1;
      if (e.gameMinute < START_MINUTE + 60) firstHour++;
      if (e.gameMinute - lastEventMin >= 4 * 60) quietStretches++;
      lastEventMin = e.gameMinute;
      for (const p of e.patches) if (p.p === 'death') deathsByDay[d] = (deathsByDay[d] ?? 0) + 1;
      if (e.fight) {
        const small = Math.min(e.fight.sizeA, e.fight.sizeB);
        const big = Math.max(e.fight.sizeA, e.fight.sizeB);
        const key = `${small}v${big}`;
        const f = (fights[key] ??= { n: 0, smallerWins: 0, stalemates: 0, deathsSmaller: 0, deathsBigger: 0 });
        f.n++;
        const aSmaller = e.fight.sizeA <= e.fight.sizeB;
        if (e.fight.winner === 'stalemate') f.stalemates++;
        else if (small !== big && (e.fight.winner === 'A') === aSmaller) f.smallerWins++;
        else if (small === big && e.fight.winner === 'A') f.smallerWins++;
        f.deathsSmaller += aSmaller ? e.fight.deathsA : e.fight.deathsB;
        f.deathsBigger += aSmaller ? e.fight.deathsB : e.fight.deathsA;
      }
    }
    // hours elapsed per day (Day 1 starts at 10:00, last day ends at endMinute)
    for (let d = 0; d < endDay; d++) {
      const start = d === 0 ? START_MINUTE : d * 1440;
      const end = d === endDay - 1 ? r.endMinute : (d + 1) * 1440;
      hoursByDay[d] = (hoursByDay[d] ?? 0) + Math.max(0, end - start) / 60;
    }
    firstHourEvents.push(firstHour);
    legendary += r.stats.legendaryOutcomes;
    if (r.stats.victorEverInGroup) victorInGroup++;
    for (const [k, v] of Object.entries(r.stats.templateUse)) templateUse[k] = (templateUse[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.stats.fightLineUse)) fightLineUse[k] = (fightLineUse[k] ?? 0) + v;
  }
  const n = results.length;
  const maxDay = Math.max(...lengthDays);
  const deathsPerDay: number[] = [];
  const eventsPerHourByDay: number[] = [];
  for (let d = 0; d < maxDay; d++) {
    deathsPerDay.push((deathsByDay[d] ?? 0) / n);
    eventsPerHourByDay.push(hoursByDay[d] ? (eventsByDay[d] ?? 0) / hoursByDay[d]! : 0);
  }
  const unusedTemplates = db.templates
    .filter((t) => !(t.id in templateUse))
    .filter((t) => !(isHazard(t) && t.trigger === 'feastDrop'))
    .map((t) => t.id);
  const unusedFightLines = db.fightLines.filter((l) => !(l.id in fightLineUse)).map((l) => l.id);
  return {
    games: n,
    lengthDays,
    bloodbathDeaths: results.map((r) => r.stats.bloodbathDeaths),
    deathsPerDay,
    eventsPerHourByDay,
    firstHourEvents,
    groupsFormed: results.map((r) => r.stats.groupsFormed),
    betrayals: results.map((r) => r.stats.betrayals),
    victorEverInGroupShare: victorInGroup / n,
    legendaryPer100: (legendary / n) * 100,
    fights,
    templateUse,
    fightLineUse,
    unusedTemplates,
    unusedFightLines,
    quietStretches: quietStretches / n,
  };
}

export const median = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
export const pct = (xs: number[], p: number) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};
