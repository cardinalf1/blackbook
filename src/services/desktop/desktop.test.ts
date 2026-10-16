import { describe, expect, it, vi } from 'vitest';
import { timedTestInProgress } from './index';
import type { SessionRecord } from '../../types/session';

describe('desktop service hooks', () => {
  it('reports timed test in progress during exam module', () => {
    const activeExam = {
      mode: 'exam',
      status: 'in_progress',
      exam: { phase: 'active' },
    } as unknown as SessionRecord;

    expect(timedTestInProgress(activeExam, null, Date.now())).toBe(true);

    const submittedExam = {
      mode: 'exam',
      status: 'in_progress',
      exam: { phase: 'submitted' },
    } as unknown as SessionRecord;

    expect(timedTestInProgress(submittedExam, null, Date.now())).toBe(false);
  });

  it('reports timed test in progress during test break', () => {
    const now = 1000;
    const testOnBreak = {
      status: 'in_progress',
      test: { break: { endedAt: null, deadlineAt: 2000 } },
    } as unknown as SessionRecord;

    expect(timedTestInProgress(null, testOnBreak, now)).toBe(true);

    const testEndedBreak = {
      status: 'in_progress',
      test: { break: { endedAt: 1500, deadlineAt: 2000 } },
    } as unknown as SessionRecord;

    expect(timedTestInProgress(null, testEndedBreak, now)).toBe(false);
  });
});
