import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  gameNow,
  jumpTo,
  revealedCount,
  setPaused,
  setSpeed,
  ViewFolder,
  type GameClock,
  type LogEntry,
  type MidnightEntry,
  type ViewState,
} from '../../../engine';
import type { GameRecord } from '../../data/db';
import { games } from '../../data/repositories';

/** Minimum real time the Fallen screen stays up, even at high speed. */
const FALLEN_MIN_MS = 4500;

export type Fallen = { entry: MidnightEntry; shownAt: number };

/**
 * Drives the viewing clock (§4.2, §9). Only changes what you *see* when — never what happens.
 */
export function useGame(rec: GameRecord) {
  const [clock, setClockState] = useState<GameClock>(() => ({ ...rec.clock }));
  const clockRef = useRef(clock);
  const [t, setT] = useState(() => Math.min(gameNow(rec.clock, Date.now()), rec.endMinute));
  const [fallen, setFallen] = useState<Fallen | null>(null);
  const fallenRef = useRef<Fallen | null>(null);
  const seen = useRef(new Set<number>(rec.seenMidnights));
  const folder = useMemo(() => new ViewFolder(rec.setup, rec.log), [rec]);
  const midnights = useMemo(() => rec.log.filter((e): e is MidnightEntry => e.kind === 'midnight'), [rec]);
  const victorMinute = rec.log[rec.log.length - 1]!.gameMinute;

  const save = useCallback(
    (c: GameClock) => {
      const now = Date.now();
      const anchored = { ...c, anchorGameMin: Math.min(gameNow(c, now), victorMinute), anchorWallMs: now };
      void games.updateClock(rec.id, anchored, [...seen.current]);
    },
    [rec.id, victorMinute],
  );

  const setClock = useCallback(
    (c: GameClock, persist = true) => {
      clockRef.current = c;
      setClockState(c);
      if (persist) save(c);
    },
    [save],
  );

  // Main loop: ~10 updates a second is plenty for a text feed.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (wall: number) => {
      raf = requestAnimationFrame(tick);
      if (wall - last < 90) return;
      last = wall;
      const now = Date.now();
      let c = clockRef.current;
      let cur = gameNow(c, now);
      const f = fallenRef.current;
      if (f) {
        const q = f.entry.quietUntil;
        if (cur >= q) {
          if (now - f.shownAt < FALLEN_MIN_MS && !c.paused) {
            c = jumpTo(c, q, now);
            clockRef.current = c;
            cur = q;
          } else {
            fallenRef.current = null;
            setFallen(null);
          }
        }
      } else {
        // A midnight we haven't shown yet?
        const due = midnights.filter((m) => m.gameMinute <= cur && !seen.current.has(m.gameMinute));
        if (due.length) {
          for (const m of due) seen.current.add(m.gameMinute);
          const latest = due[due.length - 1]!;
          if (cur < latest.quietUntil + 60) {
            const nf = { entry: latest, shownAt: now };
            fallenRef.current = nf;
            setFallen(nf);
          }
          save(c);
        }
      }
      if (cur >= victorMinute && !c.paused) {
        c = { ...jumpTo(c, victorMinute, now), paused: true };
        clockRef.current = c;
        setClockState(c);
        save(c);
        cur = victorMinute;
      }
      setT(Math.min(cur, victorMinute));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [midnights, victorMinute, save]);

  // Autosave every few seconds and whenever the app is hidden.
  useEffect(() => {
    const id = setInterval(() => !clockRef.current.paused && save(clockRef.current), 2000);
    const hide = () => document.visibilityState === 'hidden' && save(clockRef.current);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', hide);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', hide);
      save(clockRef.current);
    };
  }, [save]);

  const view: ViewState = folder.at(t);
  const revealed = revealedCount(rec.log, t);

  const controls = {
    togglePause: () => setClock(setPaused(clockRef.current, !clockRef.current.paused, Date.now())),
    setSpeed: (s: number) => setClock(setSpeed(clockRef.current, s, Date.now())),
    nextEvent: () => {
      const next = rec.log.slice(revealed).find((e: LogEntry) => e.kind === 'event' || e.kind === 'victor');
      if (next) setClock(jumpTo(clockRef.current, next.gameMinute, Date.now()));
    },
    skipToMidnight: () => {
      const next = midnights.find((m) => m.gameMinute > t);
      setClock(jumpTo(clockRef.current, next ? next.gameMinute : victorMinute, Date.now()));
    },
    closeFallen: () => {
      const f = fallenRef.current;
      fallenRef.current = null;
      setFallen(null);
      if (f && gameNow(clockRef.current, Date.now()) < f.entry.quietUntil) setClock(jumpTo(clockRef.current, f.entry.quietUntil, Date.now()));
    },
  };

  return { clock, t, view, revealed, fallen, controls, finished: t >= victorMinute };
}
