// Every number that approximates the real test. Each is marked VERIFIED (with its source in
// docs/exam-spec.md) or ASSUMED. Assembly, the timer and the screens read from here only.

import type { Difficulty, Section } from '../types/sat';

export interface ModuleShape {
  /** Questions in one module. */
  questions: number;
  /** Time for one module, ms. */
  durationMs: number;
  /** Domains in the order they appear in a module, with how many questions each. */
  domains: readonly { code: string; label: string; count: number }[];
  /** Student-produced response questions per module (Math only). */
  sprCount: number;
}

export const EXAM_MODULES: Record<Section, ModuleShape> = {
  rw: {
    // VERIFIED: 27 questions, 32 minutes per module (sources 1, 3).
    questions: 27,
    durationMs: 32 * 60_000,
    // VERIFIED order (source 4, Table 2.2). Counts DERIVED from the whole-section shares
    // (≈28 / 26 / 26 / 20 %, source 1) applied to 27 with largest-remainder rounding.
    domains: [
      { code: 'CAS', label: 'Craft and Structure', count: 8 },
      { code: 'INI', label: 'Information and Ideas', count: 7 },
      { code: 'SEC', label: 'Standard English Conventions', count: 7 },
      { code: 'EOI', label: 'Expression of Ideas', count: 5 },
    ],
    sprCount: 0,
  },
  math: {
    // VERIFIED: 22 questions, 35 minutes per module (sources 2, 3).
    questions: 22,
    durationMs: 35 * 60_000,
    // Counts DERIVED from ≈35 / 35 / 15 / 15 % (source 2) applied to 22. The order of domains
    // within a Math module is not specified; ASSUMED the order the source lists them.
    domains: [
      { code: 'H', label: 'Algebra', count: 8 },
      { code: 'P', label: 'Advanced Math', count: 8 },
      { code: 'Q', label: 'Problem-Solving and Data Analysis', count: 3 },
      { code: 'S', label: 'Geometry and Trigonometry', count: 3 },
    ],
    // DERIVED: ≈25 % of Math items are student-produced response (source 4); 25 % of 22 = 5.5, rounded to 6.
    sprCount: 6,
  },
};

/** ASSUMED: each domain's questions split evenly across easy, medium and hard (source 4 says only "a broad mix"). */
export const DIFFICULTY_MIX: readonly Difficulty[] = ['E', 'M', 'H'];

/**
 * ASSUMED skill order inside a Reading and Writing domain (source 4 says "ordered first by skill",
 * not in which order). Standard English Conventions ignores skill (VERIFIED, source 4).
 */
export const RW_SKILL_ORDER: readonly string[] = ['WIC', 'TSP', 'CTC', 'CID', 'COE', 'INF', 'SYN', 'TRA'];
/** VERIFIED (source 4): Standard English Conventions are ordered by difficulty only. */
export const RW_DIFFICULTY_ONLY_DOMAINS: readonly string[] = ['SEC'];

/**
 * Math order. 'official' (default): the whole module easiest to hardest, ties by domain (VERIFIED
 * wording in source 4; placement of student-produced responses is not specified there).
 * 'spec': the earlier Phase 3 spec, multiple choice first, student-produced responses last, each
 * block by domain then easiest to hardest (ASSUMED, kept as a switch).
 */
export const MATH_ORDER: 'spec' | 'official' = 'official';

/** ASSUMED: the alert fires once at five minutes left and shows the timer if it was hidden. */
export const FIVE_MINUTE_ALERT_MS = 5 * 60_000;

/** VERIFIED (source 3): up to 5 characters for a positive answer, 6 including a leading minus. */
export const SPR_MAX_CHARS = 5;
export const SPR_MAX_CHARS_NEGATIVE = 6;
/** ASSUMED: only these characters can be typed (the directions forbid %, comma and $). */
export const SPR_ALLOWED = /^-?[0-9./]*$/;

/** ASSUMED reasons offered for an emergency pause. A pause always marks the result as paused. */
export const PAUSE_REASONS: readonly string[] = ['Emergency', 'Technical problem', 'Interrupted', 'Other'];

/** Dev only: shorten module time for testing auto-submit. Never applied in a production build. */
export const DEV_DURATION_OVERRIDE_KEY = 'blackbook.dev.examSeconds';
