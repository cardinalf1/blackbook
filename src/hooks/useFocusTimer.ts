import { useCallback, useEffect, useRef } from 'react';

const SAVE_EVERY_MS = 5000;

/**
 * Counts milliseconds while the page is visible and `active` is true. Time before a reload comes
 * in as `baseMs`. `onElapsed` is called every few seconds and when the page is hidden or closed,
 * so a reload loses at most a few seconds. Remount (change `key`) to restart for a new question.
 */
export function useFocusTimer(opts: { baseMs: number; active: boolean; onElapsed?: (ms: number) => void }): () => number {
  const { baseMs, active, onElapsed } = opts;
  const acc = useRef(baseMs);
  const since = useRef<number | null>(null);
  const report = useRef(onElapsed);
  report.current = onElapsed;

  const read = useCallback(() => acc.current + (since.current === null ? 0 : performance.now() - since.current), []);

  useEffect(() => {
    if (!active) return;
    const start = () => {
      if (since.current === null && document.visibilityState === 'visible') since.current = performance.now();
    };
    const stop = () => {
      if (since.current !== null) {
        acc.current += performance.now() - since.current;
        since.current = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else {
        stop();
        report.current?.(acc.current);
      }
    };
    const onUnload = () => {
      stop();
      report.current?.(acc.current);
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onUnload);
    const timer = window.setInterval(() => report.current?.(read()), SAVE_EVERY_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onUnload);
      window.clearInterval(timer);
      stop();
    };
  }, [active, read]);

  return read;
}
