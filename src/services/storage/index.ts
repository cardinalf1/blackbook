import { api } from '../api/client';
import type { AttemptStore, TelemetryStore } from './attemptTypes';
import type { AnalyticsStore } from '../../types/analytics';
import type { BackupStore } from '../../types/backup';
import type { MistakeStore } from '../../types/mistakes';
import type { AiStore, RulesNotesStore } from '../../types/ai';
import { HttpAiStore, HttpAnalyticsStore, HttpAttemptStore, HttpBackupStore, HttpQuestionStore, HttpRulesNotesStore } from './http';
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

/** Mistake tags, append-only, kept next to the attempts they describe. */
export const mistakeStore: MistakeStore = userStore;

/** Snapshots of user data and restore from them or from an export file. */
export const backupStore: BackupStore = new HttpBackupStore(api);

/** The AI layer on the local program. The key is sent in once and never read back. */
export const aiStore: AiStore = new HttpAiStore(api);

/** Your own rules notes per skill. Local only, never sent to Groq. */
export const rulesNotesStore: RulesNotesStore = new HttpRulesNotesStore(api);

/** Summaries for the analytics screens, computed by the local program. */
export const analyticsStore: AnalyticsStore = new HttpAnalyticsStore(api);
