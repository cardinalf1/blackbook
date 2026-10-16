// The exam module (Phase 3): one timed module end to end. Built so Phase 4 can chain four of them
// (module number and tier are already part of the spec). Numbers come from src/config/examConfig.ts.

import type { Section } from './sat';
import type { SessionReport } from './session';

/** Which module this is. Module 1 is 'routing'; module 2 is 'easier' or 'harder' (Phase 4). */
export interface ExamModuleSpec {
  section: Section;
  moduleNumber: 1 | 2;
  tier: 'routing' | 'easier' | 'harder';
}

/**
 * The clock. Remaining time always derives from an absolute deadline, never from counted ticks,
 * so it stays right in a hidden tab, after sleep and after a reload.
 */
export interface ExamTimer {
  durationMs: number;
  /** Epoch ms when time runs out. Null while paused. */
  deadlineAt: number | null;
  /** Time left when the clock was paused. Null while running. */
  pausedRemainingMs: number | null;
}

export interface ExamPause {
  /** Epoch ms. */
  at: number;
  reason: string;
  resumedAt: number | null;
}

/** in_progress: answering. review: the review page before submitting. submitted: closed for good. */
export type ExamPhase = 'in_progress' | 'review' | 'submitted';

/** Exam-only part of a session record (mode 'exam'). */
export interface ExamState {
  module: ExamModuleSpec;
  timer: ExamTimer;
  /** Every emergency pause. Any pause marks the result as paused, permanently. */
  pauses: ExamPause[];
  phase: ExamPhase;
  submittedBy: 'user' | 'timer' | null;
  timerHidden: boolean;
  fiveMinuteAlertShown: boolean;
  /** Plain-language notes from assembly, e.g. a domain short of questions. */
  assemblyNotes: string[];
  /** Set when this module belongs to a full test or section run (Phase 4): the id of its container session. */
  testId?: string;
}

/** What assembly produced, shown on the setup screen before starting. */
export interface AssembledModule {
  spec: ExamModuleSpec;
  questionIds: string[];
  /** Shortfalls and other notes, in plain language. Empty when the module is complete. */
  notes: string[];
  /** Planned and actual count per domain, for the setup screen. */
  domains: { code: string; label: string; planned: number; actual: number }[];
  /** How many picked questions were unseen, seen but not done, or done before. */
  freshness: { fresh: number; soft: number; consumed: number };
}

// ---- Props contracts. Screens are thin: all logic arrives through these props. ----

export interface NavigatorItem {
  /** 1-based. */
  number: number;
  answered: boolean;
  flagged: boolean;
}

export interface FiveMinuteAlertProps {
  onDismiss: () => void;
}

export interface PauseDialogProps {
  /** 'confirm': choose a reason first. 'paused': the clock is stopped and the questions are hidden. */
  mode: 'confirm' | 'paused';
  reasons: readonly string[];
  /** Called with the chosen reason. */
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  onResume: () => void;
  /** Time left on the stopped clock, for the paused screen. */
  remainingMs: number;
}

export interface SprInputProps {
  value: string;
  /** Only called with values that pass the input rules (see examConfig). */
  onChange: (value: string) => void;
  /** For the label: "Answer for question 7". */
  questionNumber: number;
}

export interface ExamResultsProps {
  title: string;
  report: SessionReport;
  submittedBy: 'user' | 'timer';
  pauses: readonly ExamPause[];
  /** Time on the clock used, ms (limit minus what was left). */
  timeUsedMs: number;
  timeLimitMs: number;
  onItemToggle: (questionId: string, open: boolean) => void;
  onBack: () => void;
  onMySkills: () => void;
}
