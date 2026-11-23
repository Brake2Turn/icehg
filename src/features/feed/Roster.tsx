import { dayOf, ITEM_LABEL, WEAPON_LABEL, type ContestantSetup, type Traits, type ViewContestant, type ViewState } from '../../../engine';
import { Initials } from './FallenOverlay';
import { listNames } from './outcomes';

/** Colour-blind-safe alliance colours (Okabe–Ito), always paired with a letter badge. */
export const GROUP_COLOURS = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#BBBBBB'];
const HEALTH: Record<string, string> = { healthy: 'Healthy', wounded: 'Injured', critical: 'Badly hurt' };

/** The Contestants screen: alliances, people on their own, and the fallen. */
export function Roster({
  view,
  people,
  traits,
  onClose,
  onPick,
}: {
  view: ViewState;
  people: Record<string, ContestantSetup>;
  traits: Record<string, Traits>;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const nameOf = (id: string) => people[id]?.name ?? '?';
  const all = Object.values(view.contestants);
  const groups = Object.values(view.groups).filter((g) => g.members.length > 1);
  const solo = all.filter((c) => c.alive && !c.groupId);
  const fallen = all.filter((c) => !c.alive).sort((a, b) => (b.deathMinute ?? 0) - (a.deathMinute ?? 0));
  const alive = all.length - fallen.length;

  const row = (c: ViewContestant) => {
    const p = people[c.id]!;
    const t = traits[c.id];
    const status = c.alive
      ? [HEALTH[c.health], c.kills.length ? `${c.kills.length} kill${c.kills.length === 1 ? '' : 's'}` : '', c.weapon !== 'none' ? WEAPON_LABEL[c.weapon] : '', ...c.items.map((i) => ITEM_LABEL[i])]
      : [c.killedBy ? `Killed by ${nameOf(c.killedBy)}` : 'Died', c.deathMinute !== null ? `Day ${dayOf(c.deathMinute)}` : '', c.kills.length ? `${c.kills.length} kill${c.kills.length === 1 ? '' : 's'}` : ''];
    return (
      <li key={c.id}>
        <button className={`w-full text-left rounded-xl px-3 py-2 flex gap-3 items-center bg-white/5 active:bg-white/10 ${c.alive ? '' : 'opacity-55'}`} onClick={() => onPick(c.id)}>
          <Initials name={p.name} size={38} dead={!c.alive} />
          <div className="flex-1 min-w-0">
            <div className="font-medium">
              {p.name}
              {p.district ? <span className="text-xs text-mute"> · D{p.district}</span> : null}
            </div>
            <div className="text-xs text-mute truncate">{status.filter(Boolean).join(' · ')}</div>
            {t && c.alive && (
              <div className="text-[10px] text-mute/80 mt-0.5 tabular-nums">
                STR {t.strength} · STL {t.stealth} · CUN {t.cunning} · SUR {t.survival} · LOY {t.loyalty} · RUTH {t.ruthlessness}
              </div>
            )}
          </div>
        </button>
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 fade-in flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-ink-2 border border-line w-full sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 safe-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-1">
          <div className="font-display text-xl uppercase tracking-wider flex-1">Contestants</div>
          <button className="btn btn-ghost !py-1.5 !px-3" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="text-xs text-mute mb-4">
          {alive} alive · {groups.length} alliance{groups.length === 1 ? '' : 's'} · {fallen.length} fallen. Tap someone to follow only them in the feed.
        </div>

        {groups.length > 0 && (
          <section className="mb-5">
            <h3 className="text-xs uppercase tracking-[0.2em] text-mute mb-2">Alliances</h3>
            <div className="flex flex-col gap-3">
              {groups.map((g, i) => {
                const colour = GROUP_COLOURS[g.colour % GROUP_COLOURS.length]!;
                return (
                  <div key={g.id} className="rounded-2xl p-2.5 border" style={{ borderColor: `${colour}88`, background: `${colour}12` }}>
                    <div className="flex items-center gap-2 px-1 pb-2">
                      <span className="w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center text-ink" style={{ background: colour }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm font-medium truncate">{listNames(g.members.map(nameOf))}</span>
                    </div>
                    <ul className="flex flex-col gap-1.5">{g.members.map((m) => row(view.contestants[m]!))}</ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {solo.length > 0 && (
          <section className="mb-5">
            <h3 className="text-xs uppercase tracking-[0.2em] text-mute mb-2">On their own</h3>
            <ul className="flex flex-col gap-1.5">{solo.map(row)}</ul>
          </section>
        )}

        {fallen.length > 0 && (
          <section>
            <h3 className="text-xs uppercase tracking-[0.2em] text-mute mb-2">Fallen</h3>
            <ul className="flex flex-col gap-1.5">{fallen.map(row)}</ul>
          </section>
        )}
      </div>
    </div>
  );
}
