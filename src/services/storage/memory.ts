import type { Question } from '../../types/sat';
import { matchesQuery, type BankMeta, type ProgressFn, type QuestionQuery, type WritableQuestionStore } from './types';

/** In-memory QuestionStore for tests. Same contract as the IndexedDB store. */
export class MemoryQuestionStore implements WritableQuestionStore {
  private questions = new Map<string, Question>();
  private meta: BankMeta | null = null;

  async replaceAll(questions: readonly Question[], meta: BankMeta, onProgress?: ProgressFn, signal?: AbortSignal): Promise<void> {
    const next = new Map<string, Question>();
    questions.forEach((q, i) => {
      signal?.throwIfAborted();
      next.set(q.id, structuredClone(q));
      onProgress?.(i + 1, questions.length);
    });
    this.questions = next;
    this.meta = { ...meta };
  }

  async count(): Promise<number> {
    return this.questions.size;
  }

  async get(id: string): Promise<Question | undefined> {
    const q = this.questions.get(id);
    return q === undefined ? undefined : structuredClone(q);
  }

  async query(query: QuestionQuery): Promise<Question[]> {
    return [...this.questions.values()].filter((q) => matchesQuery(q, query)).map((q) => structuredClone(q));
  }

  async getMeta(): Promise<BankMeta | null> {
    return this.meta === null ? null : { ...this.meta };
  }

  async clear(): Promise<void> {
    this.questions.clear();
    this.meta = null;
  }
}
