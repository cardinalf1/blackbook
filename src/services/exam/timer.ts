// The exam clock. Pure: every function takes `now` (epoch ms) and returns a new timer. Remaining
// time is always deadline minus now, never a count of interval ticks, so it is right after a
// hidden tab, sleep or reload. The deadline is saved with the session, so it survives a closed tab.

import { FIVE_MINUTE_ALERT_MS } from '../../config/examConfig';
import type { ExamPause, ExamState, ExamTimer } from '../../types/exam';

export function startTimer(durationMs: number, now: number): ExamTimer {
  return { durationMs, deadlineAt: now + durationMs, pausedRemainingMs: null };
}

export function isPaused(t: ExamTimer): boolean {
  return t.pausedRemainingMs !== null;
}

/** Milliseconds left, never negative. While paused, the time left when the clock stopped. */
export function remainingMs(t: ExamTimer, now: number): number {
  if (t.pausedRemainingMs !== null) return Math.max(0, t.pausedRemainingMs);
  if (t.deadlineAt === null) return 0;
  return Math.max(0, t.deadlineAt - now);
}

/** Time is up: running and the deadline has passed. A paused clock never expires. */
export function isExpired(t: ExamTimer, now: number): boolean {
  return !isPaused(t) && t.deadlineAt !== null && now >= t.deadlineAt;
}

/** Stops the clock. Pausing a paused or expired clock changes nothing. */
export function pauseTimer(t: ExamTimer, now: number): ExamTimer {
  if (isPaused(t) || isExpired(t, now)) return t;
  return { ...t, deadlineAt: null, pausedRemainingMs: remainingMs(t, now) };
}

/** Starts the clock again with the time that was left. */
export function resumeTimer(t: ExamTimer, now: number): ExamTimer {
  if (t.pausedRemainingMs === null) return t;
  return { ...t, deadlineAt: now + t.pausedRemainingMs, pausedRemainingMs: null };
}

/** Clock time used so far: the limit minus what is left. */
export function usedMs(t: ExamTimer, now: number): number {
  return Math.max(0, t.durationMs - remainingMs(t, now));
}

/** The five-minute alert is due once: running, not shown yet, at most five minutes left, not expired. */
export function fiveMinuteAlertDue(e: Pick<ExamState, 'timer' | 'fiveMinuteAlertShown'>, now: number): boolean {
  if (e.fiveMinuteAlertShown || isPaused(e.timer)) return false;
  const left = remainingMs(e.timer, now);
  return left > 0 && left <= FIVE_MINUTE_ALERT_MS && e.timer.durationMs > FIVE_MINUTE_ALERT_MS;
}

/** Pauses with a reason. Every pause is kept, so the result is marked paused for good. */
export function pauseExam(e: ExamState, reason: string, now: number): ExamState {
  const timer = pauseTimer(e.timer, now);
  if (timer === e.timer) return e;
  const pause: ExamPause = { at: now, reason, resumedAt: null };
  return { ...e, timer, pauses: [...e.pauses, pause] };
}

export function resumeExam(e: ExamState, now: number): ExamState {
  const timer = resumeTimer(e.timer, now);
  if (timer === e.timer) return e;
  const pauses = e.pauses.map((p, i) => (i === e.pauses.length - 1 && p.resumedAt === null ? { ...p, resumedAt: now } : p));
  return { ...e, timer, pauses };
}

export function wasPaused(e: Pick<ExamState, 'pauses'>): boolean {
  return e.pauses.length > 0;
}
