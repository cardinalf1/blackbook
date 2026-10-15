// The retry queue, derived from attempts and sessions every time. Nothing is stored beyond what
// the attempts already say, so it can never disagree with them.
//
// - A wrong, answered final answer in a finished session that is not a retry puts the question in
//   the queue at step 0, due after the first interval (2 days by default).
// - A correct answer in a retry moves it to the next step (7, then 21 days); a wrong one sends it
//   back to step 0. A correct answer at the last step graduates it: it leaves the queue.
// - A wrong answer anywhere else while it is queued also resets it to step 0. A correct answer
//   outside a retry does not advance it: only retries move a question forward.
// - Unanswered questions are not queued; they show up in the mistake log, not here.

import { DAY_MS, RETRY_INTERVALS_DAYS } from '../../config/mistakeConfig';
import type { SessionRecord, StoredAttempt } from '../../types/session';

export interface RetryEntry {
  questionId: string;
  /** Index into the interval list of the interval it is waiting out. */
  step: number;
  /** When the question becomes due, epoch ms. */
  dueAt: number;
  /** True when `dueAt` has passed. */
  due: boolean;
  /** When the latest miss that (re)started the wait happened. */
  lastMissAt: number;
}

type SessionFacts = Pick<SessionRecord, 'id' | 'status' | 'source'>;

/** Final, answered attempts of finished sessions, oldest first, with the session's source. */
function countable(attempts: readonly StoredAttempt[], sessions: readonly SessionFacts[]): { a: StoredAttempt; retry: boolean }[] {
  const bySession = new Map(sessions.filter((s) => s.status === 'finished').map((s) => [s.id, s]));
  const out: { a: StoredAttempt; retry: boolean }[] = [];
  for (const a of attempts) {
    const s = bySession.get(a.sessionId);
    if (s && a.status === 'final' && a.response !== '') out.push({ a, retry: s.source === 'retry' });
  }
  return out.sort((x, y) => x.a.at - y.a.at || x.a.id.localeCompare(y.a.id));
}

export function deriveRetryQueue(
  attempts: readonly StoredAttempt[],
  sessions: readonly SessionFacts[],
  now: number,
  intervalsDays: readonly number[] = RETRY_INTERVALS_DAYS,
): RetryEntry[] {
  const state = new Map<string, { step: number; dueAt: number; lastMissAt: number } | null>();
  const wait = (step: number, at: number) => at + (intervalsDays[step] as number) * DAY_MS;
  for (const { a, retry } of countable(attempts, sessions)) {
    const cur = state.get(a.questionId) ?? null;
    if (!a.correct) {
      state.set(a.questionId, { step: 0, dueAt: wait(0, a.at), lastMissAt: a.at });
    } else if (cur && retry) {
      const next = cur.step + 1;
      state.set(a.questionId, next >= intervalsDays.length ? null : { step: next, dueAt: wait(next, a.at), lastMissAt: cur.lastMissAt });
    }
  }
  const out: RetryEntry[] = [];
  for (const [questionId, s] of state) if (s) out.push({ questionId, step: s.step, dueAt: s.dueAt, due: s.dueAt <= now, lastMissAt: s.lastMissAt });
  return out.sort((a, b) => a.dueAt - b.dueAt || a.questionId.localeCompare(b.questionId));
}

/** Questions to serve in a retry session now: the due ones, longest overdue first. */
export function dueQuestionIds(queue: readonly RetryEntry[]): string[] {
  return queue.filter((e) => e.due).map((e) => e.questionId);
}

export interface RetryAccuracy {
  answered: number;
  correct: number;
}

/** How retries went. Kept apart from first-attempt accuracy everywhere. */
export function retryAccuracy(attempts: readonly StoredAttempt[], sessions: readonly SessionFacts[]): RetryAccuracy {
  const out: RetryAccuracy = { answered: 0, correct: 0 };
  for (const { a, retry } of countable(attempts, sessions)) {
    if (!retry) continue;
    out.answered++;
    if (a.correct) out.correct++;
  }
  return out;
}
