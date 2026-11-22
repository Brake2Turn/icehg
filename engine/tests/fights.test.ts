import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { rollFight, type Fighter } from '../systems/fight';

const even = (id: string): Fighter => ({ id, strength: 5, stealth: 5, cunning: 5, ruthlessness: 5, weapon: 'none', health: 'healthy', asleep: false });

function trial(small: number, big: number, n: number, seed: number) {
  const rng = new Rng(seed);
  let smallWins = 0;
  let wipes = 0;
  let allBigDead = 0;
  for (let i = 0; i < n; i++) {
    const A = Array.from({ length: small }, (_, j) => even(`a${j}`));
    const B = Array.from({ length: big }, (_, j) => even(`b${j}`));
    // Randomly choose who attacks, so neither role is favoured.
    const aAttacks = rng.chance(0.5);
    const r = rollFight(rng, aAttacks ? A : B, aAttacks ? B : A, { ambush: false, night: false, aliveTotal: small + big, aff: () => 0 });
    const smallSide = aAttacks ? 'A' : 'B';
    if (r.winner === smallSide) smallWins++;
    const dead = Object.values(r.fates).filter((f) => f === 'dies').length;
    if (dead >= small + big) wipes++;
    if (r.winner === smallSide && B.every((f) => r.fates[f.id] === 'dies')) allBigDead++;
  }
  return { smallRate: smallWins / n, wipes, allBigDeadRate: allBigDead / n };
}

describe('fights (§6.10)', () => {
  const N = 10000;
  const results = [1, 2, 3, 4, 5].map((big) => ({ big, ...trial(1, big, N, 1234 + big) }));

  it('the bigger side wins more often as the size gap grows', () => {
    for (let i = 1; i < results.length; i++) expect(results[i]!.smallRate).toBeLessThan(results[i - 1]!.smallRate);
  });
  it('a lone tribute beats two attackers about 1 time in 4, and five about 1 time in 12', () => {
    expect(results[1]!.smallRate).toBeGreaterThan(0.17);
    expect(results[1]!.smallRate).toBeLessThan(0.3);
    expect(results[4]!.smallRate).toBeGreaterThan(0.04);
    expect(results[4]!.smallRate).toBeLessThan(0.12);
  });
  it('a lone tribute killing all five attackers is well under 1%', () => {
    expect(results[4]!.allBigDeadRate).toBeLessThan(0.01);
  });
  it('no fight ever kills everyone left alive', () => {
    for (const r of results) expect(r.wipes).toBe(0);
    expect(trial(3, 4, N, 99).wipes).toBe(0);
  });
});
