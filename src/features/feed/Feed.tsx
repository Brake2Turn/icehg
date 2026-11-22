import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dayOf, formatGameTime, type EventEntry, type LogEntry, type MidnightEntry } from '../../../engine';
import { CannonIcon } from './icons';
import { NameText } from './NameText';

export type FeedFilter = { kind: 'all' } | { kind: 'deaths' } | { kind: 'groups' } | { kind: 'person'; id: string };

type Row = EventEntry | MidnightEntry;

function matches(e: Row, f: FeedFilter): boolean {
  if (e.kind === 'midnight') return f.kind === 'all' || f.kind === 'deaths';
  switch (f.kind) {
    case 'all':
      return true;
    case 'deaths':
      return e.patches.some((p) => p.p === 'death');
    case 'groups':
      return !!e.tags?.some((t) => t === 'betrayal' || t === 'groupFormed') || e.category === 'group';
    case 'person':
      return e.participants.includes(f.id);
  }
}

/** The running feed (§8.3, Phase 1 version): grouped by day, auto-scrolls unless you've scrolled up. */
export function Feed({
  log,
  revealed,
  nameOf,
  filter,
  onName,
}: {
  log: LogEntry[];
  revealed: number;
  nameOf: (id: string) => string;
  filter: FeedFilter;
  onName: (id: string) => void;
}) {
  const rows = useMemo(
    () => log.slice(0, revealed).filter((e): e is Row => (e.kind === 'event' || e.kind === 'midnight') && matches(e as Row, filter)),
    [log, revealed, filter],
  );
  const box = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const lastLen = useRef(rows.length);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (stuck) el.scrollTop = el.scrollHeight;
    else if (rows.length > lastLen.current) setUnseen((u) => u + rows.length - lastLen.current);
    lastLen.current = rows.length;
  }, [rows.length, stuck]);

  useEffect(() => {
    setStuck(true);
    setUnseen(0);
  }, [filter]);

  const onScroll = () => {
    const el = box.current!;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setStuck(atBottom);
    if (atBottom) setUnseen(0);
  };

  let lastDay = 0;
  return (
    <div className="relative flex-1 min-h-0">
      <div ref={box} onScroll={onScroll} className="h-full overflow-y-auto px-4 py-3">
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          {rows.length === 0 && <div className="text-center text-mute py-10">Nothing yet.</div>}
          {rows.map((e) => {
            const day = dayOf(e.gameMinute);
            const header = day !== lastDay && e.kind !== 'midnight';
            lastDay = day;
            if (e.kind === 'midnight') {
              lastDay = e.day;
              return (
                <div key={e.seq} className="mt-4 mb-1 flex flex-col items-center gap-1">
                  <div className="text-xs uppercase tracking-[0.3em] text-mute">Midnight</div>
                  <div className="text-sm text-mute text-center">
                    {e.fallen.length === 0 ? 'No cannons tonight.' : `${e.fallen.length} fallen: ${e.fallen.map(nameOf).join(', ')}`}
                  </div>
                  <DayHeader day={e.day} />
                </div>
              );
            }
            const death = e.patches.some((p) => p.p === 'death');
            return (
              <div key={e.seq}>
                {header && <DayHeader day={day} />}
                <div className={`glass rounded-xl px-3 py-2.5 flex gap-3 fade-in ${death ? 'border-chip-red/30' : ''}`}>
                  <div className="w-11 shrink-0 text-[11px] text-mute pt-0.5 tabular-nums">{formatGameTime(e.gameMinute).split(' · ')[1]}</div>
                  <div className="flex-1 text-[15px] leading-snug">
                    <NameText text={e.text} colours={e.nameColours} nameOf={nameOf} onName={onName} />
                  </div>
                  {death && <CannonIcon className="w-4 h-4 text-chip-red shrink-0 mt-1" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {!stuck && unseen > 0 && (
        <button
          className="absolute bottom-3 left-1/2 -translate-x-1/2 btn btn-gold !py-1.5 !px-4 text-sm shadow-lg"
          onClick={() => {
            setStuck(true);
            setUnseen(0);
          }}
        >
          ↓ New events
        </button>
      )}
    </div>
  );
}

function DayHeader({ day }: { day: number }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="h-px flex-1 bg-line" />
      <div className="font-display uppercase tracking-[0.25em] text-gold text-sm">Day {day}</div>
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}
