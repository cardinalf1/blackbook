// The merged Dashboard (Phase 8): one page that replaces Analytics, My skills, Study next and the
// Study report entry points. The local program builds the whole page in one request
// (GET /api/dashboard) from the existing analytics summaries, so nothing is computed twice.
// Counts and sums only, like the analytics summaries: screens derive rates. Every figure carries
// its sample size. Drill and exam stay separate where the old screens kept them separate.

import type { CoachAction, ReportLine, ResultOrigin } from './ai';
import type {
  AnalyticsFilter,
  AnalyticsKind,
  BehaviorCounts,
  ByMode,
  ModulePacing,
  OverviewSummary,
  TestHistoryRow,
} from './analytics';
import type { DrillConfig, PresetId } from './drill';
import type { MistakeReason } from './mistakes';
import type { Section } from './sat';

// ---- Scope ----

/** The segmented control. 'auto' means 30 days, or all time when there is less than 30 days of data. */
export type ScopePreset = 'last_test' | '7d' | '30d' | 'all';
export const SCOPE_PRESETS: readonly { id: ScopePreset; label: string }[] = [
  { id: 'last_test', label: 'Last test' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All time' },
];

export type ScopeSection = 'both' | Section;
export const SCOPE_SECTIONS: readonly { id: ScopeSection; label: string }[] = [
  { id: 'both', label: 'Both' },
  { id: 'rw', label: 'Reading and Writing' },
  { id: 'math', label: 'Math' },
];

/** What the user picked. The "More filters" fields are the old analytics filter fields. */
export interface DashboardScope {
  preset: ScopePreset | 'auto';
  section: ScopeSection;
  /** A custom date range (epoch ms, inclusive) replaces the preset when either end is set. */
  from: number | null;
  to: number | null;
  kind: AnalyticsKind;
  excludePaused: boolean;
  excludeSingle: boolean;
  includeHidden: boolean;
}

export const DEFAULT_DASHBOARD_SCOPE: DashboardScope = {
  preset: 'auto',
  section: 'both',
  from: null,
  to: null,
  kind: 'all',
  excludePaused: false,
  excludeSingle: false,
  includeHidden: false,
};

/** The scope as the server applied it. */
export interface ResolvedScope {
  /** The preset in force ('auto' resolved), or 'custom' for a date range. */
  preset: ScopePreset | 'custom';
  /** The analytics filter every section of the page used. */
  filter: AnalyticsFilter;
  /** The previous period of equal length, for changes; null for all time and last test. */
  previous: AnalyticsFilter | null;
  /** Plain words, e.g. "Last 30 days" or "Test of Oct 15". */
  label: string;
  /** Calendar days between your first and latest finished session (0 with none). */
  dataDays: number;
}

// ---- Coach ----

export interface CoachSection {
  /** Rule-based lines (at most 3). The screen may replace them with AI-assisted ones from aiStore.coach. */
  lines: ReportLine[];
  origin: ResultOrigin;
  /** True when a key is set and AI is on, so the screen may ask aiStore.coach for AI wording. */
  aiAvailable: boolean;
  /**
   * Set when there is too little data for insights: "Do N more drills to unlock this", with the
   * action. When set, `lines` is empty. The coach card is never empty.
   */
  unlock: { drillsNeeded: number; action: CoachAction } | null;
  /** Set when there is data overall but nothing in this scope. */
  emptyScope: { message: string; action: CoachAction } | null;
}

// ---- Numbers row ----

/** A count pair with the same pair for the previous equal period, when both have enough data. */
export interface KpiRate {
  correct: number;
  attempts: number;
  /** Null when there is no previous period or either side is below its minimum. Show "not enough data". */
  previous: { correct: number; attempts: number } | null;
}

export interface NumbersRow {
  /** Latest finished full test with an estimate (any date). Always labeled "approximation". */
  estimate: { testId: string; finishedAt: number; low: number; high: number; configVersion: number } | null;
  /** First attempts in scope (retries never count). */
  firstAttempt: KpiRate;
  /** Questions answered at least once and questions seen (all time), out of the bank. Hidden sessions still count (you saw them). */
  questionsDone: { done: number; seen: number; total: number; live: number };
  /** Fresh full tests left (estimate from simulated assembly). Null when it could not be computed. */
  freshTests: { full: number; rw: number; math: number; capped: boolean } | null;
  /** Active study time in the 7 days up to now, and the 7 days before, whatever the scope. */
  studyWeek: { activeMs: number; previousMs: number | null; sessions: number };
  /** Average active time per answer against the target pace, per section, in scope. */
  pace: { section: Section; attempts: number; timeMs: number; targetMs: number; previous: { attempts: number; timeMs: number } | null }[];
}

// ---- Trends ----

export interface Trends {
  /** First-attempt accuracy per day and kind of session (drill or exam), oldest first. */
  accuracy: OverviewSummary['daily'];
  /** Answers and active time per day, mode and section, oldest first. */
  pace: OverviewSummary['dailyPace'];
  targetMs: Record<Section, number>;
  /** Below this many answers a point is drawn hollow. */
  hollowBelow: number;
  /** Below this many points a table replaces the line. */
  tableBelowPoints: number;
}

// ---- Skills map ----

export interface SkillMapRow {
  skillCode: string;
  skill: string;
  /** Pooled drill and exam first attempts: the study-priority basis, the same as Study next. */
  attempts: number;
  correct: number;
  /** Wilson interval (80%), 0 to 1. Both 0 with no attempts. */
  low: number;
  high: number;
  /** Study priority from Study next, 0 to 1, higher means study sooner. */
  priority: number;
  counts: ByMode<{ attempts: number; correct: number; timeMs: number }>;
  unseenLive: number;
  bankLive: number;
}

export interface DomainMapRow {
  section: Section;
  domainCode: string;
  domain: string;
  /** Official share of the section (docs/exam-spec.md), 0 to 1, or null when unknown for this code. */
  officialWeight: number | null;
  /** This domain's share of your answering time within its section in scope, 0 to 1, or null with no time. */
  practiceShare: number | null;
  timeMs: number;
  attempts: number;
  correct: number;
  /** Sorted by study priority, highest first. */
  skills: SkillMapRow[];
}

// ---- Mistakes ----

export interface MistakesSection {
  /** From your own tags only, the tag in force per question, in scope. */
  reasons: Partial<Record<MistakeReason, number>>;
  tagged: number;
  /** Misses (wrong answers) in scope, so "tagged of misses" can be shown. */
  misses: number;
  /** Tag counts per ISO week (Monday, YYYY-MM-DD) and reason, oldest first. */
  reasonsTrend: { week: string; reason: MistakeReason; count: number }[];
  /** The latest finished session with untagged misses, for the "tag them" prompt. */
  untaggedLast: { sessionId: string; untagged: number; finishedAt: number } | null;
  retry: { due: number; queued: number; answered: number; correct: number };
  /** Clean-set figures for the 800 modes, all time. Only presets with at least one set. */
  slips800: { preset: PresetId; title: string; sets: number; cleanSets: number; cleanStreak: number; slipsPerSet: number; untagged: number }[];
  /** Review-misses drill configs per section (the old Study next buttons). */
  reviewDrills: { section: Section; available: number; config: DrillConfig }[];
}

// ---- Habits ----

export interface HabitsSection {
  behavior: ByMode<BehaviorCounts>;
  /** Wrong answers much faster than your baseline, and answers much slower. */
  flagged: { rushedWrong: ByMode<number>; stuck: ByMode<number> };
  /** Answers in scope, the denominator for rushed and stuck. */
  answered: ByMode<number>;
  lastFive: { modules: number; reached: number; answeredInLastFive: number; questions: number };
  /** Exam modules in scope, newest first (for the drill-down). */
  modules: ModulePacing[];
  /** Below this a figure is marked "thin data". */
  thinBelow: number;
}

// ---- Whole page ----

export interface DashboardData {
  scope: ResolvedScope;
  coach: CoachSection;
  numbers: NumbersRow;
  trends: Trends;
  skills: { domains: DomainMapRow[]; methodNote: string; topDrills: { section: Section; skillCodes: string[]; config: DrillConfig }[] };
  mistakes: MistakesSection;
  habits: HabitsSection;
  /** Finished tests in scope, newest first. */
  tests: TestHistoryRow[];
  /** The one honest-limits sentence, shown once at the bottom. */
  limits: string;
  /** Server time to build the page, for the budget check. */
  buildMs: number;
}

/** UI code reaches the dashboard only through this (AGENTS.md rule 6). */
export interface DashboardStore {
  load(scope: DashboardScope): Promise<DashboardData>;
}

/** Where a "Detailed views" link or a drill-down goes. App maps these to screens. */
export type DashboardLink =
  | { to: 'skills' }
  | { to: 'skill'; skillCode: string }
  | { to: 'timing' }
  | { to: 'behavior' }
  | { to: 'tests' }
  | { to: 'test'; testId: string }
  | { to: 'study' }
  | { to: 'overview' }
  | { to: 'report' }
  | { to: 'mistakes' }
  | { to: 'past' };

/** Every action the dashboard can start. App owns the handlers. */
export interface DashboardActions {
  onAction: (action: CoachAction) => void;
  onLink: (link: DashboardLink) => void;
  /** Opens a session report to tag its misses. */
  onTagSession: (sessionId: string) => void;
}

// ---- Section props. Sections are thin: data arrives through these, actions go out. ----

export interface ScopeBarProps {
  scope: DashboardScope;
  resolved: ResolvedScope;
  onChange: (scope: DashboardScope) => void;
}

export interface CoachCardProps {
  coach: CoachSection;
  /** AI-assisted lines when they arrived; replaces coach.lines and changes the small label. */
  ai: { state: 'idle' | 'loading' | 'done' | 'failed'; lines: ReportLine[] | null };
  onAction: (action: CoachAction) => void;
}

export interface NumbersRowProps {
  numbers: NumbersRow;
}

export interface TrendsProps {
  trends: Trends;
}

export interface SkillsMapProps {
  skills: DashboardData['skills'];
  onSkill: (skillCode: string) => void;
  onAction: (action: CoachAction) => void;
}

export interface MistakesCardProps {
  mistakes: MistakesSection;
  onAction: (action: CoachAction) => void;
  onTagSession: (sessionId: string) => void;
  onLink: (link: DashboardLink) => void;
}

export interface HabitsCardProps {
  habits: HabitsSection;
}

export interface TestsTableProps {
  tests: readonly TestHistoryRow[];
  onOpenTest: (testId: string) => void;
}

export interface DetailLinksProps {
  links: readonly import('../services/home/routes').NavLink[];
  onOpen: (to: import('../services/home/routes').ScreenId) => void;
}

/** Ids of the sticky section index, in order. */
export const DASHBOARD_SECTIONS: readonly { id: string; label: string }[] = [
  { id: 'coach', label: 'Coach' },
  { id: 'numbers', label: 'Numbers' },
  { id: 'trends', label: 'Trends' },
  { id: 'skills', label: 'Skills' },
  { id: 'mistakes', label: 'Mistakes' },
  { id: 'habits', label: 'Habits' },
  { id: 'tests', label: 'Tests' },
];
