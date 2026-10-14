import { describe, expect, it } from 'vitest';
import type { DrillConfig } from '../../types/drill';
import { advance, createSession, currentQuestionId, isStruck, recordElapsed, submitAnswer, toggleStrike } from './session';

const cfg: DrillConfig = { section: 'math', domainCode: 'all', skillCodes: [], difficulties: [], count: 3, liveOnly: true };
const fresh = () => createSession('s1', cfg, ['a', 'b', 'c'], 1000);

describe('session transitions', () => {
  it('starts on the first question, active, with nothing answered', () => {
    const s = fresh();
    expect(currentQuestionId(s)).toBe('a');
    expect(s.status).toBe('active');
    expect(s.answered).toEqual({});
  });

  it('submits once per question and returns the attempt to store', () => {
    const { session, attempt } = submitAnswer(fresh(), 'a', 'B', true, 4321.4, 2000);
    expect(attempt).toEqual({ id: 's1:a', questionId: 'a', response: 'B', correct: true, timeMs: 4321, sessionId: 's1', at: 2000 });
    expect(session.answered.a?.correct).toBe(true);

    const again = submitAnswer(session, 'a', 'C', false, 9999, 3000);
    expect(again.attempt).toBeNull();
    expect(again.session).toBe(session);
  });

  it('ignores answers for questions that are not in the queue', () => {
    expect(submitAnswer(fresh(), 'zzz', 'A', true, 1, 1).attempt).toBeNull();
  });

  it('cannot advance before answering, then walks the queue and finishes', () => {
    let s = fresh();
    expect(advance(s)).toBe(s);
    s = advance(submitAnswer(s, 'a', 'A', true, 1, 1).session);
    expect(currentQuestionId(s)).toBe('b');
    s = advance(submitAnswer(s, 'b', 'A', false, 1, 2).session);
    s = advance(submitAnswer(s, 'c', 'A', true, 1, 3).session);
    expect(s.status).toBe('finished');
    expect(Object.keys(s.answered)).toEqual(['a', 'b', 'c']);
    expect(submitAnswer(s, 'a', 'A', true, 1, 4).attempt).toBeNull();
  });

  it('strikes and unstrikes choices before answering only', () => {
    let s = toggleStrike(fresh(), 'a', 'B');
    expect(isStruck(s, 'a', 'B')).toBe(true);
    expect(isStruck(s, 'a', 'C')).toBe(false);
    s = toggleStrike(s, 'a', 'B');
    expect(isStruck(s, 'a', 'B')).toBe(false);
    s = toggleStrike(s, 'a', 'D');
    s = submitAnswer(s, 'a', 'A', true, 1, 1).session;
    expect(toggleStrike(s, 'a', 'C')).toBe(s);
  });

  it('records elapsed time on the unanswered current question and clears it on submit', () => {
    let s = recordElapsed(fresh(), 5400.6);
    expect(s.currentElapsedMs).toBe(5401);
    s = submitAnswer(s, 'a', 'A', true, 7000, 9).session;
    expect(s.currentElapsedMs).toBe(0);
    expect(recordElapsed(s, 100)).toBe(s);
  });
});
