// Derived metrics from a session's event log. Pure and deterministic. These describe behavior
// (time, clicks, changes), not thinking; see docs/telemetry.md for every definition.
//
// Durations inside one page load use the monotonic clock (monoMs). A question visit never spans
// two page loads: one left open by a reload or crash is closed at that page's last event.

import type { ChoiceLetter } from '../../types/sat';
import type { Confidence, EventPayloads, EventRecord } from '../../types/session';

export interface Interval {
  start: number;
  end: number;
}

export interface QuestionMetrics {
  questionId: string;
  visits: number;
  /** Time on screen, tab visible or not. */
  wallMs: number;
  /** Wall time minus hidden-tab time. Same definition as an attempt's timeMs. */
  activeMs: number;
  hiddenMs: number;
  /** Part of active time inside idle periods (from the last input until input again). */
  idleMs: number;
  /** From the first time the question was shown to the first select, strike, flag, typing or rating. */
  timeToFirstInteractionMs: number | null;
  /** Every answer in order. '' marks a clear. */
  answerChain: string[];
  finalResponse: string | null;
  /** Replacing or clearing an existing answer. The first pick is not a change. */
  changes: number;
  /** Only counted between two non-empty answers, when a grader is given. */
  correctToIncorrect: number;
  incorrectToCorrect: number;
  /** Struck when the log ends. */
  struck: ChoiceLetter[];
  strikeActions: number;
  flagHistory: { flagged: boolean; ts: number }[];
  confidenceChain: Confidence[];
}

export interface Distribution {
  count: number;
  min: number;
  median: number;
  p90: number;
  max: number;
  mean: number;
}

export interface SessionMetrics {
  sessionId: string;
  /** In the order each question was first shown. */
  questions: QuestionMetrics[];
  totals: {
    wallMs: number;
    activeMs: number;
    hiddenMs: number;
    idleMs: number;
    changes: number;
    correctToIncorrect: number;
    incorrectToCorrect: number;
    pageLoads: number;
    events: number;
  };
  distributions: {
    activeMs: Distribution | null;
    timeToFirstInteractionMs: Distribution | null;
  };
}

export type Grader = (questionId: string, response: string) => boolean;

// ---- interval helpers ----

function overlap(a: Interval, b: Interval): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/** `base` minus every interval in `cut`, as disjoint pieces. */
export function subtract(base: Interval, cut: readonly Interval[]): Interval[] {
  let pieces: Interval[] = [base];
  for (const c of cut) {
    const next: Interval[] = [];
    for (const p of pieces) {
      if (c.end <= p.start || c.start >= p.end) next.push(p);
      else {
        if (c.start > p.start) next.push({ start: p.start, end: c.start });
        if (c.end < p.end) next.push({ start: c.end, end: p.end });
      }
    }
    pieces = next;
  }
  return pieces;
}

const sumOverlap = (pieces: readonly Interval[], others: readonly Interval[]) =>
  pieces.reduce((s, p) => s + others.reduce((t, o) => t + overlap(p, o), 0), 0);

export function distribution(values: readonly number[]): Distribution | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  const at = (q: number) => v[Math.min(v.length - 1, Math.floor(q * (v.length - 1) + 0.5))] as number;
  return { count: v.length, min: v[0] as number, median: at(0.5), p90: at(0.9), max: v[v.length - 1] as number, mean: v.reduce((s, x) => s + x, 0) / v.length };
}

const INTERACTIONS = new Set<EventRecord['type']>([
  'choice_selected',
  'choice_changed',
  'choice_cleared',
  'choice_struck',
  'strike_removed',
  'spr_changed',
  'spr_cleared',
  'flag_set',
  'flag_removed',
  'confidence_rated',
]);

const payload = <T extends EventRecord['type']>(e: EventRecord, _t: T) => e.payload as EventPayloads[T];

interface Acc {
  m: QuestionMetrics;
  firstShownAt: { pageId: string; mono: number } | null;
  firstInteractionDone: boolean;
}

function blank(questionId: string): Acc {
  return {
    m: {
      questionId,
      visits: 0,
      wallMs: 0,
      activeMs: 0,
      hiddenMs: 0,
      idleMs: 0,
      timeToFirstInteractionMs: null,
      answerChain: [],
      finalResponse: null,
      changes: 0,
      correctToIncorrect: 0,
      incorrectToCorrect: 0,
      struck: [],
      strikeActions: 0,
      flagHistory: [],
      confidenceChain: [],
    },
    firstShownAt: null,
    firstInteractionDone: false,
  };
}

export function sessionMetrics(sessionId: string, events: readonly EventRecord[], grade?: Grader): SessionMetrics {
  const own = events.filter((e) => e.sessionId === sessionId);

  // Group by page load, pages ordered by their first event, events in logged order.
  const pages = new Map<string, EventRecord[]>();
  for (const e of own) {
    const list = pages.get(e.pageId) ?? [];
    list.push(e);
    pages.set(e.pageId, list);
  }
  const ordered = [...pages.values()].map((list) => list.sort((a, b) => a.seq - b.seq));
  ordered.sort((a, b) => (a[0] as EventRecord).ts - (b[0] as EventRecord).ts);

  const accs = new Map<string, Acc>();
  const order: string[] = [];
  const acc = (qid: string): Acc => {
    let a = accs.get(qid);
    if (!a) {
      a = blank(qid);
      accs.set(qid, a);
      order.push(qid);
    }
    return a;
  };

  for (const page of ordered) {
    const pageEnd = (page[page.length - 1] as EventRecord).monoMs;
    // Hidden and idle intervals for this page.
    const hidden: Interval[] = [];
    const idle: Interval[] = [];
    let hiddenFrom: number | null = null;
    let idleFrom: number | null = null;
    for (const e of page) {
      if (e.type === 'tab_hidden' && hiddenFrom === null) hiddenFrom = e.monoMs;
      if (e.type === 'tab_visible' && hiddenFrom !== null) {
        hidden.push({ start: hiddenFrom, end: e.monoMs });
        hiddenFrom = null;
      }
      if (e.type === 'idle_start' && idleFrom === null) idleFrom = e.monoMs - payload(e, 'idle_start').thresholdMs;
      if (e.type === 'idle_end') {
        idle.push({ start: e.monoMs - payload(e, 'idle_end').idleMs, end: e.monoMs });
        idleFrom = null;
      }
    }
    if (hiddenFrom !== null) hidden.push({ start: hiddenFrom, end: pageEnd });
    if (idleFrom !== null) idle.push({ start: idleFrom, end: pageEnd });

    // Visits.
    let open: { qid: string; start: number } | null = null;
    const close = (end: number) => {
      if (!open) return;
      const span: Interval = { start: open.start, end: Math.max(open.start, end) };
      const visible = subtract(span, hidden);
      const a = acc(open.qid);
      a.m.wallMs += span.end - span.start;
      a.m.hiddenMs += span.end - span.start - visible.reduce((s, p) => s + p.end - p.start, 0);
      a.m.idleMs += sumOverlap(visible, idle);
      open = null;
    };

    for (const e of page) {
      const qid = e.questionId;
      if (e.type === 'question_shown' && qid) {
        close(e.monoMs);
        const a = acc(qid);
        a.m.visits++;
        a.firstShownAt ??= { pageId: e.pageId, mono: e.monoMs };
        open = { qid, start: e.monoMs };
        continue;
      }
      if (e.type === 'question_hidden') {
        if (open && open.qid === qid) close(e.monoMs);
        continue;
      }
      if (!qid || !INTERACTIONS.has(e.type)) continue;
      const a = acc(qid);
      if (!a.firstInteractionDone) {
        a.firstInteractionDone = true;
        if (a.firstShownAt && a.firstShownAt.pageId === e.pageId) a.m.timeToFirstInteractionMs = Math.max(0, e.monoMs - a.firstShownAt.mono);
      }
      switch (e.type) {
        case 'choice_selected':
          a.m.answerChain.push(payload(e, 'choice_selected').choice);
          break;
        case 'choice_changed':
          a.m.answerChain.push(payload(e, 'choice_changed').to);
          break;
        case 'choice_cleared':
        case 'spr_cleared':
          a.m.answerChain.push('');
          break;
        case 'spr_changed':
          a.m.answerChain.push(payload(e, 'spr_changed').value);
          break;
        case 'choice_struck': {
          const c = payload(e, 'choice_struck').choice;
          a.m.strikeActions++;
          if (!a.m.struck.includes(c)) a.m.struck.push(c);
          break;
        }
        case 'strike_removed': {
          const c = payload(e, 'strike_removed').choice;
          a.m.strikeActions++;
          a.m.struck = a.m.struck.filter((x) => x !== c);
          break;
        }
        case 'flag_set':
        case 'flag_removed':
          a.m.flagHistory.push({ flagged: e.type === 'flag_set', ts: e.ts });
          break;
        case 'confidence_rated':
          a.m.confidenceChain.push(payload(e, 'confidence_rated').rating);
          break;
        default:
          break;
      }
    }
    close(pageEnd);
  }

  // Answers: changes and swaps from the chain.
  for (const { m } of accs.values()) {
    m.activeMs = m.wallMs - m.hiddenMs;
    let prev: string | null = null;
    let lastAnswer: string | null = null;
    for (const r of m.answerChain) {
      const cur = r === '' ? null : r;
      if (prev !== null && cur !== prev) m.changes++;
      if (cur !== null && lastAnswer !== null && cur !== lastAnswer && grade) {
        const was = grade(m.questionId, lastAnswer);
        const now = grade(m.questionId, cur);
        if (was && !now) m.correctToIncorrect++;
        if (!was && now) m.incorrectToCorrect++;
      }
      if (cur !== null) lastAnswer = cur;
      prev = cur;
    }
    m.finalResponse = prev;
  }

  const questions = order.map((id) => (accs.get(id) as Acc).m);
  const sum = (f: (m: QuestionMetrics) => number) => questions.reduce((s, m) => s + f(m), 0);
  return {
    sessionId,
    questions,
    totals: {
      wallMs: sum((m) => m.wallMs),
      activeMs: sum((m) => m.activeMs),
      hiddenMs: sum((m) => m.hiddenMs),
      idleMs: sum((m) => m.idleMs),
      changes: sum((m) => m.changes),
      correctToIncorrect: sum((m) => m.correctToIncorrect),
      incorrectToCorrect: sum((m) => m.incorrectToCorrect),
      pageLoads: ordered.length,
      events: own.length,
    },
    distributions: {
      activeMs: distribution(questions.filter((m) => m.visits > 0).map((m) => m.activeMs)),
      timeToFirstInteractionMs: distribution(questions.flatMap((m) => (m.timeToFirstInteractionMs === null ? [] : [m.timeToFirstInteractionMs]))),
    },
  };
}
