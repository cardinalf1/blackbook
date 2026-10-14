import type { Difficulty, Question, Section, SkippedQuestion } from '../../types/sat';

export interface QuestionQuery {
  section?: Section;
  domainCode?: string;
  skillCode?: string;
  difficulty?: Difficulty;
}

export interface BankMeta {
  /** When the bank was synced from the source (from the file). */
  fetchedAt: string;
  /** When it was imported into this browser. */
  importedAt: string;
  count: number;
  /** Questions the sync deliberately left out (from the file's "skipped"). */
  skippedCount: number;
}

export type ProgressFn = (done: number, total: number) => void;

/** The only way UI and services reach stored questions (AGENTS.md rule 6). */
export interface QuestionStore {
  count(): Promise<number>;
  get(id: string): Promise<Question | undefined>;
  query(q: QuestionQuery): Promise<Question[]>;
  getMeta(): Promise<BankMeta | null>;
  clear(): Promise<void>;
}

/** A store that can swap in a whole new bank. Only the local server and tests hold one. */
export interface WritableQuestionStore extends QuestionStore {
  /**
   * Replaces the whole bank atomically: on failure or abort the previous bank stays.
   * Aborting rejects with the signal's reason.
   */
  replaceAll(
    questions: readonly Question[],
    meta: BankMeta,
    onProgress?: ProgressFn,
    signal?: AbortSignal,
    /** The sync's skip list, kept for the plain-language report. */
    skipped?: readonly SkippedQuestion[],
  ): Promise<void>;
}

export function matchesQuery(q: Question, query: QuestionQuery): boolean {
  return (
    (query.section === undefined || q.section === query.section) &&
    (query.domainCode === undefined || q.domainCode === query.domainCode) &&
    (query.skillCode === undefined || q.skillCode === query.skillCode) &&
    (query.difficulty === undefined || q.difficulty === query.difficulty)
  );
}
