# Session handoff

Read this first in a new session, after AGENTS.md and CLAUDE.md. Updated by Claude at the end of each session or milestone. No College Board content in this file.

Last updated: 2026-10-14, Phase 2 build session (Claude).

## Where things are

- Phase: **2 (Drill mode)**, AGENTS.md says 2. Branch `claude/phase1-ingest` (Phase 1 and 2 work together), not pushed, no PR. User will make the GitHub repo private first and say when to push. Do not push before that.
- `assets/` was deleted by the user. Working tree clean at `082c869`.
- `bun run typecheck`, `bun run test` (184 tests) pass. `bun run sync` exits 0 (known malformed item `029650-DC` is a warning). `git ls-files` has no data/fixtures/.env.
- AGENTS.md has a Parallelism section (I wrote it: no cap on Gemini workers, disjoint files, interfaces first, Claude merges one branch at a time).

## Phase 2 built

- Contracts: `src/types/drill.ts`. Services: `src/services/drill/` (facets, select, stats, session, facetCache). Store: `src/stores/drillStore.ts` (Zustand factory, resume). Storage: `AttemptStore` in `src/services/storage/attempt*.ts`, separate IndexedDB `blackbook-user`.
- SPR grader: exact rationals in `src/services/answers.ts`, rules in `docs/spr-grading.md`, real-bank check `bun run scripts/check-spr.ts`.
- Import: chunked on the main thread (DOMPurify needs a DOM, so no Web Worker), progress, Cancel via AbortSignal, store rollback on abort.
- Gemini branches merged (all reviewed): `drill-setup-ui`, `results-ui`, `myskills-ui`, `styling-pass`. Only change in review: MySkills reuses `formatDuration`, singular "attempt".
- Browser-verified on the full bank: import with progress (max main-thread block 148 ms), cancel while checking and while saving (bank intact), 10 R&W drill with mid-session reload and resume, 10 Math drill, results, review, My skills matches brute-force recount, all 20 stored grades match bank keys.

## Not verified / open

- The `styling-pass` look was not viewed in the real app (screenshots timed out); Gemini rendered synthetic props only.
- One unexplained import stall at "Checking 3620/3695" after a tool-timed-out script; not reproduced in three later runs.
- SPR judgement calls (trailing zeros accepted, unlisted roundings rejected, etc.) follow user's defaults, unverified against the real test.
- Out-of-phase ideas are in `docs/later.md`.

## Decisions the user made (do not re-ask)

- Deps: added dompurify, vitest, jsdom, @types/jsdom. Removed @google/genai, express, dotenv, @types/express, tsx, happy-dom. Ask before any other dependency.
- Out-of-phase scaffold: deleted. Phase 3 rebuilds against the real `Question` type.
- Legacy answers: MCQ key may come from the rationale only if `"Choice X is correct"` matches exactly once. Legacy SPR with no structured key is skipped. Report extracted and skipped counts separately, and print 20 random extracted answers next to their explanations for the user to eyeball.
- Active ("live") items: sync all, store `active` flag, filter in Phase 2.
- Claude may run several Gemini agents in parallel (CLAUDE.md). Claude's view: not worth it for Phase 1; use 2 or 3 at a time from Phase 2 on.

## Open questions for the user

- Classmates distribution (must be settled before Phase 2): the API allows CORS from any origin, so an in-browser "download from the source" button is possible with no server or proxy. User has not decided. Do not build it without a yes.
- Branch/PR flow: nothing pushed yet. Ask before pushing or opening a PR.

## Phase 1 verification results (2026-10-14)

- Full sync done and rerun with the SVG fix: 3695 questions (math 1850, rw 1845; digital 3306, legacy 389; 2019 active). 72 skipped: 69 legacy SPR with no key, 2 MCQ key conflicts with rationale, 1 `detail-shape` (`029650-DC`, legacy detail has no `prompt` field; malformed upstream, skip is correct). That one is why sync exits 2.
- Legacy keys: 378 structured, 11 extracted from rationale, 0 ambiguous MCQ. Sample of 20 is in `data/sync-report.txt`.
- Math: 37968 converted to KaTeX, 9 kept as MathML (U+200A x6, U+2206 x2, U+1D4C1 x1). 334 SVGs cleaned.
- Browser: full bank imported, stepped 20 random questions: KaTeX errors 0, stray MathML 0, broken images 0, SVGs visible (2 seen), legacy PNG math loaded (3 items).
- `git ls-files` shows no data/fixtures/.env. typecheck clean, 116 tests pass.
- Known issue: import freezes the tab about 15 s (logged in `docs/later.md`).
- Waiting on the user to confirm Phase 1 done before changing AGENTS.md phase.

## Known facts worth remembering

- API: `qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/` with `GET /lookup`, `POST /digital/get-questions`, `POST /digital/get-question` (`{"external_id": id}`; legacy items send their `ibn` in the same field). Full details in `docs/api-notes.md`.
- Counts: R&W 1845, Math 1922 unique (459 legacy). Roughly 30 non-repeating full tests; about 13 R&W and 22 Math if active items are excluded.
- Gemini's first summary got per-domain and per-difficulty counts wrong while totals were right. Always verify its numbers.
- Sync speed is about 1.2 questions/s with 2 workers; a full fresh sync takes about 50 minutes.
- Rendering: math is `<span class="bb-math" data-latex>` rendered by KaTeX at view time; graphs and legacy PNG math are inverted with a CSS filter for the dark theme.
