// EVERY chance and number the engine uses lives here (§6.1).
// Tune these with `npm run sim:stats` (§6.14). The engine never looks at target game lengths.

import type { Pace, Rarity, Weapon } from './core/types';

export const TICK_MIN = 15;
export const DAY_MIN = 24 * 60;
/** Day 1 starts at 10:00 with the gong. */
export const START_MINUTE = 10 * 60;

/** Game minutes per real second at 1x (§4.2). */
export const GAME_MIN_PER_SEC: Record<Pace, number> = {
  quick: 7.5,
  standard: 2,
  slow: 0.4,
  realtime: 1 / 60,
};
/** Quiet window after midnight, in real seconds at 1x (§6.3). */
export const QUIET_REAL_SECONDS = 8;

export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 100,
  uncommon: 30,
  rare: 8,
  veryRare: 2,
  legendary: 0.5,
};

/** k in the tone multiplier (§6.7). */
export const AFFINITY_INFLUENCE = 1.4;

// ---------- Affinity (§6.6)
export const AFF_START_SD = 25;
export const AFF_RECIPROCITY = 0.6;
export const WITNESS_LIKE_MIN = 20;
export const WITNESS_PENALTY = -30;
export const WITNESS_VENGEFUL_MIN = 60;
export const HARDSHIP_PER_DAY = 3;
export const DRIFT_PER_DAY = 0.02;
export const GRIEF_LIKE_MIN = 40;
export const BETRAYAL_KNOWER_PENALTY = -40;

// ---------- Tag durations in game minutes (§6.2)
export const TAG_DURATION = {
  abandoned: 24 * 60,
  betrayed: 48 * 60,
  grieving: 24 * 60,
  vengeful: null as number | null,
  hunted: 12 * 60,
  poisoned: 6 * 60,
  hiding: 3 * 60,
};

// ---------- Traits

// ---------- Needs per tick (§6.5)
export const HUNGER_PER_TICK = 0.33;
export const THIRST_PER_TICK = 0.6;
export const FATIGUE_PER_TICK_AWAKE = 0.9;
export const FATIGUE_PER_TICK_ASLEEP = -5;
/** Silent drinking when standing in a water zone. */
export const DRINK_IN_WATER_ZONE = 25;
/** Silent eating of a carried food/water item when the need is above this. */
export const EAT_CARRIED_THRESHOLD = 55;
export const ITEM_FOOD_RELIEF = 45;
export const ITEM_WATER_RELIEF = 50;
/** Silent grazing in a food zone (per tick, chance-based). */
export const GRAZE_CHANCE = 0.08;
export const GRAZE_RELIEF = 20;
/** Fatigue needed to fall asleep at night (lower when it's very late). */
export const SLEEP_FATIGUE_MIN = 35;
export const WAKE_FATIGUE = 8;

// ---------- Wounds
/** Chance per tick a wounded contestant's wound worsens (visible event). */
export const P_WOUND_WORSEN = 0.006;
/** Chance per tick a critical contestant gets a "wounds" event (can be lethal). */
export const P_CRITICAL_EVENT = 0.025;
/** Chance per tick a sleeping/resting wounded contestant heals silently. */
export const P_REST_HEAL = 0.015;
/** Needs that trigger dehydration/starvation events. */
export const THIRST_CRISIS = 92;
export const HUNGER_CRISIS = 95;
export const P_NEED_CRISIS = 0.04;

// ---------- Solo, encounter and group rolls (§6.5)
export const P_SOLO_DAY = 0.07;
export const P_SOLO_NIGHT = 0.015;
/** Solo template weight boost when a tag-driven template matches (abandoned etc.). */
export const ENCOUNTER_RATE = 0.28;
export const VISIBILITY: Record<'dawn' | 'day' | 'dusk' | 'night', number> = {
  dawn: 0.75,
  day: 1,
  dusk: 0.75,
  night: 0.35,
};
/** visibility × (1 − STEALTH_VIS·(avgStealth − 5)); doubled at night. */
export const STEALTH_VIS = 0.04;
export const P_GROUP = 0.04;
export const MAX_GROUP = 6;

// ---------- Bloodbath
/** Number of ticks the Bloodbath runs (10:00–10:30). */
export const BLOODBATH_TICKS = 2;
/** Weight multiplier for lethal Bloodbath templates (the opening is meant to be brutal). */
export const BLOODBATH_LETHAL_MULT = 22;
/** Per-game Gamemaker temperament: lognormal spread applied to hazard and shrink odds. */
export const GM_MOOD_SD = 1.2;

// ---------- Movement (§6.4)
export const P_MOVE_DAY = 0.03;
export const P_MOVE_NIGHT = 0.008;
export const TRAVEL_ADJ_MIN = 60;
export const TRAVEL_ADJ_MAX = 120;
export const TRAVEL_CORN_MIN = 75;
export const TRAVEL_CORN_MAX = 135;
export const MOVE_UTILITY = {
  stay: 1.0,
  water: 2.2,
  food: 1.4,
  shelter: 1.6,
  dangerous: -0.8,
  hunt: 0.35,
  /** Hunters ((ruthlessness+strength)/20 above this) roam toward people. */
  hunterThreshold: 0.55,
  hunterUrge: 8,
  hunterPull: 1.2,
  vengeance: 2.5,
  cornucopiaAfterBloodbath: -2.5,
  crowd: -0.15,
  feast: 3,
  softmaxTemp: 0.8,
};

// ---------- Betrayal (§6.9)
export const BETRAYAL_BASE = 0.0007;
export const BETRAYAL_FIELD_EXP = 1.2;
export const BETRAYAL_ALL_IN_GROUP = 4;
export const BETRAYAL_SCARCITY_MAX = 2;

// ---------- Fights (§6.10)
export const WEAPON_BONUS: Record<Weapon, number> = {
  none: 0,
  knife: 1,
  mace: 2,
  spear: 2,
  axe: 2,
  bow: 2,
  sword: 3,
};
export const WOUND_PENALTY = { healthy: 0, wounded: 2, critical: 4 };
export const FIGHT_CUNNING = 0.3;
export const FIGHT_NOISE_SD = 2;
export const FIGHT_MIN_SCORE = 0.5;
export const AMBUSH_BONUS = 0.25;
export const NIGHT_WOKEN_PENALTY = 0.25;
export const AMBUSH_BASE = 0.45;
export const AMBUSH_PER_STEALTH = 0.07;
export const LOYAL_IN_FIGHT = 60;
export const LOYAL_STRENGTH_MULT = 0.5;
export const LOYAL_KILL_WEIGHT = 0.08;
export const STALEMATE_BASE = 0.22;
export const FIGHT_ALPHA = 1.5;
export const LOSER_DIE = 0.5;
export const LOSER_WOUND = 0.25;
export const LOSER_STEALTH_ESCAPE = 0.04;
export const WINNER_RUTHLESS_DEATH = 0.04;
export const WINNER_DIE = 0.2;
export const WINNER_WOUND = 0.4;
export const STALEMATE_WOUND = 0.2;
export const STALEMATE_DIE = 0.05;

// ---------- Gamemakers (§6.11)
export const P_GM = 0.0007;
export const GM_BORED_HOURS = 12;
export const P_FEAST_ANNOUNCE = 0.2;
export const FEAST_FROM_DAY = 3;
export const FEAST_HOUR = 8;
export const FEAST_WINDOW_MIN = 120;
export const FEAST_ENCOUNTER_MULT = 2.5;
export const SHRINK_FROM_DAY = 6;
export const SHRINK_PER_DAY = 0.12;
export const SHRINK_MAX = 0.9;
/** Never close the last open outer zone before the backstop. */
export const MIN_OPEN_OUTER = 1;
export const BACKSTOP_DAY = 30;
/** Absolute safety net: from this day every tick has a lethal hazard at the Cornucopia. */
export const SUDDEN_DEATH_DAY = 40;
/** Chance per tick a contestant at the Cornucopia during the feast grabs something (feast solo template). */
export const FEAST_SOLO_P = 0.15;
/** Solo-roll multiplier for abandoned / grieving / betrayed contestants. */
export const TAGGED_SOLO_MULT = 3;

// ---------- Repetition (owner's request): each use of a template this game makes it less likely again.
export const REPEAT_DECAY = 0.6;
export const REPEAT_FLOOR = 0.12;

// ---------- Saves (shown in cyan)
/** Chance a nearby ally pulls someone out of a Gamemaker hazard: base × e^(k·aff/100). */
export const RESCUE_BASE = 0.1;
export const RESCUE_AFF_K = 2.2;
/** Chance a teammate saves someone about to die in a fight (needs affinity ≥ FIGHT_SAVE_MIN). */
export const FIGHT_SAVE_BASE = 0.12;
export const FIGHT_SAVE_MIN = 20;

// ---------- Gamemaker events (owner's request): at most one per day, likelier as days pass.
/** Per-tick chance on day d: P_GM × mood × d^GM_DAY_EXP × boredom. */
export const GM_DAY_EXP = 1.3;
/** Share of Gamemaker hazards that hit the whole arena instead of one area. */
export const P_ARENA_WIDE = 0.35;
/** Kill outcomes in Gamemaker events: weight × GM_LETHAL_MULT × mood^GM_LETHAL_MOOD_EXP. */
export const GM_LETHAL_MULT = 3;
export const GM_LETHAL_MOOD_EXP = 3;
/** When the only people left are all in one alliance, the chance it ends in betrayal (otherwise they split or ditch). */
export const P_LAST_ALLIANCE_BETRAYAL = 0.55;

// ---------- Quirks (owner's request): everyone is equal (every trait 5) unless they have a quirk.
import type { QuirkId } from './core/quirks';
export const BASE_TRAIT = 5;
export type QuirkEffect = {
  /** Trait values that differ from BASE_TRAIT. */
  traits?: Partial<Record<'strength' | 'stealth' | 'cunning' | 'survival' | 'loyalty' | 'ruthlessness', number>>;
  /** Added to everyone else's starting feelings toward this person. */
  othersFeel?: number;
  /** Fight score multiplier, always / only when fighting alone. */
  fight?: number;
  fightAlone?: number;
  /** Chance a killing blow in a fight leaves them injured instead. */
  survivesKill?: number;
  /** Weight multiplier on event outcomes that would kill them. */
  deathOutcome?: number;
  /** Weight multiplier on events that would put them in an alliance. */
  alliance?: number;
  /** How likely they are to be the one picked when an ally betrays the alliance. */
  betrayalTarget?: number;
  /** Betrayal chance multiplier, save chance multiplier, needs (hunger/thirst) rate multiplier. */
  betrayal?: number;
  saves?: number;
  needs?: number;
};
export const QUIRK_EFFECTS: Record<QuirkId, QuirkEffect> = {
  career: { traits: { strength: 7, ruthlessness: 7 }, othersFeel: -25, survivesKill: 0.3, deathOutcome: 0.7 },
  young: { traits: { strength: 3 }, othersFeel: 20, fight: 0.8 },
  peoplePerson: { traits: { loyalty: 7 }, alliance: 2, fightAlone: 0.75 },
  psycho: { traits: { ruthlessness: 9, loyalty: 3 }, alliance: 0.35, fightAlone: 2.1, othersFeel: -10 },
  survivalist: { traits: { survival: 9 }, needs: 0.7, deathOutcome: 0.85, fight: 0.7 },
  sneaky: { traits: { stealth: 9 }, deathOutcome: 0.75, othersFeel: -15 },
  loyal: { traits: { loyalty: 10 }, betrayal: 0.15, saves: 2, betrayalTarget: 3 },
  backstabber: { traits: { loyalty: 1, cunning: 8, ruthlessness: 7 }, betrayal: 3, othersFeel: -10, alliance: 0.8 },
};
