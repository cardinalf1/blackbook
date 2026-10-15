// Numbers behind the mistake log and the retry queue. All are choices, not facts about the real test.

/** Days after a miss until a question is due again, then after each correct retry. A correct retry at the last step graduates it. */
export const RETRY_INTERVALS_DAYS: readonly number[] = [2, 7, 21];

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Most questions one retry session serves. Longer queues take several sessions, longest overdue first. */
export const RETRY_SESSION_MAX = 20;

/** A wrong answer given in under this share of your own median time on that skill suggests "careless". */
export const CARELESS_TIME_RATIO = 0.5;

/** The skill median needs at least this many of your own answered questions, else no timing-based suggestion is made. */
export const MIN_ANSWERS_FOR_MEDIAN = 5;
