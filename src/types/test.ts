// A full practice test (Phase 4): a sequence of exam modules with routing and a break between
// sections. The test is stored as a "container" session (mode 'exam', no questions of its own) whose
// `test` field holds this state; each module is an ordinary exam session linked by `exam.testId`.
// Records hold ids, answers and numbers only, never question content.

import type { Section } from './sat';

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
