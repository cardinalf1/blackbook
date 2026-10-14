import type { Attempt, FlagRecord, SessionRecord } from '../../types/drill';

/**
 * User data: attempts, flags and drill sessions. Kept apart from the question bank, so replacing
 * the bank never touches it. UI and services use this interface, never IndexedDB (AGENTS.md rule 6).
 */
export interface AttemptStore {
  /** Idempotent on `attempt.id`. */
  addAttempt(attempt: Attempt): Promise<void>;
  listAttempts(): Promise<Attempt[]>;
  attemptsForSession(sessionId: string): Promise<Attempt[]>;

  setFlag(questionId: string, flagged: boolean): Promise<void>;
  listFlags(): Promise<FlagRecord[]>;

  saveSession(session: SessionRecord): Promise<void>;
  /** The most recently started session whose status is 'active', if any. */
  getActiveSession(): Promise<SessionRecord | null>;
  getSession(id: string): Promise<SessionRecord | null>;
  deleteSession(id: string): Promise<void>;

  /** Removes attempts, flags and sessions. */
  clearAll(): Promise<void>;
}
