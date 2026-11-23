// The event database: every JSON file in /events, bundled into the app.
// Validation (zod, events/validate.ts) runs in the tests and sim:stats; the app trusts the bundled files.
import type { AnyTemplate, EventDb, FightLine } from './types';
import bloodbath from './bloodbath.json';
import solo from './solo.json';
import triggers from './triggers.json';
import encounter from './encounter.json';
import group from './group.json';
import betrayal from './betrayal.json';
import gamemaker from './gamemaker.json';
import feast from './feast.json';
import saves from './saves.json';
import more from './more.json';
import fightlines from './fightlines.json';

export const TEMPLATE_FILES: Record<string, unknown[]> = {
  bloodbath,
  solo,
  triggers,
  encounter,
  group,
  betrayal,
  gamemaker,
  feast,
  saves,
  more,
};

export const eventDb: EventDb = {
  templates: Object.values(TEMPLATE_FILES).flat() as AnyTemplate[],
  fightLines: fightlines as FightLine[],
};
