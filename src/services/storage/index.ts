import { api } from '../api/client';
import type { AttemptStore, TelemetryStore } from './attemptTypes';
import { HttpAttemptStore, HttpQuestionStore } from './http';
import type { QuestionStore } from './types';

export type { AttemptStore, SessionFilter, TelemetryStore } from './attemptTypes';
export type { BankMeta, ProgressFn, QuestionQuery, QuestionStore } from './types';

/** App-wide question store, served by the local Blackbook program. UI code uses this only. */
export const questionStore: QuestionStore = new HttpQuestionStore(api);

const userStore = new HttpAttemptStore(api);

/** App-wide store for sessions, attempts and flags, kept on disk by the local program. */
export const attemptStore: AttemptStore = userStore;

/** App-wide event log, on disk next to the attempts. Only the telemetry logger writes to it. */
export const telemetryStore: TelemetryStore = userStore;
