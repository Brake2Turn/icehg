import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { QUIRK_INFO } from '../../../engine';
import { Avatar } from '../../components/Avatar';
import { Screen } from '../../components/Screen';
import { pairKey, useDraft, type Slot } from '../../store/draft';
import { usePool } from '../pool/usePool';
import { AddSheet } from './AddSheet';
import { DISTRICTS } from './districts';
import { PairSheet } from './PairSheet';
import { affinityColour, boardAffinity } from './relationships';
import { SAMPLE_NAMES } from './sampleNames';
import { startGame } from './startGame';

type BoardMode = 'tributes' | 'relationships';
const LONG_PRESS_MS = 380;

/** The create screen (§5.2, §5.4): fill slots, drag to swap, and set relationships. */
export function CreateScreen() {
  const nav = useNavigate();
  const d = useDraft();
  const { mode, pace, slots } = d;
  const { people: poolPeople, reload: reloadPool } = usePool();
  const [busy, setBusy] = useState(false);
  const [boardMode, setBoardMode] = useState<BoardMode>('tributes');
  const [editing, setEditing] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [pair, setPair] = useState<string | null>(null);
  const drag = useSwapDrag((a, b) => d.swap(a, b));

  const aff = useMemo(() => boardAffinity(slots, d.affinitySeed, d.affinityBase, d.overrides), [slots, d.affinitySeed, d.affinityBase, d.overrides]);
  if (slots.length === 0) return <Navigate to="/new" replace />;

  const filled = slots.filter((s) => s.name.trim()).length;
  const ready = filled === slots.length;
  const usedPoolIds = new Set(slots.map((s) => s.poolId).filter(Boolean) as string[]);
  const available = (poolPeople ?? []).filter((p) => !usedPoolIds.has(p.id));
  const labelOf = (s: Slot) => {
    if (s.district) return `District ${s.district} · ${DISTRICTS[s.district - 1]!.industry}`;
    return `Slot ${slots.indexOf(s) + 1}`;
  };

  const fillFromPool = () => {
    const pick = available.slice().sort(() => Math.random() - 0.5);
    let i = 0;
    d.setAll(
      slots.map((s) => {
        if (s.name.trim()) return s;
        const p = pick[i++];
        return p ? { ...s, name: p.name, pronouns: p.pronouns, quirk: p.quirk, photo: p.photo, poolId: p.id } : s;
      }),
    );
  };
  const fillSamples = () => {
    const used = new Set(slots.map((s) => s.name.trim().toLowerCase()));
    const pick = SAMPLE_NAMES.filter(([n]) => !used.has(n.toLowerCase())).sort(() => Math.random() - 0.5);
    let i = 0;
    d.setAll(slots.map((s) => (s.name.trim() ? s : pick[i] ? { ...s, name: pick[i]![0], pronouns: pick[i++]![1] } : s)));
  };

  const go = async () => {
    setBusy(true);
    try {
      const id = await startGame(mode, pace, slots, { seed: d.affinitySeed, base: d.affinityBase, overrides: d.overrides });
      nav(`/game/${id}`, { replace: true, state: { fresh: true } });
    } finally {
      setBusy(false);
    }
  };

  const tile = (s: Slot) => {
    const isFilled = !!s.name.trim();
    const rel = boardMode === 'relationships';
    const v = rel && focus && isFilled && s.key !== focus ? aff[focus]?.[s.key] : undefined;
    const ring = s.key === focus ? 'var(--color-gold)' : v !== undefined ? affinityColour(v) : undefined;
    const onTap = () => {
      if (drag.consumedClick()) return;
      if (!rel) return setEditing(s.key);
      if (!isFilled) return;
      if (!focus || focus === s.key) return setFocus(focus === s.key ? null : s.key);
      setPair(s.key);
    };
    return (
      <button
        key={s.key}
        data-slot={s.key}
        type="button"
        onClick={onTap}
        {...(!rel && isFilled ? drag.handlers(s.key) : {})}
        className={`relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-left w-full min-w-0 select-none [-webkit-touch-callout:none] transition ${
          isFilled ? 'bg-white/5 active:bg-white/10' : 'border border-dashed border-line'
        } ${drag.dragging === s.key ? 'opacity-30' : ''} ${drag.over === s.key ? 'ring-2 ring-gold' : ''} ${rel && !isFilled ? 'opacity-30' : ''} ${
          s.key === focus ? 'bg-gold/15' : ''
        }`}
      >
        {isFilled ? (
          <Avatar name={s.name} photo={s.photo} size={40} ring={ring} />
        ) : (
          <span className="w-10 h-10 rounded-full border-2 border-dashed border-line flex items-center justify-center text-mute text-xl shrink-0">+</span>
        )}
        <span className="flex-1 min-w-0">
          <span className={`block truncate ${isFilled ? 'font-medium' : 'text-mute'}`}>{isFilled ? s.name : 'Empty slot'}</span>
          {isFilled && (
            <span className="block text-[11px] text-mute">
              {s.pronouns}
              {s.quirk && <span className="text-gold"> · {QUIRK_INFO[s.quirk].label}</span>}
            </span>
          )}
        </span>
        {v !== undefined && (
          <span className="text-sm font-semibold tabular-nums" style={{ color: affinityColour(v) }}>
            {v > 0 ? `+${v}` : v}
          </span>
        )}
      </button>
    );
  };

  const editingSlot = slots.find((s) => s.key === editing);
  const pairA = slots.find((s) => s.key === focus);
  const pairB = slots.find((s) => s.key === pair);

  return (
    <Screen title={mode === 'classic' ? 'Classic board' : 'Custom board'} back="/new" right={<span className="text-sm text-mute tabular-nums">{filled}/{slots.length}</span>}>
      <div className="flex flex-col gap-4 pb-28">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5">
          {(['tributes', 'relationships'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setBoardMode(m);
                setFocus(null);
              }}
              className={`rounded-lg py-2 font-display uppercase tracking-wider text-sm ${boardMode === m ? 'bg-gold text-ink' : 'text-mute'}`}
            >
              {m}
            </button>
          ))}
        </div>

        {boardMode === 'tributes' ? (
          <>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost flex-1 text-sm" disabled={ready || available.length === 0} onClick={fillFromPool}>
                Fill empty slots from pool{poolPeople ? ` (${available.length})` : ''}
              </button>
              <button className="btn btn-ghost text-sm" disabled={ready} onClick={fillSamples}>
                Sample names
              </button>
            </div>
            <p className="text-xs text-mute -mt-2">Tap a slot to add or edit someone. Press and hold a filled slot, then drag, to swap two people.</p>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1 text-sm" onClick={d.randomise}>
                Randomise all
              </button>
              <button className="btn btn-ghost flex-1 text-sm" onClick={d.neutral}>
                Reset to neutral
              </button>
            </div>
            <p className="text-xs text-mute -mt-2">
              {focus
                ? `Showing how ${slots.find((s) => s.key === focus)?.name} feels about everyone. Tap someone to edit the pair, or tap ${slots.find((s) => s.key === focus)?.name} again to stop.`
                : 'Tap someone to see how they feel about everyone else.'}
            </p>
          </>
        )}

        {mode === 'classic' ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {DISTRICTS.map((dist, i) => (
              <div key={dist.n} className="glass rounded-2xl p-2.5">
                <div className="flex items-baseline gap-2 mb-2 px-1">
                  <span className="font-display text-xl gold-text">{dist.n}</span>
                  <span className="text-[11px] uppercase tracking-widest text-mute">{dist.industry}</span>
                </div>
                <div className="flex flex-col gap-1.5">{slots.slice(i * 2, i * 2 + 2).map(tile)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {slots.map((s) => (
              <div key={s.key} className="flex items-center gap-1">
                <div className="flex-1 min-w-0">{tile(s)}</div>
                {boardMode === 'tributes' && slots.length > 2 && (
                  <button className="text-mute px-2 py-3" aria-label="Remove slot" onClick={() => d.removeSlot(s.key)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {boardMode === 'tributes' && slots.length < 48 && (
              <button className="btn btn-ghost border-dashed" onClick={d.addSlot}>
                + Add slot
              </button>
            )}
          </div>
        )}
      </div>

      {drag.ghost && (
        <div className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2" style={{ left: drag.ghost.x, top: drag.ghost.y }}>
          {(() => {
            const s = slots.find((x) => x.key === drag.dragging);
            return s ? <Avatar name={s.name} photo={s.photo} size={56} ring="var(--color-gold)" /> : null;
          })()}
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 glass safe-bottom px-4 pt-3 z-20 border-x-0 border-b-0">
        <div className="max-w-3xl mx-auto">
          <button className="btn btn-gold w-full py-4 font-display uppercase tracking-widest text-lg" disabled={!ready || busy} onClick={go}>
            {busy ? 'Rolling the dice…' : ready ? 'Start' : `Fill ${slots.length - filled} more`}
          </button>
        </div>
      </div>

      {editingSlot && poolPeople && (
        <AddSheet
          slot={editingSlot}
          label={labelOf(editingSlot)}
          poolPeople={poolPeople}
          usedPoolIds={new Set([...usedPoolIds].filter((id) => id !== editingSlot.poolId))}
          onPoolChanged={reloadPool}
          onClose={() => setEditing(null)}
          onClear={() => {
            d.clearSlot(editingSlot.key);
            setEditing(null);
          }}
          onSave={(patch) => {
            d.update(editingSlot.key, patch);
            setEditing(null);
          }}
        />
      )}

      {pairA && pairB && (
        <PairSheet
          a={pairA}
          b={pairB}
          ab={aff[pairA.key]![pairB.key]!}
          ba={aff[pairB.key]![pairA.key]!}
          onChange={(ab, ba) => d.setPair(pairA.key, pairB.key, ab, ba)}
          onClose={() => setPair(null)}
        />
      )}
      <ResetFocus slots={slots} focus={focus} setFocus={setFocus} />
    </Screen>
  );
}

/** Drop the focus if that slot is emptied. */
function ResetFocus({ slots, focus, setFocus }: { slots: Slot[]; focus: string | null; setFocus: (f: string | null) => void }) {
  useEffect(() => {
    if (focus && !slots.some((s) => s.key === focus && s.name.trim())) setFocus(null);
  }, [slots, focus, setFocus]);
  return null;
}

/** Long-press then drag a slot onto another to swap them. Works with touch and mouse. */
function useSwapDrag(onSwap: (a: string, b: string) => void) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number; key: string } | null>(null);
  const active = useRef<string | null>(null);
  const swallowClick = useRef(false);
  const pointerY = useRef(0);

  // Auto-scroll while dragging near the top or bottom of the screen, so far-away slots are reachable.
  useEffect(() => {
    if (!dragging) return;
    let raf = 0;
    const step = () => {
      const y = pointerY.current;
      const h = window.innerHeight;
      const edge = 140;
      const speed = y < edge ? -Math.ceil((edge - y) / 8) : y > h - edge ? Math.ceil((y - (h - edge)) / 8) : 0;
      if (speed) window.scrollBy(0, speed);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [dragging]);

  const targetAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-slot]') as HTMLElement | null)?.dataset.slot ?? null;

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = start.current;
      if (!s) return;
      if (!active.current) {
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
        return;
      }
      setGhost({ x: e.clientX, y: e.clientY });
      pointerY.current = e.clientY;
      const t = targetAt(e.clientX, e.clientY);
      setOver(t && t !== active.current ? t : null);
    };
    const up = (e: PointerEvent) => {
      if (active.current) {
        const t = targetAt(e.clientX, e.clientY);
        if (t && t !== active.current) onSwap(active.current, t);
        // Ignore the click that follows this pointerup, but not later taps.
        swallowClick.current = true;
        window.setTimeout(() => (swallowClick.current = false), 0);
      }
      cancel();
    };
    // While dragging on a phone, stop the page from scrolling.
    const touch = (e: TouchEvent) => {
      if (active.current) e.preventDefault();
    };
    const cancel = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
      start.current = null;
      active.current = null;
      setDragging(null);
      setGhost(null);
      setOver(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    document.addEventListener('touchmove', touch, { passive: false });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      document.removeEventListener('touchmove', touch);
    };
  }, [onSwap]);

  return {
    dragging,
    ghost,
    over,
    handlers: (key: string) => ({
      onPointerDown: (e: React.PointerEvent) => {
        start.current = { x: e.clientX, y: e.clientY, key };
        timer.current = window.setTimeout(() => {
          active.current = key;
          pointerY.current = start.current?.y ?? e.clientY;
          setDragging(key);
          setGhost({ x: start.current?.x ?? e.clientX, y: start.current?.y ?? e.clientY });
          navigator.vibrate?.(12);
        }, LONG_PRESS_MS);
      },
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    }),
    consumedClick: () => {
      const v = swallowClick.current;
      swallowClick.current = false;
      return v;
    },
  };
}

export { pairKey };
