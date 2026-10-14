// Storage adapters backed by the local server. Same contracts as the in-memory stores.

import type { Attempt, FlagRecord, SessionRecord } from '../../types/drill';
import type { Question } from '../../types/sat';
import { ApiError, type ApiClient } from '../api/client';
import type { AttemptStore } from './attemptTypes';
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

export class HttpAttemptStore implements AttemptStore {
  constructor(private readonly api: ApiClient) {}

  async addAttempt(attempt: Attempt): Promise<void> {
    await this.api.request('/api/attempts', { method: 'POST', body: JSON.stringify(attempt) });
  }

  async listAttempts(): Promise<Attempt[]> {
    return this.api.request<Attempt[]>('/api/attempts');
  }

  async attemptsForSession(sessionId: string): Promise<Attempt[]> {
    return this.api.request<Attempt[]>(`/api/attempts?sessionId=${enc(sessionId)}`);
  }

  async setFlag(questionId: string, flagged: boolean): Promise<void> {
    await this.api.request(`/api/flags/${enc(questionId)}`, { method: 'PUT', body: JSON.stringify({ flagged }) });
  }

  async listFlags(): Promise<FlagRecord[]> {
    return this.api.request<FlagRecord[]>('/api/flags');
  }

  async saveSession(session: SessionRecord): Promise<void> {
    await this.api.request(`/api/sessions/${enc(session.id)}`, { method: 'PUT', body: JSON.stringify(session) });
  }

  async getActiveSession(): Promise<SessionRecord | null> {
    return this.api.request<SessionRecord | null>('/api/sessions/active');
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    return this.api.request<SessionRecord | null>(`/api/sessions/${enc(id)}`);
  }

  async deleteSession(id: string): Promise<void> {
    await this.api.request(`/api/sessions/${enc(id)}`, { method: 'DELETE' });
  }

  async clearAll(): Promise<void> {
    await this.api.request('/api/user-data', { method: 'DELETE' });
  }
}
