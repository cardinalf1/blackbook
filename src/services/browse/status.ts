// Seen and done status, derived from the raw records. The local program computes the same thing
// in one SQL query (server/userDb.ts); this pure version is the reference the two are checked
// against, and the in-memory store uses it directly.

import type { FlagRecord } from '../../types/drill';
import type { QuestionStatus } from '../../types/browse';
import type { EventRecord, SessionRecord, StoredAttempt } from '../../types/session';

/**
 * - seen: a question_shown event, or any stored attempt (answers from before the event log).
 * - done: a final, non-empty answer in any session.
 * - examShown: the question was on screen in any exam module, finished, paused or discarded, whether or
 *   not it was answered. Read from the session records (visits) and from exam question_shown events.
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
  examShownQuestionIds: ReadonlySet<string> = new Set(),
): QuestionStatus[] {
  const finished = new Set(sessions.filter((s) => s.status === 'finished').map((s) => s.id));
  const out = new Map<string, QuestionStatus & { lastAt: number; lastId: string }>();
  const get = (questionId: string) => {
    let s = out.get(questionId);
    if (!s) {
      s = { questionId, seen: false, done: false, examShown: false, attempts: 0, lastResult: null, flagged: false, lastAt: -Infinity, lastId: '' };
      out.set(questionId, s);
    }
    return s;
  };
  for (const id of shownQuestionIds) get(id).seen = true;
  for (const id of examShownQuestionIds) {
    const s = get(id);
    s.seen = true;
    s.examShown = true;
  }
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

/** Questions shown in exam modules: a visit in an exam session's progress, or an exam question_shown event. */
export function examShownIds(
  sessions: readonly Pick<SessionRecord, 'mode' | 'progress'>[],
  events: readonly EventRecord[],
): Set<string> {
  const ids = new Set<string>();
  for (const s of sessions) {
    if (s.mode !== 'exam') continue;
    for (const [id, p] of Object.entries(s.progress)) if (p.visits > 0) ids.add(id);
  }
  for (const e of events) if (e.type === 'question_shown' && e.mode === 'exam' && e.questionId) ids.add(e.questionId);
  return ids;
}
