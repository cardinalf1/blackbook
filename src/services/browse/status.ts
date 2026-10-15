// Seen and done status, derived from the raw records. The local program computes the same thing
// in one SQL query (server/userDb.ts); this pure version is the reference the two are checked
// against, and the in-memory store uses it directly.

import type { FlagRecord } from '../../types/drill';
import type { QuestionStatus } from '../../types/browse';
import type { EventRecord, SessionRecord, StoredAttempt } from '../../types/session';

/**
 * - seen: a question_shown event, or any stored attempt (answers from before the event log).
 * - done: a final, non-empty answer in any session.
 * - attempts: how many final, non-empty answers.
 * - lastResult: the newest final answer in a finished session, else null. Answers in unfinished
 *   sessions never reveal correctness here.
 * - flagged: on the "flag for later" list.
 * Only questions with any of these appear.
 */
export function deriveStatus(
  attempts: readonly StoredAttempt[],
  sessions: readonly Pick<SessionRecord, 'id' | 'status'>[],
  shownQuestionIds: Iterable<string>,
  flags: readonly FlagRecord[],
): QuestionStatus[] {
  const finished = new Set(sessions.filter((s) => s.status === 'finished').map((s) => s.id));
  const out = new Map<string, QuestionStatus & { lastAt: number; lastId: string }>();
  const get = (questionId: string) => {
    let s = out.get(questionId);
    if (!s) {
      s = { questionId, seen: false, done: false, attempts: 0, lastResult: null, flagged: false, lastAt: -Infinity, lastId: '' };
      out.set(questionId, s);
    }
    return s;
  };
  for (const id of shownQuestionIds) get(id).seen = true;
  for (const a of attempts) {
    const s = get(a.questionId);
    s.seen = true;
    if (a.status !== 'final' || a.response === '') continue;
    s.done = true;
    s.attempts++;
    if (finished.has(a.sessionId) && (a.at > s.lastAt || (a.at === s.lastAt && a.id > s.lastId))) {
      s.lastAt = a.at;
      s.lastId = a.id;
      s.lastResult = a.correct ? 'correct' : 'incorrect';
    }
  }
  for (const f of flags) get(f.questionId).flagged = true;
  return [...out.values()]
    .map(({ lastAt: _a, lastId: _b, ...s }) => s)
    .sort((a, b) => a.questionId.localeCompare(b.questionId));
}

/** Question ids from question_shown events. */
export function shownIds(events: readonly EventRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const e of events) if (e.type === 'question_shown' && e.questionId) ids.add(e.questionId);
  return ids;
}
