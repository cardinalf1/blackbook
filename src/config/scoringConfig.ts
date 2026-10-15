// Every number behind routing and the score estimate. This is a transparent approximation, not a
// replica: the real routing thresholds and score conversion are not public, and the bank has no
// calibrated item parameters (docs/scoring-spec.md). Each value is marked VERIFIED (with a source)
// or ASSUMED. Change a value and bump SCORING_CONFIG_VERSION: past results keep the version they
// were computed with, so they are never rewritten.

import type { Difficulty } from '../types/sat';

export const SCORING_CONFIG_VERSION = 1;

/**
 * Weight of a correct answer by the bank's scoreBand (1 to 7). VERIFIED in the data: bands 1-3 are
 * the easy questions, 4-5 medium, 6-7 hard (checked over the whole bank, see docs/scoring-spec.md).
 * ASSUMED: the weights themselves; they only say that a harder question counts for more.
 */
export const BAND_WEIGHTS: Readonly<Record<number, number>> = { 1: 1, 2: 1.25, 3: 1.5, 4: 2, 5: 2.5, 6: 3, 7: 3.5 };
/** Used when a question has no usable band: by its easy / medium / hard label. */
export const DIFFICULTY_WEIGHTS: Readonly<Record<Difficulty, number>> = { E: 1.25, M: 2.25, H: 3.25 };

/**
 * ASSUMED (Blackbook's own choice): module 1 goes to the harder module 2 when the weighted share
 * correct is at least this. The only official statement is that the break point is "around the
 * median" section score; it does not say whether routing uses number correct, a weighted score or
 * an IRT estimate. Community sources put the cut at roughly two thirds correct, unevenly across
 * sections and administrations. 0.5 on the weighted scale is about "all easy and medium right".
 */
export const ROUTING_THRESHOLD = 0.5;

/**
 * Module 2 difficulty mix as relative weights for [easy, medium, hard]. ASSUMED. Module 1 is the
 * broad mix the technical manual describes (VERIFIED: "a broad mix of easy, medium-difficulty, and
 * hard questions"), taken as equal thirds.
 */
export const TIER_MIX: Readonly<Record<'routing' | 'easier' | 'harder', readonly [number, number, number]>> = {
  routing: [1, 1, 1],
  easier: [5, 4, 1],
  harder: [1, 4, 5],
};

/**
 * COMMUNITY-DERIVED, UNVERIFIED: the top of the scale reachable through the easier module 2.
 * Official text says "a range of section scores is possible, no matter which second module", so
 * this is likely too hard a cap; the only figure found is a blog's. It is kept so the estimate
 * leans cautious on the easier route, and the report says the effect is not published.
 */
export const EASIER_ROUTE_CAP = 600;
/** COMMUNITY-DERIVED, UNVERIFIED (no source found at all): the lowest section score shown on the harder module 2. */
export const HARDER_ROUTE_FLOOR = 400;
export const SCORE_MIN = 200;
export const SCORE_MAX = 800;

/** ASSUMED: half-width of the range with a full set of answers, in scale points. */
export const BASE_HALF_WIDTH = 40;
/** ASSUMED: extra half-width when every question is unanswered; scales with the unanswered share. */
export const UNANSWERED_HALF_WIDTH = 120;
/** ASSUMED: extra half-width on the easier route, where the conversion is less certain; makes its range visibly wider. */
export const EASIER_ROUTE_EXTRA_HALF_WIDTH = 20;
/** Scores are shown rounded to this step. */
export const SCORE_STEP = 10;

/**
 * VERIFIED: one 10-minute scheduled break between Reading and Writing and Math (Specifications
 * Overview, official help text). Students cannot start or end it early (How do student breaks work).
 */
export const BREAK_MS = 10 * 60_000;
