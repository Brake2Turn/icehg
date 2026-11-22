// Pre-process the event database into lookup tables the engine can use quickly.
import type { AnyTemplate, EventDb, FightLine, HazardTemplate, EventTemplate, Trigger } from '../../events/types';
import { isHazard } from '../../events/types';
import type { Category } from '../core/types';

export type SingleRole = 'A' | 'B' | 'C';
export type UnitSlot = { role: 'G' | 'H' | SingleRole; min: number; max: number; single: boolean };

export type Compiled = {
  t: EventTemplate;
  /** Roles bound to whole units (encounters need exactly two). */
  unitSlots: UnitSlot[];
  /** Single roles that must be picked from inside a unit role. */
  inside: { role: SingleRole; group: 'G' | 'H' }[];
  hasFormGroup: boolean;
};

export type CompiledDb = {
  all: AnyTemplate[];
  byCategory: Record<Category, Compiled[]>;
  betrayal: Compiled[];
  byTrigger: Partial<Record<Trigger, Compiled[]>>;
  hazards: HazardTemplate[];
  closures: HazardTemplate[];
  fightLines: FightLine[];
  linesByKind: Record<FightLine['kind'], FightLine[]>;
};

function compileOne(t: EventTemplate): Compiled {
  const inside: Compiled['inside'] = [];
  const insideRoles = new Set<string>();
  for (const r of t.requires?.inGroup ?? []) {
    if (r.who === 'A' || r.who === 'B' || r.who === 'C') {
      inside.push({ role: r.who, group: r.group });
      insideRoles.add(r.who);
    }
  }
  const unitSlots: UnitSlot[] = [];
  if (t.roles.G) unitSlots.push({ role: 'G', min: t.roles.G.min, max: t.roles.G.max, single: false });
  if (t.roles.H) unitSlots.push({ role: 'H', min: t.roles.H.min, max: t.roles.H.max, single: false });
  for (const r of ['A', 'B', 'C'] as const) {
    if (t.roles[r] && !insideRoles.has(r)) unitSlots.push({ role: r, min: 1, max: 1, single: true });
  }
  const hasFormGroup = t.outcomes.some((o) => o.effects.some((e) => e.kind === 'formGroup' || e.kind === 'joinGroup'));
  return { t, unitSlots, inside, hasFormGroup };
}

export function compileDb(db: EventDb): CompiledDb {
  const byCategory: CompiledDb['byCategory'] = {
    bloodbath: [],
    solo: [],
    encounter: [],
    group: [],
    gamemaker: [],
    feast: [],
  };
  const byTrigger: CompiledDb['byTrigger'] = {};
  const betrayal: Compiled[] = [];
  const hazards: HazardTemplate[] = [];
  const closures: HazardTemplate[] = [];
  for (const t of db.templates) {
    if (isHazard(t)) {
      if (t.trigger === 'closure') closures.push(t);
      else if (!t.trigger || t.trigger === 'hazard') hazards.push(t);
      else {
        // Announcement-style gamemaker entries (feast, gong): stored as hazards with no victims.
        (byTrigger[t.trigger] ??= []).push(compileOne({ ...t, outcomes: [{ rarity: 'common', text: t.intro, effects: [] }] } as unknown as EventTemplate));
      }
      continue;
    }
    const c = compileOne(t);
    if (t.trigger) (byTrigger[t.trigger] ??= []).push(c);
    else if (t.betrayal) betrayal.push(c);
    else byCategory[t.category].push(c);
  }
  const linesByKind: CompiledDb['linesByKind'] = { opener: [], kill: [], wound: [], escape: [], stalemate: [], ending: [] };
  for (const l of db.fightLines) linesByKind[l.kind].push(l);
  return { all: db.templates, byCategory, betrayal, byTrigger, hazards, closures, fightLines: db.fightLines, linesByKind };
}
