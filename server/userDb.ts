// User data on disk: sessions, attempts, flags and the event log in SQLite. Implements the same
// store contracts the app uses, so the HTTP adapter is a thin pass-through.
//
// Schema version lives in SQLite's `PRAGMA user_version`. Each migration runs in its own
// transaction and bumps the version; a database written by a newer app is refused, not guessed at.

import { isSessionV1, upgradeSession, upgradeSessionV1 } from '../src/services/session/upgrade';
import type { AttemptStore, SessionFilter, TelemetryStore } from '../src/services/storage/attemptTypes';
import type { QuestionStatus } from '../src/types/browse';
import type { FlagRecord } from '../src/types/drill';
import type { MistakeStore, MistakeTag } from '../src/types/mistakes';
import { DEFAULT_AI_SETTINGS, type AiSettings, type RulesNote, type RulesNotesStore } from '../src/types/ai';
import type { EventRecord, HiddenSession, HiddenSessionsStore, EventType, SessionRecord, StoredAttempt, TelemetryStats, UserDataExport } from '../src/types/session';
import { transaction, type SqlDb, type SqlParam } from './sql';
import type { ValidatedUserData } from './validate';

/** SQL text, or a function for steps SQL alone cannot do (rewriting stored JSON). */
export type Migration = string | ((db: SqlDb) => void);

/** Index i upgrades the schema from version i to i + 1. Append only; never edit a shipped one. */
export const MIGRATIONS: readonly Migration[] = [
  // 1: Phase 2 drill data.
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
  // 2: Phase 2c. Session statuses and mode, draft attempts, the event log.
  (db) => {
    db.exec(`
      CREATE TABLE sessions_v2 (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK (mode IN ('drill', 'exam')),
        status TEXT NOT NULL CHECK (status IN ('in_progress', 'finished', 'abandoned')),
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        last_activity_at INTEGER NOT NULL,
        data TEXT NOT NULL
      );
    `);
    for (const row of db.all<{ data: string }>('SELECT data FROM sessions')) {
      const raw = JSON.parse(row.data) as unknown;
      const s = isSessionV1(raw) ? upgradeSessionV1(raw) : (raw as SessionRecord);
      insertSession(db, 'sessions_v2', s);
    }
    db.exec(`
      DROP TABLE sessions;
      ALTER TABLE sessions_v2 RENAME TO sessions;
      CREATE INDEX sessions_status ON sessions (status, mode, started_at);

      -- Phase 2 attempts were graded on submit and asked once, so they are final, single-visit.
      ALTER TABLE attempts ADD COLUMN mode TEXT NOT NULL DEFAULT 'drill' CHECK (mode IN ('drill', 'exam'));
      ALTER TABLE attempts ADD COLUMN status TEXT NOT NULL DEFAULT 'final' CHECK (status IN ('draft', 'final'));
      ALTER TABLE attempts ADD COLUMN first_visit_ms INTEGER;
      ALTER TABLE attempts ADD COLUMN changes INTEGER NOT NULL DEFAULT 0 CHECK (changes >= 0);
      ALTER TABLE attempts ADD COLUMN confidence TEXT CHECK (confidence IN ('guess', 'unsure', 'sure'));
      UPDATE attempts SET first_visit_ms = time_ms;

      CREATE TABLE events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('drill', 'exam')),
        question_id TEXT,
        type TEXT NOT NULL,
        ts INTEGER NOT NULL,
        mono_ms REAL NOT NULL,
        page_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX events_session ON events (session_id, ts, seq);
      CREATE INDEX events_question ON events (question_id);
      -- Append-only: rows can be deleted (Delete telemetry) but never changed.
      CREATE TRIGGER events_append_only BEFORE UPDATE ON events
        BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
    `);
  },
  // 3: Phase 2d. Sessions record where they were started (drill setup, Browse, exam).
  (db) => {
    db.exec(`ALTER TABLE sessions ADD COLUMN source TEXT NOT NULL DEFAULT 'drill' CHECK (source IN ('drill', 'browse', 'exam'))`);
    for (const row of db.all<{ id: string; data: string }>('SELECT id, data FROM sessions')) {
      const s = upgradeSession(JSON.parse(row.data) as unknown);
      db.run('UPDATE sessions SET data = ?, source = ? WHERE id = ?', JSON.stringify(s), s.source, row.id);
    }
  },
  // 4: Phase 5 analytics. Columns that let SQL filter by test and pause without parsing JSON per row,
  // and indexes for the event scans. Generated columns are computed from `data`, so nothing is rewritten.
  `
  ALTER TABLE sessions ADD COLUMN test_id TEXT GENERATED ALWAYS AS (json_extract(data, '$.exam.testId')) VIRTUAL;
  ALTER TABLE sessions ADD COLUMN test_kind TEXT GENERATED ALWAYS AS (json_extract(data, '$.test.kind')) VIRTUAL;
  ALTER TABLE sessions ADD COLUMN test_paused INTEGER GENERATED ALWAYS AS (COALESCE(json_extract(data, '$.test.paused'), 0)) VIRTUAL;
  ALTER TABLE sessions ADD COLUMN exam_paused INTEGER GENERATED ALWAYS AS (COALESCE(json_array_length(json_extract(data, '$.exam.pauses')), 0) > 0) VIRTUAL;
  CREATE INDEX sessions_test ON sessions (test_id);
  CREATE INDEX sessions_finished ON sessions (status, finished_at);
  CREATE INDEX events_type ON events (type, session_id, question_id);
  CREATE INDEX attempts_status ON attempts (status, session_id, question_id);
  `,
  // 5: Phase 6. Sessions may start from the retry queue (the source CHECK has to be rebuilt to allow
  // it), and mistake tags live in their own append-only table: attempts are never touched.
  `
  CREATE TABLE sessions_v5 (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL CHECK (mode IN ('drill', 'exam')),
    source TEXT NOT NULL DEFAULT 'drill' CHECK (source IN ('drill', 'browse', 'exam', 'retry')),
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'finished', 'abandoned')),
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    last_activity_at INTEGER NOT NULL,
    data TEXT NOT NULL
  );
  INSERT INTO sessions_v5 (id, mode, source, status, started_at, finished_at, last_activity_at, data)
    SELECT id, mode, source, status, started_at, finished_at, last_activity_at, data FROM sessions;
  DROP TABLE sessions;
  ALTER TABLE sessions_v5 RENAME TO sessions;
  CREATE INDEX sessions_status ON sessions (status, mode, started_at);
  ALTER TABLE sessions ADD COLUMN test_id TEXT GENERATED ALWAYS AS (json_extract(data, '$.exam.testId')) VIRTUAL;
  ALTER TABLE sessions ADD COLUMN test_kind TEXT GENERATED ALWAYS AS (json_extract(data, '$.test.kind')) VIRTUAL;
  ALTER TABLE sessions ADD COLUMN test_paused INTEGER GENERATED ALWAYS AS (COALESCE(json_extract(data, '$.test.paused'), 0)) VIRTUAL;
  ALTER TABLE sessions ADD COLUMN exam_paused INTEGER GENERATED ALWAYS AS (COALESCE(json_array_length(json_extract(data, '$.exam.pauses')), 0) > 0) VIRTUAL;
  CREATE INDEX sessions_test ON sessions (test_id);
  CREATE INDEX sessions_finished ON sessions (status, finished_at);

  -- One row per tag action. The newest row for a (session, question) is the tag in force; older rows
  -- are the history. No foreign key and no update: discarding a session never deletes its tags.
  CREATE TABLE mistake_tags (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('careless', 'concept_gap', 'misread', 'ran_out_of_time', 'guessed', 'other')),
    note TEXT NOT NULL,
    suggested INTEGER NOT NULL CHECK (suggested IN (0, 1)),
    at INTEGER NOT NULL
  );
  CREATE INDEX mistake_tags_question ON mistake_tags (session_id, question_id, at);
  CREATE TRIGGER mistake_tags_append_only BEFORE UPDATE ON mistake_tags
    BEGIN SELECT RAISE(ABORT, 'mistake tags are append-only'); END;
  `,
  // 6: Phase 7. The source CHECK goes (the server validates sources, so a new one never needs another
  // rebuild); settings, the user's own rules notes, and a cache of AI replies keyed by input hash.
  // The Groq key is never stored here: it lives in a separate file (server/ai/keyStore.ts).
  `
  CREATE TABLE sessions_v6 (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL CHECK (mode IN ('drill', 'exam')),
    source TEXT NOT NULL DEFAULT 'drill',
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'finished', 'abandoned')),
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    last_activity_at INTEGER NOT NULL,
    data TEXT NOT NULL
  );
  INSERT INTO sessions_v6 (id, mode, source, status, started_at, finished_at, last_activity_at, data)
    SELECT id, mode, source, status, started_at, finished_at, last_activity_at, data FROM sessions;
  DROP TABLE sessions;
  ALTER TABLE sessions_v6 RENAME TO sessions;
  CREATE INDEX sessions_status ON sessions (status, mode, started_at);
  ALTER TABLE sessions ADD COLUMN test_id TEXT GENERATED ALWAYS AS (json_extract(data, '$.exam.testId')) VIRTUAL;
  ALTER TABLE sessions ADD COLUMN test_kind TEXT GENERATED ALWAYS AS (json_extract(data, '$.test.kind')) VIRTUAL;
  ALTER TABLE sessions ADD COLUMN test_paused INTEGER GENERATED ALWAYS AS (COALESCE(json_extract(data, '$.test.paused'), 0)) VIRTUAL;
  ALTER TABLE sessions ADD COLUMN exam_paused INTEGER GENERATED ALWAYS AS (COALESCE(json_array_length(json_extract(data, '$.exam.pauses')), 0) > 0) VIRTUAL;
  CREATE INDEX sessions_test ON sessions (test_id);
  CREATE INDEX sessions_finished ON sessions (status, finished_at);

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE rules_notes (
    skill_code TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  -- Replies only, keyed by a hash of the request. The request (which may hold question text) is never stored.
  CREATE TABLE ai_cache (
    hash TEXT PRIMARY KEY,
    feature TEXT NOT NULL,
    reply TEXT NOT NULL,
    at INTEGER NOT NULL
  );
  `,
  // 7: Phase 8. Sessions hidden from analytics. A side table, so saving a session never clears the
  // mark, and only analytics reads it (eligibility, retries and pool health ignore it on purpose).
  `
  CREATE TABLE hidden_sessions (
    session_id TEXT PRIMARY KEY,
    at INTEGER NOT NULL
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function schemaVersion(db: SqlDb): number {
  return db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
}

/** Brings the database up to the latest version. Throws if it was written by a newer version. */
export function migrate(db: SqlDb, migrations: readonly Migration[] = MIGRATIONS): void {
  const current = schemaVersion(db);
  if (current > migrations.length) {
    throw new Error(`This data was saved by a newer version of Blackbook (schema ${current}). Update Blackbook to open it.`);
  }
  for (let v = current; v < migrations.length; v++) {
    transaction(db, () => {
      const m = migrations[v] as Migration;
      if (typeof m === 'string') db.exec(m);
      else m(db);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

function insertSession(db: SqlDb, table: 'sessions' | 'sessions_v2', s: SessionRecord): void {
  if (table === 'sessions') {
    db.run(
      `INSERT INTO sessions (id, mode, source, status, started_at, finished_at, last_activity_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET mode = excluded.mode, source = excluded.source, status = excluded.status, started_at = excluded.started_at,
         finished_at = excluded.finished_at, last_activity_at = excluded.last_activity_at, data = excluded.data`,
      s.id,
      s.mode,
      s.source,
      s.status,
      s.startedAt,
      s.finishedAt,
      s.lastActivityAt,
      JSON.stringify(s),
    );
    return;
  }
  // Migration 2 only: the version 2 table, before migration 3 added the source column.
  db.run(
    `INSERT INTO ${table} (id, mode, status, started_at, finished_at, last_activity_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET mode = excluded.mode, status = excluded.status, started_at = excluded.started_at,
       finished_at = excluded.finished_at, last_activity_at = excluded.last_activity_at, data = excluded.data`,
    s.id,
    s.mode,
    s.status,
    s.startedAt,
    s.finishedAt,
    s.lastActivityAt,
    JSON.stringify(s),
  );
}

interface AttemptRow {
  id: string;
  question_id: string;
  session_id: string;
  mode: string;
  status: string;
  response: string;
  correct: number;
  time_ms: number;
  first_visit_ms: number | null;
  changes: number;
  confidence: string | null;
  at: number;
}

const toAttempt = (r: AttemptRow): StoredAttempt => ({
  id: r.id,
  sessionId: r.session_id,
  questionId: r.question_id,
  mode: r.mode as StoredAttempt['mode'],
  status: r.status as StoredAttempt['status'],
  response: r.response,
  correct: r.correct === 1,
  timeMs: r.time_ms,
  firstVisitMs: r.first_visit_ms,
  changes: r.changes,
  confidence: r.confidence as StoredAttempt['confidence'],
  at: r.at,
});

interface EventRow {
  id: string;
  session_id: string;
  mode: string;
  question_id: string | null;
  type: string;
  ts: number;
  mono_ms: number;
  page_id: string;
  seq: number;
  payload: string;
}

const toEvent = (r: EventRow): EventRecord => ({
  id: r.id,
  sessionId: r.session_id,
  mode: r.mode as EventRecord['mode'],
  questionId: r.question_id,
  type: r.type as EventType,
  ts: r.ts,
  monoMs: r.mono_ms,
  pageId: r.page_id,
  seq: r.seq,
  payload: JSON.parse(r.payload) as EventRecord['payload'],
});

/**
 * Status per question in one query; the same rules as deriveStatus in src/services/browse/status.ts.
 * Correctness comes only from finished sessions.
 */
const STATUS_SQL = `
WITH exam_visits AS (
  SELECT DISTINCT je.key AS q FROM sessions s, json_each(s.data, '$.progress') je
  WHERE s.mode = 'exam' AND json_extract(je.value, '$.visits') > 0
),
ids AS (
  SELECT question_id AS q FROM events WHERE type = 'question_shown' AND question_id IS NOT NULL
  UNION SELECT question_id FROM attempts
  UNION SELECT question_id FROM flags
  UNION SELECT q FROM exam_visits
),
done AS (
  SELECT question_id AS q, COUNT(*) AS n FROM attempts WHERE status = 'final' AND response <> '' GROUP BY question_id
),
last AS (
  SELECT a.question_id AS q, a.correct AS correct,
         ROW_NUMBER() OVER (PARTITION BY a.question_id ORDER BY a.at DESC, a.id DESC) AS rn
  FROM attempts a JOIN sessions s ON s.id = a.session_id
  WHERE a.status = 'final' AND a.response <> '' AND s.status = 'finished'
)
SELECT ids.q AS question_id,
       (EXISTS (SELECT 1 FROM events e WHERE e.question_id = ids.q AND e.type = 'question_shown')
        OR EXISTS (SELECT 1 FROM attempts a WHERE a.question_id = ids.q)
        OR EXISTS (SELECT 1 FROM exam_visits v WHERE v.q = ids.q)) AS seen,
       (EXISTS (SELECT 1 FROM events e WHERE e.question_id = ids.q AND e.type = 'question_shown' AND e.mode = 'exam')
        OR EXISTS (SELECT 1 FROM exam_visits v WHERE v.q = ids.q)) AS exam_shown,
       COALESCE(done.n, 0) AS attempts,
       (SELECT correct FROM last WHERE last.q = ids.q AND last.rn = 1) AS last_correct,
       EXISTS (SELECT 1 FROM flags f WHERE f.question_id = ids.q) AS flagged
FROM ids LEFT JOIN done ON done.q = ids.q
ORDER BY ids.q`;

/** Rough bytes per event row: the text columns plus four 8-byte numbers. Excludes index pages. */
const EVENT_BYTES_SQL = `SELECT COUNT(*) AS n, COALESCE(SUM(
  LENGTH(id) + LENGTH(session_id) + LENGTH(mode) + COALESCE(LENGTH(question_id), 0) + LENGTH(type) +
  LENGTH(page_id) + LENGTH(payload) + 32), 0) AS bytes FROM events`;

export class ClosedSessionError extends Error {
  constructor() {
    super('This session is already finished or discarded and cannot be changed.');
    this.name = 'ClosedSessionError';
  }
}

export class SqliteUserStore implements AttemptStore, TelemetryStore, MistakeStore, RulesNotesStore, HiddenSessionsStore {
  constructor(private readonly db: SqlDb) {
    migrate(db);
  }

  async saveSession(s: SessionRecord, attempts: readonly StoredAttempt[] = []): Promise<void> {
    transaction(this.db, () => {
      // A finished or abandoned session is closed for good. Resending the identical record (a retry
      // whose first reply was lost) is fine; anything else is refused.
      const prev = this.db.get<{ status: string; data: string }>('SELECT status, data FROM sessions WHERE id = ?', s.id);
      if (prev && prev.status !== 'in_progress' && prev.data !== JSON.stringify(s)) throw new ClosedSessionError();
      insertSession(this.db, 'sessions', s);
      for (const a of attempts) this.insertAttempt(a);
    });
  }

  private insertAttempt(a: StoredAttempt): void {
    this.db.run(
      `INSERT INTO attempts (id, question_id, session_id, mode, status, response, correct, time_ms, first_visit_ms, changes, confidence, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET status = excluded.status, response = excluded.response, correct = excluded.correct,
         time_ms = excluded.time_ms, first_visit_ms = excluded.first_visit_ms, changes = excluded.changes,
         confidence = excluded.confidence, at = excluded.at`,
      a.id,
      a.questionId,
      a.sessionId,
      a.mode,
      a.status,
      a.response,
      a.correct ? 1 : 0,
      Math.max(0, Math.round(a.timeMs)),
      a.firstVisitMs === null ? null : Math.max(0, Math.round(a.firstVisitMs)),
      a.changes,
      a.confidence,
      a.at,
    );
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    const r = this.db.get<{ data: string }>('SELECT data FROM sessions WHERE id = ?', id);
    return r ? (JSON.parse(r.data) as SessionRecord) : null;
  }

  async listSessions(filter: SessionFilter = {}): Promise<SessionRecord[]> {
    const where: string[] = [];
    const params: SqlParam[] = [];
    if (filter.status) {
      where.push('status = ?');
      params.push(filter.status);
    }
    if (filter.mode) {
      where.push('mode = ?');
      params.push(filter.mode);
    }
    const sql = `SELECT data FROM sessions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY started_at DESC`;
    return this.db.all<{ data: string }>(sql, ...params).map((r) => JSON.parse(r.data) as SessionRecord);
  }

  async listAttempts(sessionId?: string): Promise<StoredAttempt[]> {
    const rows = sessionId
      ? this.db.all<AttemptRow>('SELECT * FROM attempts WHERE session_id = ? ORDER BY at, id', sessionId)
      : this.db.all<AttemptRow>('SELECT * FROM attempts ORDER BY at, id');
    return rows.map(toAttempt);
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

  async appendEvents(events: readonly EventRecord[]): Promise<void> {
    if (events.length === 0) return;
    transaction(this.db, () => {
      for (const e of events) {
        this.db.run(
          `INSERT OR IGNORE INTO events (id, session_id, mode, question_id, type, ts, mono_ms, page_id, seq, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          e.id,
          e.sessionId,
          e.mode,
          e.questionId,
          e.type,
          e.ts,
          e.monoMs,
          e.pageId,
          e.seq,
          JSON.stringify(e.payload),
        );
      }
    });
  }

  async listEvents(sessionId?: string): Promise<EventRecord[]> {
    const order = 'ORDER BY ts, page_id, seq';
    const rows = sessionId
      ? this.db.all<EventRow>(`SELECT * FROM events WHERE session_id = ? ${order}`, sessionId)
      : this.db.all<EventRow>(`SELECT * FROM events ${order}`);
    return rows.map(toEvent);
  }

  async clearEvents(): Promise<void> {
    transaction(this.db, () => this.db.run('DELETE FROM events'));
  }

  async stats(): Promise<TelemetryStats> {
    const ev = this.db.get<{ n: number; bytes: number }>(EVENT_BYTES_SQL) ?? { n: 0, bytes: 0 };
    const count = (table: 'sessions' | 'attempts') => this.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? 0;
    return { events: Number(ev.n), eventBytes: Number(ev.bytes), sessions: Number(count('sessions')), attempts: Number(count('attempts')) };
  }

  async exportAll(): Promise<UserDataExport> {
    return {
      app: 'blackbook',
      exportedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      sessions: await this.listSessions(),
      attempts: await this.listAttempts(),
      events: await this.listEvents(),
      mistakeTags: await this.listTags(),
      flags: await this.listFlags(),
      rulesNotes: await this.listNotes(),
      aiSettings: this.aiSettings(),
      hiddenSessions: await this.listHidden(),
    };
  }

  // ---- hidden from analytics (HiddenSessionsStore) ----

  async listHidden(): Promise<HiddenSession[]> {
    return this.db
      .all<{ session_id: string; at: number }>('SELECT session_id, at FROM hidden_sessions ORDER BY at, session_id')
      .map((r) => ({ sessionId: r.session_id, at: Number(r.at) }));
  }

  async setHidden(sessionIds: readonly string[], hidden: boolean): Promise<number> {
    let changed = 0;
    const now = Date.now();
    transaction(this.db, () => {
      for (const id of sessionIds) {
        const present = Number(this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM hidden_sessions WHERE session_id = ?', id)?.n ?? 0) > 0;
        if (hidden && !present) {
          this.db.run('INSERT INTO hidden_sessions (session_id, at) VALUES (?, ?)', id, now);
          changed++;
        } else if (!hidden && present) {
          this.db.run('DELETE FROM hidden_sessions WHERE session_id = ?', id);
          changed++;
        }
      }
    });
    return changed;
  }

  async hideBefore(before: number): Promise<number> {
    const ids = this.db
      .all<{ id: string }>(
        `SELECT id FROM sessions WHERE status = 'finished' AND test_id IS NULL AND COALESCE(finished_at, last_activity_at) < ?
           AND id NOT IN (SELECT session_id FROM hidden_sessions)`,
        before,
      )
      .map((r) => r.id);
    return this.setHidden(ids, true);
  }

  // ---- rules notes (RulesNotesStore) ----

  async listNotes(): Promise<RulesNote[]> {
    return this.db
      .all<{ skill_code: string; text: string; updated_at: number }>('SELECT * FROM rules_notes ORDER BY skill_code')
      .map((r) => ({ skillCode: r.skill_code, text: r.text, updatedAt: r.updated_at }));
  }

  async setNote(skillCode: string, text: string): Promise<void> {
    transaction(this.db, () => {
      if (text.trim() === '') this.db.run('DELETE FROM rules_notes WHERE skill_code = ?', skillCode);
      else
        this.db.run(
          'INSERT INTO rules_notes (skill_code, text, updated_at) VALUES (?, ?, ?) ON CONFLICT (skill_code) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at',
          skillCode,
          text,
          Date.now(),
        );
    });
  }

  // ---- settings and the AI reply cache ----

  aiSettings(): AiSettings {
    const r = this.db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'ai'");
    if (!r) return { ...DEFAULT_AI_SETTINGS };
    try {
      return { ...DEFAULT_AI_SETTINGS, ...(JSON.parse(r.value) as Partial<AiSettings>) };
    } catch {
      return { ...DEFAULT_AI_SETTINGS };
    }
  }

  saveAiSettings(s: AiSettings): void {
    transaction(this.db, () => {
      this.db.run("INSERT INTO settings (key, value) VALUES ('ai', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", JSON.stringify(s));
    });
  }

  cachedReply(hash: string): string | null {
    return this.db.get<{ reply: string }>('SELECT reply FROM ai_cache WHERE hash = ?', hash)?.reply ?? null;
  }

  cacheReply(hash: string, feature: string, reply: string): void {
    transaction(this.db, () => {
      this.db.run('INSERT OR REPLACE INTO ai_cache (hash, feature, reply, at) VALUES (?, ?, ?, ?)', hash, feature, reply, Date.now());
    });
  }

  async addTag(t: MistakeTag): Promise<void> {
    transaction(this.db, () => {
      this.db.run(
        'INSERT OR IGNORE INTO mistake_tags (id, session_id, question_id, reason, note, suggested, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        t.id,
        t.sessionId,
        t.questionId,
        t.reason,
        t.note,
        t.suggested ? 1 : 0,
        t.at,
      );
    });
  }

  async listTags(): Promise<MistakeTag[]> {
    return this.db
      .all<{ id: string; session_id: string; question_id: string; reason: string; note: string; suggested: number; at: number }>(
        'SELECT * FROM mistake_tags ORDER BY at, id',
      )
      .map((r) => ({
        id: r.id,
        sessionId: r.session_id,
        questionId: r.question_id,
        reason: r.reason as MistakeTag['reason'],
        note: r.note,
        suggested: Number(r.suggested) === 1,
        at: r.at,
      }));
  }

  /**
   * Replaces all user data with `data`, in one transaction: either everything is swapped or nothing
   * is. The caller has already validated every record.
   */
  async replaceAll(data: ValidatedUserData): Promise<void> {
    transaction(this.db, () => {
      this.db.run('DELETE FROM attempts');
      this.db.run('DELETE FROM flags');
      this.db.run('DELETE FROM sessions');
      this.db.run('DELETE FROM events');
      this.db.run('DELETE FROM mistake_tags');
      for (const s of data.sessions) insertSession(this.db, 'sessions', s);
      for (const a of data.attempts) this.insertAttempt(a);
      for (const f of data.flags) this.db.run('INSERT OR REPLACE INTO flags (question_id, at) VALUES (?, ?)', f.questionId, f.at);
      for (const e of data.events) {
        this.db.run(
          `INSERT OR IGNORE INTO events (id, session_id, mode, question_id, type, ts, mono_ms, page_id, seq, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          e.id, e.sessionId, e.mode, e.questionId, e.type, e.ts, e.monoMs, e.pageId, e.seq, JSON.stringify(e.payload),
        );
      }
      this.db.run('DELETE FROM hidden_sessions');
      for (const h of data.hiddenSessions) this.db.run('INSERT OR REPLACE INTO hidden_sessions (session_id, at) VALUES (?, ?)', h.sessionId, h.at);
      this.db.run('DELETE FROM rules_notes');
      for (const n of data.rulesNotes) {
        this.db.run('INSERT OR REPLACE INTO rules_notes (skill_code, text, updated_at) VALUES (?, ?, ?)', n.skillCode, n.text, n.updatedAt);
      }
      if (data.aiSettings) {
        this.db.run("INSERT INTO settings (key, value) VALUES ('ai', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", JSON.stringify(data.aiSettings));
      }
      for (const t of data.mistakeTags) {
        this.db.run(
          'INSERT OR IGNORE INTO mistake_tags (id, session_id, question_id, reason, note, suggested, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          t.id, t.sessionId, t.questionId, t.reason, t.note, t.suggested ? 1 : 0, t.at,
        );
      }
    });
  }

  async questionStatus(): Promise<QuestionStatus[]> {
    return this.db
      .all<{ question_id: string; seen: number; exam_shown: number; attempts: number; last_correct: number | null; flagged: number }>(STATUS_SQL)
      .map((r) => ({
        questionId: r.question_id,
        seen: Number(r.seen) === 1,
        done: Number(r.attempts) > 0,
        examShown: Number(r.exam_shown) === 1,
        attempts: Number(r.attempts),
        lastResult: r.last_correct === null ? null : Number(r.last_correct) === 1 ? 'correct' : 'incorrect',
        flagged: Number(r.flagged) === 1,
      }));
  }

  async clearAll(): Promise<void> {
    transaction(this.db, () => {
      this.db.run('DELETE FROM attempts');
      this.db.run('DELETE FROM flags');
      this.db.run('DELETE FROM sessions');
      this.db.run('DELETE FROM events');
      this.db.run('DELETE FROM mistake_tags');
      this.db.run('DELETE FROM rules_notes');
      this.db.run('DELETE FROM ai_cache');
      this.db.run('DELETE FROM hidden_sessions');
    });
  }
}
