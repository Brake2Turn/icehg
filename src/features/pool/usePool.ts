import { useCallback, useEffect, useState } from 'react';
import type { PronounKey, QuirkId } from '../../../engine';
import { pool } from '../../data/repositories';
import { blobToDataUrl, dataUrlToBlob } from '../setup/photo';
import { newId } from '../setup/startGame';

export type PoolPerson = { id: string; name: string; pronouns: PronounKey; quirk?: QuirkId; photo?: string; addedAt: number };

/** The saved contestant pool (IndexedDB; photos stored as blobs, shown as data URLs). */
export function usePool() {
  const [people, setPeople] = useState<PoolPerson[] | null>(null);
  const reload = useCallback(async () => {
    try {
      const rows = await pool.list();
      setPeople(
        await Promise.all(
          rows.map(async (r) => ({
            id: r.id,
            name: r.name,
            pronouns: r.pronouns,
            addedAt: r.addedAt,
            ...(r.quirk ? { quirk: r.quirk } : {}),
            ...(r.photo ? { photo: await blobToDataUrl(r.photo) } : {}),
          })),
        ),
      );
    } catch {
      setPeople([]);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { people, reload };
}

export async function savePoolPerson(p: { id?: string; name: string; pronouns: PronounKey; quirk?: QuirkId; photo?: string; addedAt?: number }): Promise<string> {
  const id = p.id ?? newId();
  await pool.save({
    id,
    name: p.name.trim(),
    pronouns: p.pronouns,
    addedAt: p.addedAt ?? Date.now(),
    ...(p.quirk ? { quirk: p.quirk } : {}),
    ...(p.photo ? { photo: await dataUrlToBlob(p.photo) } : {}),
  });
  return id;
}

export async function removePoolPerson(id: string) {
  await pool.remove(id);
}
