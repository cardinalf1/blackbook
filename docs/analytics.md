# Analytics (Phase 5)

The Analytics area turns data Blackbook already stores (sessions, answers, events, test estimates) into three answers: where you are weak, how you behave under time, and what to study next. It tracks nothing new. Everything runs on your computer; the browser receives summaries, never raw events.

Counts and timing describe **behavior**. Nothing here knows why you answered the way you did.

## Where the numbers come from

`server/analytics.ts` runs SQL over `user.db`. Facts about each question (section, skill, difficulty, correct choice) live in the bank file, so they are copied into a temporary table whenever the bank changes. `src/services/analytics/brute.ts` recomputes every figure with plain loops and shares no code with the SQL; `bun scripts/analytics-check.ts` (your data) and `bun scripts/analytics-check.ts --synthetic` compare the two, and `server/analytics.test.ts` does the same in the test suite.

## Counting rules

- Only **finished** sessions count. Full-test containers hold no questions and feed the test history only.
- An **answer** is a final, non-empty response. A skipped question is not an answer.
- A session counts by when it finished. The section filter uses the section of the session.
- **Drill and exam figures are separate** everywhere. Study next pools them for ranking only, and says so.
- Filters: date range, kind (drill, single question, practice module, section run, full test), section, exclude paused tests, exclude single-question sessions. "Paused" means an exam module with an emergency pause, or any module of a test that had one.

## Small samples

Every rate shows its N. A rate from fewer than `LOW_CONFIDENCE_ATTEMPTS` (10) answers is marked "low N". Skills are ranked by the lower end of a Wilson interval (z = 1.2816, an 80% interval), not by raw accuracy, so 1 right out of 1 never counts as mastery (a test proves it ranks below 18 of 20). All parameters are in `src/config/analyticsConfig.ts`.

## Study next

- Skills with at least `MIN_ATTEMPTS_TO_RANK` (5) answers: priority = 1 minus the Wilson lower bound, plus up to 0.05 for unseen questions.
- Skills with fewer: priority = 0.45 plus up to 0.10 for the share of live questions never seen, so they land between proven weak spots and proven strengths.
- Skills with no live question are left out.
- **Drill top skills** launches a normal drill on the top three skills of a section (the drill picker already serves never-answered questions first).
- **Review my misses** launches a normal drill with `questionIds`: questions whose latest finished answer was wrong, oldest miss first. No new session type.

## Timing

"Rushed and wrong" is a wrong answer faster than the 15th percentile of your own time for the same **mode, section and difficulty**. "Took unusually long" is slower than the 90th percentile of the same group, right or wrong. Percentiles use the nearest-rank rule over all your finished answers (the date filter does not move the baseline). A group with fewer than 20 answers is not flagged. Drills (untimed) and exam modules (timed) have separate baselines.

For exam modules: time left at the end comes from the saved timer and the finish time. "Answered in the last five minutes" counts questions whose **first** answer came after the five-minute alert; a module that ended earlier shows "ended before the five-minute alert".

## Behavior

- **Changed answers:** an answer replaced or cleared at least once (the stored change count).
- **Right to wrong / wrong to right:** direct replacements of one choice by another on multiple-choice questions, judged against the key. Typed answers are not included. Net effect = wrong-to-right minus right-to-wrong.
- **Strike-outs:** multiple-choice answers on which a choice was struck, and the strikes made.
- **Confidence:** only when the drill asked for it. "Sure but wrong" and "guess but right" are plain counts.

## Test history and scoring versions

Estimate ranges are the Phase 4 ranges (`docs/scoring-spec.md`); there is no new predictor. Each estimate keeps the scoring config version it was computed with. A chart that spans versions shows a warning and gives each version its own marker pattern.

## Limits

- The estimate is an approximation, useful for comparing your own tests with each other.
- Skill trends use the latest five sessions; with few sessions they are noisy.
- Unseen counts use live questions only, matching the drill default.
