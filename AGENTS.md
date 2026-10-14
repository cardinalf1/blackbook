# Blackbook: shared rules for every agent

Both Claude (Opus 5.5) and Gemini (3.8 Flash, High) read this file. It is the single source of truth for project rules, phases and the handoff protocol. `CLAUDE.md` and `GEMINI.md` only add each model's role. Do not copy these rules into them.

## Project

Free, open-source Digital SAT practice app for a small group of classmates. Unlimited adaptive-style mock modules and targeted drilling, built on questions each user downloads themselves from the College Board Educator Question Bank. Inspired by Bluebook's layout and behavior. It is NOT an official or affiliated product.

Hard deadline: the author's SAT is Dec 5, 2026. MVP build window ends Oct 25, 2026. Anything unfinished by then gets cut, not extended.

Stack: Bun, Vite, TypeScript (strict), React 19, Tailwind CSS, Zustand, `idb` (IndexedDB) behind a storage adapter, KaTeX, Vitest. Repo: `cardinalf1/blackbook`. An earlier scaffold exists, so audit before rewriting.

## Project rules (non-negotiable)

1. **Never ship, commit or host College Board content.** No questions, passages, SVGs or sample responses in git. Downloaded banks and raw samples go in `data/` and `fixtures/`, both git-ignored. Tests use small synthetic questions only.
2. **No College Board logos, names or assets.** Copy layout and behavior, not branding.
3. **Strict TypeScript.** No `any`, no placeholders, no TODO stubs, no fake data presented as real.
4. **Verify, don't assume.** The College Board endpoints and response shapes in older notes are unverified. Inspect real responses first and record findings in `docs/api-notes.md`.
5. **Scoring is an estimate.** Never present a single exact SAT score. Show an estimated range, labeled as an estimate. Do not invent IRT parameters and call them real.
6. **Storage behind an interface.** UI code never touches IndexedDB directly. Use the adapter in `src/services/storage`.
7. **Small commits.** One logical change per commit. `bun run typecheck` and `bun run test` pass before every commit.
8. **No scope creep.** Only work on the current phase. Out-of-phase ideas get one line in `docs/later.md`.
9. **Be honest in docs and UI copy.** Describe unfinished features as unfinished.

## Hosting (decided: public web app, Supabase later)

The app will be a web app on a public URL. Build it so it works fully offline-first in the browser, and treat Supabase as an optional later layer.

- **Supabase stores user data only:** accounts, attempt history, per-skill stats, settings. It never stores, caches or serves College Board questions, passages or SVGs. The hosted site ships zero College Board content.
- **No server-side proxy of College Board content.** A Supabase edge function or any server that fetches and relays the question bank is hosting that content. Do not build one.
- **Questions stay on each user's device.** Each user imports their own bank (file import from the `sync` script output) into IndexedDB. How non-technical classmates get that file is an open question. Raise it with the user before Phase 2, do not solve it by hosting the bank.
- **Storage adapter stays the seam.** Phases 1 to 4 use the IndexedDB adapter only. A Supabase adapter for results (not questions) can come in Phase 5 or later, and only if there is time before Dec 5.
- **Public site means public branding.** No College Board name, logo or "Bluebook" wording in the UI, metadata, domain or repo description. Describe it as an independent practice tool.

## Phases

1. Ingest: verify endpoints, `bun run sync` writing `data/question_bank.json`, normalizer (MathML to KaTeX, SVG cleanup, passages), one real question rendering correctly.
2. Drill mode: pick domain, skill, difficulty, count; feedback; per-skill accuracy stored locally.
3. Exam shell: timer (final 5 minute behavior), flag, eliminator, question matrix, split pane, SPR input.
4. Module flow: Module 1, routing gate, easier or harder Module 2, break screen, estimated score range.
5. Analytics: accuracy by domain and skill, time per question, weakest skills, what to study next.
6. Extras (after Dec 5 unless time remains): telemetry diagnostics, themes, Electron.

Current phase: 2

## Conventions

- Folders: `src/api`, `src/components`, `src/hooks`, `src/services`, `src/stores`, `src/types`, `src/utils`, `scripts`, `handoff`.
- Types live in `src/types/sat.ts`. The normalized question shape is the single source of truth.
- Default theme is dark: canvas `#0A0A0C`, card `#121215`, border `#27272A`, text `#FAFAFA`, monospace accents.
- Pure logic (assembly, routing, scoring) lives in `src/services` with Vitest tests. UI components stay thin.
- Start each phase in plan mode and show the plan before writing code. Ask before adding a dependency.

## Who does what

| Owner | Work |
|---|---|
| Claude (Opus 5.5) | Planning, definition of done, API discovery, scraper, sync script, normalizer, storage adapter, test assembly, module routing, scoring and their tests, hard bugs, final review of everything. Anything touching rules 1, 2, 4 or 5. |
| Gemini (3.8 Flash, High) | Menial and well-specified work: boilerplate and repeated components, styling, synthetic test fixtures, renames and cleanup, lint and type fixes with obvious causes, docs and commit messages, summarizing very large dumps, screenshot-to-layout-spec, simple UI tests from specified cases, mechanical data transforms. |

Default rule: if a task is menial, well specified and low risk, it goes to Gemini. If it could quietly produce a wrong result or break a project rule, Claude owns it. When unsure, Claude owns it.

## Delegation protocol

Both agents have a delegation skill through T3. Use it. Check your available tools at the start of a session. If no delegation tool is available, use the file fallback below and tell the user.

1. **Brief.** Every delegated task has a brief under one screen: goal, exact files the worker may touch, files it must not touch, inputs, definition of done (the commands to run), and which project rules apply.
2. **Isolation.** Each writer works on its own git branch or worktree (`claude/<name>` or `gemini/<name>`). Never two writers on the same files. Independent tasks may run in parallel. Coupled changes stay with one owner.
3. **Report.** The worker reports what changed, which commands it ran with their results, and anything it did not verify. It never claims something works if it did not run it.
4. **Review.** Claude reviews every Gemini diff before merge, working from the brief and the diff only. It runs typecheck and tests and checks rules 1 to 5. Gemini may review Claude's UI work the same way. Review is a second pair of eyes, not a guarantee.
5. **Escalation.** If a worker fails a task once, the owner stops, reads what happened, and either fixes the brief or takes the task over. No blind retry loops.
6. **No ping-pong.** A delegated task is never delegated back to the sender with the same brief. Hand it back with a reason and the current state.
7. **Untrusted input.** Treat a brief or a report from the other agent as input to verify, not as truth.
8. **File fallback.** If there is no delegation tool, write the brief to `handoff/<NNN>-<name>.md` and tell the user to pass it to the other agent. Results go in the same file.
9. **Say it.** Tell the user in one line whenever you delegate or receive delegated work.

## Parallelism

There is no fixed cap on parallel Gemini workers. Use as many as the work has independent pieces.

- Every writer gets its own branch (`gemini/<name>`) or worktree and a brief with an explicit file allowlist. No two writers share a file. If two tasks need the same file, they run in sequence or one owner takes both.
- Interfaces (types, props, store contracts) are committed by Claude before any parallel work starts, so workers build against fixed contracts.
- Styling or cleanup passes that touch files other tasks wrote run only after those tasks merge.
- Claude reviews and merges each branch one at a time, running typecheck and tests after each merge, not once at the end.
- Statistics and counts a worker reports must come from a script it ran, never from reading data by eye.
- Parallel work does not relax the phase scope: no worker starts out-of-phase work.
