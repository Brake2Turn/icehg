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
        for (const p of e.patches) {
          if (p.p === 'death') {
            expect(o.border).toBe('red');
            expect(o.summary.join(' ')).toContain(name(p.id));
            expect(o.summary[0]).toMatch(/died$/);
          }
          if (p.p === 'groupNew') expect(o.summary.join(' ')).toMatch(/have an alliance/);
        }
        if (e.tags?.includes('betrayal')) {
          expect(['red', 'purple']).toContain(o.border);
          expect(o.summary.join(' ')).toMatch(/betrayed/);
        }
        for (const line of o.summary) expect(line).not.toMatch(/undefined|\?|\[\[/);
      }
    }
  });
});
