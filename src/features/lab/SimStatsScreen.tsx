import { useState } from 'react';
import { simulate } from '../../../engine';
import { makeCast, median, summarise, type SimStats } from '../../../engine/analysis/stats';
import type { GameResult } from '../../../engine';
import { eventDb } from '../../../events';
import { Screen } from '../../components/Screen';

/** In-app version of `npm run sim:stats` (smaller run, same numbers). */
export function SimStatsScreen() {
  const [n, setN] = useState(100);
  const [progress, setProgress] = useState<number | null>(null);
  const [stats, setStats] = useState<SimStats | null>(null);

  const run = () => {
    const results: GameResult[] = [];
    const seed0 = Math.floor(Math.random() * 1e9);
    setProgress(0);
    setStats(null);
    const step = () => {
      const end = Math.min(n, results.length + 10);
      while (results.length < end) {
        results.push(simulate({ mode: 'classic', pace: 'standard', seed: seed0 + results.length, contestants: makeCast(24) }, eventDb));
      }
      setProgress(results.length);
      if (results.length < n) setTimeout(step, 0);
      else {
        setStats(summarise(eventDb, results));
        setProgress(null);
      }
    };
    setTimeout(step, 0);
  };

  const hist: Record<number, number> = {};
  for (const d of stats?.lengthDays ?? []) hist[d] = (hist[d] ?? 0) + 1;
  const maxH = Math.max(1, ...Object.values(hist));

  return (
    <Screen title="Sim stats" back="/settings">
      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <span className="text-sm text-mute">Games</span>
        <input type="number" className="input !w-24" value={n} min={10} max={2000} onChange={(e) => setN(Math.max(10, Math.min(2000, Number(e.target.value) || 10)))} />
        <button className="btn btn-gold flex-1" onClick={run} disabled={progress !== null}>
          {progress !== null ? `${progress} / ${n}` : 'Run 24-tribute games'}
        </button>
      </div>
      {stats && (
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <div className="glass rounded-2xl p-4">
            <div className="font-display uppercase tracking-wider mb-2">Game length (days)</div>
            {Object.keys(hist)
              .map(Number)
              .sort((a, b) => a - b)
              .map((d) => (
                <div key={d} className="flex items-center gap-2">
                  <span className="w-12 text-mute">Day {d}</span>
                  <div className="h-3 bg-gold/80 rounded" style={{ width: `${(hist[d]! / maxH) * 70}%` }} />
                  <span className="text-mute text-xs">{hist[d]}</span>
                </div>
              ))}
            <div className="text-mute mt-2">median {median(stats.lengthDays)} days</div>
          </div>
          <div className="glass rounded-2xl p-4 grid grid-cols-2 gap-2">
            <Stat label="Bloodbath deaths (median)" value={`${median(stats.bloodbathDeaths)} of 24`} />
            <Stat label="First-hour events" value={String(median(stats.firstHourEvents))} />
            <Stat label="Betrayals / game" value={String(median(stats.betrayals))} />
            <Stat label="Groups formed / game" value={String(median(stats.groupsFormed))} />
            <Stat label="Legendary / 100 games" value={stats.legendaryPer100.toFixed(1)} />
            <Stat label="Victors ever in a group" value={`${Math.round(stats.victorEverInGroupShare * 100)}%`} />
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="font-display uppercase tracking-wider mb-2">Unused in this run</div>
            <div className="text-mute text-xs break-words">{[...stats.unusedTemplates, ...stats.unusedFightLines].join(', ') || 'none'}</div>
          </div>
        </div>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-mute">{label}</div>
      <div className="font-display text-xl">{value}</div>
    </div>
  );
}
