import { describe, expect, it } from 'vitest';
import { PACE_TARGET_MS } from '../../config/paceConfig';
import type { MistakeTag } from '../../types/mistakes';
import type { SessionRecord, SessionReport, StoredAttempt } from '../../types/session';
import { liveHint, reportPacing } from '../pacing/pacing';
import { createSession } from '../session/record';
import { cleanSetStats, presetConfig, presetTimeLeftMs, PRESETS } from './presets';

describe('800 presets', () => {
  it('Math 800 is hard Math only, 15 questions, timed at about 95 s each', () => {
    const c = presetConfig('math800');
    expect(c).toMatchObject({ section: 'math', difficulties: ['H'], count: 15, preset: 'math800' });
    expect(c.timeLimitMs).toBe(Math.round(PACE_TARGET_MS.math * 15));
    expect(Math.round(PACE_TARGET_MS.math / 1000)).toBe(95);
  });
  it('English 800 has a hard track and a Conventions track at all difficulties', () => {
    expect(presetConfig('english800')).toMatchObject({ section: 'rw', difficulties: ['H'], count: 15 });
    expect(Math.round(PACE_TARGET_MS.rw / 1000)).toBe(71);
    expect(presetConfig('conventions')).toMatchObject({ section: 'rw', domainCode: 'SEC', difficulties: [] });
    expect(PRESETS.english800.blurb).toMatch(/not a promise/);
  });
  it('the soft time limit counts down from active time and stops at zero', () => {
    const c = presetConfig('math800', 2);
    expect(presetTimeLeftMs(c, 10_000)).toBe((c.timeLimitMs as number) - 10_000);
    expect(presetTimeLeftMs(c, 10_000_000)).toBe(0);
    expect(presetTimeLeftMs({ ...c, timeLimitMs: undefined }, 5)).toBeNull();
  });
});

describe('clean sets', () => {
  const set = (id: string, at: number, preset: 'math800' | 'conventions' = 'conventions'): SessionRecord => ({
    ...createSession(id, 'drill', presetConfig(preset, 2), [`${id}a`, `${id}b`], at),
    status: 'finished',
    finishedAt: at,
  });
  const ans = (s: SessionRecord, q: string, correct: boolean): StoredAttempt => ({
    id: `${s.id}:${q}`, sessionId: s.id, questionId: q, mode: 'drill', status: 'final', response: 'A', correct, timeMs: 1, firstVisitMs: 1, changes: 0, confidence: null, at: 1,
  });
  it('counts clean sets, the streak back from the latest, slips per set and slips by reason', () => {
    const a = set('a', 1);
    const b = set('b', 2);
    const c = set('c', 3);
    const d = set('d', 4);
    const other = set('x', 5, 'math800');
    const attempts = [ans(a, 'aa', true), ans(a, 'ab', true), ans(b, 'ba', false), ans(b, 'bb', true), ans(c, 'ca', true), ans(c, 'cb', true), ans(d, 'da', true), ans(d, 'db', true)];
    const tags: MistakeTag[] = [{ id: 't', sessionId: 'b', questionId: 'ba', reason: 'careless', note: '', suggested: true, at: 9 }];
    const s = cleanSetStats('conventions', [a, b, c, d, other], attempts, tags);
    expect(s).toMatchObject({ sets: 4, cleanSets: 3, cleanStreak: 2, bestStreak: 2, untagged: 0 });
    expect(s.slipsPerSet).toBe(0.25);
    expect(s.slipsByReason).toEqual({ careless: 1 });
  });
  it('a blank counts as a slip', () => {
    const a = set('a', 1);
    const s = cleanSetStats('conventions', [a], [ans(a, 'aa', true)], []);
    expect(s).toMatchObject({ cleanSets: 0, untagged: 1 });
  });
});

describe('pacing', () => {
  const report = (times: number[], mode: 'drill' | 'exam' = 'drill'): SessionReport => ({
    sessionId: 's', mode, startedAt: 0, finishedAt: 1, score: { correct: 0, total: times.length }, totalActiveMs: times.reduce((x, y) => x + y, 0), byDomain: [], bySkill: [],
    items: times.map((t, index) => ({ index, questionId: `q${index}`, displayId: `d${index}`, section: 'math', domain: '', skill: '', difficulty: 'M', response: 'A', correct: index % 2 === 0, correctAnswer: 'A', activeMs: t, firstVisitMs: t, flagged: false, changes: 0, confidence: null, question: null })),
  });
  it('lists questions over target and the checkpoints against the pace', () => {
    const target = PACE_TARGET_MS.math;
    const p = reportPacing(report([target * 0.5, target * 2, target, target]), 'math', null);
    expect(p.overTarget.map((q) => q.questionId)).toEqual(['q1']);
    expect(p.budgetMs).toBe(target * 4);
    expect(p.checkpoints[1]).toEqual({ at: 0.5, done: 1, expected: 2 });
    expect(p.lastFive).toBeNull();
    expect(p.approximate).toBe(false);
  });
  it('with a time limit, reports the questions reached in its last five minutes', () => {
    const p = reportPacing(report([900_000, 900_000, 200_000, 200_000], 'exam'), 'math', 35 * 60_000);
    // The limit is 2,100,000 ms; the last five minutes start at 1,800,000 ms.
    expect(p.lastFive).toEqual({ questions: 2, correct: 1, timeMs: 400_000 });
    expect(p.approximate).toBe(true);
  });
  it('the live hint says behind only well past the pace', () => {
    const t = PACE_TARGET_MS.rw;
    expect(liveHint('rw', t * 3, 3).status).toBe('on_pace');
    expect(liveHint('rw', t * 3 + 31_000, 3).status).toBe('behind');
    expect(liveHint('rw', t, 3).status).toBe('ahead');
  });
});
