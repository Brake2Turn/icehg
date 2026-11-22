import type { ContestantSetup, Traits, ViewState } from '../../../engine';
import { ITEM_LABEL, WEAPON_LABEL } from '../../../engine';
import { Initials } from './FallenOverlay';

const HEALTH: Record<string, string> = { healthy: 'Healthy', wounded: 'Wounded', critical: 'Critical' };

/** Simple tribute list (the full contestant card comes in Phase 3). */
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
  const list = Object.values(view.contestants).sort((a, b) => Number(b.alive) - Number(a.alive) || (b.deathMinute ?? 0) - (a.deathMinute ?? 0));
  const nameOf = (id: string) => people[id]?.name ?? '?';
  return (
    <div className="fixed inset-0 z-40 bg-black/60 fade-in flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-ink-2 border border-line w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 safe-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-3">
          <div className="font-display text-xl uppercase tracking-wider flex-1">Tributes</div>
          <button className="btn btn-ghost !py-1.5 !px-3" onClick={onClose}>
            Close
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {list.map((c) => {
            const p = people[c.id]!;
            const t = traits[c.id];
            const group = c.groupId ? view.groups[c.groupId]?.members.filter((m) => m !== c.id).map(nameOf) : [];
            return (
              <li key={c.id}>
                <button className={`w-full text-left rounded-xl px-3 py-2 flex gap-3 items-center bg-white/5 ${c.alive ? '' : 'opacity-50'}`} onClick={() => onPick(c.id)}>
                  <Initials name={p.name} size={38} dead={!c.alive} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {p.name}
                      {p.district ? <span className="text-xs text-mute"> · D{p.district}</span> : null}
                    </div>
                    <div className="text-xs text-mute truncate">
                      {c.alive ? HEALTH[c.health] : c.killedBy ? `Killed by ${nameOf(c.killedBy)}` : 'Dead'}
                      {c.kills.length ? ` · ${c.kills.length} kill${c.kills.length === 1 ? '' : 's'}` : ''}
                      {c.alive && c.weapon !== 'none' ? ` · ${WEAPON_LABEL[c.weapon]}` : ''}
                      {c.alive && c.items.length ? ` · ${c.items.map((i) => ITEM_LABEL[i]).join(', ')}` : ''}
                      {group && group.length ? ` · with ${group.join(', ')}` : ''}
                    </div>
                    {t && (
                      <div className="text-[10px] text-mute/80 mt-0.5">
                        STR {t.strength} · STL {t.stealth} · CUN {t.cunning} · SUR {t.survival} · LOY {t.loyalty} · RUTH {t.ruthlessness}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
