// The fight system (§6.10). rollFight is pure maths (tested on its own); resolveFight applies it.
import type { FightLine } from '../../events/types';
import type { Rng } from '../core/rng';
import { renderText } from '../core/text';
import type { Health, Weapon } from '../core/types';
import {
  AMBUSH_BASE,
  AMBUSH_BONUS,
  AMBUSH_PER_STEALTH,
  FIGHT_ALPHA,
  FIGHT_CUNNING,
  FIGHT_MIN_SCORE,
  FIGHT_NOISE_SD,
  LOSER_DIE,
  LOSER_STEALTH_ESCAPE,
  LOSER_WOUND,
  LOYAL_IN_FIGHT,
  LOYAL_KILL_WEIGHT,
  LOYAL_STRENGTH_MULT,
  NIGHT_WOKEN_PENALTY,
  RARITY_WEIGHT,
  STALEMATE_BASE,
  STALEMATE_DIE,
  STALEMATE_WOUND,
  WEAPON_BONUS,
  WINNER_DIE,
  WINNER_RUTHLESS_DEATH,
  WINNER_WOUND,
  WOUND_PENALTY,
} from '../tuning';
import type { EventCtx } from './resolve';
import { injure, killWithWitnesses, textBinding, WEAPON_LABEL } from './resolve';
import { zoneLabel } from '../core/arena';

export type Fighter = {
  id: string;
  strength: number;
  stealth: number;
  cunning: number;
  ruthlessness: number;
  weapon: Weapon;
  health: Health;
  asleep: boolean;
};

export type Fate = 'dies' | 'wounded' | 'escapes' | 'fine';

export type FightRoll = {
  winner: 'A' | 'B' | 'stalemate';
  ambushed: boolean;
  powerA: number;
  powerB: number;
  fates: Record<string, Fate>;
  killer: Record<string, string>;
  wounder: Record<string, string>;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function rollFight(
  rng: Rng,
  A: Fighter[],
  B: Fighter[],
  opts: { ambush: boolean; night: boolean; aliveTotal: number; aff: (from: string, to: string) => number },
): FightRoll {
  const ambushed =
    opts.ambush && rng.chance(clamp01(AMBUSH_BASE + AMBUSH_PER_STEALTH * (avg(A.map((f) => f.stealth)) - avg(B.map((f) => f.cunning)))));
  const score = (f: Fighter, enemies: Fighter[], side: 'A' | 'B') => {
    let s = f.strength + WEAPON_BONUS[f.weapon] - WOUND_PENALTY[f.health] + FIGHT_CUNNING * f.cunning + rng.normal(0, FIGHT_NOISE_SD);
    s = Math.max(FIGHT_MIN_SCORE, s);
    if (enemies.some((e) => opts.aff(f.id, e.id) >= LOYAL_IN_FIGHT)) s *= LOYAL_STRENGTH_MULT;
    if (side === 'A' && ambushed) s *= 1 + AMBUSH_BONUS;
    if (side === 'B' && opts.night && f.asleep) s *= 1 - NIGHT_WOKEN_PENALTY;
    return s;
  };
  const sA = new Map(A.map((f) => [f.id, score(f, B, 'A')]));
  const sB = new Map(B.map((f) => [f.id, score(f, A, 'B')]));
  const X = [...sA.values()].reduce((a, b) => a + b, 0);
  const Y = [...sB.values()].reduce((a, b) => a + b, 0);

  let winner: FightRoll['winner'];
  if (rng.chance(STALEMATE_BASE * (1 - Math.abs(X - Y) / (X + Y)))) winner = 'stalemate';
  else winner = rng.chance(X ** FIGHT_ALPHA / (X ** FIGHT_ALPHA + Y ** FIGHT_ALPHA)) ? 'A' : 'B';

  const fates: Record<string, Fate> = {};
  const killer: Record<string, string> = {};
  const wounder: Record<string, string> = {};
  const pickOpponent = (victim: string, enemies: Fighter[], scores: Map<string, number>, forKill: boolean) => {
    const i = rng.weightedIndex(
      enemies.map((e) => scores.get(e.id)! * (forKill && opts.aff(e.id, victim) >= LOYAL_IN_FIGHT ? LOYAL_KILL_WEIGHT : 1)),
    );
    return enemies[i < 0 ? 0 : i]!.id;
  };

  if (winner === 'stalemate') {
    for (const [side, enemies, scores] of [
      [A, B, sB],
      [B, A, sA],
    ] as const) {
      for (const f of side) {
        const r = rng.next();
        fates[f.id] = r < STALEMATE_DIE ? 'dies' : r < STALEMATE_DIE + STALEMATE_WOUND ? 'wounded' : 'fine';
        if (fates[f.id] === 'dies') killer[f.id] = pickOpponent(f.id, enemies, scores, true);
        if (fates[f.id] === 'wounded') wounder[f.id] = pickOpponent(f.id, enemies, scores, false);
      }
    }
  } else {
    const [W, L, sW, sL, pW, pL] = winner === 'A' ? [A, B, sA, sB, X, Y] : [B, A, sB, sA, Y, X];
    const ruth = avg(W.map((f) => f.ruthlessness));
    const closeness = Math.min(1, pL / pW);
    for (const f of L) {
      const escape = Math.max(0.02, (1 - LOSER_DIE - LOSER_WOUND) + LOSER_STEALTH_ESCAPE * (f.stealth - 5));
      const die = clamp01(LOSER_DIE + WINNER_RUTHLESS_DEATH * (ruth - 5));
      const total = escape + die + LOSER_WOUND;
      const r = rng.next() * total;
      fates[f.id] = r < die ? 'dies' : r < die + LOSER_WOUND ? 'wounded' : 'escapes';
      if (fates[f.id] === 'dies') killer[f.id] = pickOpponent(f.id, W, sW, true);
      if (fates[f.id] === 'wounded') wounder[f.id] = pickOpponent(f.id, W, sW, false);
    }
    for (const f of W) {
      const r = rng.next();
      const die = WINNER_DIE * closeness;
      const wound = WINNER_WOUND * closeness;
      fates[f.id] = r < die ? 'dies' : r < die + wound ? 'wounded' : 'fine';
      if (fates[f.id] === 'dies') killer[f.id] = pickOpponent(f.id, L, sL, true);
      if (fates[f.id] === 'wounded') wounder[f.id] = pickOpponent(f.id, L, sL, false);
    }
  }

  // No mutual kills: if X killed K and K killed X, the second one survives, wounded.
  for (const v of Object.keys(killer)) {
    const k = killer[v]!;
    if (fates[v] === 'dies' && fates[k] === 'dies' && killer[k] === v) {
      fates[k] = 'wounded';
      wounder[k] = v;
      delete killer[k];
    }
  }
  // Never-wipe: if this would kill everyone left alive, spare the last one to fall.
  const dead = Object.keys(fates).filter((id) => fates[id] === 'dies');
  if (dead.length >= opts.aliveTotal) {
    const spare = dead[dead.length - 1]!;
    fates[spare] = 'wounded';
    wounder[spare] = killer[spare]!;
    delete killer[spare];
  }
  return { winner, ambushed, powerA: X, powerB: Y, fates, killer, wounder };
}

// ------------------------------------------------------------------ applying a fight to the world

function pickLine(ctx: EventCtx, lines: FightLine[], used: Set<string>, rng: Rng): FightLine | undefined {
  let pool = lines.filter((l) => !used.has(l.id));
  if (!pool.length) pool = lines;
  const i = rng.weightedIndex(pool.map((l) => RARITY_WEIGHT[l.rarity]));
  if (i < 0) return undefined;
  const l = pool[i]!;
  used.add(l.id);
  ctx.w.stats.fightLineUse[l.id] = (ctx.w.stats.fightLineUse[l.id] ?? 0) + 1;
  return l;
}

export function resolveFight(ctx: EventCtx, attackersIn: string[], defendersIn: string[], ambush: boolean) {
  const w = ctx.w;
  const rng = w.rng;
  const attackers = [...new Set(attackersIn)].filter((id) => w.c[id]!.alive);
  const defenders = [...new Set(defendersIn)].filter((id) => w.c[id]!.alive && !attackers.includes(id));
  if (!attackers.length || !defenders.length) return;
  const fighter = (id: string): Fighter => {
    const c = w.c[id]!;
    return { id, ...pickTraits(c.traits), weapon: c.weapon, health: c.health, asleep: c.asleep };
  };
  const roll = rollFight(rng, attackers.map(fighter), defenders.map(fighter), {
    ambush,
    night: w.band === 'night',
    aliveTotal: w.aliveCount(),
    aff: (a, b) => w.getAff(a, b),
  });
  for (const id of [...attackers, ...defenders]) {
    w.c[id]!.asleep = false;
    ctx.participants.add(id);
  }
  ctx.entryTags.add('fight');

  const lines = w.db.linesByKind;
  const used = new Set<string>();
  const zone = zoneLabel(ctx.zone);
  const out: string[] = [];
  const matchup = attackers.length === 1 && defenders.length === 1 ? '1v1' : attackers.length === 1 || defenders.length === 1 ? '1vGroup' : 'groupVsGroup';
  const roles = { G: textBinding(w, attackers, true), H: textBinding(w, defenders, true) };
  const opener = pickLine(
    ctx,
    lines.opener.filter((l) => !l.matchup || l.matchup.includes(matchup)),
    used,
    rng,
  );
  if (opener) out.push(renderText(opener.text, { roles, zone }));

  const weaponLines = (kind: 'kill' | 'wound', weapon: Weapon) =>
    lines[kind].filter((l) => !l.weapon || l.weapon.includes(weapon));

  // Deaths and wounds, in fighter order.
  const deaths: [string, string][] = [];
  // Winners who fall go first (they fell mid-fight), then the losers.
  const winnersFirst = roll.winner === 'B' ? [...defenders, ...attackers] : [...attackers, ...defenders];
  for (const id of winnersFirst) {
    const fate = roll.fates[id];
    if (fate === 'dies') {
      const k = roll.killer[id]!;
      deaths.push([id, k]);
      const kw = w.c[k]!.weapon;
      const l = pickLine(ctx, weaponLines('kill', kw), used, rng);
      if (l) out.push(renderText(l.text, { roles: { ...roles, K: textBinding(w, [k], false), V: textBinding(w, [id], false) }, zone, weapon: WEAPON_LABEL[kw] }));
    } else if (fate === 'wounded') {
      const k = roll.wounder[id] ?? id;
      const kw = w.c[k]!.weapon;
      const l = pickLine(ctx, weaponLines('wound', kw), used, rng);
      if (l) out.push(renderText(l.text, { roles: { ...roles, K: textBinding(w, [k], false), V: textBinding(w, [id], false) }, zone, weapon: WEAPON_LABEL[kw] }));
    }
  }
  const escapees = [...attackers, ...defenders].filter((id) => roll.fates[id] === 'escapes');
  for (const id of escapees) {
    const l = pickLine(ctx, lines.escape, used, rng);
    if (l) out.push(renderText(l.text, { roles: { ...roles, V: textBinding(w, [id], false) }, zone }));
  }

  // Ending line.
  const winSide = roll.winner === 'A' ? attackers : roll.winner === 'B' ? defenders : null;
  const loseSide = roll.winner === 'A' ? defenders : roll.winner === 'B' ? attackers : null;
  if (winSide && loseSide) {
    const standing = winSide.filter((id) => roll.fates[id] !== 'dies');
    if (standing.length) {
      const size = winSide.length > loseSide.length ? 'bigger' : winSide.length < loseSide.length ? 'smaller' : 'even';
      const l = pickLine(
        ctx,
        lines.ending.filter((x) => (!x.winner || x.winner === size) && (!x.matchup || x.matchup.includes(matchup))),
        used,
        rng,
      );
      if (l)
        out.push(
          renderText(l.text, { roles: { ...roles, W: textBinding(w, standing, true), L: textBinding(w, loseSide, true) }, zone }),
        );
    }
  } else {
    const l = pickLine(ctx, lines.stalemate, used, rng);
    if (l) out.push(renderText(l.text, { roles, zone }));
  }
  ctx.extra.push(...out);

  // Apply results.
  for (const [v, k] of deaths) {
    if (w.aliveCount() <= 1) break;
    killWithWitnesses(ctx, v, k);
    // Loot: the killer takes a better weapon and the pack.
    const vc = w.c[v]!;
    const kc = w.c[k]!;
    if (kc.alive) {
      if (WEAPON_BONUS[vc.weapon] > WEAPON_BONUS[kc.weapon]) w.setWeapon(k, vc.weapon);
      if (vc.items.length) w.setItems(k, [...kc.items, ...vc.items]);
    }
  }
  for (const id of [...attackers, ...defenders]) if (roll.fates[id] === 'wounded') injure(ctx, id, 'wounded');

  if (winSide && loseSide) {
    const fleeing = loseSide.filter((id) => w.c[id]!.alive);
    for (const id of fleeing) {
      w.addTag(id, 'hunted');
      ctx.queueMove(id, 'adjacent', rng);
    }
  } else {
    const a = attackers.find((id) => w.c[id]!.alive);
    const d = defenders.find((id) => w.c[id]!.alive);
    if (a) ctx.queueMove(a, 'adjacent', rng);
    if (d) ctx.queueMove(d, 'adjacent', rng, a ? ctx.destinationOf(a) : undefined);
  }

  const countDeaths = (side: string[]) => side.filter((id) => roll.fates[id] === 'dies' && !w.c[id]!.alive).length;
  ctx.fight = {
    sizeA: attackers.length,
    sizeB: defenders.length,
    winner: roll.winner,
    deathsA: countDeaths(attackers),
    deathsB: countDeaths(defenders),
  };
}

function pickTraits(t: { strength: number; stealth: number; cunning: number; ruthlessness: number }) {
  return { strength: t.strength, stealth: t.stealth, cunning: t.cunning, ruthlessness: t.ruthlessness };
}
