import type { QuestionStatus } from '../../types/browse';
import type { FlagRecord } from '../../types/drill';
import { deriveStatus, shownIds } from '../browse/status';
import type { EventRecord, SessionRecord, StoredAttempt, TelemetryStats, UserDataExport } from '../../types/session';
import type { AttemptStore, SessionFilter, TelemetryStore } from './attemptTypes';

/** In-memory user store for tests. Same contracts as the SQLite store behind the local server. */
export class MemoryAttemptStore implements AttemptStore, TelemetryStore {
  private attempts = new Map<string, StoredAttempt>();
  private flags = new Map<string, FlagRecord>();
  private sessions = new Map<string, SessionRecord>();
  private events = new Map<string, EventRecord>();

  async saveSession(session: SessionRecord, attempts: readonly StoredAttempt[] = []): Promise<void> {
    const prev = this.sessions.get(session.id);
    if (prev && prev.status !== 'in_progress' && JSON.stringify(prev) !== JSON.stringify(session)) {
      throw new Error('This session is already finished or discarded and cannot be changed.');
    }
    this.sessions.set(session.id, structuredClone(session));
    for (const a of attempts) this.attempts.set(a.id, structuredClone(a));
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    const s = this.sessions.get(id);
    return s ? structuredClone(s) : null;
  }

  async listSessions(filter: SessionFilter = {}): Promise<SessionRecord[]> {
    const list = [...this.sessions.values()].filter(
      (s) => (filter.status === undefined || s.status === filter.status) && (filter.mode === undefined || s.mode === filter.mode),
    );
    list.sort((a, b) => b.startedAt - a.startedAt);
    return structuredClone(list);
  }

  async listAttempts(sessionId?: string): Promise<StoredAttempt[]> {
    const list = [...this.attempts.values()].filter((a) => sessionId === undefined || a.sessionId === sessionId);
    list.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    return structuredClone(list);
  }

  async setFlag(questionId: string, flagged: boolean): Promise<void> {
    if (flagged) this.flags.set(questionId, { questionId, at: Date.now() });
    else this.flags.delete(questionId);
  }

  async listFlags(): Promise<FlagRecord[]> {
    return [...this.flags.values()];
  }

  async appendEvents(events: readonly EventRecord[]): Promise<void> {
    for (const e of events) if (!this.events.has(e.id)) this.events.set(e.id, structuredClone(e));
  }

  async listEvents(sessionId?: string): Promise<EventRecord[]> {
    const list = [...this.events.values()].filter((e) => sessionId === undefined || e.sessionId === sessionId);
    list.sort((a, b) => a.ts - b.ts || a.pageId.localeCompare(b.pageId) || a.seq - b.seq);
    return structuredClone(list);
  }

  async clearEvents(): Promise<void> {
    this.events.clear();
  }

  async stats(): Promise<TelemetryStats> {
    let eventBytes = 0;
    for (const e of this.events.values()) {
      eventBytes += e.id.length + e.sessionId.length + e.mode.length + (e.questionId?.length ?? 0) + e.type.length;
      eventBytes += e.pageId.length + JSON.stringify(e.payload).length + 32;
    }
    return { events: this.events.size, eventBytes, sessions: this.sessions.size, attempts: this.attempts.size };
  }

  async exportAll(): Promise<UserDataExport> {
    return {
      app: 'blackbook',
      exportedAt: new Date().toISOString(),
      schemaVersion: 0,
      sessions: await this.listSessions(),
      attempts: await this.listAttempts(),
      events: await this.listEvents(),
    };
  }

  async questionStatus(): Promise<QuestionStatus[]> {
    return deriveStatus([...this.attempts.values()], [...this.sessions.values()], shownIds([...this.events.values()]), [...this.flags.values()]);
  }

  async clearAll(): Promise<void> {
    this.attempts.clear();
    this.flags.clear();
    this.sessions.clear();
    this.events.clear();
  }
}
