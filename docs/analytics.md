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

## Dashboard (Phase 8)

One page, reached from Home > Progress > Dashboard, replaces the top-level Analytics, My skills, Study next and Study report entries. The old pages stay as drill-downs under "Detailed views" and are one click from the Dashboard.

- **One request per scope.** `GET /api/dashboard` (`server/dashboard.ts`) calls the same SQL summaries as the old screens and passes them to the pure builder `src/services/dashboard/build.ts`. Nothing is computed twice. `bun scripts/analytics-check.ts` builds the page from SQL and from the brute-force summaries for six scopes and requires them to be equal; it also reports the build time (synthetic set: median 216 ms, max 265 ms on 2026-10-16; your data: about 30 ms).
- **Scope.** Last test, 7 days, 30 days, All time (default 30 days, or All time with less than 30 days of data), a section toggle, and "More filters" with the old filter fields plus "Show hidden sessions". Changes against the previous period appear only when both periods have at least 10 answers.
- **Coach.** At most 3 insights from the Phase 7 builder, each with one action. A "weakest skill" needs at least 5 first attempts and is picked by the Study next lower-bound ranking. Pool health is not an insight; it is on the Take a test card and the numbers row. With fewer than 3 finished sessions the coach says how many more drills unlock it. AI-assisted wording (`GET /api/ai/coach`) replaces the rule-based lines when a key is set and AI is on; the model never sees or chooses the actions.
- **Mistakes** counts come from your own tags only. **Habits** and **Skills** show N beside every figure.

## Hidden sessions (Phase 8)

Past drills has "Hide from analytics" per session (reversible), "Hide all sessions before..." with a confirmation, and a "Show hidden sessions" toggle. Hidden sessions (and every module of a hidden test) leave the dashboard, the analytics summaries, the timing baselines, the insights and the weak-skill ranking. They still count as seen and done for the exam no-repeat rule, the retry queue, pool health and "questions done", because you did see those questions. The mark lives in its own table (migration 7) and is part of exports and backups. `server/hidden.test.ts` proves both halves.
