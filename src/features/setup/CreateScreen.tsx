import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { PronounKey } from '../../../engine';
import { Screen } from '../../components/Screen';
import { useDraft, type Slot } from '../../store/draft';
import { DISTRICTS } from './districts';
import { SAMPLE_NAMES } from './sampleNames';
import { startGame } from './startGame';

/** Phase 1 create screen: names and pronouns only. Photos, the pool and relationships arrive in Phase 2. */
export function CreateScreen() {
  const nav = useNavigate();
  const { mode, pace, slots, update, addSlot, removeSlot, setAll } = useDraft();
  const [busy, setBusy] = useState(false);
  if (slots.length === 0) return <Navigate to="/new" replace />;

  const filled = slots.filter((s) => s.name.trim()).length;
  const ready = filled === slots.length;

  const fillSamples = () => {
    const used = new Set(slots.map((s) => s.name.trim().toLowerCase()));
    const pool = SAMPLE_NAMES.filter(([n]) => !used.has(n.toLowerCase()));
    const shuffled = pool.sort(() => Math.random() - 0.5);
    let i = 0;
    setAll(
      slots.map((s) => {
        if (s.name.trim()) return s;
        const pick = shuffled[i++];
        return pick ? { ...s, name: pick[0], pronouns: pick[1] } : s;
      }),
    );
  };

  const go = async () => {
    setBusy(true);
    try {
      const id = await startGame(mode, pace, slots);
      nav(`/game/${id}`, { replace: true, state: { fresh: true } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={mode === 'classic' ? 'Classic board' : 'Custom board'} back="/new" right={<span className="text-sm text-mute">{filled}/{slots.length}</span>}>
      <div className="flex flex-col gap-4 pb-28">
        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1 text-sm" onClick={fillSamples}>
            Fill empty slots with sample names
          </button>
          {filled > 0 && (
            <button className="btn btn-ghost text-sm" onClick={() => setAll(slots.map((s) => ({ ...s, name: '' })))}>
              Clear
            </button>
          )}
        </div>

        {mode === 'classic' ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {DISTRICTS.map((d, i) => (
              <div key={d.n} className="glass rounded-2xl p-3">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-display text-2xl gold-text">{d.n}</span>
                  <span className="text-xs uppercase tracking-widest text-mute">{d.industry}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {slots.slice(i * 2, i * 2 + 2).map((s) => (
                    <SlotRow key={s.key} slot={s} onChange={(p) => update(s.key, p)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {slots.map((s, i) => (
              <div key={s.key} className="glass rounded-xl p-2 flex items-center gap-2">
                <span className="w-6 text-center text-mute text-sm">{i + 1}</span>
                <div className="flex-1">
                  <SlotRow slot={s} onChange={(p) => update(s.key, p)} />
                </div>
                <button className="text-mute px-2" aria-label="Remove slot" disabled={slots.length <= 2} onClick={() => removeSlot(s.key)}>
                  ✕
                </button>
              </div>
            ))}
            {slots.length < 48 && (
              <button className="btn btn-ghost border-dashed" onClick={addSlot}>
                + Add slot
              </button>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 glass safe-bottom px-4 pt-3 z-20 border-x-0 border-b-0">
        <div className="max-w-3xl mx-auto">
          <button className="btn btn-gold w-full py-4 font-display uppercase tracking-widest text-lg" disabled={!ready || busy} onClick={go}>
            {busy ? 'Rolling the dice…' : ready ? 'Start' : `Fill ${slots.length - filled} more`}
          </button>
        </div>
      </div>
    </Screen>
  );
}

function SlotRow({ slot, onChange }: { slot: Slot; onChange: (p: Partial<Slot>) => void }) {
  return (
    <div className="flex gap-2">
      <input
        className="input"
        placeholder="Name"
        value={slot.name}
        maxLength={24}
        autoCapitalize="words"
        autoComplete="off"
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <select className="input !w-24" value={slot.pronouns} onChange={(e) => onChange({ pronouns: e.target.value as PronounKey })} aria-label="Pronouns">
        <option value="they">they</option>
        <option value="she">she</option>
        <option value="he">he</option>
      </select>
    </div>
  );
}
