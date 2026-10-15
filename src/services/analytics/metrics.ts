// Small pure helpers behind the analytics screens: confidence-aware rates, pooled counts and the
// config-version check for score estimates. Numbers come from src/config/analyticsConfig.ts.

import { LOW_CONFIDENCE_ATTEMPTS, WILSON_Z } from '../../config/analyticsConfig';
import type { ByMode, ModeCounts, RateView, TestHistoryRow } from '../../types/analytics';

/**
 * Lower end of the Wilson score interval for a proportion: the accuracy you can claim with some
 * confidence given how many questions you answered. 0 with no answers; 1 of 1 gives about 0.5 while
 * 18 of 20 gives about 0.78, so a lucky single answer never outranks a solid record.
 */
export function wilsonLowerBound(correct: number, attempts: number, z: number = WILSON_Z): number {
  if (attempts <= 0) return 0;
  const p = correct / attempts;
  const z2 = z * z;
  const centre = p + z2 / (2 * attempts);
  const margin = z * Math.sqrt((p * (1 - p)) / attempts + z2 / (4 * attempts * attempts));
  return Math.max(0, (centre - margin) / (1 + z2 / attempts));
}

export function rateView(correct: number, attempts: number): RateView {
  return {
    attempts,
    correct,
    accuracy: attempts > 0 ? correct / attempts : null,
    lowConfidence: attempts < LOW_CONFIDENCE_ATTEMPTS,
    lowerBound: wilsonLowerBound(correct, attempts),
  };
}

/** "18 of 20 (90%)", "no answers yet", with "low N" when the sample is small. */
export function describeRate(r: RateView): string {
  if (r.accuracy === null) return 'no answers yet';
  const text = `${r.correct} of ${r.attempts} (${Math.round(r.accuracy * 100)}%)`;
  return r.lowConfidence ? `${text}, low N` : text;
}

/** Drill and exam counts added together. Only for ranking; screens show the two apart. */
export function pooled(counts: ByMode<ModeCounts>): ModeCounts {
  return {
    attempts: counts.drill.attempts + counts.exam.attempts,
    correct: counts.drill.correct + counts.exam.correct,
    timeMs: counts.drill.timeMs + counts.exam.timeMs,
  };
}

/** Average active time per answer in ms, or null with no answers. */
export function averageMs(c: ModeCounts): number | null {
  return c.attempts > 0 ? c.timeMs / c.attempts : null;
}

export interface EstimateVersions {
  /** Distinct scoring config versions among the tests, ascending. */
  versions: number[];
  /** More than one version: the points are not comparable with each other. */
  mixed: boolean;
}

/** Estimates from different scoring config versions are not comparable (docs/scoring-spec.md). */
export function estimateVersions(tests: readonly Pick<TestHistoryRow, 'configVersion' | 'estimate'>[]): EstimateVersions {
  const versions = [...new Set(tests.filter((t) => t.estimate !== null).map((t) => t.configVersion))].sort((a, b) => a - b);
  return { versions, mixed: versions.length > 1 };
}

/** Net effect of answer changes on multiple-choice questions: right-after-wrong minus wrong-after-right. */
export function netChangeEffect(c: { correctToIncorrect: number; incorrectToCorrect: number }): number {
  return c.incorrectToCorrect - c.correctToIncorrect;
}
