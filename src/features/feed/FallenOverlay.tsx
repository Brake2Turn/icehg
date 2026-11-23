import { Avatar } from '../../components/Avatar';
import type { Person } from './person';
import type { Fallen } from './useGame';
import { DISTRICTS } from '../setup/districts';

/** The Fallen screen at 00:00 (§8.4). */
export function FallenOverlay({ fallen, people, onClose }: { fallen: Fallen; people: Record<string, Person>; onClose: () => void }) {
  const list = fallen.entry.fallen;
  const step = Math.min(0.6, 3 / Math.max(1, list.length));
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 fade-in overflow-y-auto"
      style={{ background: 'radial-gradient(ellipse at 50% 20%, #1b2340 0%, #070912 70%)' }}
      onClick={onClose}
    >
      <Stars />
      <div className="relative text-center">
        <div className="text-xs uppercase tracking-[0.4em] text-mute">Day {fallen.entry.day - 1} · the fallen</div>
        {list.length === 0 ? (
          <div className="font-display text-3xl mt-6 tracking-wide rise">No cannons tonight.</div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3 items-center">
            {list.map((id, i) => {
              const p = people[id]!;
              return (
                <li key={id} className="rise flex items-center gap-3" style={{ animationDelay: `${0.35 + i * step}s` }}>
                  <Avatar name={p.name} photo={p.photo} />
                  <div className="text-left">
                    <div className="font-display text-2xl tracking-wide">{p.name}</div>
                    {p.district && <div className="text-xs text-mute uppercase tracking-widest">District {p.district} · {DISTRICTS[p.district - 1]?.industry}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="text-xs text-mute mt-10">Tap to close</div>
      </div>
    </div>
  );
}

function Stars() {
  const stars = Array.from({ length: 60 }, (_, i) => ({ x: (i * 37.7) % 100, y: (i * 61.3) % 100, s: (i % 3) + 1, o: 0.25 + ((i * 13) % 7) / 10 }));
  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((s, i) => (
        <span key={i} className="absolute rounded-full bg-white" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o }} />
      ))}
    </div>
  );
}
