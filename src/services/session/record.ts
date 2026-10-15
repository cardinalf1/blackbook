// Pure state transitions for a session record (drill now, exam module later). The drill store
// persists the results. Nothing here knows whether an answer is right: grading is passed in at
// finish and when building attempts, and nothing reaches the screen before the session ends.

import type { DrillConfig } from '../../types/drill';
import type { ChoiceLetter } from '../../types/sat';
import {
  SESSION_RECORD_VERSION,
  type Confidence,
  type QuestionProgress,
  type SessionMode,
  type SessionSource,
  type SessionRecord,
  type StoredAttempt,
} from '../../types/session';

const blank = (): QuestionProgress => ({
  response: null,
  changes: 0,
  activeMs: 0,
  firstVisitMs: null,
  visits: 0,
  struck: [],
  flagged: false,
  confidence: null,
});

const ms = (n: number) => Math.max(0, Math.round(n));

export function createSession(
  id: string,
  mode: SessionMode,
  config: DrillConfig,
  queueIds: readonly string[],
  now: number,
  source: SessionSource = mode === 'exam' ? 'exam' : 'drill',
): SessionRecord {
  const progress: Record<string, QuestionProgress> = {};
  for (const q of queueIds) progress[q] = blank();
  const first = queueIds[0];
  if (first !== undefined) progress[first] = { ...blank(), visits: 1 };
  return {
    version: SESSION_RECORD_VERSION,
    id,
    mode,
    source,
    config,
    queueIds: [...queueIds],
    index: 0,
    status: 'in_progress',
    startedAt: now,
    finishedAt: null,
    lastActivityAt: now,
    progress,
    score: null,
    totalActiveMs: 0,
    askConfidence: mode === 'drill' && config.askConfidence === true,
  };
}

export function currentQuestionId(s: SessionRecord): string | null {
  return s.queueIds[s.index] ?? null;
}

export function progressOf(s: SessionRecord, questionId: string): QuestionProgress {
  return s.progress[questionId] ?? blank();
}

const open = (s: SessionRecord, questionId: string) => s.status === 'in_progress' && s.queueIds.includes(questionId);

function withProgress(s: SessionRecord, questionId: string, p: QuestionProgress, now: number): SessionRecord {
  const progress = { ...s.progress, [questionId]: p };
  const totalActiveMs = s.queueIds.reduce((sum, id) => sum + (progress[id]?.activeMs ?? 0), 0);
  return { ...s, progress, totalActiveMs, lastActivityAt: now };
}

/**
 * Sets the answer. '' or null clears it. Replacing or clearing an existing answer is a change;
 * the first pick is not. A new answer drops the confidence rating, which was about the old one.
 */
export function setResponse(
  s: SessionRecord,
  questionId: string,
  response: string | null,
  now: number,
  opts: { countChange?: boolean } = {},
): SessionRecord {
  if (!open(s, questionId)) return s;
  const next = response === '' ? null : response;
  const p = progressOf(s, questionId);
  if (p.response === next) return s;
  const counts = opts.countChange !== false && p.response !== null;
  return withProgress(s, questionId, { ...p, response: next, changes: counts ? p.changes + 1 : p.changes, confidence: null }, now);
}

/**
 * Counts one change. Typed answers are saved on every keystroke without counting; the store
 * counts once when typing settles, so typing "125" is one answer, not three changes.
 */
export function addChange(s: SessionRecord, questionId: string, now: number): SessionRecord {
  if (!open(s, questionId)) return s;
  const p = progressOf(s, questionId);
  return withProgress(s, questionId, { ...p, changes: p.changes + 1 }, now);
}

/** Striking the selected choice also clears the answer: a struck choice cannot be the answer. */
export function toggleStrike(s: SessionRecord, questionId: string, letter: ChoiceLetter, now: number): SessionRecord {
  if (!open(s, questionId)) return s;
  const p = progressOf(s, questionId);
  const striking = !p.struck.includes(letter);
  const struck = striking ? [...p.struck, letter] : p.struck.filter((l) => l !== letter);
  let after = withProgress(s, questionId, { ...p, struck }, now);
  if (striking && p.response === letter) after = setResponse(after, questionId, null, now);
  return after;
}

export function setFlagged(s: SessionRecord, questionId: string, flagged: boolean, now: number): SessionRecord {
  if (!open(s, questionId)) return s;
  const p = progressOf(s, questionId);
  if (p.flagged === flagged) return s;
  return withProgress(s, questionId, { ...p, flagged }, now);
}

/** Only for an answered question in a session that asks for confidence. */
export function rate(s: SessionRecord, questionId: string, rating: Confidence, now: number): SessionRecord {
  if (!open(s, questionId) || !s.askConfidence) return s;
  const p = progressOf(s, questionId);
  if (p.response === null || p.confidence === rating) return s;
  return withProgress(s, questionId, { ...p, confidence: rating }, now);
}

/** Stores the total active time on a question so far (all visits), so a reload keeps it. */
export function recordActive(s: SessionRecord, questionId: string, activeMs: number, now: number): SessionRecord {
  if (!open(s, questionId)) return s;
  const p = progressOf(s, questionId);
  const t = ms(activeMs);
  if (p.activeMs === t) return s;
  return withProgress(s, questionId, { ...p, activeMs: t }, now);
}

/** Closes the visit to the current question: its total active time, and the first-visit time once. */
function leaveCurrent(s: SessionRecord, activeMs: number, now: number): SessionRecord {
  const id = currentQuestionId(s);
  if (id === null) return s;
  const p = progressOf(s, id);
  const t = ms(activeMs);
  return withProgress(s, id, { ...p, activeMs: t, firstVisitMs: p.firstVisitMs ?? t }, now);
}

/** Moves to another question. `activeMs` is the current question's total active time. */
export function moveTo(s: SessionRecord, index: number, activeMs: number, now: number): SessionRecord {
  if (s.status !== 'in_progress' || index < 0 || index >= s.queueIds.length || index === s.index) return s;
  const left = leaveCurrent(s, activeMs, now);
  const target = left.queueIds[index] as string;
  const p = progressOf(left, target);
  return { ...withProgress(left, target, { ...p, visits: p.visits + 1 }, now), index };
}

/** Ends the session. `isCorrect` grades one answered question. Unanswered questions count as wrong. */
export function finish(
  s: SessionRecord,
  activeMs: number,
  isCorrect: (questionId: string, response: string) => boolean,
  now: number,
): SessionRecord {
  if (s.status !== 'in_progress') return s;
  const left = leaveCurrent(s, activeMs, now);
  let correct = 0;
  for (const id of left.queueIds) {
    const r = left.progress[id]?.response;
    if (r !== null && r !== undefined && isCorrect(id, r)) correct++;
  }
  return { ...left, status: 'finished', finishedAt: now, score: { correct, total: left.queueIds.length } };
}

export function abandon(s: SessionRecord, now: number): SessionRecord {
  if (s.status !== 'in_progress') return s;
  return { ...s, status: 'abandoned', lastActivityAt: now };
}

export function answeredCount(s: SessionRecord): number {
  return s.queueIds.filter((id) => s.progress[id]?.response != null).length;
}

/** 1-based numbers of unanswered and flagged questions, for the finish check. */
export function finishCheck(s: SessionRecord): { unanswered: number[]; flagged: number[] } {
  const unanswered: number[] = [];
  const flagged: number[] = [];
  s.queueIds.forEach((id, i) => {
    const p = s.progress[id];
    if (p?.response == null) unanswered.push(i + 1);
    if (p?.flagged) flagged.push(i + 1);
  });
  return { unanswered, flagged };
}

/** The stored attempt for one question. An empty response means the answer was cleared. */
export function attemptFor(
  s: SessionRecord,
  questionId: string,
  correct: boolean,
  status: StoredAttempt['status'],
  now: number,
): StoredAttempt {
  const p = progressOf(s, questionId);
  return {
    id: `${s.id}:${questionId}`,
    sessionId: s.id,
    questionId,
    mode: s.mode,
    status,
    response: p.response ?? '',
    correct: p.response !== null && correct,
    timeMs: p.activeMs,
    firstVisitMs: p.firstVisitMs,
    changes: p.changes,
    confidence: p.confidence,
    at: now,
  };
}
