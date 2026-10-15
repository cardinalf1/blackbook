import { useEffect, useRef, useState } from 'react';
import { fiveMinuteAlertDue, isExpired, remainingMs } from '../services/exam/timer';
import type { ExamState } from '../types/exam';

/** Redraw rate. The time shown is always recomputed from the deadline, so ticks only refresh it. */
const REDRAW_MS = 250;

/**
 * Time left on an exam module, recomputed from the saved deadline on every redraw (and when the
 * tab becomes visible again), never counted down by ticks. Calls `onExpire` once when time runs
 * out and `onFiveMinutes` once when the alert is due. Nothing here waits on saving or telemetry.
 */
export function useExamClock(
  exam: ExamState | undefined,
  handlers: { onExpire: () => void; onFiveMinutes: () => void },
  now: () => number = Date.now,
): number {
  const [left, setLeft] = useState(() => (exam ? remainingMs(exam.timer, now()) : 0));
  const h = useRef(handlers);
  h.current = handlers;
  const examRef = useRef(exam);
  examRef.current = exam;
  const expiredFired = useRef(false);
  const alertFired = useRef(false);

  useEffect(() => {
    const tick = () => {
      const e = examRef.current;
      if (!e || e.phase === 'submitted') return;
      const t = now();
      setLeft(remainingMs(e.timer, t));
      if (!alertFired.current && fiveMinuteAlertDue(e, t)) {
        alertFired.current = true;
        h.current.onFiveMinutes();
      }
      if (!expiredFired.current && isExpired(e.timer, t)) {
        expiredFired.current = true;
        h.current.onExpire();
      }
    };
    tick();
    const id = window.setInterval(tick, REDRAW_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [now]);

  // A resumed clock (after a pause) may expire again later; a new deadline re-arms the expiry.
  useEffect(() => {
    if (exam && !isExpired(exam.timer, now())) expiredFired.current = false;
    if (exam?.fiveMinuteAlertShown) alertFired.current = true;
  }, [exam, now]);

  return left;
}
