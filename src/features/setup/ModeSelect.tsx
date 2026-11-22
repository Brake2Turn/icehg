import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Mode, Pace } from '../../../engine';
import { Screen } from '../../components/Screen';
import { useDraft } from '../../store/draft';
import { useSettings } from '../../store/settings';
import { PACE_LABEL } from '../feed/paceLabels';

export function ModeSelect() {
  const nav = useNavigate();
  const defaultPace = useSettings((s) => s.defaultPace);
  const start = useDraft((s) => s.start);
  const [mode, setMode] = useState<Mode>('classic');
  const [count, setCount] = useState(12);
  const [pace, setPace] = useState<Pace>(defaultPace);

  return (
    <Screen title="New game">
      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-2 gap-3">
          {(['classic', 'custom'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`glass rounded-2xl p-4 text-left transition ${mode === m ? 'ring-2 ring-gold' : ''}`}
            >
              <div className="font-display text-2xl uppercase tracking-wider">{m}</div>
              <div className="text-sm text-mute mt-1">{m === 'classic' ? '12 districts × 2 tributes' : 'Any number, no districts'}</div>
            </button>
          ))}
        </section>

        {mode === 'custom' && (
          <section className="glass rounded-2xl p-4">
            <label className="text-sm text-mute" htmlFor="count">
              How many contestants? (2–48)
            </label>
            <div className="flex items-center gap-3 mt-2">
              <button className="btn btn-ghost !px-4" onClick={() => setCount((c) => Math.max(2, c - 1))}>
                −
              </button>
              <input
                id="count"
                className="input text-center font-display text-2xl"
                type="number"
                inputMode="numeric"
                min={2}
                max={48}
                value={count}
                onChange={(e) => setCount(Math.max(2, Math.min(48, Number(e.target.value) || 2)))}
              />
              <button className="btn btn-ghost !px-4" onClick={() => setCount((c) => Math.min(48, c + 1))}>
                +
              </button>
            </div>
          </section>
        )}

        <section className="glass rounded-2xl p-4">
          <div className="text-sm text-mute mb-2">Pace</div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PACE_LABEL) as Pace[]).map((p) => (
              <button key={p} onClick={() => setPace(p)} className={`rounded-xl px-3 py-2 text-left border ${pace === p ? 'border-gold bg-gold/10' : 'border-line'}`}>
                <div className="font-medium">{PACE_LABEL[p].name}</div>
                <div className="text-xs text-mute">{PACE_LABEL[p].detail}</div>
              </button>
            ))}
          </div>
        </section>

        <button
          className="btn btn-gold py-4 font-display uppercase tracking-widest text-lg"
          onClick={() => {
            start(mode, count, pace);
            nav('/create');
          }}
        >
          Next: fill the board
        </button>
      </div>
    </Screen>
  );
}
