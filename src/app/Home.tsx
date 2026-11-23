import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatGameTime } from '../../engine';
import { games } from '../data/repositories';

type Saved = Awaited<ReturnType<typeof games.list>>[number];

export function Home() {
  const nav = useNavigate();
  const [saved, setSaved] = useState<Saved[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    games.list().then(setSaved).catch(() => setSaved([]));
  }, []);
  const running = saved.filter((g) => g.status === 'running');

  return (
    <div className="min-h-full flex flex-col items-center px-5 safe-top safe-bottom">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm gap-8 py-10">
        <div className="text-center rise">
          <div className="font-display text-6xl font-bold tracking-[0.18em] gold-text">ICEHG</div>
          <div className="font-display uppercase tracking-[0.3em] text-sm text-mute mt-2">I Could Eat a Horse Games</div>
        </div>

        <div className="w-full flex flex-col gap-3 rise" style={{ animationDelay: '.1s' }}>
          <button className="btn btn-gold text-lg py-4 font-display uppercase tracking-widest" onClick={() => nav('/new')}>
            New game
          </button>
          {running[0] && (
            <button className="btn btn-ghost py-4 flex-col !gap-0" onClick={() => nav(`/game/${running[0]!.id}`)}>
              <span className="font-display uppercase tracking-widest">Continue</span>
              <span className="text-xs text-mute">
                {running[0].title} · {formatGameTime(running[0].clock.anchorGameMin)}
              </span>
            </button>
          )}
          <Link className="btn btn-ghost py-4 font-display uppercase tracking-widest" to="/pool">
            Contestant pool
          </Link>
          <button className="btn btn-ghost py-4 font-display uppercase tracking-widest opacity-50" disabled title="Coming in Phase 4">
            Watch <span className="text-[10px] normal-case tracking-normal">(soon)</span>
          </button>
          <Link className="btn btn-ghost py-4 font-display uppercase tracking-widest" to="/settings">
            Settings
          </Link>
        </div>

        {saved.length > 0 && (
          <div className="w-full rise" style={{ animationDelay: '.2s' }}>
            <div className="text-xs uppercase tracking-widest text-mute mb-2">Saved games</div>
            <ul className="flex flex-col gap-2">
              {saved.slice(0, 6).map((g) => (
                <li key={g.id} className="glass rounded-xl flex items-center">
                  <button className="flex-1 text-left px-3 py-2" onClick={() => nav(`/game/${g.id}`)}>
                    <div className="text-sm font-medium">{g.title}</div>
                    <div className="text-xs text-mute">
                      {g.status === 'finished' ? 'Finished' : formatGameTime(g.clock.anchorGameMin)} · {g.setup.contestants.length} tributes
                    </div>
                  </button>
                  {confirming === g.id ? (
                    <button
                      className="px-3 py-2 text-chip-red text-sm font-medium"
                      onClick={async () => {
                        await games.remove(g.id);
                        setSaved((s) => s.filter((x) => x.id !== g.id));
                        setConfirming(null);
                      }}
                    >
                      Delete?
                    </button>
                  ) : (
                    <button className="px-3 py-2 text-mute text-sm" aria-label="Delete game" onClick={() => setConfirming(g.id)}>
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
