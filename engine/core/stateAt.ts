// Rebuild what's on screen from the log (§4.2): fold every entry with gameMinute <= t.
import { START_MINUTE } from '../tuning';
import type { GameSetup, LogEntry, Patch, ViewState } from './types';

export function blankView(setup: GameSetup): ViewState {
  const contestants: ViewState['contestants'] = {};
  const affinity: ViewState['affinity'] = {};
  for (const s of setup.contestants) {
    contestants[s.id] = {
      id: s.id,
      alive: true,
      health: 'healthy',
      weapon: 'none',
      items: [],
      zone: 'cornucopia',
      groupId: null,
      kills: [],
      killedBy: null,
      deathMinute: null,
      deathEventSeq: null,
      tags: [],
    };
    affinity[s.id] = {};
  }
  return { minute: START_MINUTE, contestants, groups: {}, affinity, closedZones: [], victor: null, feast: 'none' };
}

export function cloneView(v: ViewState): ViewState {
  return structuredCloneLite(v);
}

function structuredCloneLite<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function applyPatch(v: ViewState, p: Patch, entry: LogEntry) {
  switch (p.p) {
    case 'death': {
      const c = v.contestants[p.id]!;
      c.alive = false;
      c.killedBy = p.by;
      c.deathMinute = entry.gameMinute;
      c.deathEventSeq = entry.seq;
      if (p.by && v.contestants[p.by]) v.contestants[p.by]!.kills.push(p.id);
      break;
    }
    case 'health':
      v.contestants[p.id]!.health = p.v;
      break;
    case 'weapon':
      v.contestants[p.id]!.weapon = p.v;
      break;
    case 'items':
      v.contestants[p.id]!.items = p.v.slice();
      break;
    case 'zone':
      v.contestants[p.id]!.zone = p.v;
      break;
    case 'group': {
      const c = v.contestants[p.id]!;
      if (c.groupId && v.groups[c.groupId]) {
        const g = v.groups[c.groupId]!;
        g.members = g.members.filter((m) => m !== p.id);
      }
      c.groupId = p.v;
      if (p.v) v.groups[p.v]!.members.push(p.id);
      break;
    }
    case 'groupNew':
      v.groups[p.group] = { id: p.group, members: [], colour: p.colour };
      break;
    case 'groupEnd':
      delete v.groups[p.group];
      break;
    case 'aff':
      v.affinity[p.from]![p.to] = p.v;
      break;
    case 'affAll':
      p.ids.forEach((a, i) => {
        const row = (v.affinity[a] ??= {});
        p.ids.forEach((b, j) => {
          if (a !== b) row[b] = p.v[i]![j]!;
        });
      });
      break;
    case 'tags':
      v.contestants[p.id]!.tags = p.v.map((t) => ({ ...t }));
      break;
    case 'close':
      if (!v.closedZones.includes(p.zone)) {
        v.closedZones.push(p.zone);
        v.closedZones.sort();
      }
      break;
    case 'feast':
      v.feast = p.v;
      break;
    case 'victor':
      v.victor = p.id;
      break;
  }
}

/** Pure fold. For per-frame use, prefer a ViewFolder (incremental). */
export function stateAt(setup: GameSetup, log: LogEntry[], t: number): ViewState {
  const v = blankView(setup);
  for (const e of log) {
    if (e.gameMinute > t) break;
    for (const p of e.patches) applyPatch(v, p, e);
  }
  v.minute = t;
  return v;
}

/** Index of the first entry with gameMinute > t (log is sorted by gameMinute). */
export function revealedCount(log: LogEntry[], t: number): number {
  let lo = 0;
  let hi = log.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (log[mid]!.gameMinute <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Incremental fold: cheap when time moves forward, rebuilds when it moves back. */
export class ViewFolder {
  private v: ViewState;
  private n = 0;
  constructor(
    private setup: GameSetup,
    private log: LogEntry[],
  ) {
    this.v = blankView(setup);
  }
  at(t: number): ViewState {
    const target = revealedCount(this.log, t);
    if (target < this.n) {
      this.v = blankView(this.setup);
      this.n = 0;
    }
    for (; this.n < target; this.n++) {
      const e = this.log[this.n]!;
      for (const p of e.patches) applyPatch(this.v, p, e);
    }
    this.v.minute = t;
    return this.v;
  }
  get count() {
    return this.n;
  }
}
