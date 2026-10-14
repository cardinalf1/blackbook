// Pure state transitions for a drill session. The store in src/stores persists the results.

import type { Attempt, DrillConfig, SessionRecord } from '../../types/drill';
import type { ChoiceLetter } from '../../types/sat';

export function createSession(id: string, config: DrillConfig, queueIds: readonly string[], now: number): SessionRecord {
  return {
    id,
    config,
    queueIds: [...queueIds],
    index: 0,
    startedAt: now,
    status: 'active',
    answered: {},
    struck: {},
    currentElapsedMs: 0,
  };
}

export function currentQuestionId(s: SessionRecord): string | null {
  return s.queueIds[s.index] ?? null;
}

export function isAnswered(s: SessionRecord, questionId: string): boolean {
  return s.answered[questionId] !== undefined;
}

export interface SubmitResult {
  session: SessionRecord;
  /** Null when the question was already answered: a question is graded once per session. */
  attempt: Attempt | null;
}

/** Records an answer. A second submit for the same question is ignored, so time and result stay fixed. */
export function submitAnswer(
  s: SessionRecord,
  questionId: string,
  response: string,
  correct: boolean,
  timeMs: number,
  now: number,
): SubmitResult {
  if (s.status !== 'active' || !s.queueIds.includes(questionId) || isAnswered(s, questionId)) {
    return { session: s, attempt: null };
  }
  const t = Math.max(0, Math.round(timeMs));
  const attempt: Attempt = {
    id: `${s.id}:${questionId}`,
    questionId,
    response,
    correct,
    timeMs: t,
    sessionId: s.id,
    at: now,
  };
  const session: SessionRecord = {
    ...s,
    answered: { ...s.answered, [questionId]: { response, correct, timeMs: t, at: now } },
    currentElapsedMs: questionId === currentQuestionId(s) ? 0 : s.currentElapsedMs,
  };
  return { session, attempt };
}

/** Moves to the next question, or finishes the session after the last one. Only after answering. */
export function advance(s: SessionRecord): SessionRecord {
  const id = currentQuestionId(s);
  if (s.status !== 'active' || id === null || !isAnswered(s, id)) return s;
  if (s.index + 1 >= s.queueIds.length) return { ...s, status: 'finished', currentElapsedMs: 0 };
  return { ...s, index: s.index + 1, currentElapsedMs: 0 };
}

/** Struck choices cannot be selected, so striking is only allowed before the question is answered. */
export function toggleStrike(s: SessionRecord, questionId: string, letter: ChoiceLetter): SessionRecord {
  if (s.status !== 'active' || isAnswered(s, questionId)) return s;
  const cur = s.struck[questionId] ?? [];
  const next = cur.includes(letter) ? cur.filter((l) => l !== letter) : [...cur, letter];
  return { ...s, struck: { ...s.struck, [questionId]: next } };
}

export function isStruck(s: SessionRecord, questionId: string, letter: ChoiceLetter): boolean {
  return (s.struck[questionId] ?? []).includes(letter);
}

/** Saves focus time on the current unanswered question so a reload does not lose it. */
export function recordElapsed(s: SessionRecord, elapsedMs: number): SessionRecord {
  const id = currentQuestionId(s);
  if (s.status !== 'active' || id === null || isAnswered(s, id)) return s;
  return { ...s, currentElapsedMs: Math.max(0, Math.round(elapsedMs)) };
}
