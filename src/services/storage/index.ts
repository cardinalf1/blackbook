import { IndexedDbAttemptStore } from './attemptsIndexeddb';
import type { AttemptStore } from './attemptTypes';
import { IndexedDbQuestionStore } from './indexeddb';
import type { QuestionStore } from './types';

export type { AttemptStore } from './attemptTypes';
export type { BankMeta, ProgressFn, QuestionQuery, QuestionStore } from './types';

/** App-wide question store. UI code uses this, never IndexedDB directly. */
export const questionStore: QuestionStore = new IndexedDbQuestionStore();

/** App-wide store for attempts, flags and sessions. Separate database from the question bank. */
export const attemptStore: AttemptStore = new IndexedDbAttemptStore();
