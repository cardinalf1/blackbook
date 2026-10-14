// User data on disk: attempts, flags and drill sessions in SQLite. Implements the same
// AttemptStore contract the app uses, so the HTTP adapter is a thin pass-through.
//
// Schema version lives in SQLite's `PRAGMA user_version`. Each migration runs in its own
// transaction and bumps the version; a database written by a newer app is refused, not guessed at.

import type { AttemptStore } from '../src/services/storage/attemptTypes';
import type { Attempt, FlagRecord, SessionRecord } from '../src/types/drill';
import { transaction, type SqlDb } from './sql';

/** Index i upgrades the schema from version i to i + 1. Append only; never edit a shipped one. */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('active', 'finished')),
    started_at INTEGER NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX sessions_status ON sessions (status, started_at);

  -- No foreign key to sessions on purpose: discarding a session must never delete its answers.
  CREATE TABLE attempts (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    response TEXT NOT NULL,
    correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
    time_ms INTEGER NOT NULL CHECK (time_ms >= 0),
    at INTEGER NOT NULL
  );
  CREATE INDEX attempts_session ON attempts (session_id);
  CREATE INDEX attempts_question ON attempts (question_id);

  CREATE TABLE flags (
    question_id TEXT PRIMARY KEY,
    at INTEGER NOT NULL
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function schemaVersion(db: SqlDb): number {
  return db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
}

/** Brings the database up to SCHEMA_VERSION. Throws if it was written by a newer version. */
export function migrate(db: SqlDb, migrations: readonly string[] = MIGRATIONS): void {
  const current = schemaVersion(db);
  if (current > migrations.length) {
    throw new Error(`This data was saved by a newer version of Blackbook (schema ${current}). Update Blackbook to open it.`);
  }
  for (let v = current; v < migrations.length; v++) {
    transaction(db, () => {
      db.exec(migrations[v] as string);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

interface AttemptRow {
  id: string;
  question_id: string;
  session_id: string;
  response: string;
  correct: number;
  time_ms: number;
  at: number;
}

const toAttempt = (r: AttemptRow): Attempt => ({
  id: r.id,
  questionId: r.question_id,
  sessionId: r.session_id,
  response: r.response,
  correct: r.correct === 1,
  timeMs: r.time_ms,
  at: r.at,
});

export class SqliteUserStore implements AttemptStore {
  constructor(private readonly db: SqlDb) {
    migrate(db);
  }

  async addAttempt(a: Attempt): Promise<void> {
    transaction(this.db, () =>
      this.db.run(
        `INSERT INTO attempts (id, question_id, session_id, response, correct, time_ms, at) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET response = excluded.response, correct = excluded.correct, time_ms = excluded.time_ms, at = excluded.at`,
        a.id,
        a.questionId,
        a.sessionId,
        a.response,
        a.correct ? 1 : 0,
        Math.max(0, Math.round(a.timeMs)),
        a.at,
      ),
    );
  }

  async listAttempts(): Promise<Attempt[]> {
    return this.db.all<AttemptRow>('SELECT * FROM attempts ORDER BY at').map(toAttempt);
  }

  async attemptsForSession(sessionId: string): Promise<Attempt[]> {
    return this.db.all<AttemptRow>('SELECT * FROM attempts WHERE session_id = ? ORDER BY at', sessionId).map(toAttempt);
  }

  async setFlag(questionId: string, flagged: boolean): Promise<void> {
    transaction(this.db, () => {
      if (flagged) this.db.run('INSERT OR REPLACE INTO flags (question_id, at) VALUES (?, ?)', questionId, Date.now());
      else this.db.run('DELETE FROM flags WHERE question_id = ?', questionId);
    });
  }

  async listFlags(): Promise<FlagRecord[]> {
    return this.db.all<{ question_id: string; at: number }>('SELECT * FROM flags ORDER BY at').map((r) => ({ questionId: r.question_id, at: r.at }));
  }

  async saveSession(s: SessionRecord): Promise<void> {
    transaction(this.db, () =>
      this.db.run(
        `INSERT INTO sessions (id, status, started_at, data) VALUES (?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET status = excluded.status, started_at = excluded.started_at, data = excluded.data`,
        s.id,
        s.status,
        s.startedAt,
        JSON.stringify(s),
      ),
    );
  }

  async getActiveSession(): Promise<SessionRecord | null> {
    const r = this.db.get<{ data: string }>("SELECT data FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1");
    return r ? (JSON.parse(r.data) as SessionRecord) : null;
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    const r = this.db.get<{ data: string }>('SELECT data FROM sessions WHERE id = ?', id);
    return r ? (JSON.parse(r.data) as SessionRecord) : null;
  }

  async deleteSession(id: string): Promise<void> {
    transaction(this.db, () => this.db.run('DELETE FROM sessions WHERE id = ?', id));
  }

  async clearAll(): Promise<void> {
    transaction(this.db, () => {
      this.db.run('DELETE FROM attempts');
      this.db.run('DELETE FROM flags');
      this.db.run('DELETE FROM sessions');
    });
  }
}
