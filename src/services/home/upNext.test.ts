import { describe, expect, it } from 'vitest';
import type { InProgressRow } from '../../types/session';
import { countRankableSkills, pickUpNext } from './upNext';

const row = (over: Partial<InProgressRow> = {}): InProgressRow => ({
  id: 'd1', kindLabel: 'Drill', sectionLabel: 'Math', filtersLabel: 'All domains', answered: 12, total: 20, activeMs: 1000, lastActivityAt: 5, ...over,
});

describe('Up next priority', () => {
  it('1. an unfinished session wins, with the most recent shown and the rest counted', () => {
    const c = pickUpNext({ inProgress: [row(), row({ id: 'd2' })], retryDue: 8, rankableSkills: 9 });
    expect(c.primary).toMatchObject({ kind: 'resume', sessionId: 'd1', label: 'Resume drill, 12 of 20 answered' });
    expect(c.moreInProgress).toBe(1);
  });

  it('an unfinished test says where it stopped', () => {
    const c = pickUpNext({ inProgress: [row({ id: 't1', kindLabel: 'Full test', isTest: true, progressLabel: 'Module 2 of 4' })], retryDue: 0, rankableSkills: 0 });
    expect(c.primary).toMatchObject({ kind: 'resume', isTest: true, label: 'Resume full test, Module 2 of 4' });
  });

  it('2. retries due come next', () => {
    expect(pickUpNext({ inProgress: [], retryDue: 8, rankableSkills: 9 }).primary).toMatchObject({ kind: 'retry', label: 'Review 8 questions due today' });
    expect(pickUpNext({ inProgress: [], retryDue: 1, rankableSkills: 0 }).primary.label).toBe('Review 1 question due today');
  });

  it('3. a weak-skill drill once 3 skills have enough first attempts', () => {
    expect(pickUpNext({ inProgress: [], retryDue: 0, rankableSkills: 3 }).primary).toMatchObject({ kind: 'weak_drill', label: 'Practice your 3 weakest skills' });
    expect(pickUpNext({ inProgress: [], retryDue: 0, rankableSkills: 7 }).primary.label).toBe('Practice your 4 weakest skills');
  });

  it('4. otherwise a 20-question drill', () => {
    const c = pickUpNext({ inProgress: [], retryDue: 0, rankableSkills: 2 });
    expect(c.primary).toMatchObject({ kind: 'start_drill', label: 'Start a 20-question drill' });
    expect(c.primary.reason).not.toBe('');
    expect(c.moreInProgress).toBe(0);
  });

  it('counts skills with at least 3 first attempts', () => {
    const skillOf = new Map([['a', 'S1'], ['b', 'S1'], ['c', 'S1'], ['d', 'S2'], ['e', 'S2']]);
    expect(countRankableSkills([{ questionId: 'a' }, { questionId: 'b' }, { questionId: 'c' }, { questionId: 'd' }, { questionId: 'e' }, { questionId: 'zz' }], skillOf)).toBe(1);
  });
});
