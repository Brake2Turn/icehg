import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { formatGameTime } from '../../../engine';
import type { Person } from './person';
import type { GameRecord } from '../../data/db';
import { games } from '../../data/repositories';
import { startGame } from '../setup/startGame';
import { FallenOverlay } from './FallenOverlay';
import { Feed, type FeedFilter } from './Feed';
import { describeLog } from './outcomes';
import { PauseIcon, PlayIcon, SkipIcon } from '../../components/icons';
import { Roster } from './Roster';
import { useGame } from './useGame';
import { VictorOverlay } from './VictorOverlay';

export function GameScreen() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const fresh = !!(location.state as { fresh?: boolean } | null)?.fresh;
  const [rec, setRec] = useState<GameRecord | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    games.get(id!).then((r) => {
      if (!alive) return;
      // Local games resume paused (§9); a game that was just started plays straight away.
      if (r && r.status === 'running') r.clock = fresh ? { ...r.clock, anchorWallMs: Date.now(), paused: false } : { ...r.clock, paused: true };
      setRec(r ?? null);
      // Forget the "just started" flag so a reload resumes paused.
      if (fresh) navigate(location.pathname, { replace: true, state: null });
    });
    return () => {
      alive = false;
    };
  }, [id]);
  if (rec === undefined) return <div className="p-8 text-mute">Loading…</div>;
  if (rec === null) return <div className="p-8">Game not found.</div>;
  return <Game key={rec.id} rec={rec} />;
}

/** Playback: normal is Standard pace; Slow and Fast toggle around it. */
const SLOW = 0.5;
const FAST = 4;

function Game({ rec }: { rec: GameRecord }) {
  const nav = useNavigate();
  const { clock, t, view, revealed, fallen, controls, finished } = useGame(rec);
  const people = useMemo(
    () => Object.fromEntries(rec.setup.contestants.map((c) => [c.id, { ...c, photo: rec.photos?.[c.id] }])) as Record<string, Person>,
    [rec],
  );
  const nameOf = (cid: string) => people[cid]?.name ?? '?';
  const outcomes = useMemo(() => describeLog(rec.setup, rec.log), [rec]);
  const saves = useMemo(() => {
    const out: Record<string, number> = {};
    for (const e of rec.log.slice(0, revealed)) if (e.kind === 'event') for (const [saver] of e.saves ?? []) out[saver] = (out[saver] ?? 0) + 1;
    return out;
  }, [rec, revealed]);
  const [filter, setFilter] = useState<FeedFilter>({ kind: 'all' });
  const [victorOpen, setVictorOpen] = useState(true);
  const [rosterOpen, setRosterOpen] = useState(false);
  const alive = Object.values(view.contestants).filter((c) => c.alive).length;
  const total = rec.setup.contestants.length;

  const replay = async () => {
    // Same cast, photos and relationship edits; new dice.
    const slots = rec.setup.contestants.map((c) => ({ key: c.id, name: c.name, pronouns: c.pronouns, quirk: c.quirk, district: c.district, photo: rec.photos?.[c.id] }));
    const overrides = Object.fromEntries((rec.setup.affinityOverrides ?? []).map((o) => [`${o.from}>${o.to}`, o.value]));
    const nid = await startGame(rec.setup.mode, rec.setup.pace, slots, { seed: rec.setup.affinitySeed ?? rec.setup.seed, base: rec.setup.affinityBase ?? 'random', overrides });
    nav(`/game/${nid}`, { replace: true, state: { fresh: true } });
  };

  return (
    <div className="h-full flex flex-col">
      <header className="glass safe-top px-3 pb-2 z-20 border-x-0 border-t-0">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button className="btn btn-ghost !px-3 !py-1.5" onClick={() => nav('/')} aria-label="Home">
            ←
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-display text-xl tracking-wide tabular-nums">{formatGameTime(t)}</div>
            <div className="text-xs text-mute truncate">{rec.title}</div>
          </div>
          <button className="text-right" onClick={() => setRosterOpen(true)}>
            <div className="font-display text-xl tabular-nums">
              {alive}
              <span className="text-mute text-base"> / {total}</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-mute">contestants ›</div>
          </button>
        </div>
        {filter.kind === 'person' && (
          <div className="max-w-2xl mx-auto mt-2 flex text-xs">
            <button onClick={() => setFilter({ kind: 'all' })} className="px-3 py-1 rounded-full border border-gold text-gold whitespace-nowrap">
              Only {nameOf(filter.id)} · show everyone
            </button>
          </div>
        )}
      </header>

      <Feed outcomes={outcomes} log={rec.log} revealed={revealed} nameOf={nameOf} filter={filter} onName={(cid) => setFilter({ kind: 'person', id: cid })} />

      <footer className="glass safe-bottom px-3 pt-2 z-20 border-x-0 border-b-0">
        <div className="max-w-2xl mx-auto flex items-center gap-1.5">
          <button
            className={`btn !py-2.5 flex-1 text-sm ${clock.speed < 1 ? 'btn-gold' : 'btn-ghost'}`}
            onClick={() => controls.setSpeed(clock.speed < 1 ? 1 : SLOW)}
            disabled={finished}
            aria-pressed={clock.speed < 1}
          >
            Slow
          </button>
          <button className="btn btn-gold !py-2.5 flex-1" onClick={controls.togglePause} disabled={finished} aria-label={clock.paused ? 'Play' : 'Pause'}>
            {clock.paused ? <PlayIcon className="w-5 h-5" /> : <PauseIcon className="w-5 h-5" />}
          </button>
          <button
            className={`btn !py-2.5 flex-1 text-sm ${clock.speed > 1 ? 'btn-gold' : 'btn-ghost'}`}
            onClick={() => controls.setSpeed(clock.speed > 1 ? 1 : FAST)}
            disabled={finished}
            aria-pressed={clock.speed > 1}
          >
            Fast
          </button>
          <button className="btn btn-light !py-2.5 flex-1 gap-1.5 text-sm" onClick={controls.skipToMidnight} disabled={finished} aria-label="Skip to the end of the day">
            <SkipIcon className="w-5 h-5" /> Skip
          </button>
        </div>
        {finished && !victorOpen && (
          <div className="max-w-2xl mx-auto mt-2">
            <button className="btn btn-ghost w-full !py-2 text-sm" onClick={() => setVictorOpen(true)}>
              Show the Victor
            </button>
          </div>
        )}
      </footer>

      {rosterOpen && <Roster view={view} people={people} saves={saves} onClose={() => setRosterOpen(false)} onPick={(cid) => {
            setFilter({ kind: 'person', id: cid });
            setRosterOpen(false);
          }} />}
      {fallen && <FallenOverlay fallen={fallen} people={people} onClose={controls.closeFallen} />}
      {finished && victorOpen && !fallen && (
        <VictorOverlay victor={rec.victor} people={people} log={rec.log} final={view} onLog={() => setVictorOpen(false)} onReplay={replay} onHome={() => nav('/')} />
      )}
    </div>
  );
}
