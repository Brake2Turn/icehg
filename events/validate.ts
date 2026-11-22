// Strict zod validation of every event file. Used by the tests and sim:stats (not bundled into the app).
import { z } from 'zod';
import { EventTemplateZ, FightLineZ, HazardTemplateZ, type FightLine } from './schema';
import type { AnyTemplate, EventDb } from './types';
import { TEMPLATE_FILES } from './index';
import fightlines from './fightlines.json';

/** Throws with a readable message on the first broken template. */
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
  return { templates, fightLines: fl.data as FightLine[] };
}
