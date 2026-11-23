// Core engine types. Pure data: no React, no browser APIs.

export type ZoneId =
  | 'cornucopia'
  | 'forest'
  | 'river'
  | 'lake'
  | 'swamp'
  | 'meadow'
  | 'cliffs'
  | 'caves'
  | 'ruins';

export type ZoneTag = 'supplies' | 'exposed' | 'shelter' | 'food' | 'water' | 'dangerous' | 'highGround' | 'dark';

export type Weapon = 'none' | 'knife' | 'spear' | 'bow' | 'axe' | 'sword' | 'mace';
export type Item = 'food' | 'water' | 'medkit' | 'rope' | 'trap' | 'sleepingBag' | 'matches' | 'map';
export type Health = 'healthy' | 'wounded' | 'critical';
export type Trait = 'strength' | 'stealth' | 'cunning' | 'survival' | 'loyalty' | 'ruthlessness';
export type Need = 'hunger' | 'thirst' | 'fatigue';
export type TimeBand = 'dawn' | 'day' | 'dusk' | 'night';
export type Tag = 'abandoned' | 'betrayed' | 'grieving' | 'vengeful' | 'hunted' | 'poisoned' | 'hiding';
export type PronounKey = 'he' | 'she' | 'they';
export type Pace = 'quick' | 'standard' | 'slow' | 'realtime';
export type Mode = 'classic' | 'custom';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'veryRare' | 'legendary';
export type Category = 'bloodbath' | 'solo' | 'encounter' | 'group' | 'gamemaker' | 'feast';
export type Tone = 'cooperative' | 'hostile' | 'neutral';
export type Severity = 'flavour' | 'minor' | 'major' | 'lethal';
export type Visual =
  | 'none'
  | 'cry'
  | 'sleep'
  | 'forage'
  | 'hide'
  | 'trap'
  | 'huddle'
  | 'fight'
  | 'chase'
  | 'ambush'
  | 'betrayal'
  | 'injury'
  | 'death'
  | 'hazard'
  | 'feast'
  | 'loot';

/** Name-chip colours (§8.1). */
export type NameColour = 'red' | 'purple' | 'gold' | 'orange' | 'green' | 'white';

export type Traits = Record<Trait, number>;

export type TagState = { tag: Tag; until: number | null; target?: string };

/** What the user sets up before pressing Start. */
export type ContestantSetup = {
  id: string;
  name: string;
  pronouns: PronounKey;
  district?: number;
};

export type AffinityOverride = { from: string; to: string; value: number };

export type GameSetup = {
  mode: Mode;
  pace: Pace;
  seed: number;
  contestants: ContestantSetup[];
  /** Manual affinity edits (Phase 2 UI). Applied after the random defaults. */
  affinityOverrides?: AffinityOverride[];
  /** Seed for the starting feelings (defaults to `seed`); the create screen shows these before Start. */
  affinitySeed?: number;
  /** 'neutral' = everyone starts at 0 ("Reset to neutral"). */
  affinityBase?: 'random' | 'neutral';
};

export type Contestant = {
  id: string;
  name: string;
  pronouns: PronounKey;
  district?: number;
  alive: boolean;
  health: Health;
  hunger: number;
  thirst: number;
  fatigue: number;
  weapon: Weapon;
  items: Item[];
  zone: ZoneId;
  /** Game minute when the current journey ends (null = not travelling). */
  travelUntil: number | null;
  asleep: boolean;
  groupId: string | null;
  kills: string[];
  killedBy: string | null;
  deathMinute: number | null;
  traits: Traits;
  tags: TagState[];
};

export type Group = { id: string; members: string[]; colour: number; formedMinute: number };

/**
 * Everything the screen needs. `stateAt(log, minute)` rebuilds this from the log;
 * the engine keeps the same shape internally (plus private extras).
 */
export type ViewState = {
  minute: number;
  contestants: Record<string, ViewContestant>;
  groups: Record<string, { id: string; members: string[]; colour: number }>;
  affinity: Record<string, Record<string, number>>;
  closedZones: ZoneId[];
  victor: string | null;
  feast: 'none' | 'announced' | 'done';
};

export type ViewContestant = {
  id: string;
  alive: boolean;
  health: Health;
  weapon: Weapon;
  items: Item[];
  zone: ZoneId;
  groupId: string | null;
  kills: string[];
  killedBy: string | null;
  deathMinute: number | null;
  /** id of the event that killed them (for "how they died"). */
  deathEventSeq: number | null;
  tags: TagState[];
};

/** State changes recorded in the log, so the screen can rebuild state by folding. */
export type Patch =
  | { p: 'death'; id: string; by: string | null }
  | { p: 'health'; id: string; v: Health }
  | { p: 'weapon'; id: string; v: Weapon }
  | { p: 'items'; id: string; v: Item[] }
  | { p: 'zone'; id: string; v: ZoneId }
  | { p: 'group'; id: string; v: string | null }
  | { p: 'groupNew'; group: string; colour: number }
  | { p: 'groupEnd'; group: string }
  | { p: 'aff'; from: string; to: string; v: number }
  | { p: 'affAll'; ids: string[]; v: number[][] }
  | { p: 'tags'; id: string; v: TagState[] }
  | { p: 'close'; zone: ZoneId }
  | { p: 'feast'; v: 'none' | 'announced' | 'done' }
  | { p: 'victor'; id: string };

export type LogEntryBase = { seq: number; gameMinute: number; patches: Patch[] };

export type EventEntry = LogEntryBase & {
  kind: 'event';
  templateId: string;
  category: Category;
  severity: Severity;
  /** Outcome rarity (or template rarity, whichever is rarer) — used by stats. */
  rarity: Rarity;
  /** Text with name markers: [[contestantId]]. Render with renderMarkedText(). */
  text: string;
  participants: string[];
  nameColours: Record<string, NameColour>;
  zone: ZoneId;
  visual: Visual;
  /** Extra bookkeeping for stats/awards. */
  tags?: ('betrayal' | 'fight' | 'groupFormed' | 'mercy' | 'suicide')[];
  fight?: FightSummary;
  /** Gamemaker events: one line per contestant caught up in it (their fate). `text` is the intro. */
  lines?: string[];
  /** [saver, saved] pairs: someone saved someone else in this event. */
  saves?: [string, string][];
  /** Gamemaker events: whole arena or one area. */
  scope?: 'arena' | 'zone';
};

export type FightSummary = {
  sizeA: number;
  sizeB: number;
  winner: 'A' | 'B' | 'stalemate';
  deathsA: number;
  deathsB: number;
};

export type MoveEntry = LogEntryBase & {
  kind: 'move';
  who: string[];
  from: ZoneId;
  to: ZoneId;
  arriveMinute: number;
};

export type MidnightEntry = LogEntryBase & {
  kind: 'midnight';
  /** The day that is starting (Day 2 at the first midnight). */
  day: number;
  fallen: string[];
  /** Game minute when visible events may resume. */
  quietUntil: number;
};

export type SilentEntry = LogEntryBase & { kind: 'silent' };

export type VictorEntry = LogEntryBase & { kind: 'victor'; victor: string };

export type LogEntry = EventEntry | MoveEntry | MidnightEntry | SilentEntry | VictorEntry;

export type GameResult = {
  setup: GameSetup;
  log: LogEntry[];
  initial: ViewState;
  victor: string;
  endMinute: number;
  /** Starting traits (rolled per game). */
  traits: Record<string, Traits>;
  stats: GameStats;
};

export type GameStats = {
  bloodbathDeaths: number;
  groupsFormed: number;
  betrayals: number;
  legendaryOutcomes: number;
  victorEverInGroup: boolean;
  templateUse: Record<string, number>;
  fightLineUse: Record<string, number>;
};
