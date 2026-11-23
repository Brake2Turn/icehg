import { describe, expect, it } from 'vitest';
import { minuteOfDay } from '../core/clock';
import { simulate } from '../core/simulate';
import { stateAt, ViewFolder } from '../core/stateAt';
import type { LogEntry, ViewState } from '../core/types';
import { TICK_MIN } from '../tuning';
import { db, run, setup } from './helpers';

const strip = (v: ViewState) => ({ ...v, minute: 0 });

describe('determinism', () => {
  it('same setup + seed gives an identical log', () => {
    const a = run(24, 42);
    const b = run(24, 42);
    expect(JSON.stringify(a.log)).toBe(JSON.stringify(b.log));
    expect(a.victor).toBe(b.victor);
  });
  it('different seeds give different games', () => {
    expect(JSON.stringify(run(24, 1).log)).not.toBe(JSON.stringify(run(24, 2).log));
  });
});

describe('exactly one Victor', () => {
  for (const n of [2, 3, 12, 24, 48]) {
    it(`field of ${n}`, () => {
      for (let seed = 1; seed <= (n >= 24 ? 12 : 30); seed++) {
        const r = run(n, seed * 7919 + n);
        const victors = r.log.filter((e) => e.kind === 'victor');
        expect(victors).toHaveLength(1);
        const final = stateAt(r.setup, r.log, Infinity);
        const alive = Object.values(final.contestants).filter((c) => c.alive);
        expect(alive).toHaveLength(1);
        expect(alive[0]!.id).toBe(r.victor);
        expect(final.victor).toBe(r.victor);
        // the victor entry is the very last thing in the log
        expect(r.log[r.log.length - 1]!.kind).toBe('victor');
      }
    });
  }
});

function checkLog(log: LogEntry[]) {
  const dead = new Set<string>();
  const perTick = new Map<number, Map<string, number>>();
  let lastMinute = -Infinity;
  for (const e of log) {
    expect(e.gameMinute).toBeGreaterThanOrEqual(lastMinute);
    lastMinute = e.gameMinute;
    if (e.kind === 'event') {
      for (const id of e.participants) expect(dead.has(id), `${id} acts after death in ${e.templateId}`).toBe(false);
      const tick = Math.floor(e.gameMinute / TICK_MIN);
      const m = perTick.get(tick) ?? new Map<string, number>();
      perTick.set(tick, m);
      for (const id of e.participants) {
        m.set(id, (m.get(id) ?? 0) + 1);
        expect(m.get(id), `${id} has two visible events in one tick (${e.templateId})`).toBe(1);
      }
    }
    if (e.kind === 'move') for (const id of e.who) expect(dead.has(id), `${id} moves after death`).toBe(false);
    for (const p of e.patches) {
      if (p.p === 'aff') {
        expect(p.v).toBeGreaterThanOrEqual(-100);
        expect(p.v).toBeLessThanOrEqual(100);
      }
      if (p.p === 'affAll') for (const row of p.v) for (const v of row) expect(Math.abs(v)).toBeLessThanOrEqual(100);
      if (p.p === 'tags' || p.p === 'health' || p.p === 'zone' || p.p === 'weapon') {
        expect(dead.has(p.id), `patch ${p.p} on dead ${p.id}`).toBe(false);
      }
    }
    for (const p of e.patches) if (p.p === 'death') {
      expect(dead.has(p.id)).toBe(false);
      dead.add(p.id);
    }
  }
}

describe('log invariants', () => {
  it('the dead never act, move or appear in later events; one visible event per contestant per tick; affinity stays in range', () => {
    for (const n of [3, 12, 24, 48]) for (let seed = 100; seed < 110; seed++) checkLog(run(n, seed).log);
  });
});

describe('stateAt', () => {
  it("matches the engine's internal state at every midnight", () => {
    for (const seed of [3, 17, 99, 2024]) {
      const s = setup(24, seed);
      let checks = 0;
      simulate(s, db, {
        onTickEnd: (w, t) => {
          if (minuteOfDay(t) !== 0) return;
          const view = stateAt(s, w.log, t + TICK_MIN - 1e-6);
          expect(strip(view)).toEqual(strip(w.viewState()));
          checks++;
        },
      });
      expect(checks).toBeGreaterThan(0);
    }
  });
  it('ViewFolder (incremental) agrees with a full fold, forwards and backwards', () => {
    const r = run(24, 5);
    const f = new ViewFolder(r.setup, r.log);
    const end = r.log[r.log.length - 1]!.gameMinute;
    for (const t of [600, 900, 2000, end / 2, end, 1500, 700]) {
      expect(strip(f.at(t))).toEqual(strip(stateAt(r.setup, r.log, t)));
    }
  });
});

describe('alliances', () => {
  it('everyone left is never allowed to be one alliance for long, and never by forming one', () => {
    for (const n of [3, 6, 24]) {
      for (let seed = 300; seed < 330; seed++) {
        let streak = 0;
        simulate(setup(n, seed), db, {
          onTickEnd: (w) => {
            const alive = w.aliveCount();
            const all = alive >= 2 && [...w.groups.values()].some((g) => g.members.length === alive);
            streak = all ? streak + 1 : 0;
            expect(streak, `seed ${seed}: last alliance survived ${streak} ticks`).toBeLessThanOrEqual(16);
          },
        });
      }
    }
  });
});

describe('game shape', () => {
  it('the Fallen list at each midnight matches the deaths since the previous one', () => {
    const r = run(24, 77);
    let since: string[] = [];
    for (const e of r.log) {
      if (e.kind === 'midnight') {
        expect(e.fallen.sort()).toEqual(since.sort());
        since = [];
      }
      for (const p of e.patches) if (p.p === 'death') since.push(p.id);
    }
  });
  it('nothing visible happens in the quiet window after midnight', () => {
    const r = run(24, 8);
    for (const m of r.log.filter((e) => e.kind === 'midnight')) {
      const q = m.kind === 'midnight' ? m.quietUntil : 0;
      const visible = r.log.filter((e) => e.kind === 'event' && e.gameMinute >= m.gameMinute && e.gameMinute < q);
      expect(visible).toHaveLength(0);
    }
  });
});
