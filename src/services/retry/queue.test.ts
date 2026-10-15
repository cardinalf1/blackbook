import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../../config/mistakeConfig';
import type { SessionRecord, StoredAttempt } from '../../types/session';
import { seededRng, syntheticPool } from '../__fixtures__/pool';
import { buildRows } from '../browse/filter';
import { assembleModule } from '../exam/assemble';
import { createSession } from '../session/record';
import { MemoryAttemptStore } from '../storage/attemptsMemory';
import { countableAttempts } from '../drill/stats';
import { deriveRetryQueue, dueQuestionIds, retryAccuracy } from './queue';

const CONFIG = { section: 'rw' as const, domainCode: 'all', skillCodes: [], difficulties: [], count: 1, liveOnly: true };
const T0 = Date.UTC(2026, 9, 1);

let n = 0;
function session(source: SessionRecord['source'], status: SessionRecord['status'] = 'finished'): SessionRecord {
  return { ...createSession(`s${n++}`, 'drill', CONFIG, ['q'], T0, source), status };
}
function answer(s: SessionRecord, questionId: string, correct: boolean, at: number, response = 'A'): StoredAttempt {
  return { id: `${s.id}:${questionId}`, sessionId: s.id, questionId, mode: 'drill', status: 'final', response, correct, timeMs: 1000, firstVisitMs: 1000, changes: 0, confidence: null, at };
}

describe('retry queue', () => {
  it('a missed question is due after 2 days, then 7, then 21; the last correct retry graduates it', () => {
    const miss = session('drill');
    const r1 = session('retry');
    const r2 = session('retry');
    const r3 = session('retry');
    const sessions = [miss, r1, r2, r3];
    const at1 = T0 + 2 * DAY_MS;
    const at2 = at1 + 7 * DAY_MS;
    const at3 = at2 + 21 * DAY_MS;

    let q = deriveRetryQueue([answer(miss, 'a', false, T0)], sessions, T0 + DAY_MS);
    expect(q).toEqual([{ questionId: 'a', step: 0, dueAt: T0 + 2 * DAY_MS, due: false, lastMissAt: T0 }]);
    expect(deriveRetryQueue([answer(miss, 'a', false, T0)], sessions, T0 + 2 * DAY_MS)[0]?.due).toBe(true);

    q = deriveRetryQueue([answer(miss, 'a', false, T0), answer(r1, 'a', true, at1)], sessions, at1);
    expect(q[0]).toMatchObject({ step: 1, dueAt: at1 + 7 * DAY_MS, due: false });

    q = deriveRetryQueue([answer(miss, 'a', false, T0), answer(r1, 'a', true, at1), answer(r2, 'a', true, at2)], sessions, at2);
    expect(q[0]).toMatchObject({ step: 2, dueAt: at2 + 21 * DAY_MS });

    q = deriveRetryQueue([answer(miss, 'a', false, T0), answer(r1, 'a', true, at1), answer(r2, 'a', true, at2), answer(r3, 'a', true, at3)], sessions, at3);
    expect(q).toEqual([]);
  });

  it('a wrong retry resets the wait to 2 days', () => {
    const miss = session('drill');
    const r1 = session('retry');
    const r2 = session('retry');
    const at1 = T0 + 2 * DAY_MS;
    const at2 = at1 + 7 * DAY_MS;
    const attempts = [answer(miss, 'a', false, T0), answer(r1, 'a', true, at1), answer(r2, 'a', false, at2)];
    const q = deriveRetryQueue(attempts, [miss, r1, r2], at2);
    expect(q[0]).toMatchObject({ step: 0, dueAt: at2 + 2 * DAY_MS, lastMissAt: at2 });
  });

  it('ignores drafts, blanks and unfinished sessions, and correct answers outside a retry do not advance', () => {
    const miss = session('drill');
    const open = session('retry', 'in_progress');
    const drill = session('drill');
    const attempts = [
      answer(miss, 'a', false, T0),
      { ...answer(open, 'a', true, T0 + DAY_MS), status: 'draft' as const },
      answer(open, 'a', true, T0 + 3 * DAY_MS),
      answer(drill, 'a', true, T0 + 4 * DAY_MS),
      answer(miss, 'blank', false, T0, ''),
    ];
    const q = deriveRetryQueue(attempts, [miss, open, drill], T0 + 5 * DAY_MS);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ questionId: 'a', step: 0 });
  });

  it('lists the due questions, longest overdue first', () => {
    const s = session('drill');
    const attempts = [answer(s, 'late', false, T0 + 5 * DAY_MS), answer(s, 'early', false, T0), answer(s, 'notyet', false, T0 + 9 * DAY_MS)];
    const q = deriveRetryQueue(attempts, [s], T0 + 8 * DAY_MS);
    expect(dueQuestionIds(q)).toEqual(['early', 'late']);
  });

  it('keeps retry accuracy apart from everything else', () => {
    const miss = session('drill');
    const r1 = session('retry');
    const r2 = session('retry', 'abandoned');
    const attempts = [answer(miss, 'a', false, T0), answer(miss, 'b', true, T0), answer(r1, 'a', true, T0 + 1), answer(r1, 'c', false, T0 + 1), answer(r2, 'd', true, T0 + 2)];
    expect(retryAccuracy(attempts, [miss, r1, r2])).toEqual({ answered: 2, correct: 1 });
  });

  it('a retried question is already done, so it never enters an exam', async () => {
    const base = syntheticPool(4);
    const ids = base.filter((r) => r.section === 'rw').slice(0, 3).map((r) => r.id);
    const store = new MemoryAttemptStore();
    const miss = { ...session('drill'), status: 'finished' as const };
    const retry = { ...session('retry'), status: 'finished' as const };
    await store.saveSession(miss, [answer(miss, ids[0] as string, false, T0)]);
    await store.saveSession(retry, [answer(retry, ids[0] as string, true, T0 + 2 * DAY_MS)]);
    const queue = deriveRetryQueue(await store.listAttempts(), await store.listSessions(), T0 + 3 * DAY_MS);
    expect(queue.map((e) => e.questionId)).toEqual([ids[0]]);
    const questions = base.map((r) => ({ id: r.id, displayId: r.displayId, section: r.section, domainCode: r.domainCode, domain: r.domain, skillCode: r.skillCode, skill: r.skill, difficulty: r.difficulty, source: r.source, active: r.active, answer: { kind: r.format } }));
    const rows = buildRows(questions as never, await store.questionStatus());
    for (let seed = 1; seed <= 25; seed++) {
      const m = assembleModule(rows, { section: 'rw', moduleNumber: 1, tier: 'routing' }, seededRng(seed));
      expect(m.questionIds).not.toContain(ids[0]);
    }
  });

  it('retry results stay out of first-attempt skill accuracy', () => {
    const miss = session('drill');
    const r1 = session('retry');
    const attempts = [answer(miss, 'a', false, T0), answer(r1, 'a', true, T0 + 1)];
    expect(countableAttempts(attempts, [miss, r1], 'drill').map((a) => a.id)).toEqual([`${miss.id}:a`]);
  });
});
