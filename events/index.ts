// The event database: every JSON file in /events, bundled into the app.
// Validation (zod) runs in the tests; the app trusts the bundled files.
import { z } from 'zod';
import { EventTemplateZ, HazardTemplateZ, FightLineZ, type AnyTemplate, type EventDb, type FightLine } from './schema';
import bloodbath from './bloodbath.json';
import solo from './solo.json';
import triggers from './triggers.json';
import encounter from './encounter.json';
import group from './group.json';
import betrayal from './betrayal.json';
import gamemaker from './gamemaker.json';
import feast from './feast.json';
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
};

export const eventDb: EventDb = {
  templates: Object.values(TEMPLATE_FILES).flat() as AnyTemplate[],
  fightLines: fightlines as FightLine[],
};

/** Strict validation. Throws with a readable message on the first broken file. */
export function validateEventDb(): EventDb {
  const templates: AnyTemplate[] = [];
  for (const [file, list] of Object.entries(TEMPLATE_FILES)) {
    list.forEach((t, i) => {
      const schema = t && typeof t === 'object' && 'perVictim' in t ? HazardTemplateZ : EventTemplateZ;
      const r = schema.safeParse(t);
      const id = (t as { id?: string })?.id ?? `#${i}`;
      if (!r.success) throw new Error(`events/${file}.json → ${id}:\n${z.prettifyError(r.error)}`);
      templates.push(r.data);
    });
  }
  const fl = z.array(FightLineZ).safeParse(fightlines);
  if (!fl.success) throw new Error(`events/fightlines.json: ${z.prettifyError(fl.error)}`);
  return { templates, fightLines: fl.data };
}
