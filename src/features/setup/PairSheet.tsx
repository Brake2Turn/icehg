import { useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Sheet } from '../../components/Sheet';
import type { Slot } from '../../store/draft';
import { affinityColour, affinityLabel, PRESETS } from './relationships';

/** Edit how two people feel about each other (§5.4). Changes apply straight away. */
export function PairSheet({ a, b, ab, ba, onChange, onClose }: { a: Slot; b: Slot; ab: number; ba: number; onChange: (ab: number, ba: number) => void; onClose: () => void }) {
  const [link, setLink] = useState(true);
  const row = (from: Slot, to: Slot, v: number, set: (n: number) => void, id: string) => (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-sm" htmlFor={id}>
        <span className="font-medium">{from.name}</span>
        <span className="text-mute">→</span>
        <span className="font-medium">{to.name}</span>
        <span className="ml-auto font-semibold tabular-nums" style={{ color: affinityColour(v) }}>
          {affinityLabel(v)} · {v > 0 ? `+${v}` : v}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={-100}
        max={100}
        step={1}
        value={v}
        onChange={(e) => set(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: affinityColour(v) }}
      />
    </div>
  );
  return (
    <Sheet title="Relationship" onClose={onClose} footer={<button className="btn btn-gold w-full mb-1" onClick={onClose}>Done</button>}>
      <div className="flex items-center justify-center gap-4 mb-4">
        <div className="flex flex-col items-center gap-1">
          <Avatar name={a.name} photo={a.photo} size={56} />
          <span className="text-sm">{a.name}</span>
        </div>
        <span className="text-mute">⇄</span>
        <div className="flex flex-col items-center gap-1">
          <Avatar name={b.name} photo={b.photo} size={56} />
          <span className="text-sm">{b.name}</span>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        {row(a, b, ab, (n) => onChange(n, link ? n : ba), 'aff-ab')}
        {row(b, a, ba, (n) => onChange(link ? n : ab, n), 'aff-ba')}
        <label className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5" htmlFor="aff-link">
          <span className="text-sm">Link both ways</span>
          <input id="aff-link" type="checkbox" className="w-6 h-6 accent-[var(--color-gold)]" checked={link} onChange={(e) => setLink(e.target.checked)} />
        </label>
        <div>
          <div className="text-xs uppercase tracking-widest text-mute mb-2">Presets</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.name} className="btn btn-ghost !py-1.5 !px-3 text-sm" onClick={() => onChange(p.ab, p.ba)}>
                {p.name}{' '}
                <span className="text-mute text-xs">
                  {p.ab > 0 ? '+' : ''}
                  {p.ab}/{p.ba > 0 ? '+' : ''}
                  {p.ba}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-mute">Hates ≤ −60 · Dislikes −59…−20 · Neutral −19…19 · Likes 20…59 · Loyal ≥ 60. Feelings tilt the odds; they never decide what happens.</div>
      </div>
    </Sheet>
  );
}
