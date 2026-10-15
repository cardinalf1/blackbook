import type { QuestionStatus } from '../../types/browse';
import type { FlagRecord } from '../../types/drill';
import type {
  EventRecord,
  SessionMode,
  SessionRecord,
  SessionStatus,
  StoredAttempt,
  TelemetryStats,
  UserDataExport,
} from '../../types/session';

export interface SessionFilter {
  status?: SessionStatus;
  mode?: SessionMode;
}

/**
 * User data: sessions, attempts, flags and the event log. Kept apart from the question bank, so
 * replacing the bank never touches it. UI and services use this interface only (AGENTS.md rule 6).
 * Sessions are never deleted one by one: discarding marks a session abandoned.
 */
export interface AttemptStore {
  /**
   * Saves a session and the attempts that changed with it, in one transaction: either both are
   * stored or neither is. Attempts are upserted on `attempt.id`.
   */
  saveSession(session: SessionRecord, attempts?: readonly StoredAttempt[]): Promise<void>;
  getSession(id: string): Promise<SessionRecord | null>;
  /** Newest started first. */
  listSessions(filter?: SessionFilter): Promise<SessionRecord[]>;
  /** Oldest first. */
  listAttempts(sessionId?: string): Promise<StoredAttempt[]>;

  /** "Flag for later" across sessions. A session's own flags live in its record. */
  setFlag(questionId: string, flagged: boolean): Promise<void>;
  listFlags(): Promise<FlagRecord[]>;

  /** Seen, done, attempts, last result and flag per question, derived in one pass (see browse/status). */
  questionStatus(): Promise<QuestionStatus[]>;

  /** Removes sessions, attempts, flags and events. */
  clearAll(): Promise<void>;
}

/** The append-only event log. */
export interface TelemetryStore {
  /** Idempotent on `event.id`: sending the same event twice stores it once. */
  appendEvents(events: readonly EventRecord[], opts?: { keepalive?: boolean }): Promise<void>;
  /** In logged order (wall time, then page and sequence). All sessions when no id is given. */
  listEvents(sessionId?: string): Promise<EventRecord[]>;
  /** Deletes the event log only. Sessions and attempts stay. */
  clearEvents(): Promise<void>;
  stats(): Promise<TelemetryStats>;
  exportAll(): Promise<UserDataExport>;
}
