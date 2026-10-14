import { IndexedDbQuestionStore } from './indexeddb';
import type { QuestionStore } from './types';

export type { BankMeta, ProgressFn, QuestionQuery, QuestionStore } from './types';

/** App-wide question store. UI code uses this, never IndexedDB directly. */
export const questionStore: QuestionStore = new IndexedDbQuestionStore();
