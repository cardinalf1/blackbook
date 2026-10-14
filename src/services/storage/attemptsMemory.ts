import type { Attempt, FlagRecord, SessionRecord } from '../../types/drill';
import type { AttemptStore } from './attemptTypes';

/** In-memory AttemptStore for tests. Same contract as the IndexedDB store. */
export class MemoryAttemptStore implements AttemptStore {
  private attempts = new Map<string, Attempt>();
  private flags = new Map<string, FlagRecord>();
  private sessions = new Map<string, SessionRecord>();

  async addAttempt(attempt: Attempt): Promise<void> {
    this.attempts.set(attempt.id, structuredClone(attempt));
  }

  async listAttempts(): Promise<Attempt[]> {
    return structuredClone([...this.attempts.values()]);
  }

  async attemptsForSession(sessionId: string): Promise<Attempt[]> {
    return structuredClone([...this.attempts.values()].filter((a) => a.sessionId === sessionId));
  }

  async setFlag(questionId: string, flagged: boolean): Promise<void> {
    if (flagged) this.flags.set(questionId, { questionId, at: Date.now() });
    else this.flags.delete(questionId);
  }

  async listFlags(): Promise<FlagRecord[]> {
    return [...this.flags.values()];
  }

  async saveSession(session: SessionRecord): Promise<void> {
    this.sessions.set(session.id, structuredClone(session));
  }

  async getActiveSession(): Promise<SessionRecord | null> {
    const active = [...this.sessions.values()].filter((s) => s.status === 'active');
    active.sort((a, b) => b.startedAt - a.startedAt);
    return active[0] ? structuredClone(active[0]) : null;
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    const s = this.sessions.get(id);
    return s ? structuredClone(s) : null;
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async clearAll(): Promise<void> {
    this.attempts.clear();
    this.flags.clear();
    this.sessions.clear();
  }
}
