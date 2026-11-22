import type { ContestantSetup, LogEntry, ViewState } from '../../../engine';
import { computeAwards } from './awards';
import { Initials } from './FallenOverlay';

/** Basic Victor screen (§8.6). */
export function VictorOverlay({
  victor,
  people,
  log,
  final,
  onLog,
  onReplay,
  onHome,
}: {
  victor: string;
  people: Record<string, ContestantSetup>;
  log: LogEntry[];
  final: ViewState;
  onLog: () => void;
  onReplay: () => void;
  onHome: () => void;
}) {
  const nameOf = (id: string) => people[id]?.name ?? '?';
  const v = people[victor]!;
  const awards = computeAwards(log, final, victor, nameOf);
  const kills = final.contestants[victor]?.kills.length ?? 0;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto fade-in" style={{ background: 'radial-gradient(ellipse at 50% 0%, #3a2c0c 0%, #0b0d12 65%)' }}>
      <div className="min-h-full flex flex-col items-center px-6 safe-top safe-bottom py-10 gap-6 max-w-md mx-auto">
        <div className="text-xs uppercase tracking-[0.4em] text-gold">The Victor</div>
        <div className="rise">
          <Initials name={v.name} size={110} />
        </div>
        <div className="text-center rise" style={{ animationDelay: '.15s' }}>
          <div className="font-display text-5xl tracking-wide gold-text">{v.name}</div>
          <div className="text-mute mt-1">
            {v.district ? `District ${v.district} · ` : ''}
            {kills} kill{kills === 1 ? '' : 's'}
          </div>
        </div>
        <ul className="w-full flex flex-col gap-2 rise" style={{ animationDelay: '.3s' }}>
          {awards.map((a) => (
            <li key={a.title} className="glass rounded-xl px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-gold">{a.title}</div>
              <div className="font-medium">{a.who.map(nameOf).join(' & ')}</div>
              <div className="text-xs text-mute">{a.detail}</div>
            </li>
          ))}
        </ul>
        <div className="w-full flex flex-col gap-2">
          <button className="btn btn-gold py-3" onClick={onReplay}>
            Play again with the same cast
          </button>
          <button className="btn btn-ghost py-3" onClick={onLog}>
            Full log
          </button>
          <button className="btn btn-ghost py-3" onClick={onHome}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
