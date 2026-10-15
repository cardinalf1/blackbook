import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExamState } from '../../types/exam';
import {
  fiveMinuteAlertDue,
  isExpired,
  isPaused,
  pauseExam,
  pauseTimer,
  remainingMs,
  resumeExam,
  resumeTimer,
  startTimer,
  usedMs,
  wasPaused,
} from './timer';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 15, 9, 0, 0);

function exam(over: Partial<ExamState> = {}): ExamState {
  return {
    module: { section: 'rw', moduleNumber: 1, tier: 'routing' },
    timer: startTimer(32 * MIN, T0),
    pauses: [],
    phase: 'in_progress',
    submittedBy: null,
    timerHidden: false,
    fiveMinuteAlertShown: false,
    assemblyNotes: [],
    ...over,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('exam timer', () => {
  it('counts down from an absolute deadline', () => {
    const t = startTimer(32 * MIN, T0);
    expect(remainingMs(t, T0)).toBe(32 * MIN);
    expect(remainingMs(t, T0 + 61_500)).toBe(32 * MIN - 61_500);
    expect(usedMs(t, T0 + 61_500)).toBe(61_500);
    expect(isExpired(t, T0 + 32 * MIN - 1)).toBe(false);
    expect(isExpired(t, T0 + 32 * MIN)).toBe(true);
    expect(remainingMs(t, T0 + 40 * MIN)).toBe(0);
  });

  it('stays right while the tab is hidden: the deadline does not depend on ticks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const t = startTimer(32 * MIN, Date.now());
    // A hidden tab throttles a 1 s interval to about once a minute. Over 10 minutes a tick
    // counter would see about 10 ticks and think 10 seconds passed.
    const throttledTicks = 10;
    vi.setSystemTime(T0 + 10 * MIN);
    const tickCountedLeft = 32 * MIN - throttledTicks * 1000;
    expect(tickCountedLeft).toBe(31 * MIN + 50_000); // wrong by almost 10 minutes
    expect(remainingMs(t, Date.now())).toBe(22 * MIN); // right
    // Sleep: the wall clock jumps 15 minutes at once with no ticks at all.
    vi.setSystemTime(T0 + 25 * MIN);
    expect(remainingMs(t, Date.now())).toBe(7 * MIN);
  });

  it('survives a reload: the saved timer gives the same time left', () => {
    const before = exam();
    const saved = JSON.parse(JSON.stringify(before)) as ExamState; // what the session record stores
    const now = T0 + 12 * MIN + 345;
    expect(remainingMs(saved.timer, now)).toBe(remainingMs(before.timer, now));
    expect(remainingMs(saved.timer, now)).toBe(20 * MIN - 345);
  });

  it('knows the deadline passed while the tab was closed', () => {
    const saved = exam();
    const reopenedAt = T0 + 50 * MIN;
    expect(isExpired(saved.timer, reopenedAt)).toBe(true);
    expect(remainingMs(saved.timer, reopenedAt)).toBe(0);
    expect(usedMs(saved.timer, reopenedAt)).toBe(32 * MIN);
  });

  it('pause stops the clock and keeps the reason; resume carries on; the mark stays', () => {
    let e = exam();
    e = pauseExam(e, 'Technical problem', T0 + 10 * MIN);
    expect(isPaused(e.timer)).toBe(true);
    // Hours pass while paused; nothing is lost and it never expires.
    expect(remainingMs(e.timer, T0 + 5 * 60 * MIN)).toBe(22 * MIN);
    expect(isExpired(e.timer, T0 + 5 * 60 * MIN)).toBe(false);
    e = resumeExam(e, T0 + 60 * MIN);
    expect(remainingMs(e.timer, T0 + 61 * MIN)).toBe(21 * MIN);
    expect(e.pauses).toEqual([{ at: T0 + 10 * MIN, reason: 'Technical problem', resumedAt: T0 + 60 * MIN }]);
    expect(wasPaused(e)).toBe(true);
    // Pausing twice or resuming a running clock changes nothing.
    expect(resumeExam(e, T0 + 62 * MIN)).toBe(e);
    const p = pauseExam(e, 'Other', T0 + 62 * MIN);
    expect(pauseExam(p, 'Other', T0 + 63 * MIN)).toBe(p);
  });

  it('cannot pause an expired clock', () => {
    const t = startTimer(MIN, T0);
    expect(pauseTimer(t, T0 + 2 * MIN)).toBe(t);
    expect(resumeTimer(t, T0)).toBe(t);
  });

  it('the five-minute alert is due once, inside the last five minutes only', () => {
    const e = exam();
    expect(fiveMinuteAlertDue(e, T0 + 26 * MIN)).toBe(false);
    expect(fiveMinuteAlertDue(e, T0 + 27 * MIN)).toBe(true);
    expect(fiveMinuteAlertDue({ ...e, fiveMinuteAlertShown: true }, T0 + 28 * MIN)).toBe(false);
    expect(fiveMinuteAlertDue(e, T0 + 32 * MIN)).toBe(false); // expired: submit instead
    expect(fiveMinuteAlertDue(pauseExam(e, 'x', T0 + 28 * MIN), T0 + 28 * MIN)).toBe(false);
  });
});
