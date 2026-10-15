# Routing and score estimate (Phase 4)

Blackbook's routing and score estimate are a **transparent approximation**, not a replica of the real test. The routing thresholds and the score conversion are not public, and the question bank has no calibrated item parameters. Nothing here uses IRT or invented item parameters, and no single exact score is ever shown (AGENTS.md rule 5). Every number is in `src/config/scoringConfig.ts`, marked verified or assumed, and each stored result keeps the config version it was computed with (`SCORING_CONFIG_VERSION`).

## What the bank's `scoreBand` is

Checked over the whole local bank with a script (3,695 questions counted by section, difficulty label and `scoreBand`): `scoreBand` is an integer 1 to 7 and it **nests inside the difficulty label**. Easy is 1 to 3, Medium is 4 to 5, Hard is 6 to 7, in both sections, with no overlap. It is a finer difficulty signal than E/M/H, and the weights are built on it (`BAND_WEIGHTS`). It is not a calibrated item parameter; the data says nothing about what it measures beyond that ordering. When a question has no usable band, its E/M/H label is used (`DIFFICULTY_WEIGHTS`).

## Sources

1. **Technical manual** (`docs/exam-spec.md`, source 4). Module 1 is "a broad mix of easy, medium-difficulty, and hard questions"; the test uses item response theory and is multistage adaptive. No thresholds or tables are given.
2. **Official score page**, "How Scores Are Calculated" (satsuite.collegeboard.org, understanding scores). Says scores come from IRT-based scaling, that a range of section scores is possible whichever second module a student sees, and that students routed to either module 2 can reach the college readiness benchmark. It publishes **no** routing threshold, no ceiling for the easier module and no conversion table.
3. **Community and tutoring sites** (for example Academic Approach, TutelaPrep and various score calculators; read 2026-10-15). They say the easier module 2 limits the maximum section score and give figures around 590 to 600 for it, and a routing cut at roughly two thirds correct or "570 to 600 points of performance". They disagree with each other and none cites an official document. **These are community-derived and not verified.**

## What is verified and what is assumed

| Item | Value | Status |
|---|---|---|
| Module 1 is a broad mix of difficulty | Equal thirds easy, medium, hard (`TIER_MIX.routing`) | Wording verified (source 1); equal thirds assumed |
| Module 2 depends on module 1 performance | Yes | Verified (sources 1, 2) |
| Difficulty bands | E 1 to 3, M 4 to 5, H 6 to 7 | Verified in the bank data |
| Band weights | 1, 1.25, 1.5, 2, 2.5, 3, 3.5 | Assumed; they only say harder counts more |
| Routing rule | Weighted share correct on module 1 at or above `ROUTING_THRESHOLD` (0.5) goes to the harder module 2 | Assumed (Blackbook's own; official text says only "around the median" section score). Community figures say about two thirds correct; 0.5 on the weighted scale is about "all easy and medium right" |
| Module 2 difficulty mix (easy : medium : hard) | Easier 5:4:1, harder 1:4:5 | Assumed |
| Easier-route ceiling | 600 per section (`EASIER_ROUTE_CAP`) | Community-derived, unverified (source 3). Official text says a full range of section scores is possible from either Module 2, so this may be too low; the report says the easier route "may limit the top of your range; the exact effect is not published" |
| Harder-route floor | 400 per section (`HARDER_ROUTE_FLOOR`) | Community-derived, unverified (no source found) |
| Conversion | Linear from the weighted share correct over both modules onto 200 to 600 (easier route) or 400 to 800 (harder route) | Assumed |
| Range | Half-width 40, plus up to 120 for the unanswered share, plus 20 on the easier route; rounded to 10; the easier route's top is cut at the ceiling | Assumed |
| Break | 10 minutes, cannot be ended early | Verified (`docs/exam-spec.md`) |

## How the estimate is computed

1. Each question gets a weight from its `scoreBand`. A wrong or unanswered question scores 0.
2. After module 1, the weighted share correct is compared with the threshold to pick the route. The decision, its inputs and the config version are stored with the test.
3. For a section, the weighted share correct over **both** modules is mapped linearly onto the route's score band. The midpoint is shown small.
4. The range is the midpoint plus and minus a half-width that grows with the unanswered share and on the easier route. On the easier route the top is cut at the ceiling, and the report says so when that happens.
5. A total range is shown only when both sections were taken: low plus low, high plus high.

The engine is a pure function (`src/services/test/estimate.ts`) of answers, difficulties and routing. `bun scripts/test-estimate.ts` prints the estimate for a stored test and cross-checks its inputs against the stored attempts.

## What it cannot tell you

It does not know the real conversion, so the numbers can be off by more than the range, especially near the ends of the scale. It is useful for comparing your own tests with each other, not for predicting a test day score.
