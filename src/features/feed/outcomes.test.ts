import { describe, expect, it } from 'vitest';
import { simulate } from '../../../engine';
import { makeCast } from '../../../engine/analysis/stats';
import { eventDb } from '../../../events';
import { describeLog } from './outcomes';

describe('feed outcomes (border + summary)', () => {
  it('every death is red and named; betrayals are flagged; group changes are described', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const setup = { mode: 'classic' as const, pace: 'standard' as const, seed, contestants: makeCast(24) };
      const r = simulate(setup, eventDb);
      const out = describeLog(setup, r.log);
      const name = (id: string) => setup.contestants.find((c) => c.id === id)!.name;
      for (const e of r.log) {
        if (e.kind !== 'event') continue;
        const o = out.get(e.seq)!;
        const all = o.summary.map((l) => l.text).join(' | ');
        const betrayal = !!e.tags?.includes('betrayal');
        for (const p of e.patches) {
          if (p.p === 'death') {
            expect(betrayal ? ['pink', 'red'] : ['red', 'pink']).toContain(o.border);
            expect(all).toContain(name(p.id));
          }
          if (p.p === 'groupNew') expect(all).toMatch(/have an alliance/);
        }
        if (betrayal) {
          expect(['pink', 'purple', 'red']).toContain(o.border);
          expect(all).toMatch(/betrayed/);
        }
        for (const [a, b] of e.saves ?? []) expect(all).toContain(`${name(a)} saved ${name(b)}`);
        for (const line of o.summary) expect(line.text).not.toMatch(/undefined|\?|\[\[/);
      }
    }
  });
});
