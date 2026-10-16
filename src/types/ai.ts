// The AI layer (Phase 7). Groq is optional: every feature has a rule-based form that runs when AI is
// off, there is no key, or a reply is unusable. Code builds the candidates and computes every number;
// the model only chooses from what code offered and words what code supplied. The key lives on the
// local server and never reaches the browser, an event, a log, an export or a backup.

import type { KeyProtection } from './keys';
import type { DrillConfig } from './drill';
import type { Difficulty, Section } from './sat';

export type AiFeature = 'weak_drill' | 'report';

/** User settings for AI, stored with user data (never the key). */
export interface AiSettings {
  /** Global switch. Off: every feature runs rule-based. */
  enabled: boolean;
  /** Send question text (passage, stem, choices as plain text). Needs `textConfirmedAt` first. */
  includeText: boolean;
  /** When the one-time "question text goes to Groq" confirmation was accepted, or null. */
  textConfirmedAt: number | null;
  /** Features whose "show exactly what will be sent" preview has been seen. */
  previewSeen: AiFeature[];
}

export const DEFAULT_AI_SETTINGS: AiSettings = { enabled: true, includeText: false, textConfirmedAt: null, previewSeen: [] };

export interface AiStatus {
  hasKey: boolean;
  /** How the saved key is kept on disk; null when none is saved. */
  keyProtection: KeyProtection | null;
  settings: AiSettings;
  model: string;
  /** One line on Groq's retention policy for API traffic, shown beside the text toggle. */
  policyLine: string;
}

/** Why an AI call did not produce the result. Plain words go to the screen. */
export type AiFailure = 'off' | 'no_key' | 'rate_limited' | 'timeout' | 'network' | 'http' | 'invalid_reply';

export interface AiTestResult {
  ok: boolean;
  /** Plain sentence; never contains the key. */
  message: string;
}

/** Who produced a result. Shown as "AI-assisted" or "rule-based". */
export type ResultOrigin = 'ai' | 'rule';

// ---- Weak-skill drill ----

export interface WeakDrillRequest {
  section: Section | 'both';
  /** Questions in the drill. Default 20. */
  size: number;
  /** Skip the model and use the rule-based pick. */
  ruleOnly: boolean;
}

export interface WeakDrillGroup {
  label: string;
  /** One short reason, e.g. "same concept you missed twice, slow on these". */
  reason: string;
  questionIds: string[];
}

export interface WeakDrillResult {
  origin: ResultOrigin;
  /** Why the rule-based form ran, when it did. */
  fallbackReason: AiFailure | null;
  /** In the order to serve them. */
  questionIds: string[];
  groups: WeakDrillGroup[];
  /** The skills the candidates came from, weakest first, with the numbers code computed. */
  skills: { skillCode: string; skill: string; section: Section; answered: number; correct: number; lowerBound: number }[];
  /** True when the reply came from the cache, so no call was spent. */
  cached: boolean;
  /** Whether question text was part of the request. */
  usedText: boolean;
  notes: string[];
}

// ---- AI-assisted analytics report ----

export type ReportPeriod = 'last_test' | 'last_7_days' | 'all_time';

/** One insight code computed: a headline number, the facts behind it, and its sample size. */
export interface Insight {
  id: string;
  title: string;
  headline: string;
  /** Every number the sentence may use, by name. */
  facts: Record<string, number>;
  sampleSize: number;
  /** True when the sample is too small to lean on. */
  thin: boolean;
  /** Rule-based priority; higher is more useful. */
  priority: number;
  /** What the one button under it launches. Code chooses it; it is never sent to the model. */
  action: CoachAction | null;
}

/**
 * The one action under a coach insight: a drill with a config code built (weakest skills, review
 * misses), the retry set, or another screen.
 */
export type CoachAction =
  | { kind: 'drill'; label: string; config: DrillConfig }
  | { kind: 'retry'; label: string }
  | { kind: 'open'; label: string; target: 'exam_setup' | 'mistakes' | 'drill_setup' };

export interface ReportLine {
  insightId: string;
  title: string;
  headline: string;
  sentence: string;
  thin: boolean;
  sampleSize: number;
  action: CoachAction | null;
}

export interface InsightReport {
  origin: ResultOrigin;
  fallbackReason: AiFailure | null;
  period: ReportPeriod;
  lines: ReportLine[];
  nextWeek: string;
  /** Sentences the model wrote that used numbers not in the facts; dropped. */
  dropped: number;
  cached: boolean;
  generatedAt: number;
}

/** The dashboard coach: at most three report lines, each with its action. */
export interface CoachResult {
  origin: ResultOrigin;
  fallbackReason: AiFailure | null;
  lines: ReportLine[];
  cached: boolean;
}

/** What one AI call would send, exactly, for the preview. */
export interface AiPreview {
  feature: AiFeature;
  model: string;
  usedText: boolean;
  /** The request body minus the authorization header. */
  body: unknown;
  questionCount: number;
  /** Rough size, for the free-tier token limit. */
  approxTokens: number;
}

/** UI code reaches the AI layer only through this (AGENTS.md rule 6). */
export interface AiStore {
  status(): Promise<AiStatus>;
  setKey(key: string): Promise<AiStatus>;
  removeKey(): Promise<AiStatus>;
  testConnection(): Promise<AiTestResult>;
  updateSettings(patch: Partial<AiSettings>): Promise<AiStatus>;
  preview(feature: 'weak_drill', req: WeakDrillRequest): Promise<AiPreview>;
  previewReport(period: ReportPeriod): Promise<AiPreview>;
  weakDrill(req: WeakDrillRequest): Promise<WeakDrillResult>;
  report(period: ReportPeriod, regenerate: boolean): Promise<InsightReport>;
  /** The dashboard coach for an analytics filter (query string of src/services/analytics/filter). */
  coach(filter: import('./analytics').AnalyticsFilter): Promise<CoachResult>;
}

// ---- Rules notes ----

export interface RulesNote {
  skillCode: string;
  text: string;
  updatedAt: number;
}

export const RULES_NOTE_MAX = 2000;

export interface RulesNotesStore {
  listNotes(): Promise<RulesNote[]>;
  /** Empty text removes the note. */
  setNote(skillCode: string, text: string): Promise<void>;
}

/** A candidate question as code ranks it. No content. */
export interface Candidate {
  id: string;
  section: Section;
  domainCode: string;
  domain: string;
  skillCode: string;
  skill: string;
  difficulty: Difficulty;
  scoreBand: number | null;
  /** Shown before but never answered (soft tier). */
  seen: boolean;
}
