// Pace targets. DERIVED from the verified module shapes in examConfig.ts: module time divided by
// questions. The real modules include 2 unscored pretest questions each, which the bank does not
// have, so these targets spread the time over scored questions only (docs/exam-spec.md).

import { EXAM_MODULES } from './examConfig';
import type { Section } from '../types/sat';

/** Reading and Writing: 32 min / 27 = about 71 s. Math: 35 min / 22 = about 95 s. */
export const PACE_TARGET_MS: Record<Section, number> = {
  rw: EXAM_MODULES.rw.durationMs / EXAM_MODULES.rw.questions,
  math: EXAM_MODULES.math.durationMs / EXAM_MODULES.math.questions,
};

/** Checkpoints in the reports: share of the module's time, and where you should be by then. */
export const PACE_CHECKPOINTS: readonly number[] = [0.25, 0.5, 0.75];

/** A question over target by more than this share is listed as over target. */
export const OVER_TARGET_SLACK = 0.25;

/** The optional live hint in drills: says "behind" once this far behind the pace. */
export const LIVE_HINT_BEHIND_MS = 30_000;
