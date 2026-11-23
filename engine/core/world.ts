// The engine's internal state plus every mutation helper.
// Every change to something on screen goes through a helper that records a Patch,
// so stateAt(log) can rebuild exactly the same view (§4.2, tested at every midnight).
import { Rng } from './rng';
import { defaultAffinity } from './affinity';
import { neighbours, RING } from './arena';
import { dayOf, timeBand } from './clock';
import type {
  Contestant,
  EventEntry,
  GameSetup,
  GameStats,
  Group,
  Health,
  Item,
  LogEntry,
  Patch,
  Tag,
  TagState,
  Traits,
  ViewState,
  Weapon,
  ZoneId,
} from './types';
import {
  GM_MOOD_SD,
  START_MINUTE,
  TAG_DURATION,
  TRAIT_MAX,
  TRAIT_MIN,
  WEAPON_BONUS,
} from '../tuning';
import type { CompiledDb } from '../systems/compile';

export type PendingEntry =
  | (Omit<EventEntry, 'seq' | 'gameMinute'> & { kind: 'event' })
  | { kind: 'move'; who: string[]; from: ZoneId; to: ZoneId; arriveMinute: number; patches: Patch[] }
  | { kind: 'silent'; patches: Patch[] }
  | { kind: 'midnight'; day: number; fallen: string[]; quietUntil: number; patches: Patch[] }
  | { kind: 'victor'; victor: string; patches: Patch[] };

export const clampAff = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));

export class World {
  rng: Rng;
  db: CompiledDb;
  setup: GameSetup;
  minute = START_MINUTE;
  c: Record<string, Contestant> = {};
  order: string[] = [];
  groups = new Map<string, Group>();
  private groupSeq = 0;
  private colourSeq = 0;
  aff: Record<string, Record<string, number>> = {};
  affStart: Record<string, Record<string, number>> = {};
  closed = new Set<ZoneId>();
  feast: 'none' | 'announced' | 'done' = 'none';
  feastMinute: number | null = null;
  victor: string | null = null;

  log: LogEntry[] = [];
  private buf: PendingEntry[] = [];
  /** Patches go here while an event is being resolved; otherwise into a silent entry. */
  cur: Patch[] | null = null;
  /** Contestants who already had a visible event this tick. */
  acted = new Set<string>();
  /** Contestants who already had their Bloodbath moment. */
  bloodbathDone = new Set<string>();

  startCount: number;
  lastDeathMinute = START_MINUTE;
  diedSinceMidnight: string[] = [];
  everInGroup = new Set<string>();
  stats: GameStats = {
    bloodbathDeaths: 0,
    groupsFormed: 0,
    betrayals: 0,
    legendaryOutcomes: 0,
    victorEverInGroup: false,
    templateUse: {},
    fightLineUse: {},
  };
  traits: Record<string, Traits> = {};
  /** Per-game Gamemaker temperament (rolled once): scales hazard and shrink odds. */
  gmMood = 1;
  /** Day of the last Gamemaker event (one per day at most). */
  gmDay = 0;

  constructor(setup: GameSetup, db: CompiledDb) {
    this.setup = setup;
    this.db = db;
    this.rng = new Rng(setup.seed);
    this.startCount = setup.contestants.length;
    for (const s of setup.contestants) {
      const traits: Traits = {
        strength: this.rollTrait(),
        stealth: this.rollTrait(),
        cunning: this.rollTrait(),
        survival: this.rollTrait(),
        loyalty: this.rollTrait(),
        ruthlessness: this.rollTrait(),
      };
      this.traits[s.id] = { ...traits };
      this.c[s.id] = {
        id: s.id,
        name: s.name,
        pronouns: s.pronouns,
        district: s.district,
        alive: true,
        health: 'healthy',
        hunger: this.rng.int(5, 25),
        thirst: this.rng.int(5, 20),
        fatigue: this.rng.int(5, 20),
        weapon: 'none',
        items: [],
        zone: 'cornucopia',
        travelUntil: null,
        asleep: false,
        groupId: null,
        kills: [],
        killedBy: null,
        deathMinute: null,
        traits,
        tags: [],
      };
      this.order.push(s.id);
    }
    this.initAffinity();
    this.gmMood = Math.exp(this.rng.normal(0, GM_MOOD_SD));
  }

  private rollTrait(): number {
    // Roughly bell-shaped 1–10 (sum of two dice), so extremes are rarer.
    const v = Math.round((this.rng.int(TRAIT_MIN, TRAIT_MAX) + this.rng.int(TRAIT_MIN, TRAIT_MAX)) / 2);
    return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, v));
  }

  private initAffinity() {
    const ids = this.order;
    for (const a of ids) {
      this.aff[a] = {};
      this.affStart[a] = {};
    }
    const start = defaultAffinity(ids, this.setup.affinitySeed ?? this.setup.seed, this.setup.affinityBase ?? 'random');
    for (const a of ids) for (const b of ids) if (a !== b) this.aff[a]![b] = start[a]![b]!;
    for (const o of this.setup.affinityOverrides ?? []) {
      if (this.aff[o.from] && o.from !== o.to && o.to in this.aff) this.aff[o.from]![o.to] = clampAff(o.value);
    }
    for (const a of ids) for (const b of ids) if (a !== b) this.affStart[a]![b] = this.aff[a]![b]!;
    // Opening silent entry: the starting affinity matrix.
    this.pushPatch(this.affSnapshot());
  }

  affSnapshot(): Patch {
    const ids = this.order;
    return { p: 'affAll', ids: ids.slice(), v: ids.map((a) => ids.map((b) => (a === b ? 0 : this.aff[a]![b]!))) };
  }

  // ------------------------------------------------------------------ time
  get day() {
    return dayOf(this.minute);
  }
  get band() {
    return timeBand(this.minute);
  }

  // ------------------------------------------------------------------ queries
  alive(): Contestant[] {
    return this.order.map((id) => this.c[id]!).filter((c) => c.alive);
  }
  aliveCount(): number {
    let n = 0;
    for (const id of this.order) if (this.c[id]!.alive) n++;
    return n;
  }
  isTravelling(c: Contestant) {
    return c.travelUntil !== null && c.travelUntil > this.minute;
  }
  /** Lone contestant or whole group (only living members). */
  unitOf(id: string): string[] {
    const c = this.c[id]!;
    if (!c.groupId) return [id];
    return this.groups.get(c.groupId)!.members.slice();
  }
  getAff(a: string, b: string): number {
    if (a === b) return 0;
    return this.aff[a]![b]!;
  }
  hasTag(id: string, tag: Tag): boolean {
    return this.c[id]!.tags.some((t) => t.tag === tag);
  }
  vengefulTargets(id: string): string[] {
    return this.c[id]!.tags.filter((t) => t.tag === 'vengeful' && t.target).map((t) => t.target!);
  }
  openNeighbours(zone: ZoneId): ZoneId[] {
    return neighbours(zone).filter((z) => !this.closed.has(z));
  }
  openOuter(): ZoneId[] {
    return RING.filter((z) => !this.closed.has(z));
  }
  weaponBonus(w: Weapon) {
    return WEAPON_BONUS[w];
  }

  // ------------------------------------------------------------------ log plumbing
  private pushPatch(p: Patch) {
    if (this.cur) {
      this.cur.push(p);
      return;
    }
    const last = this.buf[this.buf.length - 1];
    if (last && last.kind === 'silent') last.patches.push(p);
    else this.buf.push({ kind: 'silent', patches: [p] });
  }

  pushEntry(e: PendingEntry) {
    this.buf.push(e);
  }

  /** Assign timestamps across the tick (in resolution order) and append to the log. */
  flush(tickStart: number, tickLen: number) {
    const n = this.buf.length;
    this.buf.forEach((e, i) => {
      const gameMinute = e.kind === 'midnight' ? tickStart : tickStart + (tickLen * i) / Math.max(1, n);
      const seq = this.log.length;
      const entry = { ...e, seq, gameMinute } as LogEntry;
      for (const p of entry.patches) {
        if (p.p === 'death') {
          const c = this.c[p.id]!;
          c.deathMinute = gameMinute;
          this.deathSeq[p.id] = seq;
        }
      }
      this.log.push(entry);
    });
    this.buf = [];
  }
  deathSeq: Record<string, number> = {};

  // ------------------------------------------------------------------ mutations
  setHealth(id: string, v: Health) {
    const c = this.c[id]!;
    if (c.health === v) return;
    c.health = v;
    this.pushPatch({ p: 'health', id, v });
  }
  setWeapon(id: string, v: Weapon) {
    const c = this.c[id]!;
    if (c.weapon === v) return;
    c.weapon = v;
    this.pushPatch({ p: 'weapon', id, v });
  }
  setItems(id: string, v: Item[]) {
    const c = this.c[id]!;
    c.items = v.slice(0, 8);
    this.pushPatch({ p: 'items', id, v: c.items.slice() });
  }
  addItem(id: string, item: Item) {
    this.setItems(id, [...this.c[id]!.items, item]);
  }
  removeItem(id: string, item: Item): boolean {
    const items = this.c[id]!.items.slice();
    const i = items.indexOf(item);
    if (i < 0) return false;
    items.splice(i, 1);
    this.setItems(id, items);
    return true;
  }
  setZone(id: string, v: ZoneId) {
    const c = this.c[id]!;
    c.zone = v;
    this.pushPatch({ p: 'zone', id, v });
  }
  setAff(a: string, b: string, v: number) {
    if (a === b) return;
    const nv = clampAff(v);
    if (this.aff[a]![b] === nv) return;
    this.aff[a]![b] = nv;
    this.pushPatch({ p: 'aff', from: a, to: b, v: nv });
  }
  addAff(a: string, b: string, d: number) {
    this.setAff(a, b, this.getAff(a, b) + d);
  }
  /** Bulk change without per-pair patches (midnight); caller must push affSnapshot(). */
  setAffSilently(a: string, b: string, v: number) {
    if (a !== b) this.aff[a]![b] = clampAff(v);
  }
  pushAffSnapshot() {
    this.pushPatch(this.affSnapshot());
  }

  private setTags(id: string, tags: TagState[]) {
    this.c[id]!.tags = tags;
    this.pushPatch({ p: 'tags', id, v: tags.map((t) => ({ ...t })) });
  }
  addTag(id: string, tag: Tag, target?: string) {
    const c = this.c[id]!;
    const dur = TAG_DURATION[tag];
    const until = dur === null ? null : this.minute + dur;
    const rest = c.tags.filter((t) => !(t.tag === tag && (tag !== 'vengeful' || t.target === target)));
    const ts: TagState = target ? { tag, until, target } : { tag, until };
    this.setTags(id, [...rest, ts]);
  }
  removeTag(id: string, tag: Tag) {
    const c = this.c[id]!;
    if (!c.tags.some((t) => t.tag === tag)) return;
    this.setTags(
      id,
      c.tags.filter((t) => t.tag !== tag),
    );
  }
  expireTags() {
    for (const id of this.order) {
      const c = this.c[id]!;
      if (!c.alive || c.tags.length === 0) continue;
      const keep = c.tags.filter((t) => t.until === null || t.until > this.minute);
      if (keep.length !== c.tags.length) this.setTags(id, keep);
    }
  }
  /** Drop vengeance aimed at (or held by) a dead contestant. */
  clearVengeanceFor(deadId: string) {
    for (const id of this.order) {
      const c = this.c[id]!;
      if (!c.alive) continue;
      if (c.tags.some((t) => t.tag === 'vengeful' && t.target === deadId)) {
        this.setTags(
          id,
          c.tags.filter((t) => !(t.tag === 'vengeful' && t.target === deadId)),
        );
      }
    }
  }

  // ---- groups
  newGroup(): Group {
    const g: Group = { id: `g${++this.groupSeq}`, members: [], colour: this.colourSeq++ % 8, formedMinute: this.minute };
    this.groups.set(g.id, g);
    this.pushPatch({ p: 'groupNew', group: g.id, colour: g.colour });
    this.stats.groupsFormed++;
    return g;
  }
  /** Move a contestant into a group (or out with null). Dissolves groups left with one member. */
  setGroup(id: string, gid: string | null) {
    const c = this.c[id]!;
    if (c.groupId === gid) return;
    const old = c.groupId;
    if (old) {
      const g = this.groups.get(old)!;
      g.members = g.members.filter((m) => m !== id);
    }
    c.groupId = gid;
    if (gid) {
      this.groups.get(gid)!.members.push(id);
      this.everInGroup.add(id);
    }
    this.pushPatch({ p: 'group', id, v: gid });
    if (old) this.maybeDissolve(old);
  }
  maybeDissolve(gid: string) {
    const g = this.groups.get(gid);
    if (!g) return;
    if (g.members.length <= 1) {
      for (const m of g.members.slice()) {
        this.c[m]!.groupId = null;
        this.pushPatch({ p: 'group', id: m, v: null });
      }
      g.members = [];
      this.groups.delete(gid);
      this.pushPatch({ p: 'groupEnd', group: gid });
    }
  }

  // ---- death
  /** Returns false if the contestant was already dead. */
  kill(id: string, by: string | null): boolean {
    const c = this.c[id]!;
    if (!c.alive) return false;
    c.alive = false;
    c.killedBy = by;
    c.asleep = false;
    c.travelUntil = null;
    this.pushPatch({ p: 'death', id, by });
    if (by && this.c[by]) this.c[by]!.kills.push(id);
    this.diedSinceMidnight.push(id);
    this.lastDeathMinute = this.minute;
    if (c.groupId) this.setGroup(id, null);
    if (c.tags.length) this.setTags(id, []);
    this.clearVengeanceFor(id);
    return true;
  }

  closeZone(z: ZoneId) {
    if (this.closed.has(z)) return;
    this.closed.add(z);
    this.pushPatch({ p: 'close', zone: z });
  }
  setFeast(v: 'none' | 'announced' | 'done') {
    if (this.feast === v) return;
    this.feast = v;
    this.pushPatch({ p: 'feast', v });
  }
  declareVictor(id: string) {
    this.victor = id;
    this.pushEntry({ kind: 'victor', victor: id, patches: [{ p: 'victor', id }] });
  }

  /** Start a journey for a whole unit. Emits a silent move entry. */
  travel(ids: string[], to: ZoneId, durationMin: number) {
    const living = ids.filter((id) => this.c[id]!.alive);
    if (living.length === 0) return;
    const from = this.c[living[0]!]!.zone;
    const arrive = this.minute + durationMin;
    const saved = this.cur;
    const patches: Patch[] = [];
    this.cur = patches;
    for (const id of living) {
      this.setZone(id, to);
      const c = this.c[id]!;
      c.travelUntil = arrive;
      c.asleep = false;
    }
    this.cur = saved;
    this.pushEntry({ kind: 'move', who: living, from, to, arriveMinute: arrive, patches });
  }

  // ------------------------------------------------------------------ projection
  viewState(): ViewState {
    const contestants: ViewState['contestants'] = {};
    for (const id of this.order) {
      const c = this.c[id]!;
      contestants[id] = {
        id,
        alive: c.alive,
        health: c.health,
        weapon: c.weapon,
        items: c.items.slice(),
        zone: c.zone,
        groupId: c.groupId,
        kills: c.kills.slice(),
        killedBy: c.killedBy,
        deathMinute: c.deathMinute,
        deathEventSeq: this.deathSeq[id] ?? null,
        tags: c.tags.map((t) => ({ ...t })),
      };
    }
    const groups: ViewState['groups'] = {};
    for (const g of this.groups.values()) groups[g.id] = { id: g.id, members: g.members.slice(), colour: g.colour };
    const affinity: ViewState['affinity'] = {};
    for (const a of this.order) {
      affinity[a] = {};
      for (const b of this.order) if (a !== b) affinity[a]![b] = this.aff[a]![b]!;
    }
    return {
      minute: this.minute,
      contestants,
      groups,
      affinity,
      closedZones: [...this.closed].sort(),
      victor: this.victor,
      feast: this.feast,
    };
  }
}
