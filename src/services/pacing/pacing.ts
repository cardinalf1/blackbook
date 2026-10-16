// Pacing for the reports and the optional live hint in drills. Pure: a finished session's report
// and its time limit come in. Exam timers are not touched; this only reads what was recorded.
//
// Times are the active time per question (tab visible), the same figure the attempts store. The
// checkpoints and the last five minutes are worked out from those times in the order the
// questions were asked, which is exact for a drill answered in order and an approximation when
// you jumped around in an exam module (the report says so).

import { LIVE_HINT_BEHIND_MS, OVER_TARGET_SLACK, PACE_CHECKPOINTS, PACE_TARGET_MS } from '../../config/paceConfig';
import { FIVE_MINUTE_ALERT_MS } from '../../config/examConfig';
import type { Section } from '../../types/sat';
import type { SessionReport } from '../../types/session';

export interface QuestionPace {
  index: number;
  questionId: string;
  displayId: string;
  activeMs: number;
  targetMs: number;
  /** activeMs / targetMs. */
  ratio: number;
  over: boolean;
  correct: boolean;
}

export interface Checkpoint {
  /** Share of the time budget, e.g. 0.5. */
  at: number;
  /** Questions finished by then, and how many the pace target expects. */
  done: number;
  expected: number;
}

export interface ReportPacing {
  section: Section;
  targetMs: number;
  /** The time budget the checkpoints use: the module's limit, or questions x target. */
  budgetMs: number;
  totalMs: number;
  questions: QuestionPace[];
  overTarget: QuestionPace[];
  checkpoints: Checkpoint[];
  /** Only when there is a time limit: the questions you reached in its last five minutes. Null otherwise. */
  lastFive: { questions: number; correct: number; timeMs: number } | null;
  /** True when the order-based figures are an approximation (an exam module, where you can jump around). */
  approximate: boolean;
}

export function reportPacing(report: SessionReport, section: Section, timeLimitMs: number | null): ReportPacing {
  const targetMs = PACE_TARGET_MS[section];
  const questions: QuestionPace[] = report.items.map((it) => {
    const ratio = it.activeMs / targetMs;
    return { index: it.index, questionId: it.questionId, displayId: it.displayId, activeMs: it.activeMs, targetMs, ratio, over: ratio > 1 + OVER_TARGET_SLACK, correct: it.correct };
  });
  const budgetMs = timeLimitMs ?? targetMs * questions.length;
  const starts: number[] = [];
  let t = 0;
  for (const q of questions) {
    starts.push(t);
    t += q.activeMs;
  }
  const checkpoints = PACE_CHECKPOINTS.map((at) => {
    const cut = budgetMs * at;
    const done = questions.filter((q, i) => (starts[i] as number) + q.activeMs <= cut).length;
    return { at, done, expected: Math.floor((cut / budgetMs) * questions.length) };
  });
  let lastFive: ReportPacing['lastFive'] = null;
  if (timeLimitMs !== null) {
    const from = Math.max(0, timeLimitMs - FIVE_MINUTE_ALERT_MS);
    const reached = questions.filter((q, i) => (starts[i] as number) + q.activeMs > from && (starts[i] as number) < timeLimitMs);
    lastFive = { questions: reached.length, correct: reached.filter((q) => q.correct).length, timeMs: reached.reduce((s, q) => s + q.activeMs, 0) };
  }
  return {
    section,
    targetMs,
    budgetMs,
    totalMs: t,
    questions,
    overTarget: questions.filter((q) => q.over).sort((a, b) => b.ratio - a.ratio),
    checkpoints,
    lastFive,
    approximate: report.mode === 'exam',
  };
}

export type PaceStatus = 'ahead' | 'on_pace' | 'behind';

export interface LiveHint {
  status: PaceStatus;
  /** Questions the target expects done by now. */
  expected: number;
  /** Positive when behind. */
  behindMs: number;
}

/** The optional drill hint (off by default; never shown in exam mode). */
export function liveHint(section: Section, elapsedActiveMs: number, finished: number): LiveHint {
  const target = PACE_TARGET_MS[section];
  const behindMs = elapsedActiveMs - finished * target;
  const expected = Math.floor(elapsedActiveMs / target);
  const status: PaceStatus = behindMs > LIVE_HINT_BEHIND_MS ? 'behind' : behindMs < -target ? 'ahead' : 'on_pace';
  return { status, expected, behindMs };
}
