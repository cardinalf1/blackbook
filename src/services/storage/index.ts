import { api } from '../api/client';
import type { AttemptStore } from './attemptTypes';
import { HttpAttemptStore, HttpQuestionStore } from './http';
import type { QuestionStore } from './types';

export type { AttemptStore } from './attemptTypes';
export type { BankMeta, ProgressFn, QuestionQuery, QuestionStore } from './types';

/** App-wide question store, served by the local Blackbook program. UI code uses this only. */
export const questionStore: QuestionStore = new HttpQuestionStore(api);

/** App-wide store for attempts, flags and sessions, kept on disk by the local program. */
export const attemptStore: AttemptStore = new HttpAttemptStore(api);
