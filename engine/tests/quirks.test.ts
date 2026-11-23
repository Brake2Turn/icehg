// Quirks should do what they say, on average over many games.
import { describe, expect, it } from 'vitest';
import { makeCast } from '../analysis/stats';
import { defaultAffinity } from '../core/affinity';
import { simulate } from '../core/simulate';
import type { QuirkId } from '../core/quirks';
import { db } from './helpers';
import { Rng } from '../core/rng';
import { rollFight } from '../systems/fight';
import { QUIRK_EFFECTS } from '../tuning';

function many(quirk: QuirkId, games = 150) {
  // Contestant c0 has the quirk; everyone else is plain.
  let survivedMin = 0;
  let wins = 0;
  let groupTicks = 0;
  let betrayals = 0;
  for (let i = 0; i < games; i++) {
    const contestants = makeCast(24).map((c, j) => (j === 0 ? { ...c, quirk } : c));
    const r = simulate({ mode: 'classic', pace: 'standard', seed: 50_000 + i, contestants }, db, {
      onTickEnd: (w) => {
        if (w.c.c0!.alive && w.c.c0!.groupId) groupTicks++;
      },
    });
    let died = r.endMinute;
    for (const e of r.log) {
      for (const p of e.patches) if (p.p === 'death' && p.id === 'c0') died = e.gameMinute;
      if (e.kind === 'event' && e.tags?.includes('betrayal') && e.nameColours.c0 === 'purple') betrayals++;
    }
    survivedMin += died;
    if (r.victor === 'c0') wins++;
  }
  return { survived: survivedMin / games, wins, groupTicks: groupTicks / games, betrayals };
}

describe('quirks', () => {
  const plain = many(undefined as unknown as QuirkId);
  const plain300 = many(undefined as unknown as QuirkId, 300);
  it('Career and Young change how everyone else feels about them', () => {
    const ids = ['a', 'b', 'c'];
    const base = defaultAffinity(ids, 7);
    const career = defaultAffinity(ids, 7, 'random', { a: 'career' });
    const young = defaultAffinity(ids, 7, 'random', { a: 'young' });
    expect(career.b!.a!).toBeLessThan(base.b!.a!);
    expect(young.b!.a!).toBeGreaterThan(base.b!.a!);
  });
  it('Career wins more often than a plain contestant', () => {
    expect(many('career', 300).wins).toBeGreaterThan(plain300.wins);
  });
  it('Psycho wins more fights alone against two attackers', () => {
    const one = (mult: number) => {
      const rng = new Rng(3);
      let wins = 0;
      const f = (id: string, m = 1) => ({ id, strength: 5, stealth: 5, cunning: 5, ruthlessness: 5, weapon: 'none' as const, health: 'healthy' as const, asleep: false, mult: m });
      for (let i = 0; i < 4000; i++) if (rollFight(rng, [f('a', mult)], [f('b'), f('c')], { ambush: false, night: false, aliveTotal: 3, aff: () => 0 }).winner === 'A') wins++;
      return wins / 4000;
    };
    expect(one(QUIRK_EFFECTS.psycho.fightAlone!)).toBeGreaterThan(one(1) * 1.8);
  });
  it('People person spends more time in alliances, Psycho less', () => {
    const pp = many('peoplePerson');
    const psycho = many('psycho');
    expect(pp.groupTicks).toBeGreaterThan(plain.groupTicks);
    expect(psycho.groupTicks).toBeLessThan(plain.groupTicks);
  });
  it('Backstabber betrays more than Loyal', () => {
    expect(many('backstabber').betrayals).toBeGreaterThan(many('loyal').betrayals);
  });
});
