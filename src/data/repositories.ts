// Storage behind interfaces (§4.3) so Phase 4 can add online versions without touching screens.
import { db, type GameRecord, type PoolContestant } from './db';

export interface GameRepository {
  save(game: GameRecord): Promise<void>;
  get(id: string): Promise<GameRecord | undefined>;
  list(): Promise<Pick<GameRecord, 'id' | 'title' | 'updatedAt' | 'status' | 'clock' | 'endMinute' | 'victor' | 'setup'>[]>;
  updateClock(id: string, clock: GameRecord['clock'], seenMidnights?: number[]): Promise<void>;
  remove(id: string): Promise<void>;
}

export class LocalGameRepository implements GameRepository {
  async save(game: GameRecord) {
    await db.games.put(game);
  }
  async get(id: string) {
    return db.games.get(id);
  }
  async list() {
    const all = await db.games.orderBy('updatedAt').reverse().toArray();
    return all.map(({ id, title, updatedAt, status, clock, endMinute, victor, setup }) => ({ id, title, updatedAt, status, clock, endMinute, victor, setup }));
  }
  async updateClock(id: string, clock: GameRecord['clock'], seenMidnights?: number[]) {
    const finished = clock.anchorGameMin >= ((await db.games.get(id))?.endMinute ?? Infinity);
    await db.games.update(id, {
      clock,
      updatedAt: Date.now(),
      ...(seenMidnights ? { seenMidnights } : {}),
      ...(finished ? { status: 'finished' as const } : {}),
    });
  }
  async remove(id: string) {
    await db.games.delete(id);
  }
}

/** Phase 2 fills this in (photos, search, sync later). */
export interface PoolRepository {
  list(): Promise<PoolContestant[]>;
  save(c: PoolContestant): Promise<void>;
  remove(id: string): Promise<void>;
}

export class LocalPoolRepository implements PoolRepository {
  async list() {
    return db.pool.orderBy('name').toArray();
  }
  async save(c: PoolContestant) {
    await db.pool.put(c);
  }
  async remove(id: string) {
    await db.pool.delete(id);
  }
}

export const games: GameRepository = new LocalGameRepository();
export const pool: PoolRepository = new LocalPoolRepository();
