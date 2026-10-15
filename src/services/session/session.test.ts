import { describe, expect, it } from 'vitest';
import type { DrillConfig, QuestionFacet } from '../../types/drill';
import type { Question } from '../../types/sat';
import { buildReport, filtersLabel, pastSessionRows } from './report';
import { abandon, createSession, finish, finishCheck, moveTo, rate, setFlagged, setResponse, toggleStrike } from './record';
import { isSessionV1, upgradeSessionV1 } from './upgrade';

// Synthetic data only.
const config: DrillConfig = { section: 'math', domainCode: 'H', skillCodes: ['H.A.', 'H.B.'], difficulties: ['H'], count: 3, liveOnly: true };
const facets: QuestionFacet[] = [
  { id: 'q1', section: 'math', domainCode: 'H', domain: 'Algebra', skillCode: 'H.A.', skill: 'Linear things', difficulty: 'H', active: true },
];
const question = (id: string, skillCode: string, correct: 'A' | 'B'): Question => ({
  id, source: 'digital', displayId: `d-${id}`, section: 'math', domainCode: 'H', domain: 'Algebra', skillCode, skill: `Skill ${skillCode}`,
  difficulty: 'H', scoreBand: 5, active: true, stimulusHtml: null, stemHtml: '<p>x</p>',
  answer: { kind: 'mcq', choices: ['a', 'b', 'c', 'd'], correct, keyOrigin: 'structured' }, rationaleHtml: '<p>y</p>', updatedAt: 0,
});

describe('session record', () => {
  it('changes only after a first answer, and never once the session is closed', () => {
    let s = createSession('s', 'drill', config, ['q1', 'q2', 'q3'], 0);
    s = setResponse(s, 'q1', 'A', 1);
    s = setResponse(s, 'q1', 'A', 2); // same answer: nothing
    s = setResponse(s, 'q1', 'B', 3);
    s = setResponse(s, 'q1', '', 4);
    s = setResponse(s, 'q1', 'C', 5);
    expect(s.progress.q1).toMatchObject({ response: 'C', changes: 2 });
    const closed = abandon(s, 6);
    expect(setResponse(closed, 'q1', 'D', 7)).toBe(closed);
    expect(toggleStrike(closed, 'q1', 'A', 7)).toBe(closed);
  });

  it('confidence needs an answer and a session that asks', () => {
    let s = createSession('s', 'drill', { ...config, askConfidence: true }, ['q1'], 0);
    expect(rate(s, 'q1', 'sure', 1)).toBe(s);
    s = rate(setResponse(s, 'q1', 'A', 1), 'q1', 'sure', 2);
    expect(s.progress.q1?.confidence).toBe('sure');
    const exam = createSession('x', 'exam', { ...config, askConfidence: true }, ['q1'], 0);
    expect(exam.askConfidence).toBe(false);
  });

  it('tracks visits, first-visit time and the finish check', () => {
    let s = createSession('s', 'drill', config, ['q1', 'q2', 'q3'], 0);
    s = setFlagged(s, 'q1', true, 1);
    s = moveTo(s, 2, 1500, 2);
    s = moveTo(s, 0, 800, 3);
    s = moveTo(s, 2, 2500, 4);
    expect(s.progress.q1).toMatchObject({ visits: 2, activeMs: 2500, firstVisitMs: 1500 });
    expect(s.progress.q2?.visits).toBe(0);
    expect(s.progress.q3).toMatchObject({ visits: 2, firstVisitMs: 800 });
    expect(finishCheck(s)).toEqual({ unanswered: [1, 2, 3], flagged: [1] });
    expect(moveTo(s, 7, 0, 5)).toBe(s);
  });

  it('upgrades a Phase 2 record', () => {
    const v1 = {
      id: 'old', config, queueIds: ['q1', 'q2'], index: 1, startedAt: 10, status: 'active' as const,
      answered: { q1: { response: 'B', correct: false, timeMs: 900, at: 50 } }, struck: {}, currentElapsedMs: 300,
    };
    expect(isSessionV1(v1)).toBe(true);
    const v2 = upgradeSessionV1(v1);
    expect(isSessionV1(v2)).toBe(false);
    expect(v2).toMatchObject({ status: 'in_progress', lastActivityAt: 50, totalActiveMs: 1200, score: null });
    expect(v2.progress.q2).toMatchObject({ response: null, activeMs: 300, visits: 1 });
  });
});

describe('report', () => {
  it('grades from the bank, counts unanswered as wrong, and breaks down by skill', () => {
    let s = createSession('s', 'drill', config, ['q1', 'q2', 'q3'], 0);
    s = setResponse(s, 'q1', 'A', 1);
    s = moveTo(s, 1, 1000, 2);
    s = setResponse(s, 'q2', 'A', 3);
    s = moveTo(s, 2, 2000, 4);
    const bank = new Map([
      ['q1', question('q1', 'H.A.', 'A')],
      ['q2', question('q2', 'H.B.', 'B')],
      ['q3', question('q3', 'H.B.', 'A')],
    ]);
    s = finish(s, 500, (id, r) => bank.get(id)?.answer.kind === 'mcq' && (bank.get(id)?.answer as { correct: string }).correct === r, 9);
    const r = buildReport(s, bank, []);
    expect(r.score).toEqual({ correct: 1, total: 3 });
    expect(r.score).toEqual(s.score);
    expect(r.items.map((i) => [i.correct, i.correctAnswer])).toEqual([[true, 'A'], [false, 'B'], [false, 'A']]);
    expect(r.bySkill.map((b) => [b.code, b.correct, b.total])).toEqual([['H.B.', 0, 2], ['H.A.', 1, 1]]);
    expect(r.totalActiveMs).toBe(3500);
  });

  it('labels filters and lists only finished sessions, newest first', () => {
    const a = finish(setResponse(createSession('a', 'drill', config, ['q1'], 0), 'q1', 'A', 1), 0, () => true, 100);
    const b = finish(createSession('b', 'drill', { ...config, domainCode: 'all', skillCodes: [], difficulties: [] }, ['q1'], 0), 0, () => false, 200);
    const open = createSession('c', 'drill', config, ['q1'], 0);
    expect(filtersLabel(a, facets)).toBe('Algebra · 2 skills · Hard · live only');
    const rows = pastSessionRows([a, open, b], facets);
    expect(rows.map((r) => [r.id, r.correct, r.kindLabel])).toEqual([['b', 0, 'Drill'], ['a', 1, 'Drill']]);
  });
});
