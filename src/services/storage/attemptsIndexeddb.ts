import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Attempt, FlagRecord, SessionRecord } from '../../types/drill';
import type { AttemptStore } from './attemptTypes';

// A separate database from the question bank: replacing the bank must never touch user data.
const DB_NAME = 'blackbook-user';
const DB_VERSION = 1;

interface UserDB extends DBSchema {
  attempts: { key: string; value: Attempt; indexes: { sessionId: string; questionId: string } };
  flags: { key: string; value: FlagRecord };
  sessions: { key: string; value: SessionRecord; indexes: { status: string } };
}

export class IndexedDbAttemptStore implements AttemptStore {
  private db: Promise<IDBPDatabase<UserDB>> | null = null;

  private open(): Promise<IDBPDatabase<UserDB>> {
    this.db ??= openDB<UserDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
        attempts.createIndex('sessionId', 'sessionId');
        attempts.createIndex('questionId', 'questionId');
        db.createObjectStore('flags', { keyPath: 'questionId' });
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('status', 'status');
      },
    });
    return this.db;
  }

  async addAttempt(attempt: Attempt): Promise<void> {
    await (await this.open()).put('attempts', attempt);
  }

  async listAttempts(): Promise<Attempt[]> {
    return (await this.open()).getAll('attempts');
  }

  async attemptsForSession(sessionId: string): Promise<Attempt[]> {
    return (await this.open()).getAllFromIndex('attempts', 'sessionId', sessionId);
  }

  async setFlag(questionId: string, flagged: boolean): Promise<void> {
    const db = await this.open();
    if (flagged) await db.put('flags', { questionId, at: Date.now() });
    else await db.delete('flags', questionId);
  }

  async listFlags(): Promise<FlagRecord[]> {
    return (await this.open()).getAll('flags');
  }

  async saveSession(session: SessionRecord): Promise<void> {
    await (await this.open()).put('sessions', session);
  }

  async getActiveSession(): Promise<SessionRecord | null> {
    const active = await (await this.open()).getAllFromIndex('sessions', 'status', 'active');
    active.sort((a, b) => b.startedAt - a.startedAt);
    return active[0] ?? null;
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    return (await (await this.open()).get('sessions', id)) ?? null;
  }

  async deleteSession(id: string): Promise<void> {
    await (await this.open()).delete('sessions', id);
  }

  async clearAll(): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(['attempts', 'flags', 'sessions'], 'readwrite');
    await Promise.all([
      tx.objectStore('attempts').clear(),
      tx.objectStore('flags').clear(),
      tx.objectStore('sessions').clear(),
      tx.done,
    ]);
  }
}
