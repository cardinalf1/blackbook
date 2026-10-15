// Dev-only shortened clocks, so a whole test can be exercised quickly. Applied only in a dev
// build (import.meta.env.DEV); a production build always uses the real lengths.

import { DEV_BREAK_OVERRIDE_KEY, DEV_DURATION_OVERRIDE_KEY, EXAM_MODULES } from '../../config/examConfig';
import { BREAK_MS } from '../../config/scoringConfig';
import type { Section } from '../../types/sat';

function override(key: string): number | null {
  if (!import.meta.env.DEV) return null;
  const raw = window.localStorage.getItem(key);
  const seconds = raw === null ? NaN : Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

/** Module time: the real limit, or in a dev build only, a short override for testing auto-submit. */
export function moduleDurationMs(section: Section): number {
  return override(DEV_DURATION_OVERRIDE_KEY) ?? EXAM_MODULES[section].durationMs;
}

/** Break length: the configured one, or in a dev build only, a short override. */
export function breakDurationMs(): number {
  return override(DEV_BREAK_OVERRIDE_KEY) ?? BREAK_MS;
}
