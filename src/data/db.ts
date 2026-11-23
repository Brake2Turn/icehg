// IndexedDB via Dexie (§4.3). Phase 1 stores saved games and settings; the pool arrives in Phase 2.
import Dexie, { type EntityTable } from 'dexie';
import type { GameClock, GameSetup, LogEntry, QuirkId, Traits } from '../../engine';

export type GameRecord = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: 'running' | 'finished';
  setup: GameSetup;
  log: LogEntry[];
  traits: Record<string, Traits>;
  victor: string;
  endMinute: number;
  clock: GameClock;
  /** Midnights whose Fallen screen has already been shown (game minute). */
  seenMidnights: number[];
  /** Contestant photos (256×256 JPEG data URLs), by contestant id. */
  photos?: Record<string, string>;
};

export type PoolContestant = {
  id: string;
  name: string;
  pronouns: 'he' | 'she' | 'they';
  quirk?: QuirkId;
  photo?: Blob;
  addedAt: number;
};

export type SettingRow = { key: string; value: unknown };

export const db = new Dexie('icehg') as Dexie & {
  games: EntityTable<GameRecord, 'id'>;
  pool: EntityTable<PoolContestant, 'id'>;
  settings: EntityTable<SettingRow, 'key'>;
};

db.version(1).stores({
  games: 'id, updatedAt, status',
  pool: 'id, name, addedAt',
  settings: 'key',
});
