import { useMemo, useState } from 'react';
import { QUIRK_INFO } from '../../../engine';
import { Avatar } from '../../components/Avatar';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { PersonForm, type PersonDraft } from '../setup/PersonForm';
import { removePoolPerson, savePoolPerson, usePool, type PoolPerson } from './usePool';

/** Home → Contestant pool (§5.3): search, add, edit, delete saved contestants. */
export function PoolScreen() {
  const { people, reload } = usePool();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<PoolPerson | 'new' | null>(null);
  const list = useMemo(() => (people ?? []).filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())), [people, q]);

  return (
    <Screen
      title="Contestant pool"
      right={
        <button className="btn btn-gold !py-2 !px-3 text-sm" onClick={() => setEditing('new')}>
          + Add
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <input id="pool-filter" className="input" placeholder={`Search ${people?.length ?? 0} saved contestants`} value={q} onChange={(e) => setQ(e.target.value)} />
        {people && people.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center text-mute">
            No one saved yet. Add people here, or keep “Save to contestant pool” on when you fill a board.
          </div>
        )}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {list.map((p) => (
            <button key={p.id} className="flex flex-col items-center gap-1.5 rounded-xl p-2 active:bg-white/10" onClick={() => setEditing(p)}>
              <Avatar name={p.name} photo={p.photo} size={64} />
              <span className="text-sm truncate max-w-full">{p.name}</span>
              <span className="text-[10px] text-mute -mt-1">
                {p.pronouns}
                {p.quirk ? ` · ${QUIRK_INFO[p.quirk].label}` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
      {editing && (
        <PoolEditor
          person={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={async () => {
            await reload();
            setEditing(null);
          }}
        />
      )}
    </Screen>
  );
}

function PoolEditor({ person, onClose, onDone }: { person: PoolPerson | null; onClose: () => void; onDone: () => void }) {
  const [draft, setDraft] = useState<PersonDraft>({ name: person?.name ?? '', pronouns: person?.pronouns ?? 'they', quirk: person?.quirk, photo: person?.photo });
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet
      title={person ? 'Edit contestant' : 'New contestant'}
      onClose={onClose}
      footer={
        <div className="flex gap-2 pb-1">
          {person &&
            (confirm ? (
              <button
                className="btn btn-ghost text-chip-red"
                onClick={async () => {
                  await removePoolPerson(person.id);
                  onDone();
                }}
              >
                Delete?
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={() => setConfirm(true)}>
                Delete
              </button>
            ))}
          <button
            className="btn btn-gold flex-1"
            disabled={!draft.name.trim()}
            onClick={async () => {
              await savePoolPerson({ ...draft, ...(person ? { id: person.id, addedAt: person.addedAt } : {}) });
              onDone();
            }}
          >
            Save
          </button>
        </div>
      }
    >
      <PersonForm value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
    </Sheet>
  );
}
