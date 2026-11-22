import type { EventEntry, LogEntry, ViewState } from '../../../engine';

export type Award = { title: string; who: string[]; detail: string };

/** The Victor screen awards (§8.6), all derived from the log and the final state. */
export function computeAwards(log: LogEntry[], final: ViewState, victor: string, nameOf: (id: string) => string): Award[] {
  const out: Award[] = [];
  const cs = Object.values(final.contestants);

  const maxKills = Math.max(...cs.map((c) => c.kills.length));
  if (maxKills > 0) {
    const who = cs.filter((c) => c.kills.length === maxKills).map((c) => c.id);
    out.push({ title: 'Most kills', who, detail: `${maxKills} kill${maxKills === 1 ? '' : 's'}` });
  }

  for (const e of log) {
    const d = e.patches.find((p) => p.p === 'death' && p.by);
    if (d && d.p === 'death' && d.by) {
      out.push({ title: 'First blood', who: [d.by], detail: `drew it on ${nameOf(d.id)}` });
      break;
    }
  }

  const betrayals = log.filter((e): e is EventEntry => e.kind === 'event' && !!e.tags?.includes('betrayal'));
  if (betrayals.length) {
    const lethal = betrayals.find((e) => e.patches.some((p) => p.p === 'death')) ?? betrayals[0]!;
    const who = Object.entries(lethal.nameColours).filter(([, c]) => c === 'purple').map(([id]) => id);
    const victim = lethal.participants.find((id) => !who.includes(id));
    if (who.length) out.push({ title: 'Biggest betrayal', who, detail: victim ? `turned on ${nameOf(victim)}` : 'turned on the group' });
  }

  let best: [string, string, number] | null = null;
  for (const a of cs)
    for (const b of cs) {
      if (a.id >= b.id) continue;
      const m = Math.min(final.affinity[a.id]?.[b.id] ?? 0, final.affinity[b.id]?.[a.id] ?? 0);
      if (!best || m > best[2]) best = [a.id, b.id, m];
    }
  if (best && best[2] >= 40) out.push({ title: 'Most loyal friendship', who: [best[0], best[1]], detail: `+${best[2]} both ways` });

  let hated: [string, number] | null = null;
  for (const c of cs) {
    const vals = cs.filter((o) => o.id !== c.id).map((o) => final.affinity[o.id]?.[c.id] ?? 0);
    const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
    if (!hated || avg < hated[1]) hated = [c.id, avg];
  }
  if (hated && hated[1] < 0) out.push({ title: 'Most hated', who: [hated[0]], detail: `average feeling ${Math.round(hated[1])}` });

  const pacifists = cs.filter((c) => c.kills.length === 0 && c.id !== victor && c.deathMinute !== null).sort((a, b) => b.deathMinute! - a.deathMinute!);
  if (pacifists[0]) out.push({ title: 'Survived longest with zero kills', who: [pacifists[0].id], detail: 'never hurt a soul' });

  return out;
}
