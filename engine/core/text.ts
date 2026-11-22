// Event text rendering (§6.12 tokens). Names become markers [[id]] so the UI can draw chips.
import type { PronounKey } from './types';

export type TextPerson = { id: string; pronouns: PronounKey };
/** A role's binding: one person, or a unit (one or more people). */
export type TextBinding = { people: TextPerson[]; isUnit: boolean };

const PRONOUNS: Record<PronounKey, { they: string; them: string; their: string; theirs: string; themself: string }> = {
  he: { they: 'he', them: 'him', their: 'his', theirs: 'his', themself: 'himself' },
  she: { they: 'she', them: 'her', their: 'her', theirs: 'hers', themself: 'herself' },
  they: { they: 'they', them: 'them', their: 'their', theirs: 'theirs', themself: 'themself' },
};
const PLURAL = { they: 'they', them: 'them', their: 'their', theirs: 'theirs', themself: 'themselves' };

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

export function marker(id: string): string {
  return `[[${id}]]`;
}

export function joinNames(ids: string[]): string {
  const m = ids.map(marker);
  if (m.length <= 1) return m.join('');
  return `${m.slice(0, -1).join(', ')} and ${m[m.length - 1]}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Verb agreement table: singular (he/she) vs plural (they or a group). */
const VERBS: Record<string, [string, string]> = {
  is: ['is', 'are'],
  was: ['was', 'were'],
  has: ['has', 'have'],
  does: ['does', 'do'],
  s: ['s', ''],
  es: ['es', ''],
  ies: ['ies', 'y'],
};

export type TextContext = {
  roles: Partial<Record<string, TextBinding>>;
  zone?: string;
  item?: string;
  weapon?: string;
  extra?: Record<string, string>;
};

/**
 * Replace tokens. Unknown tokens are left as-is so tests can detect them.
 * Supported: {R} {R.count} {R.first} {R.they}/{R.They}… {R.is} {R.was} {R.has} {R.does} {R.s} {R.es} {R.ies}
 * plus {zone} {item} {weapon} and any `extra` keys.
 */
export function renderText(template: string, ctx: TextContext): string {
  // Verb agreement: after a name, verbs follow the head-count ("Sam runs", "Sam and Jo run");
  // after a subject pronoun ({A.they}), they follow the pronoun ("they run").
  const afterPronoun: Record<string, boolean> = {};
  return template.replace(/\{([A-Za-z]+)(?:\.([A-Za-z]+))?\}/g, (whole, key: string, sub: string | undefined) => {
    if (!sub) {
      if (key === 'zone' && ctx.zone !== undefined) return ctx.zone;
      if (key === 'item' && ctx.item !== undefined) return ctx.item;
      if (key === 'weapon' && ctx.weapon !== undefined) return ctx.weapon;
      if (ctx.extra && key in ctx.extra) return ctx.extra[key]!;
      const b = ctx.roles[key];
      if (b) {
        afterPronoun[key] = false;
        return joinNames(b.people.map((p) => p.id));
      }
      return whole;
    }
    const b = ctx.roles[key];
    if (!b || b.people.length === 0) return whole;
    const many = b.people.length > 1;
    if (sub === 'count') return NUMBER_WORDS[b.people.length] ?? String(b.people.length);
    if (sub === 'Count') return cap(NUMBER_WORDS[b.people.length] ?? String(b.people.length));
    if (sub === 'first') {
      afterPronoun[key] = false;
      return marker(b.people[0]!.id);
    }
    const lower = sub.charAt(0).toLowerCase() + sub.slice(1);
    const isCap = sub !== lower;
    if (lower in PLURAL) {
      const set = many ? PLURAL : PRONOUNS[b.people[0]!.pronouns];
      const word = set[lower as keyof typeof PLURAL];
      afterPronoun[key] = lower === 'they';
      return isCap ? cap(word) : word;
    }
    if (lower in VERBS && !isCap) {
      const [sing, pl] = VERBS[lower]!;
      const plural = many || (afterPronoun[key] === true && b.people[0]!.pronouns === 'they');
      return plural ? pl : sing;
    }
    return whole;
  });
}

/** Turn marked text into plain text using a name lookup. */
export function plainText(text: string, nameOf: (id: string) => string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, (_, id: string) => nameOf(id));
}

/** Split marked text into segments for rendering chips. */
export function segments(text: string): ({ kind: 'text'; text: string } | { kind: 'name'; id: string })[] {
  const out: ({ kind: 'text'; text: string } | { kind: 'name'; id: string })[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    out.push({ kind: 'name', id: m[1]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

export function hasLeftoverTokens(text: string): boolean {
  return /\{[^}]*\}/.test(text);
}
