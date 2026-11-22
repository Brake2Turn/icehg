import { describe, expect, it } from 'vitest';
import { eventDb } from '../../events';
import { validateEventDb } from '../../events/validate';
import { isHazard, type AnyTemplate, type Outcome } from '../../events/types';
import { hasLeftoverTokens, renderText, type TextBinding, type TextContext } from '../core/text';
import type { PronounKey } from '../core/types';

const PRONOUNS: PronounKey[] = ['he', 'she', 'they'];

function people(n: number, p: PronounKey, prefix: string): TextBinding {
  return { people: Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, pronouns: p })), isUnit: true };
}

function ctxFor(t: AnyTemplate | null, p: PronounKey, gSize: number, hSize: number): TextContext {
  const one = (r: string) => ({ people: [{ id: r, pronouns: p }], isUnit: false });
  const roles: TextContext['roles'] = { A: one('A'), B: one('B'), C: one('C'), X: one('X'), K: one('K'), V: one('V') };
  roles.G = people(gSize, p, 'g');
  roles.H = people(hSize, p, 'h');
  roles.W = people(gSize, p, 'w');
  roles.L = people(hSize, p, 'l');
  // {R}: the rest of G after the single roles bound inside it.
  const inside = t && !isHazard(t) ? (t.requires?.inGroup ?? []).filter((x) => x.group === 'G').length : 0;
  roles.R = people(Math.max(1, gSize - inside), p, 'r');
  return { roles, zone: 'forest', item: 'medkit', weapon: 'knife' };
}

const sizes = (r?: { min: number; max: number }) => (r ? Array.from({ length: r.max - r.min + 1 }, (_, i) => r.min + i) : [1]);

describe('event database', () => {
  it('every template and fight line passes zod validation', () => {
    expect(() => validateEventDb()).not.toThrow();
  });

  it('ids are unique', () => {
    const ids = [...eventDb.templates.map((t) => t.id), ...eventDb.fightLines.map((l) => l.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has the Phase 1 starter set (§6.12)', () => {
    const t = eventDb.templates;
    expect(t.length).toBeGreaterThanOrEqual(120);
    const by = (c: string) => t.filter((x) => x.category === c).length;
    expect(by('bloodbath')).toBeGreaterThanOrEqual(20);
    expect(by('solo')).toBeGreaterThanOrEqual(40);
    expect(by('encounter')).toBeGreaterThanOrEqual(30);
    expect(by('group')).toBeGreaterThanOrEqual(20);
    expect(by('gamemaker') + by('feast')).toBeGreaterThanOrEqual(10);
    for (const r of ['common', 'uncommon', 'rare', 'veryRare', 'legendary']) expect(t.some((x) => x.rarity === r)).toBe(true);
    const fl = eventDb.fightLines;
    const k = (kind: string) => fl.filter((l) => l.kind === kind);
    expect(k('opener').length).toBeGreaterThanOrEqual(10);
    for (const m of ['1v1', '1vGroup', 'groupVsGroup'] as const) expect(k('opener').some((l) => !l.matchup || l.matchup.includes(m))).toBe(true);
    expect(k('kill').length).toBeGreaterThanOrEqual(30);
    for (const w of ['none', 'knife', 'spear', 'bow', 'axe', 'sword', 'mace'] as const) expect(k('kill').some((l) => l.weapon?.includes(w))).toBe(true);
    expect(k('wound').length).toBeGreaterThanOrEqual(15);
    expect(k('escape').length).toBeGreaterThanOrEqual(8);
    expect(k('ending').length).toBeGreaterThanOrEqual(10);
    expect(k('ending').some((l) => l.winner === 'smaller')).toBe(true);
  });

  it('lethal templates have at least 2 outcomes, including a non-lethal one', () => {
    for (const t of eventDb.templates) {
      if (t.severity !== 'lethal') continue;
      const outs: Outcome[] = isHazard(t) ? t.perVictim : t.outcomes;
      expect(outs.length, t.id).toBeGreaterThanOrEqual(2);
      const lethal = (o: Outcome) => o.effects.some((e) => e.kind === 'kill' || e.kind === 'fight');
      expect(outs.some((o) => !lethal(o)), `${t.id} needs a non-lethal outcome`).toBe(true);
    }
  });

  it('covers the required themes', () => {
    const all = JSON.stringify(eventDb.templates);
    for (const tag of ['abandoned', 'grieving', 'vengeful', 'betrayed', 'hunted']) expect(all).toContain(`"has":["${tag}"]`);
    for (const need of ['hunger', 'thirst', 'fatigue']) expect(all).toContain(`"need":"${need}"`);
    expect(all).toContain('"item":"medkit"');
    expect(all).toContain('"item":"trap"');
    expect(eventDb.templates.some((t) => t.betrayal)).toBe(true);
    expect(eventDb.templates.some((t) => t.id.includes('mercy'))).toBe(true);
    expect(eventDb.templates.some((t) => t.id.includes('revenge'))).toBe(true);
    expect(eventDb.templates.some((t) => t.trigger === 'woundWorsen')).toBe(true);
    expect(all).toContain('own life');
  });

  it('every template renders with no leftover {tokens} for each pronoun set and group size', () => {
    for (const t of eventDb.templates) {
      const outs: Outcome[] = isHazard(t) ? t.perVictim : t.outcomes;
      const texts = [...outs.map((o) => o.text), ...(isHazard(t) ? [t.intro] : [])];
      for (const p of PRONOUNS)
        for (const g of sizes(t.roles.G))
          for (const h of sizes(t.roles.H))
            for (const text of texts) {
              const out = renderText(text, ctxFor(t, p, g, h));
              expect(hasLeftoverTokens(out), `${t.id} [${p}, G=${g}, H=${h}]: ${out}`).toBe(false);
            }
    }
    for (const l of eventDb.fightLines)
      for (const p of PRONOUNS)
        for (const g of [1, 2, 4]) {
          const out = renderText(l.text, ctxFor(null, p, g, g));
          expect(hasLeftoverTokens(out), `${l.id}: ${out}`).toBe(false);
        }
  });

  it('verb agreement reads naturally', () => {
    const one = (p: PronounKey): TextBinding => ({ people: [{ id: 'x', pronouns: p }], isUnit: false });
    expect(renderText('{A} run{A.s}. {A.They} run{A.s}.', { roles: { A: one('they') } })).toBe('[[x]] runs. They run.');
    expect(renderText('{A} {A.is} here. {A.They} {A.is} tired.', { roles: { A: one('she') } })).toBe('[[x]] is here. She is tired.');
    expect(renderText('{G} spot{G.s} it.', { roles: { G: people(2, 'he', 'g') } })).toBe('[[g0]] and [[g1]] spot it.');
    expect(renderText('{G} spot{G.s} it.', { roles: { G: people(3, 'he', 'g') } })).toBe('[[g0]], [[g1]] and [[g2]] spot it.');
    expect(renderText('{G.count}', { roles: { G: people(5, 'he', 'g') } })).toBe('five');
  });
});

// Content rules (§6.13). Banned words are matched on word boundaries across all event text.
const BANNED_PLAIN = [
  'sex', 'sexy', 'sexual', 'sexually', 'rape', 'raped', 'rapes', 'raping', 'rapist', 'molest', 'molested', 'grope', 'groped',
  'kiss', 'kissed', 'kisses', 'kissing', 'lover', 'lovers', 'boyfriend', 'girlfriend', 'flirt', 'flirts', 'flirting', 'flirted',
  'romance', 'romantic', 'romantically', 'sweetheart', 'darling', 'naked', 'nude', 'seduce', 'seduces', 'seductive', 'erotic',
  'orgasm', 'aroused', 'makes out', 'making out', 'in love', 'falls in love', 'fell in love', 'married', 'marry', 'wedding',
  'honeymoon', 'couple', 'cuddle', 'cuddles', 'snuggle', 'has a crush', 'crush on', 'date night', 'on a date', 'breasts', 'genitals',
];
// Slurs, base64-encoded so they don't sit in the source as plain text.
const BANNED_ENCODED = [
  'ZmFn', 'ZmFnZ290', 'cmV0YXJk', 'cmV0YXJkZWQ=', 'dHJhbm55', 'c3Bhc3RpYw==', 'c3Bheg==', 'Y2hpbms=', 'a2lrZQ==', 'd2V0YmFjaw==',
  'ZHlrZQ==', 'bmlnZ2Vy', 'bmlnZ2E=', 'cGFraQ==', 'Z3lwcGVk', 'c2hlbWFsZQ==', 'Y3JpcHBsZQ==', 'bWlkZ2V0', 'aG9tbw==', 'bGV6emE=',
].map((b) => Buffer.from(b, 'base64').toString('utf8'));

describe('content rules (§6.13)', () => {
  const allText: { id: string; text: string }[] = [];
  for (const t of eventDb.templates) {
    const outs: Outcome[] = isHazard(t) ? t.perVictim : t.outcomes;
    for (const o of outs) allText.push({ id: t.id, text: o.text });
    if (isHazard(t)) allText.push({ id: t.id, text: t.intro });
  }
  for (const l of eventDb.fightLines) allText.push({ id: l.id, text: l.text });

  it('no banned words anywhere in event text', () => {
    for (const word of [...BANNED_PLAIN, ...BANNED_ENCODED]) {
      const re = new RegExp(`\\b${word.replace(/ /g, '\\s+')}\\b`, 'i');
      for (const { id, text } of allText) expect(re.test(text), `${id} contains a banned word`).toBe(false);
    }
  });

  it('suicide is always one plain sentence and never common', () => {
    for (const t of eventDb.templates) {
      const outs: Outcome[] = isHazard(t) ? t.perVictim : t.outcomes;
      for (const o of outs) {
        if (!/own life|suicide|kills? (him|her|them)sel(f|ves)/i.test(o.text)) continue;
        const rendered = renderText(o.text, ctxFor(t, 'she', 1, 1));
        const sentences = rendered.split(/[.!?]/).filter((s) => s.trim().length);
        expect(sentences.length, t.id).toBe(1);
        expect(rendered.length, t.id).toBeLessThan(70);
        expect(['rare', 'veryRare', 'legendary']).toContain(t.rarity);
      }
    }
  });
});
