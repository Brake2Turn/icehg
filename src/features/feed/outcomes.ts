// What each feed entry *did*, worked out from the state before and after it:
// a border colour for the card and a short, consistent summary line (e.g. "Mark has died").
import { applyPatch, blankView, type EventEntry, type GameSetup, type Item, type LogEntry, type ViewState, type Weapon } from '../../../engine';

/** pink = betrayal that killed · red = death · purple = betrayal / alliance broken · cyan = someone saved
 *  blue = alliance formed or joined · orange = injury · green = gear or recovery */
export type Tone = 'pink' | 'red' | 'purple' | 'cyan' | 'blue' | 'orange' | 'green';
export type Border = Tone | null;
export type Line = { text: string; tone: Tone | null };
export type Outcome = { border: Border; summary: Line[] };
const RANK: Record<Tone, number> = { green: 1, orange: 2, blue: 3, cyan: 4, purple: 5, red: 6, pink: 7 };

const ITEM_PHRASE: Record<Item, string> = {
  food: 'food',
  water: 'a water bottle',
  medkit: 'a medkit',
  rope: 'rope',
  trap: 'a snare',
  sleepingBag: 'a sleeping bag',
  matches: 'matches',
  map: 'a map',
};
const WEAPON_PHRASE: Record<Weapon, string> = {
  none: '',
  knife: 'a knife',
  spear: 'a spear',
  bow: 'a bow',
  axe: 'an axe',
  sword: 'a sword',
  mace: 'a mace',
};

export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
const possessive = (names: string[]) => {
  const s = listNames(names);
  return s.endsWith('s') ? `${s}'` : `${s}'s`;
};
const has = (n: number) => (n > 1 ? 'have' : 'has');

/** Walk the whole log once and describe every event entry. */
export function describeLog(setup: GameSetup, log: LogEntry[]): Map<number, Outcome> {
  const name = new Map(setup.contestants.map((c) => [c.id, c.name]));
  const nameOf = (id: string) => name.get(id) ?? '?';
  const v: ViewState = blankView(setup);
  const out = new Map<number, Outcome>();

  for (const e of log) {
    if (e.kind !== 'event') {
      for (const p of e.patches) applyPatch(v, p, e);
      continue;
    }
    // Snapshot what this entry can change.
    const touched = new Set<string>();
    for (const p of e.patches) if ('id' in p && typeof p.id === 'string' && p.p !== 'victor') touched.add(p.id);
    const before = new Map(
      [...touched].map((id) => {
        const c = v.contestants[id]!;
        return [id, { groupId: c.groupId, health: c.health, weapon: c.weapon, items: c.items.slice(), tags: c.tags.map((t) => ({ ...t })) }];
      }),
    );
    const groupsBefore = new Map(Object.values(v.groups).map((g) => [g.id, g.members.slice()]));
    for (const p of e.patches) applyPatch(v, p, e);
    out.set(e.seq, describe(e, v, before, groupsBefore, nameOf));
  }
  return out;
}

type Before = Map<string, { groupId: string | null; health: string; weapon: Weapon; items: Item[]; tags: { tag: string; target?: string }[] }>;

function describe(e: EventEntry, v: ViewState, before: Before, groupsBefore: Map<string, string[]>, nameOf: (id: string) => string): Outcome {
  const lines: Line[] = [];
  let border: Border = null;
  const add = (text: string, tone: Tone | null) => {
    lines.push({ text, tone });
    if (tone && (!border || RANK[tone] > RANK[border])) border = tone;
  };

  const died = e.patches.filter((p) => p.p === 'death').map((p) => (p as { id: string }).id);

  // Betrayal: pink if it killed, purple if not
  let betrayalVictim: string | undefined;
  if (e.tags?.includes('betrayal')) {
    const betrayer = Object.entries(e.nameColours).find(([, c]) => c === 'purple')?.[0];
    if (betrayer) {
      betrayalVictim = died.find((id) => id !== betrayer);
      if (betrayalVictim) add(`${nameOf(betrayer)} betrayed and killed ${nameOf(betrayalVictim)}`, 'pink');
      else {
        let victim: string | undefined;
        for (const p of e.patches) if (p.p === 'aff' && p.to === betrayer && p.v === -100) victim = p.from;
        add(victim ? `${nameOf(betrayer)} betrayed ${nameOf(victim)}` : `${nameOf(betrayer)} betrayed the alliance`, 'purple');
      }
    }
  }

  // Deaths (other than the betrayal victim, already named)
  const otherDead = died.filter((id) => id !== betrayalVictim);
  if (otherDead.length) add(`${listNames(otherDead.map(nameOf))} ${has(otherDead.length)} died`, 'red');

  // Saves
  for (const [saver, saved] of e.saves ?? []) add(`${nameOf(saver)} saved ${nameOf(saved)}`, 'cyan');

  // Alliances
  const newGroups = new Set(e.patches.filter((p) => p.p === 'groupNew').map((p) => (p as { group: string }).group));
  const endedGroups = new Set(e.patches.filter((p) => p.p === 'groupEnd').map((p) => (p as { group: string }).group));
  const joined = new Map<string, string[]>();
  const left: string[] = [];
  const ditched: string[] = [];
  for (const [id, b] of before) {
    const now = v.contestants[id]!;
    if (died.includes(id) || now.groupId === b.groupId) continue;
    if (now.groupId) joined.set(now.groupId, [...(joined.get(now.groupId) ?? []), id]);
    if (b.groupId && !endedGroups.has(b.groupId)) {
      const abandoned = now.tags.some((t) => t.tag === 'abandoned') && !b.tags.some((t) => t.tag === 'abandoned');
      (abandoned ? ditched : left).push(id);
    }
  }
  for (const [gid, ids] of joined) {
    if (newGroups.has(gid)) {
      const members = v.groups[gid]?.members ?? ids;
      add(`${listNames(members.map(nameOf))} have an alliance`, 'blue');
    } else {
      const existing = (v.groups[gid]?.members ?? []).filter((m) => !ids.includes(m));
      add(`${listNames(ids.map(nameOf))} ${has(ids.length)} joined ${possessive(existing.map(nameOf))} alliance`, 'blue');
    }
  }
  for (const gid of endedGroups) {
    const members = groupsBefore.get(gid) ?? [];
    // An alliance absorbed into another (everyone joined someone else's) isn't "ended".
    if (members.length && members.every((m) => v.contestants[m]!.groupId && v.contestants[m]!.groupId !== gid)) continue;
    // Skip it when everyone in it died: the death line already says so.
    if (members.some((m) => v.contestants[m]!.alive)) add(`${possessive(members.map(nameOf))} alliance has ended`, 'purple');
  }
  if (left.length) add(`${listNames(left.map(nameOf))} ${has(left.length)} left the alliance`, 'purple');
  if (ditched.length) add(`${listNames(ditched.map(nameOf))} ${ditched.length > 1 ? 'were' : 'was'} dropped from the alliance`, 'purple');

  // Gear: "Mark now has a sword and a medkit"
  for (const [id, b] of before) {
    const now = v.contestants[id]!;
    if (!now.alive) continue;
    const gained: string[] = [];
    if (now.weapon !== b.weapon && now.weapon !== 'none') gained.push(WEAPON_PHRASE[now.weapon]);
    const rest = b.items.slice();
    for (const it of now.items) {
      const i = rest.indexOf(it);
      if (i >= 0) rest.splice(i, 1);
      else if (!gained.includes(ITEM_PHRASE[it])) gained.push(ITEM_PHRASE[it]);
    }
    if (gained.length) add(`${nameOf(id)} now has ${listNames(gained)}`, 'green');
  }

  // Health
  const worse: Record<string, number> = { healthy: 0, wounded: 1, critical: 2 };
  for (const [id, b] of before) {
    const now = v.contestants[id]!;
    if (!now.alive || now.health === b.health) continue;
    if (worse[now.health]! > worse[b.health]!) add(now.health === 'critical' ? `${nameOf(id)} is badly hurt` : `${nameOf(id)} is injured`, 'orange');
    else add(now.health === 'healthy' ? `${nameOf(id)} has recovered` : `${nameOf(id)} is recovering`, 'green');
  }

  // Vengeance
  for (const [id, b] of before) {
    const now = v.contestants[id]!;
    if (!now.alive) continue;
    for (const t of now.tags) {
      if (t.tag === 'vengeful' && t.target && !b.tags.some((x) => x.tag === 'vengeful' && x.target === t.target)) {
        add(`${nameOf(id)} wants revenge on ${nameOf(t.target)}`, null);
      }
    }
  }

  return { border, summary: lines };
}
