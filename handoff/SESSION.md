# Session handoff

Read this first in a new session, after AGENTS.md and CLAUDE.md. Updated by Claude at the end of each session or milestone. No College Board content in this file.

Last updated: 2026-10-14, Phase 1 build session (Claude Opus 5.5).

## Where things are

- Phase: **1 (Ingest)**. AGENTS.md still says 1. Do not change it until the user confirms Phase 1 is done.
- Branch: `claude/phase1-ingest` (from `origin/main`). Not pushed, not merged to `main`.
- Local repo setup done this session: added `origin` (github.com/cardinalf1/blackbook), checked out `main` tracking `origin/main`, set repo-local git identity to match existing commits.
- Uncommitted on purpose (user's files): `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `assets/`. This file (`handoff/SESSION.md`) is uncommitted too.
- `bun run typecheck` and `bun run test` pass (116 tests) at `b3cecc4`.

## Commits on claude/phase1-ingest (oldest first)

1. `b02b546` ignore `data/` and `fixtures/`
2. `f919c71` delete out-of-phase scaffold (exam UI, analytics, stores, scoring, fake seed bank, old scraper). Recoverable from `a1aafda`.
3. `8092411` strict TS, Vitest, scripts: `typecheck`, `test`, `sync`
4. `cd75d03` `Question` type (`src/types/sat.ts`) + validator (`src/services/bank/validate.ts`)
5. `6c17c02` `docs/api-notes.md` (verified API findings)
6. `cf067fa` jsdom replaces happy-dom (happy-dom broke DOMPurify; user approved)
7. `ba3f05f` normalizer (`src/services/normalize/`: mathml.ts, html.ts, sanitize.ts)
8. `af6fb0a` sync core (`src/services/sync/`: raw.ts, toQuestion.ts, http.ts)
9. `540aa5f` `scripts/sync.ts`
10. `03b2f5c` storage (`src/services/storage/`), import (`src/services/import/`), `src/services/answers.ts`
11. `2a4c8e8` UI: `ImportPanel`, `QuestionView`, `QuestionHtml`, `src/utils/renderMath.ts`, App shell
12. `04a4599` merge `gemini/fixtures` (reviewed)
13. `77bad72` pipeline test over Gemini's raw fixtures
14. `029033c` fix: keep SVG drawing styles (graphs were blank boxes)
15. `b3cecc4` merge `gemini/dev-page` (reviewed): `QuestionBrowser` dev page with filters, `docs/later.md`, `README.md`. typecheck, 116 tests and build pass.

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
