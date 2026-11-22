// Daily affinity changes and the midnight reckoning (§6.3, §6.6).
import { quietWindowMinutes } from '../core/clock';
import type { World } from '../core/world';
import { DRIFT_PER_DAY, GRIEF_LIKE_MIN, HARDSHIP_PER_DAY } from '../tuning';

export function midnight(w: World) {
  const fallen = w.diedSinceMidnight.slice();
  w.diedSinceMidnight = [];
  w.cur = [];
  // Everyone sees the faces in the sky; those who liked the dead grieve.
  for (const id of w.order) {
    const c = w.c[id]!;
    if (!c.alive) continue;
    if (fallen.some((d) => w.getAff(id, d) >= GRIEF_LIKE_MIN)) w.addTag(id, 'grieving');
  }
  // Shared hardship, then drift back toward the starting feelings.
  for (const g of w.groups.values()) {
    for (const a of g.members) for (const b of g.members) if (a !== b) w.setAffSilently(a, b, w.getAff(a, b) + HARDSHIP_PER_DAY);
  }
  for (const a of w.order) {
    if (!w.c[a]!.alive) continue;
    for (const b of w.order) {
      if (a === b) continue;
      const cur = w.getAff(a, b);
      const start = w.affStart[a]![b]!;
      if (cur === start) continue;
      let next = Math.round(cur + (start - cur) * DRIFT_PER_DAY);
      if (next === cur) next += start > cur ? 1 : -1;
      w.setAffSilently(a, b, next);
    }
  }
  w.pushAffSnapshot();
  const patches = w.cur;
  w.cur = null;
  w.pushEntry({ kind: 'midnight', day: w.day, fallen, quietUntil: w.minute + quietWindowMinutes(w.setup.pace), patches });
}
