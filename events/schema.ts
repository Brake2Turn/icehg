// The event database schema (§6.12). Validated with zod at test/build time.
// Only depends on zod, so the engine can import it.
import { z } from 'zod';

export const RarityZ = z.enum(['common', 'uncommon', 'rare', 'veryRare', 'legendary']);
export const CategoryZ = z.enum(['bloodbath', 'solo', 'encounter', 'group', 'gamemaker', 'feast']);
export const ToneZ = z.enum(['cooperative', 'hostile', 'neutral']);
export const SeverityZ = z.enum(['flavour', 'minor', 'major', 'lethal']);
export const VisualZ = z.enum([
  'none', 'cry', 'sleep', 'forage', 'hide', 'trap', 'huddle', 'fight', 'chase',
  'ambush', 'betrayal', 'injury', 'death', 'hazard', 'feast', 'loot',
]);
export const ZoneTagZ = z.enum(['supplies', 'exposed', 'shelter', 'food', 'water', 'dangerous', 'highGround', 'dark']);
export const ZoneIdZ = z.enum(['cornucopia', 'forest', 'river', 'lake', 'swamp', 'meadow', 'cliffs', 'caves', 'ruins']);
export const TagZ = z.enum(['abandoned', 'betrayed', 'grieving', 'vengeful', 'hunted', 'poisoned', 'hiding']);
export const HealthZ = z.enum(['healthy', 'wounded', 'critical']);
export const ItemZ = z.enum(['food', 'water', 'medkit', 'rope', 'trap', 'sleepingBag', 'matches', 'map']);
export const WeaponZ = z.enum(['none', 'knife', 'spear', 'bow', 'axe', 'sword', 'mace']);
export const TraitZ = z.enum(['strength', 'stealth', 'cunning', 'survival', 'loyalty', 'ruthlessness']);
export const NeedZ = z.enum(['hunger', 'thirst', 'fatigue']);
export const TimeBandZ = z.enum(['dawn', 'day', 'dusk', 'night']);
/** A, B, C are single contestants; G, H are units; X is the per-victim role in hazards. */
export const RoleZ = z.enum(['A', 'B', 'C', 'G', 'H', 'X']);
export const UnitRoleZ = z.enum(['G', 'H']);

const SizeZ = z.object({ min: z.number().int().min(1).max(6), max: z.number().int().min(1).max(6) }).strict();

export const WeightModZ = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('trait'), who: RoleZ, trait: TraitZ, per: z.number() }).strict(),
  z.object({ kind: z.literal('traitDiff'), a: RoleZ, b: RoleZ, trait: TraitZ, per: z.number() }).strict(),
  z.object({ kind: z.literal('need'), who: RoleZ, need: NeedZ, per: z.number() }).strict(),
  z.object({ kind: z.literal('hasWeapon'), who: RoleZ, mult: z.number().min(0) }).strict(),
  z.object({ kind: z.literal('hasItem'), who: RoleZ, item: ItemZ, mult: z.number().min(0) }).strict(),
  z.object({ kind: z.literal('health'), who: RoleZ, is: HealthZ, mult: z.number().min(0) }).strict(),
  z.object({ kind: z.literal('groupSize'), who: UnitRoleZ, per: z.number() }).strict(),
  z.object({ kind: z.literal('timeOfDay'), is: TimeBandZ, mult: z.number().min(0) }).strict(),
  z.object({ kind: z.literal('alive'), per: z.number() }).strict(),
  z.object({ kind: z.literal('day'), per: z.number() }).strict(),
  z.object({ kind: z.literal('hasTag'), who: RoleZ, tag: TagZ, mult: z.number().min(0) }).strict(),
]);

const RoleOrUnit = z.union([RoleZ, z.literal('G'), z.literal('H')]);

export const EffectZ = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('kill'), target: z.union([RoleZ, z.literal('G.all'), z.literal('G.first'), z.literal('H.all')]), by: z.union([RoleZ, z.literal('G')]).optional() }).strict(),
  z.object({ kind: z.literal('injure'), target: RoleZ, severity: z.enum(['wounded', 'critical']) }).strict(),
  z.object({ kind: z.literal('heal'), target: RoleZ }).strict(),
  z.object({ kind: z.literal('need'), who: RoleZ, need: NeedZ, delta: z.number() }).strict(),
  z.object({ kind: z.literal('gainItem'), who: RoleZ, item: ItemZ }).strict(),
  z.object({ kind: z.literal('loseItem'), who: RoleZ, item: ItemZ }).strict(),
  z.object({ kind: z.literal('transferItem'), from: RoleZ, to: RoleZ, item: z.union([ItemZ, z.literal('all')]) }).strict(),
  z.object({ kind: z.literal('setWeapon'), who: RoleZ, weapon: WeaponZ }).strict(),
  z.object({ kind: z.literal('affinity'), from: RoleOrUnit, to: RoleOrUnit, delta: z.number(), mutual: z.boolean().optional() }).strict(),
  z.object({ kind: z.literal('affinitySet'), from: RoleZ, to: RoleZ, value: z.number().min(-100).max(100) }).strict(),
  z.object({ kind: z.literal('formGroup'), members: z.array(RoleOrUnit).min(2) }).strict(),
  z.object({ kind: z.literal('joinGroup'), who: RoleZ, group: z.literal('G') }).strict(),
  z.object({ kind: z.literal('leaveGroup'), who: RoleZ }).strict(),
  z.object({ kind: z.literal('ditch'), who: RoleZ, from: z.literal('G') }).strict(),
  z.object({ kind: z.literal('addTag'), who: RoleZ, tag: TagZ }).strict(),
  z.object({ kind: z.literal('removeTag'), who: RoleZ, tag: TagZ }).strict(),
  z.object({ kind: z.literal('move'), who: z.array(RoleOrUnit).min(1), to: z.union([z.literal('adjacent'), ZoneIdZ]) }).strict(),
  z.object({ kind: z.literal('fight'), attackers: z.enum(['A', 'G']), defenders: z.enum(['B', 'H']), ambush: z.boolean().optional() }).strict(),
]);

export const OutcomeZ = z
  .object({
    rarity: RarityZ,
    mods: z.array(WeightModZ).optional(),
    text: z.string().min(1),
    effects: z.array(EffectZ),
    visual: VisualZ.optional(),
  })
  .strict();

const RequiresZ = z
  .object({
    tags: z.array(z.object({ who: RoleZ, has: z.array(TagZ).optional(), lacks: z.array(TagZ).optional() }).strict()).optional(),
    needs: z.array(z.object({ who: RoleZ, need: NeedZ, min: z.number().optional(), max: z.number().optional() }).strict()).optional(),
    health: z.array(z.object({ who: RoleZ, is: z.array(HealthZ).min(1) }).strict()).optional(),
    hasItem: z.array(z.object({ who: RoleZ, item: ItemZ }).strict()).optional(),
    lacksItem: z.array(z.object({ who: RoleZ, item: ItemZ }).strict()).optional(),
    hasWeapon: z.array(RoleZ).optional(),
    unarmed: z.array(RoleZ).optional(),
    inGroup: z.array(z.object({ who: RoleZ, group: UnitRoleZ }).strict()).optional(),
    solo: z.array(RoleZ).optional(),
    notSameGroup: z.array(z.array(RoleZ)).optional(),
    affinity: z.array(z.object({ from: RoleOrUnit, to: RoleOrUnit, min: z.number().optional(), max: z.number().optional() }).strict()).optional(),
    asleep: z.array(RoleOrUnit).optional(),
    awake: z.array(RoleOrUnit).optional(),
  })
  .strict();

const WhenZ = z
  .object({
    timeOfDay: z.array(TimeBandZ).optional(),
    day: z.object({ min: z.number().optional(), max: z.number().optional() }).strict().optional(),
    alive: z.object({ min: z.number().optional(), max: z.number().optional() }).strict().optional(),
    zoneTags: z.array(ZoneTagZ).optional(),
    zones: z.array(ZoneIdZ).optional(),
  })
  .strict();

/**
 * Systems that pick templates on their own (see docs/DECISIONS.md).
 * Templates with a trigger are only ever chosen by that system.
 */
export const TriggerZ = z.enum([
  'woundWorsen', 'succumb', 'dehydration', 'starvation',
  'hazard', 'closure', 'feastAnnounce', 'feastDrop', 'gong',
]);

const BaseTemplate = {
  id: z.string().regex(/^[a-z]+\.[a-z0-9_.]+$/),
  category: CategoryZ,
  severity: SeverityZ,
  rarity: RarityZ,
  tone: ToneZ,
  visual: VisualZ,
  betrayal: z.boolean().optional(),
  trigger: TriggerZ.optional(),
  roles: z
    .object({
      A: z.literal('one').optional(),
      B: z.literal('one').optional(),
      C: z.literal('one').optional(),
      G: SizeZ.optional(),
      H: SizeZ.optional(),
    })
    .strict(),
  when: WhenZ.optional(),
  requires: RequiresZ.optional(),
  mods: z.array(WeightModZ).optional(),
  /** Free-form notes for humans; ignored by the engine. */
  note: z.string().optional(),
};

export const EventTemplateZ = z
  .object({ ...BaseTemplate, outcomes: z.array(OutcomeZ).min(1) })
  .strict();

export const HazardTemplateZ = z
  .object({ ...BaseTemplate, category: z.literal('gamemaker'), intro: z.string().min(1), perVictim: z.array(OutcomeZ) })
  .strict();

export const AnyTemplateZ = z.union([HazardTemplateZ, EventTemplateZ]);

export const FightLineZ = z
  .object({
    id: z.string().regex(/^fl\.[a-z0-9_.]+$/),
    kind: z.enum(['opener', 'kill', 'wound', 'escape', 'stalemate', 'ending']),
    rarity: RarityZ,
    weapon: z.array(WeaponZ).optional(),
    matchup: z.array(z.enum(['1v1', '1vGroup', 'groupVsGroup'])).optional(),
    winner: z.enum(['bigger', 'smaller', 'even']).optional(),
    text: z.string().min(1),
  })
  .strict();

export type WeightMod = z.infer<typeof WeightModZ>;
export type Effect = z.infer<typeof EffectZ>;
export type Outcome = z.infer<typeof OutcomeZ>;
export type EventTemplate = z.infer<typeof EventTemplateZ>;
export type HazardTemplate = z.infer<typeof HazardTemplateZ>;
export type FightLine = z.infer<typeof FightLineZ>;
export type Role = z.infer<typeof RoleZ>;
export type Trigger = z.infer<typeof TriggerZ>;
export type { AnyTemplate, EventDb } from './types';
export { isHazard } from './types';
