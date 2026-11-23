import { useMemo, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Sheet } from '../../components/Sheet';
import type { Slot } from '../../store/draft';
import { savePoolPerson, type PoolPerson } from '../pool/usePool';
import { PersonForm, type PersonDraft } from './PersonForm';

/**
 * The Add sheet (§5.2). Empty slot: tabs New / From pool. Filled slot: edit, remove, or save to the pool.
 */
export function AddSheet({
  slot,
  label,
  poolPeople,
  usedPoolIds,
  onSave,
  onClear,
  onClose,
  onPoolChanged,
}: {
  slot: Slot;
  label: string;
  poolPeople: PoolPerson[];
  usedPoolIds: Set<string>;
  onSave: (patch: Partial<Slot>) => void;
  onClear: () => void;
  onClose: () => void;
  onPoolChanged: () => void;
}) {
  const filled = !!slot.name.trim();
  const [tab, setTab] = useState<'new' | 'pool'>(filled || poolPeople.length === 0 ? 'new' : 'pool');
  const [draft, setDraft] = useState<PersonDraft>({ name: slot.name, pronouns: slot.pronouns, photo: slot.photo });
  const [toPool, setToPool] = useState(!slot.poolId);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const results = useMemo(() => poolPeople.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())), [poolPeople, q]);

  const save = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      let poolId = slot.poolId;
      if (toPool && !poolId) {
        poolId = await savePoolPerson(draft);
        onPoolChanged();
      }
      onSave({ name: draft.name.trim(), pronouns: draft.pronouns, photo: draft.photo, ...(poolId ? { poolId } : {}) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={filled ? `Edit · ${label}` : label}
      onClose={onClose}
      footer={
        tab === 'new' ? (
          <div className="flex gap-2 pb-1">
            {filled &&
              (confirmRemove ? (
                <button className="btn btn-ghost text-chip-red" onClick={onClear}>
                  Remove?
                </button>
              ) : (
                <button className="btn btn-ghost" onClick={() => setConfirmRemove(true)}>
                  Remove
                </button>
              ))}
            <button className="btn btn-gold flex-1" disabled={!draft.name.trim() || busy} onClick={save}>
              {filled ? 'Save' : 'Add to board'}
            </button>
          </div>
        ) : undefined
      }
    >
      {!filled && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {(['new', 'pool'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`btn !py-2 ${tab === t ? 'btn-gold' : 'btn-ghost'}`}>
              {t === 'new' ? 'New' : `From pool (${poolPeople.length})`}
            </button>
          ))}
        </div>
      )}

      {tab === 'new' ? (
        <div className="flex flex-col gap-4">
          <PersonForm value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
          {!slot.poolId ? (
            <label className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-3" htmlFor="save-to-pool">
              <span>
                <span className="block font-medium">Save to contestant pool</span>
                <span className="block text-xs text-mute">So you can pick them again in later games.</span>
              </span>
              <input id="save-to-pool" type="checkbox" className="w-6 h-6 accent-[var(--color-gold)]" checked={toPool} onChange={(e) => setToPool(e.target.checked)} />
            </label>
          ) : (
            <div className="text-xs text-mute">Saved in your contestant pool. Edits here only change this game.</div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input id="pool-search" className="input" placeholder="Search your pool" value={q} onChange={(e) => setQ(e.target.value)} />
          {poolPeople.length === 0 ? (
            <div className="text-mute text-sm py-6 text-center">Your pool is empty. Add someone with “New” and keep “Save to contestant pool” on.</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {results.map((p) => {
                const used = usedPoolIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    disabled={used}
                    onClick={() => onSave({ name: p.name, pronouns: p.pronouns, photo: p.photo, poolId: p.id })}
                    className={`flex flex-col items-center gap-1.5 rounded-xl p-2 ${used ? 'opacity-30' : 'active:bg-white/10'}`}
                  >
                    <Avatar name={p.name} photo={p.photo} size={60} />
                    <span className="text-sm truncate max-w-full">{p.name}</span>
                    {used && <span className="text-[10px] text-mute -mt-1">in this game</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
