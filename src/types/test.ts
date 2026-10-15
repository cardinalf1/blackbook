// A full practice test (Phase 4): a sequence of exam modules with routing and a break between
// sections. The test is stored as a "container" session (mode 'exam', no questions of its own) whose
// `test` field holds this state; each module is an ordinary exam session linked by `exam.testId`.
// Records hold ids, answers and numbers only, never question content.

import type { ExamPause } from './exam';
import type { Section } from './sat';
import type { BreakdownRow, SessionReport } from './session';

export type TestKind = 'full' | 'rw' | 'math';
export type ModuleKey = 'rw1' | 'rw2' | 'math1' | 'math2';
export type Route = 'easier' | 'harder';

export type TestStep = { type: 'module'; key: ModuleKey } | { type: 'break' };

/** One module of the test: what it is, which questions it holds, and its session once started. */
export interface TestModuleSlot {
  key: ModuleKey;
  section: Section;
  moduleNumber: 1 | 2;
  tier: 'routing' | Route;
  /** Fixed when the slot is assembled (module 1 at the start, module 2 at routing time). */
  questionIds: string[];
  notes: string[];
  /** Null until the user starts the module. */
  sessionId: string | null;
}

/** The routing decision after module 1 of a section. Stored with the config version in force. */
export interface RoutingDecision {
  section: Section;
  /** Difficulty-weighted share of module 1 answered correctly, 0 to 1. */
  weightedFraction: number;
  threshold: number;
  correct: number;
  total: number;
  route: Route;
  configVersion: number;
  at: number;
}

export interface TestBreak {
  startedAt: number;
  durationMs: number;
  /** Absolute deadline: the countdown always derives from this. */
  deadlineAt: number;
  /** Null while running. */
  endedAt: number | null;
  endedEarly: boolean;
}

export interface SectionEstimate {
  section: Section;
  route: Route;
  /** Difficulty-weighted share correct over both modules, 0 to 1. */
  weightedFraction: number;
  /** Rounded to 10. */
  low: number;
  high: number;
  /** Shown small next to the range. */
  mid: number;
  /** True when the easier-route cap shortened the top of the range. */
  capped: boolean;
  answered: number;
  total: number;
}

export interface ScoreEstimate {
  /** Version of src/config/scoringConfig.ts the numbers were computed with. */
  configVersion: number;
  sections: SectionEstimate[];
  /** Null unless both sections were taken. */
  total: { low: number; high: number; mid: number } | null;
}

export type TestStatus = 'in_progress' | 'finished' | 'abandoned';

export interface TestState {
  kind: TestKind;
  /** Planned order, e.g. rw1, rw2, break, math1, math2. */
  steps: TestStep[];
  /** Index into `steps` of the step the user is on; steps.length once the test is over. */
  stepIndex: number;
  /** Slots by module key. A slot exists once it has been assembled. */
  slots: Partial<Record<ModuleKey, TestModuleSlot>>;
  routing: RoutingDecision[];
  break: TestBreak | null;
  /** Seen questions may be used when the pool of unseen ones is too thin. Chosen on the setup screen. */
  includeSeen: boolean;
  /** Any emergency pause in any module marks the whole test, for good. */
  paused: boolean;
  estimate: ScoreEstimate | null;
  /** Config version in force when the test started. */
  configVersion: number;
}

/** Preflight result for one section: can every module be built from unseen questions? */
export interface SectionPreflight {
  section: Section;
  /** Unseen live questions that can fill module 1 / the easier module 2 / the harder module 2. */
  unseenOk: boolean;
  /** Same with seen questions allowed. */
  anyOk: boolean;
  /** Plain-language lines for the setup screen. Empty when everything is fine. */
  shortfalls: string[];
}

export interface TestPreflight {
  sections: SectionPreflight[];
  /** True when every section can be built from unseen questions alone. */
  allUnseen: boolean;
  /** True when every section can be built at all if seen questions are allowed. */
  allPossible: boolean;
}

// ---- The report for a finished test (built by src/services/test/report.ts) ----

export interface TestModuleReport {
  key: ModuleKey;
  section: Section;
  moduleNumber: 1 | 2;
  tier: 'routing' | Route;
  /** For example "Section 1, Module 2: Reading and Writing". */
  title: string;
  correct: number;
  total: number;
  /** Time on the clock used, and what was left when the module ended. */
  timeUsedMs: number;
  timeLimitMs: number;
  timeLeftMs: number;
  submittedBy: 'user' | 'timer';
  pauses: ExamPause[];
  /** Items, rationales, per-question time and flags for this module. */
  report: SessionReport;
}

export interface TestSectionReport {
  section: Section;
  /** Null when the section was not routed (module 1 not finished). */
  routing: RoutingDecision | null;
  modules: TestModuleReport[];
  estimate: SectionEstimate | null;
  /** Both modules added together. */
  byDomain: BreakdownRow[];
  bySkill: BreakdownRow[];
}

export interface TestReport {
  testId: string;
  kind: TestKind;
  startedAt: number;
  finishedAt: number | null;
  /** Any emergency pause in any module. */
  paused: boolean;
  estimate: ScoreEstimate | null;
  sections: TestSectionReport[];
  break: TestBreak | null;
}

// ---- Props contracts. Screens are thin: all logic arrives through these props. ----

export interface TestSetupProps {
  kind: TestKind;
  onKindChange: (kind: TestKind) => void;
  /** Null while the check runs. */
  preflight: TestPreflight | null;
  includeSeen: boolean;
  onIncludeSeenChange: (include: boolean) => void;
  /** True while the test is being built. */
  busy: boolean;
  /** Shown in a red banner. */
  error: string | null;
  onStart: () => void;
  onCancel: () => void;
}

export interface BreakScreenProps {
  /** Milliseconds left, already computed from the saved deadline. */
  remainingMs: number;
  durationMs: number;
  /** For example "Section 2, Module 1: Math". */
  nextTitle: string;
  /** Ends the break now. */
  onEnd: () => void;
  busy: boolean;
}

/** Shown between modules (and when a started module is reopened): the next module is ready, its clock has not started. */
export interface ModuleReadyProps {
  title: string;
  questionCount: number;
  timeLimitMs: number;
  /** For example "Routed to the harder Module 2". Null before module 2. */
  routeNote: string | null;
  /** True when the module was started before and is being reopened: its clock is already running. */
  resuming: boolean;
  /** Plain-language assembly notes, if any. */
  notes: readonly string[];
  onStart: () => void;
  onLeave: () => void;
  busy: boolean;
}

export interface TestReportProps {
  report: TestReport;
  onItemToggle: (questionId: string, open: boolean) => void;
  onBack: () => void;
  onMySkills: () => void;
}
