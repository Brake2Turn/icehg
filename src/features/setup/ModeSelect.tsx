import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Mode } from '../../../engine';
import { Screen } from '../../components/Screen';
import { useDraft } from '../../store/draft';

export function ModeSelect() {
  const nav = useNavigate();
  const start = useDraft((s) => s.start);
  const [mode, setMode] = useState<Mode>('classic');
  const [count, setCount] = useState(12);

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

        <button
          className="btn btn-gold py-4 font-display uppercase tracking-widest text-lg"
          onClick={() => {
            start(mode, count, 'standard');
            nav('/create');
          }}
        >
          Next: fill the board
        </button>
      </div>
    </Screen>
  );
}
