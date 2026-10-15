// Sessions, attempts and telemetry from Phase 2c on. A session is one drill run (later also one
// exam module). Feedback is deferred: nothing about correctness reaches the screen until the
// session is finished. Records hold question ids only, never question content.

import type { ReactNode } from 'react';
import type { DrillConfig } from './drill';
import type { ExamState } from './exam';
import type { TestState } from './test';
import type { ChoiceLetter, Difficulty, Question, Section } from './sat';

export type SessionMode = 'drill' | 'exam';
/** Where a session was started: a drill setup, one question picked in Browse, or an exam module. */
export type SessionSource = 'drill' | 'browse' | 'exam';
export type SessionStatus = 'in_progress' | 'finished' | 'abandoned';
export type Confidence = 'guess' | 'unsure' | 'sure';
export const CONFIDENCE_LEVELS: readonly Confidence[] = ['guess', 'unsure', 'sure'];

export const SESSION_RECORD_VERSION = 3;

/** Where the user is on one question of a session. */
export interface QuestionProgress {
  /** Current answer: a choice letter or the typed text. Null when unanswered or cleared. */
  response: string | null;
  /** How many times an existing answer was replaced or cleared. The first pick is not a change. */
  changes: number;
  /** Time with this question on screen and the tab visible, all visits added up. */
  activeMs: number;
  /** Active time of the first visit only. Null until the user first leaves the question. */
  firstVisitMs: number | null;
  visits: number;
  struck: ChoiceLetter[];
  flagged: boolean;
  /** Only when the session asks for confidence. Reset when the answer changes. */
  confidence: Confidence | null;
}

export interface SessionScore {
  correct: number;
  /** Every question in the session, answered or not. */
  total: number;
}

export interface SessionRecord {
  version: typeof SESSION_RECORD_VERSION;
  id: string;
  mode: SessionMode;
  source: SessionSource;
  /** The filters the session was built from. */
  config: DrillConfig;
  /** Question ids in the order asked. Fixed when the session starts. */
  queueIds: string[];
  /** Index of the question on screen. */
  index: number;
  status: SessionStatus;
  startedAt: number;
  finishedAt: number | null;
  /** Wall-clock time of the last change, for the in-progress list. */
  lastActivityAt: number;
  progress: Record<string, QuestionProgress>;
  /** Set when the session is finished. */
  score: SessionScore | null;
  /** Sum of every question's activeMs. */
  totalActiveMs: number;
  /** Show the guess / unsure / sure control after each answer. Drill only. */
  askConfidence: boolean;
  /** Exam modules only (mode 'exam'): timer, pauses, phase. */
  exam?: ExamState;
  /**
   * Full test or section run (Phase 4): this record is the container. It has no questions of its
   * own (mode 'exam', empty queueIds); its modules are exam sessions with `exam.testId` set to its id.
   */
  test?: TestState;
}

/**
 * One answer, as stored. A draft is written on every change; Next or Finish makes it final.
 * Only final attempts in finished sessions count toward statistics.
 */
export interface StoredAttempt {
  /** `${sessionId}:${questionId}`. One per question per session. */
  id: string;
  sessionId: string;
  questionId: string;
  mode: SessionMode;
  status: 'draft' | 'final';
  /** Empty when the answer was cleared. */
  response: string;
  /** Graded on the device when written, never shown before the session is finished. */
  correct: boolean;
  /** Total active time on the question so far. */
  timeMs: number;
  firstVisitMs: number | null;
  changes: number;
  confidence: Confidence | null;
  /** Epoch ms of the last write. */
  at: number;
}

// ---- Telemetry ----

/** Every event type. Payload shapes are in docs/telemetry.md and EventPayloads below. */
export interface EventPayloads {
  session_started: { count: number; askConfidence: boolean };
  session_finished: { correct: number; total: number; totalActiveMs: number };
  session_abandoned: { answered: number };
  session_resumed: { index: number };
  question_shown: { index: number; visit: number };
  question_hidden: { index: number; visitActiveMs: number; reason: HideReason };
  first_interaction: { sinceShownMs: number; kind: InteractionKind };
  choice_selected: { choice: ChoiceLetter };
  choice_changed: { from: ChoiceLetter; to: ChoiceLetter };
  choice_cleared: { from: ChoiceLetter };
  choice_struck: { choice: ChoiceLetter };
  strike_removed: { choice: ChoiceLetter };
  spr_changed: { value: string };
  spr_cleared: Record<string, never>;
  flag_set: Record<string, never>;
  flag_removed: Record<string, never>;
  nav_back: { from: number };
  nav_next: { from: number };
  nav_jump: { from: number; to: number };
  finish_clicked: { unanswered: number; flagged: number };
  finish_cancelled: Record<string, never>;
  tab_hidden: Record<string, never>;
  tab_visible: Record<string, never>;
  window_blur: Record<string, never>;
  window_focus: Record<string, never>;
  /** Logged when 30 s pass with no input. */
  idle_start: { thresholdMs: number };
  /** `idleMs` counts from the last input, so it includes the threshold. */
  idle_end: { idleMs: number };
  confidence_rated: { rating: Confidence };
  report_opened: Record<string, never>;
  rationale_viewed: Record<string, never>;
  report_item_time: { dwellMs: number };
  // Reserved for the exam shell (Phase 3).
  timer_hidden: Record<string, never>;
  timer_shown: Record<string, never>;
  five_minute_alert_shown: Record<string, never>;
  exam_paused: { reason: string };
  exam_resumed: { pausedMs: number };
  reference_opened: Record<string, never>;
  reference_closed: Record<string, never>;
  navigator_opened: Record<string, never>;
  navigator_closed: Record<string, never>;
  // Full tests and section runs (Phase 4). Logged on the container session, never during a module's clock.
  test_started: { kind: string; includeSeen: boolean; allowRepeats?: boolean };
  test_module_started: { key: string; tier: string };
  test_module_submitted: { key: string; by: string };
  test_routed: { section: string; route: string; weightedFraction: number; threshold: number; configVersion: number };
  test_break_started: { durationMs: number };
  test_break_ended: { early: boolean; usedMs: number };
  test_finished: { kind: string; paused: boolean };
  test_abandoned: Record<string, never>;
}

export type EventType = keyof EventPayloads;
export type HideReason = 'next' | 'back' | 'jump' | 'finish' | 'exit' | 'unload' | 'review' | 'pause';
export type InteractionKind = 'select' | 'strike' | 'flag' | 'type' | 'confidence';

/** One row of the append-only event log. */
export interface EventRecord<T extends EventType = EventType> {
  /** Made on the device, so a resend after a failed flush never duplicates a row. */
  id: string;
  sessionId: string;
  mode: SessionMode;
  questionId: string | null;
  type: T;
  /** Wall clock, epoch ms. */
  ts: number;
  /** performance.now() when logged. Monotonic within one page load only (see pageId). */
  monoMs: number;
  /** Random per page load, so monoMs is comparable only within the same pageId. */
  pageId: string;
  /** Order within the page load. */
  seq: number;
  payload: EventPayloads[T];
}

export interface TelemetryStats {
  events: number;
  /** Approximate bytes the event rows take in the database. */
  eventBytes: number;
  sessions: number;
  attempts: number;
}

/** Everything "Export my data" writes. Ids, answers and timings only, no question content. */
export interface UserDataExport {
  app: 'blackbook';
  exportedAt: string;
  schemaVersion: number;
  sessions: SessionRecord[];
  attempts: StoredAttempt[];
  events: EventRecord[];
}

// ---- Report ----

export interface ReportItem {
  /** 0-based position in the session. */
  index: number;
  questionId: string;
  displayId: string;
  section: Section;
  domain: string;
  skill: string;
  difficulty: Difficulty;
  /** Null when left unanswered. */
  response: string | null;
  correct: boolean;
  /** Choice letter, or every accepted answer joined with ", ". */
  correctAnswer: string;
  activeMs: number;
  firstVisitMs: number | null;
  flagged: boolean;
  changes: number;
  confidence: Confidence | null;
  /** For showing the question, choices and rationale. Null if it is no longer in the bank. */
  question: Question | null;
}

export interface BreakdownRow {
  /** Domain or skill code. */
  code: string;
  label: string;
  correct: number;
  total: number;
  activeMs: number;
}

export interface SessionReport {
  sessionId: string;
  mode: SessionMode;
  startedAt: number;
  finishedAt: number | null;
  score: SessionScore;
  totalActiveMs: number;
  items: ReportItem[];
  byDomain: BreakdownRow[];
  bySkill: BreakdownRow[];
}

/** A row in the Past drills list. Labels are already worded for display. */
export interface PastSessionRow {
  id: string;
  finishedAt: number;
  /** "Reading and Writing" or "Math". */
  sectionLabel: string;
  /** For example "Algebra · 2 skills · Hard · live only". */
  filtersLabel: string;
  /** "Drill" now; "Exam module" and "Single question" later. */
  kindLabel: string;
  correct: number;
  total: number;
  totalActiveMs: number;
  /** A full test or section run: opens the test report instead of a drill report. */
  isTest?: boolean;
}

// ---- Props contracts. Screens are thin: all logic arrives through these props. ----

export interface DrillPlayProps {
  question: Question;
  /** 0-based. */
  index: number;
  total: number;
  /** Current answer. Null when unanswered. */
  response: string | null;
  /** A choice letter, or the typed text for a student-produced response. '' clears the answer. */
  onSelect: (response: string) => void;
  struck: readonly ChoiceLetter[];
  onStrike: (letter: ChoiceLetter) => void;
  flagged: boolean;
  onToggleFlag: () => void;
  askConfidence: boolean;
  confidence: Confidence | null;
  onRate: (rating: Confidence) => void;
  onBack: () => void;
  /** On the last question this is Finish. */
  onNext: () => void;
  /** Label on the last question's button. Defaults to "Finish"; "Done" for a single question. */
  finishLabel?: string;
  /** True while an answer is being saved: navigation buttons are disabled. */
  saving: boolean;
  /** Shown in a red banner with a Retry button. Navigation stays disabled while it is set. */
  saveError: string | null;
  onRetry: () => void;
  onExit: () => void;
}

export interface FinishConfirmProps {
  /** 1-based question numbers. */
  unanswered: readonly number[];
  flagged: readonly number[];
  /** Jump to a question (1-based number) instead of finishing. */
  onGoTo: (number: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  /** True while the finish is being saved. */
  busy: boolean;
}

export interface DrillReportProps {
  report: SessionReport;
  /** An item was expanded (its rationale is now visible) or collapsed. */
  onItemToggle: (questionId: string, open: boolean) => void;
  onBack: () => void;
  /** Label for the back button, e.g. "Done" after a drill or "Back to past drills". */
  backLabel: string;
  /** Heading of the report. Defaults to "Drill report". */
  heading?: string;
  onMySkills: () => void;
}

export interface PastDrillsProps {
  /** Newest first. */
  rows: readonly PastSessionRow[];
  /** The In progress list, shown above the finished sessions when given. */
  inProgressSlot?: ReactNode;
  onOpen: (sessionId: string) => void;
  onBack: () => void;
}

/** A row in the In progress list. Labels are already worded for display. */
export interface InProgressRow {
  id: string;
  /** "Drill", "Single question" or "Exam module". */
  kindLabel: string;
  sectionLabel: string;
  filtersLabel: string;
  answered: number;
  total: number;
  /** Active time so far. */
  activeMs: number;
  /** Epoch ms of the last change. */
  lastActivityAt: number;
  /** Replaces "X of Y answered" when set, e.g. for a full test: "Module 2 of 4". */
  progressLabel?: string;
  /** A full test or section run: Resume opens the test, Discard abandons the test and its open module. */
  isTest?: boolean;
}

export interface InProgressListProps {
  /** Newest activity first. When empty the list renders nothing at all. */
  rows: readonly InProgressRow[];
  onResume: (sessionId: string) => void;
  /** Called only after the user confirms. Resolves when done, rejects with a readable message. */
  onDiscard: (sessionId: string) => Promise<void>;
}

export interface DataPageProps {
  stats: TelemetryStats | null;
  /** Shown instead of the stats when they could not be read. */
  statsError: string | null;
  /** Each resolves when done or rejects with a readable message. */
  onExport: () => Promise<void>;
  onDeleteTelemetry: () => Promise<void>;
  onDeleteAll: () => Promise<void>;
  onBack: () => void;
}
