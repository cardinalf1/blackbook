// Every number behind the analytics screens (Phase 5). Nothing here is measured from the real test:
// these are choices about how cautious to be with small samples and how to define "rushed" and
// "stuck" from your own timing. Change a value and the screens follow; stored data is never touched.

/**
 * One-sided z for the Wilson lower bound used to rank skills. 1.2816 is a 90% one-sided bound: the
 * true accuracy is probably at least this high. A bigger z is more cautious about small samples.
 */
export const WILSON_Z = 1.2816;

/** Fewer answered questions than this and a rate is shown as low confidence ("low N"). */
export const LOW_CONFIDENCE_ATTEMPTS = 10;

/** A skill needs at least this many answers before its accuracy decides its study priority. */
export const MIN_ATTEMPTS_TO_RANK = 5;

/**
 * Study priority is 0 to 1, higher means work on it sooner. A skill with enough answers scores
 * 1 minus its Wilson lower bound (a skill you answer well, with enough evidence, scores low).
 * A skill with too few answers scores COLD_START_PRIORITY plus up to UNSEEN_BONUS for how much of
 * it is still unseen, so it lands between your proven weak spots and your proven strengths.
 */
export const COLD_START_PRIORITY = 0.45;
export const UNSEEN_BONUS = 0.1;
/** A skill with enough answers also gets up to this much extra for unseen questions still waiting. */
export const UNSEEN_BONUS_RANKED = 0.05;

/** "Rushed and wrong": a wrong answer faster than this percentile of your own time for that mode, section and difficulty. */
export const RUSH_PERCENTILE = 15;
/** "Stuck": an answer slower than this percentile of the same group. */
export const STUCK_PERCENTILE = 90;
/** A timing group needs this many answers before anything in it is flagged. */
export const MIN_BASELINE_ATTEMPTS = 20;

/** How many of the latest sessions with a skill make up its trend. */
export const RECENT_SESSIONS = 5;
/** The most flagged questions the timing screen lists (newest first). */
export const MAX_FLAGGED_LISTED = 100;
/** The most missed questions one request returns. */
export const MAX_MISSES = 500;

/** Study next: how many top skills the drill covers, and how many questions it serves. */
export const STUDY_TOP_SKILLS = 3;
export const STUDY_DRILL_COUNT = 10;
export const REVIEW_MISSES_COUNT = 15;
/** How many skills the Study next list shows. */
export const STUDY_LIST_LENGTH = 10;

/** Bumped when a definition above changes meaning, so a stored screenshot or note can be placed. */
export const ANALYTICS_CONFIG_VERSION = 1;

export const RANKING_EXPLANATION =
  `Skills are ranked by the lower end of an 80% confidence interval for your accuracy (Wilson interval, z = ${WILSON_Z}), not by raw accuracy, ` +
  `so 1 right out of 1 does not count as mastery. Skills with fewer than ${MIN_ATTEMPTS_TO_RANK} answers are placed after your proven weak spots, ` +
  'earlier the more of the skill you have not seen.';

// ---- Dashboard (Phase 8) ----

/** The coach needs this many finished sessions (hidden ones not counted) before it shows insights. */
export const COACH_MIN_SESSIONS = 3;
/** A numbers-row change against the previous period is shown only when both periods have this many answers. */
export const KPI_MIN_ATTEMPTS = 10;
/** Trend points with fewer answers are drawn hollow; with fewer points than this a table replaces the line. */
export const TREND_HOLLOW_BELOW = 10;
export const TREND_TABLE_BELOW_POINTS = 3;
/** Habits figures resting on fewer than this are marked "thin data". */
export const HABITS_THIN_BELOW = 20;

/**
 * Official share of each domain within its section (docs/exam-spec.md, "Verified"), by the bank's
 * domain codes. Used only to compare with your own practice time.
 */
export const DOMAIN_WEIGHTS: Readonly<Record<string, number>> = {
  CAS: 0.28,
  INI: 0.26,
  SEC: 0.26,
  EOI: 0.2,
  H: 0.35,
  P: 0.35,
  Q: 0.15,
  S: 0.15,
};

/** Shown once at the bottom of the dashboard. */
export const DASHBOARD_LIMITS =
  'Computed on this computer from your finished sessions. Counts and timing describe what you did, not why; only your own tags say why. ' +
  'The score range is an approximation from a practice scoring model, useful for comparing your own tests, not a prediction of an official score.';
