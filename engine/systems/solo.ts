// Solo rolls (§6.5 step 3).
import type { World } from '../core/world';
import { FEAST_SOLO_P, P_SOLO_DAY, P_SOLO_NIGHT, TAGGED_SOLO_MULT } from '../tuning';
import type { Compiled } from './compile';
import { choose, runTemplate, type Bind } from './resolve';
import { inFeastWindow } from './gamemakers';

const soloShape = (c: Compiled) => c.unitSlots.length === 1 && c.unitSlots[0]!.role === 'A' && c.inside.length === 0;

export function soloStep(w: World) {
  const night = w.band === 'night';
  const feast = inFeastWindow(w);
  for (const id of w.rng.shuffle(w.order)) {
    if (w.aliveCount() <= 1) return;
    const c = w.c[id]!;
    if (!c.alive || w.acted.has(id) || w.isTravelling(c)) continue;

    if (feast && c.zone === 'cornucopia' && w.rng.chance(FEAST_SOLO_P)) {
      const choice = choose(w, w.db.byCategory.feast.filter(soloShape), c.zone, () => [{ A: id }]);
      if (choice) {
        runTemplate(w, choice, c.zone);
        continue;
      }
    }

    const tagged = c.tags.some((t) => t.tag === 'abandoned' || t.tag === 'grieving' || t.tag === 'betrayed');
    const p = (night ? P_SOLO_NIGHT : P_SOLO_DAY) * (tagged ? TAGGED_SOLO_MULT : 1);
    if (!w.rng.chance(p)) continue;
    const asleep = c.asleep;
    const choice = choose(w, w.db.byCategory.solo, c.zone, (ct) => {
      if (!soloShape(ct)) return [];
      const wantsSleep = !!ct.t.requires?.asleep?.includes('A');
      if (asleep !== wantsSleep) return [];
      return [{ A: id } as Bind];
    });
    if (choice) runTemplate(w, choice, c.zone);
  }
}
