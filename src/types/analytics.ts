// Analytics (Phase 5): the filters, the summaries the local program computes in SQL, and the props
// contracts for the screens. Summaries hold counts and sums (integers), never rates: the screens
// derive rates, so the server and the independent checker compare exactly.
// Drill and exam numbers are always separate fields. Nothing here mixes them into one rate.

import type { ReactNode } from 'react';
import type { DrillConfig } from './drill';
import type { Difficulty, Section } from './sat';
import type { SessionMode } from './session';
import type { RoutingDecision, ScoreEstimate, TestKind } from './test';

/** What kind of session: a drill, one question from Browse, a lone exam module, a section run or a full test. */
export type AnalyticsKind = 'all' | 'drill' | 'single' | 'module' | 'section' | 'full';
export const ANALYTICS_KINDS: readonly AnalyticsKind[] = ['all', 'drill', 'single', 'module', 'section', 'full'];

export interface AnalyticsFilter {
  /** Epoch ms, inclusive. A session counts by when it finished. */
  from: number | null;
  /** Epoch ms, inclusive. */
  to: number | null;
  kind: AnalyticsKind;
  /** Null means both sections. */
  section: Section | null;
  /** Leave out exam modules with an emergency pause, and every module of a paused test. */
  excludePaused: boolean;
  /** Leave out one-question sessions started from Browse. */
  excludeSingle: boolean;
  /** Count sessions the user hid from analytics (Past drills). Off by default. */
  includeHidden: boolean;
}

export const DEFAULT_ANALYTICS_FILTER: AnalyticsFilter = { from: null, to: null, kind: 'all', section: null, excludePaused: false, excludeSingle: false, includeHidden: false };

/** Counts for one mode. Answered questions only, in finished sessions. */
export interface ModeCounts {
  attempts: number;
  correct: number;
  /** Sum of the answers' active time. Divide by `attempts` for the average. */
  timeMs: number;
}

export type ByMode<T> = Record<SessionMode, T>;

// ---- Overview ----

export interface OverviewSummary {
  /** Finished sessions in the filter, by mode. */
  sessions: ByMode<number>;
  attempts: ByMode<ModeCounts>;
  /** Sum of the finished sessions' active time. */
  activeMs: ByMode<number>;
  /** Bank coverage, not affected by the filter. `seen` counts questions shown or answered at least once. */
  bank: { total: number; live: number; seen: number; seenLive: number };
  /** Per calendar day (local time), oldest first. One row per day and mode. */
  daily: { day: string; mode: SessionMode; attempts: number; correct: number }[];
  /** Per calendar day, mode and question section: answers and their summed active time, for pace over time. */
  dailyPace: { day: string; mode: SessionMode; section: Section; attempts: number; timeMs: number }[];
  /** Answers whose question is no longer in the bank, left out of every skill figure. */
  unattributed: number;
}

// ---- Skills ----

export type SkillModeCounts = ModeCounts;

/** One session's result on one skill, for the trend. */
export interface SkillSessionPoint {
  sessionId: string;
  finishedAt: number;
  mode: SessionMode;
  attempts: number;
  correct: number;
}

export interface SkillRow {
  section: Section;
  domainCode: string;
  domain: string;
  skillCode: string;
  skill: string;
  /** Questions in the bank under this skill, and how many are live. */
  bankTotal: number;
  bankLive: number;
  /** Live questions never shown or answered. */
  unseenLive: number;
  counts: ByMode<SkillModeCounts>;
  /** The latest RECENT_SESSIONS sessions with this skill in the filter, oldest first. */
  recent: SkillSessionPoint[];
}

export interface SkillsSummary {
  rows: SkillRow[];
}

/** A question whose latest finished answer was wrong. Oldest miss first when listed for review. */
export interface MissRow {
  questionId: string;
  section: Section;
  domainCode: string;
  skillCode: string;
  difficulty: Difficulty;
  sessionId: string;
  /** When the latest wrong answer was written. */
  missedAt: number;
  /** Wrong answers and all answers to this question, in the filter. */
  misses: number;
  attempts: number;
}

export interface SkillSessionRow {
  sessionId: string;
  finishedAt: number;
  mode: SessionMode;
  kind: Exclude<AnalyticsKind, 'all'>;
  attempts: number;
  correct: number;
  timeMs: number;
}

export interface SkillDetail {
  skillCode: string;
  sessions: SkillSessionRow[];
  /** Questions in this skill whose latest answer was wrong, oldest miss first. */
  misses: MissRow[];
}

// ---- Timing ----

/** Your own timing for one mode, section and difficulty, over all your finished answers (not the date filter). */
export interface TimingBaseline {
  mode: SessionMode;
  section: Section;
  difficulty: Difficulty;
  n: number;
  /** Nearest-rank percentiles of the answers' active time. */
  medianMs: number;
  rushMs: number;
  stuckMs: number;
  /** False below MIN_BASELINE_ATTEMPTS: nothing in this group is flagged. */
  usable: boolean;
  /** Sum of times, for the mean. */
  timeMs: number;
}

export type FlagKind = 'rushed_wrong' | 'stuck';

export interface FlaggedQuestion {
  questionId: string;
  sessionId: string;
  mode: SessionMode;
  section: Section;
  skillCode: string;
  difficulty: Difficulty;
  flag: FlagKind;
  timeMs: number;
  correct: boolean;
  /** The threshold crossed: the rush percentile for rushed_wrong, the stuck percentile for stuck. */
  thresholdMs: number;
  at: number;
}

export interface ModulePacing {
  sessionId: string;
  finishedAt: number;
  section: Section;
  moduleNumber: 1 | 2;
  tier: 'routing' | 'easier' | 'harder';
  /** Part of a full test or a section run, or a lone module. */
  kind: 'module' | 'section' | 'full';
  timeLimitMs: number;
  timeLeftMs: number;
  submittedBy: 'user' | 'timer';
  paused: boolean;
  questions: number;
  answered: number;
  /** False when the module ended before the five-minute alert, so there was no last-five-minutes window. */
  reachedFiveMinutes: boolean;
  /** Questions first answered after the five-minute alert. */
  answeredInLastFive: number;
}

export interface TimingSummary {
  baselines: TimingBaseline[];
  /** Counts over every flagged answer in the filter. */
  flaggedCounts: { rushedWrong: ByMode<number>; stuck: ByMode<number> };
  /** The newest MAX_FLAGGED_LISTED, newest first. */
  flagged: FlaggedQuestion[];
  /** Newest first. */
  modules: ModulePacing[];
}

// ---- Behavior ----

export interface BehaviorCounts {
  answered: number;
  /** Answers that were replaced or cleared at least once (from the stored answer's change count). */
  questionsWithChange: number;
  /** Total replacements and clears. */
  changes: number;
  /** Direct replacements of one choice by another on multiple-choice questions, by what the old and new choice were. */
  correctToIncorrect: number;
  incorrectToCorrect: number;
  incorrectToIncorrect: number;
  /** Multiple-choice answers in the filter, the denominator for strike-out use. */
  mcqAnswered: number;
  /** Multiple-choice answers on which at least one choice was struck out. */
  questionsWithStrike: number;
  strikeActions: number;
  /** Answers with a rating. All zero when the confidence question was never asked. */
  rated: number;
  sureWrong: number;
  sureRight: number;
  unsureRight: number;
  unsureWrong: number;
  guessRight: number;
  guessWrong: number;
}

export interface BehaviorSummary {
  counts: ByMode<BehaviorCounts>;
}

// ---- Test history ----

export interface TestHistoryRow {
  testId: string;
  kind: TestKind;
  finishedAt: number;
  paused: boolean;
  configVersion: number;
  estimate: ScoreEstimate | null;
  routing: RoutingDecision[];
}

export interface TestHistory {
  /** Oldest first, so a chart reads left to right. */
  tests: TestHistoryRow[];
}

// ---- The store the screens use (HTTP in the app, in-memory in tests) ----

export interface AnalyticsStore {
  overview(filter: AnalyticsFilter): Promise<OverviewSummary>;
  skills(filter: AnalyticsFilter): Promise<SkillsSummary>;
  skillDetail(filter: AnalyticsFilter, skillCode: string): Promise<SkillDetail>;
  /** Questions whose latest finished answer was wrong, oldest miss first. Optional skill and section limits. */
  misses(filter: AnalyticsFilter, limit?: { skillCodes?: readonly string[]; section?: Section }): Promise<MissRow[]>;
  timing(filter: AnalyticsFilter): Promise<TimingSummary>;
  behavior(filter: AnalyticsFilter): Promise<BehaviorSummary>;
  tests(filter: AnalyticsFilter): Promise<TestHistory>;
}

// ---- Derived rows the screens show (built by src/services/analytics/metrics.ts) ----

export interface RateView {
  attempts: number;
  correct: number;
  /** 0 to 1, or null with no attempts. */
  accuracy: number | null;
  /** Fewer than LOW_CONFIDENCE_ATTEMPTS answers: show it, but mark it. */
  lowConfidence: boolean;
  /** Lower end of the Wilson interval, 0 with no attempts. */
  lowerBound: number;
}

export interface StudyRecommendation {
  skillCode: string;
  skill: string;
  domain: string;
  section: Section;
  /** 0 to 1, higher means sooner. */
  priority: number;
  attempts: number;
  correct: number;
  unseenLive: number;
  bankLive: number;
  /** Plain-language reasons, for example "low accuracy over 24 attempts". */
  reasons: string[];
}

// ---- Props contracts. Screens are thin: all data arrives through these props. ----

export interface AnalyticsFilterBarProps {
  filter: AnalyticsFilter;
  onChange: (filter: AnalyticsFilter) => void;
  /** Hide the section select where the screen shows both sections side by side. */
  showSection?: boolean;
}

export interface AnalyticsShellProps {
  /** Id of the open tab. */
  tab: AnalyticsTab;
  onTab: (tab: AnalyticsTab) => void;
  filter: AnalyticsFilter;
  onFilter: (filter: AnalyticsFilter) => void;
  onBack: () => void;
  children: ReactNode;
}

export type AnalyticsTab = 'overview' | 'skills' | 'timing' | 'behavior' | 'tests' | 'study';
export const ANALYTICS_TABS: readonly { id: AnalyticsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'skills', label: 'Skills' },
  { id: 'timing', label: 'Timing and pacing' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'tests', label: 'Test history' },
  { id: 'study', label: 'Study next' },
];

export interface OverviewScreenProps {
  summary: OverviewSummary;
  /** Latest finished tests, newest first, for the estimate cards. */
  latestTests: readonly TestHistoryRow[];
}

export interface SkillsScreenProps {
  summary: SkillsSummary;
  /** Loads the detail for the open skill. Rejects with a readable message. */
  loadDetail: (skillCode: string) => Promise<SkillDetail>;
  /** Loads a question's content for a missed-question row (rationale included). Null if gone from the bank. */
  loadQuestion: (questionId: string) => Promise<import('./sat').Question | null>;
}

export interface TimingScreenProps {
  summary: TimingSummary;
  /** Name of a skill from its code ("Unknown skill" when the code is not in the bank). */
  skillName: (skillCode: string) => string;
}

export interface BehaviorScreenProps {
  summary: BehaviorSummary;
}

export interface TestHistoryScreenProps {
  history: TestHistory;
}

/** A drill on the top-ranked skills of one section. */
export interface TopSkillsDrill {
  section: Section;
  skills: StudyRecommendation[];
  config: DrillConfig;
}

/** A misses-first review drill for one section. */
export interface MissesDrill {
  section: Section;
  /** Missed questions available in this section. */
  available: number;
  config: DrillConfig;
}

export interface StudyNextScreenProps {
  /** Ranked, best first. */
  recommendations: readonly StudyRecommendation[];
  /** The one-line explanation of the method and its parameters, shown on screen. */
  methodNote: string;
  /** One entry per section that has a recommendation. */
  topDrills: readonly TopSkillsDrill[];
  /** One entry per section that has missed questions. Empty when nothing was missed. */
  missDrills: readonly MissesDrill[];
  /** Starts a drill with this config. The flow runs it through the normal drill start. */
  onLaunch: (config: DrillConfig) => void;
}
