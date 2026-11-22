// Plain types for the event database (no zod at runtime, so the app bundle stays small).
import type { EventTemplate, FightLine, HazardTemplate } from './schema';

export type { EventTemplate, FightLine, HazardTemplate, Outcome, Effect, WeightMod, Role, Trigger } from './schema';
export type AnyTemplate = EventTemplate | HazardTemplate;
export type EventDb = { templates: AnyTemplate[]; fightLines: FightLine[] };

export function isHazard(t: AnyTemplate): t is HazardTemplate {
  return 'perVictim' in t;
}
