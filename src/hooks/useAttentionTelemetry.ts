import { useEffect, useRef } from 'react';
import { telemetry } from '../services/telemetry';
import type { SessionMode } from '../types/session';

/** No key press, click, touch, wheel or scroll for this long is an idle period. */
export const IDLE_THRESHOLD_MS = 30_000;
const IDLE_CHECK_MS = 1000;
const INPUT_EVENTS = ['keydown', 'pointerdown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * Logs tab hidden and visible, window blur and focus, and idle periods while a session screen is
 * open, so active time can be told apart from wall time. Pointer movement is not input here and
 * is never recorded. Pass null to log nothing.
 */
export function useAttentionTelemetry(ctx: { sessionId: string; mode: SessionMode; questionId: string | null } | null): void {
  const ref = useRef(ctx);
  ref.current = ctx;
  const sessionId = ctx?.sessionId ?? null;

  useEffect(() => {
    if (sessionId === null) return;
    const log = (type: 'tab_hidden' | 'tab_visible' | 'window_blur' | 'window_focus') => {
      const c = ref.current;
      if (c) telemetry.log(type, c, {});
    };
    let lastInput = performance.now();
    let idle = false;

    const onVisibility = () => log(document.visibilityState === 'hidden' ? 'tab_hidden' : 'tab_visible');
    // Switching tabs also blurs the window; only a blur with the tab still visible is logged.
    const onBlur = () => {
      if (document.visibilityState === 'visible') log('window_blur');
    };
    const onFocus = () => log('window_focus');
    const onInput = () => {
      const t = performance.now();
      const c = ref.current;
      if (idle && c) telemetry.log('idle_end', c, { idleMs: Math.round(t - lastInput) });
      idle = false;
      lastInput = t;
    };
    const timer = window.setInterval(() => {
      const c = ref.current;
      if (!idle && c && performance.now() - lastInput >= IDLE_THRESHOLD_MS) {
        idle = true;
        telemetry.log('idle_start', c, { thresholdMs: IDLE_THRESHOLD_MS });
      }
    }, IDLE_CHECK_MS);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    for (const e of INPUT_EVENTS) window.addEventListener(e, onInput, { capture: true, passive: true });
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      for (const e of INPUT_EVENTS) window.removeEventListener(e, onInput, { capture: true });
    };
  }, [sessionId]);
}
