// Group rolls (§6.5 step 5, §6.8) and betrayal checks (§6.9).
import type { World } from '../core/world';
import { P_GROUP, P_LAST_ALLIANCE_BETRAYAL } from '../tuning';
import { expandInside } from './encounters';
import { choose, runTemplate, type Bind } from './resolve';
import { betrayalCheck } from './betrayal';

export function groupStep(w: World) {
  for (const g of w.rng.shuffle([...w.groups.values()])) {
    if (w.aliveCount() <= 1) return;
    if (!w.groups.has(g.id)) continue;
    const members = g.members.slice();
    if (members.length < 2) continue;
    if (members.some((id) => w.acted.has(id) || w.isTravelling(w.c[id]!))) continue;
    const zone = w.c[members[0]!]!.zone;

    // Last alliance standing: everyone left is in this group, so it has to end now,
    // by betrayal or by them going their separate ways (owner's rule).
    if (members.length === w.aliveCount()) {
      if (w.rng.chance(P_LAST_ALLIANCE_BETRAYAL) && betrayalCheck(w, g.id, true)) continue;
      const choice = choose(w, w.db.byTrigger.lastAlliance ?? [], zone, (c) => expandInside(c, { G: members } as Bind));
      if (choice) runTemplate(w, choice, zone);
      else betrayalCheck(w, g.id, true);
      continue;
    }

    if (betrayalCheck(w, g.id)) continue;

    if (!w.rng.chance(P_GROUP)) continue;
    const choice = choose(w, w.db.byCategory.group, zone, (c) => {
      if (c.unitSlots.length !== 1 || c.unitSlots[0]!.role !== 'G') return [];
      const slot = c.unitSlots[0]!;
      if (members.length < slot.min || members.length > slot.max) return [];
      return expandInside(c, { G: members } as Bind);
    });
    if (choice) runTemplate(w, choice, zone);
  }
}
