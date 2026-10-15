// Storage adapters backed by the local server. Same contracts as the in-memory stores.

import type { FlagRecord } from '../../types/drill';
import type { EventRecord, SessionRecord, StoredAttempt, TelemetryStats, UserDataExport } from '../../types/session';
import type { Question } from '../../types/sat';
import { ApiError, type ApiClient } from '../api/client';
import type { AttemptStore, SessionFilter, TelemetryStore } from './attemptTypes';
import type { BankMeta, QuestionQuery, QuestionStore } from './types';

const enc = encodeURIComponent;

export class HttpQuestionStore implements QuestionStore {
  constructor(private readonly api: ApiClient) {}

  async count(): Promise<number> {
    return (await this.api.request<{ count: number }>('/api/bank/count')).count;
  }

  async get(id: string): Promise<Question | undefined> {
    try {
      return await this.api.request<Question>(`/api/bank/questions/${enc(id)}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return undefined;
      throw e;
    }
  }

  async query(q: QuestionQuery): Promise<Question[]> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) params.set(k, String(v));
    const qs = params.toString();
    return this.api.request<Question[]>(`/api/bank/questions${qs ? `?${qs}` : ''}`);
  }

  async getMeta(): Promise<BankMeta | null> {
    return this.api.request<BankMeta | null>('/api/bank/meta');
  }

  async clear(): Promise<void> {
    await this.api.request('/api/bank', { method: 'DELETE' });
  }
}

export class HttpAttemptStore implements AttemptStore, TelemetryStore {
  constructor(private readonly api: ApiClient) {}

  async saveSession(session: SessionRecord, attempts: readonly StoredAttempt[] = []): Promise<void> {
    await this.api.request(`/api/sessions/${enc(session.id)}`, { method: 'PUT', body: JSON.stringify({ session, attempts }) });
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    return this.api.request<SessionRecord | null>(`/api/sessions/${enc(id)}`);
  }

  async listSessions(filter: SessionFilter = {}): Promise<SessionRecord[]> {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.mode) params.set('mode', filter.mode);
    const qs = params.toString();
    return this.api.request<SessionRecord[]>(`/api/sessions${qs ? `?${qs}` : ''}`);
  }

  async listAttempts(sessionId?: string): Promise<StoredAttempt[]> {
    return this.api.request<StoredAttempt[]>(sessionId ? `/api/attempts?sessionId=${enc(sessionId)}` : '/api/attempts');
  }

  async setFlag(questionId: string, flagged: boolean): Promise<void> {
    await this.api.request(`/api/flags/${enc(questionId)}`, { method: 'PUT', body: JSON.stringify({ flagged }) });
  }

  async listFlags(): Promise<FlagRecord[]> {
    return this.api.request<FlagRecord[]>('/api/flags');
  }

  async appendEvents(events: readonly EventRecord[], opts: { keepalive?: boolean } = {}): Promise<void> {
    await this.api.request('/api/events', { method: 'POST', body: JSON.stringify({ events }), keepalive: opts.keepalive === true });
  }

  async listEvents(sessionId?: string): Promise<EventRecord[]> {
    return this.api.request<EventRecord[]>(sessionId ? `/api/events?sessionId=${enc(sessionId)}` : '/api/events');
  }

  async clearEvents(): Promise<void> {
    await this.api.request('/api/events', { method: 'DELETE' });
  }

  async stats(): Promise<TelemetryStats> {
    return this.api.request<TelemetryStats>('/api/data/stats');
  }

  async exportAll(): Promise<UserDataExport> {
    return this.api.request<UserDataExport>('/api/data/export');
  }

  async clearAll(): Promise<void> {
    await this.api.request('/api/user-data', { method: 'DELETE' });
  }
}
