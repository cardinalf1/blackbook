# Session handoff

Read this first in a new session, after AGENTS.md and CLAUDE.md. Updated by Claude at the end of each session or milestone. No College Board content in this file.

## Morning report: Phase 4 (2026-10-16, unattended)

**Done and committed** on `claude/phase4-full-test`, tag `phase4-done`. Nothing pushed. Phase 5 not started. Full report, decisions and what I could not verify are at the top of `handoff/RUN-REPORT.md`.

- **Practice test** (home): a full test (Reading and Writing, break, Math) or one section, with an easier or harder Module 2 chosen after Module 1, a break with an absolute-deadline countdown, and a final report with an **estimated score range** (never one number).
- **Persistence:** the test is a container session whose `test` field holds the state; each module is a normal exam session linked by `exam.testId`. `testStore.reconcile` is idempotent and brings a test up to date after any reload.
- **Numbers:** routing threshold, weights, difficulty mixes, the score conversion and the 10-minute break are assumptions, all in `src/config/scoringConfig.ts` and `docs/scoring-spec.md`.
- **Check:** `bun scripts/test-estimate.ts` recomputes the estimate and routing from stored data.
- **Plan that was followed:** engines and types first (routing, estimate, assembly, flow, preflight), then the store and persistence, then list labels, then the screens (Gemini for four of them, TestFlow by me), then a browser run with shortened clocks.

**To test it:** see "Exact steps" in the Phase 4 report.

---

## Morning report: Phase 3 (2026-10-15, unattended)

**Done and committed** on `claude/phase3-exam-shell`, tag `phase3-done`. Nothing pushed. Phase 4 not started. Details, decisions and what I could not verify are in `handoff/RUN-REPORT.md` (summary at the top, Phase 3 section at the end).

- **Practice module** (home): one timed module under test conditions. Reading and Writing is 27 questions in 32 minutes, Math 22 in 35. The numbers come from official sources, cited in `docs/exam-spec.md`. Every number lives in `src/config/examConfig.ts`, marked verified, derived or assumed.
- **Assembly:** live set only, unseen questions first, no repeats, and any shortfall shown on the setup screen.
- **Timer:** works from a saved deadline, so it stays right in a hidden tab, after sleep and after a reload. If time ran out while the tab was closed, the module submits as soon as you reopen it.
- **During the module:** Hide/Show on the timer, a five-minute alert, an emergency pause (marked in the results), a navigator, the review page, arrow keys, the reference sheet (Math), and SPR input limited to 5 characters (6 with a minus sign).
- **Results:** raw score, time per question, flagged and missed questions with explanations, domain and skill tables. No score estimate.
- **Kept apart:** exam attempts are stored as mode `exam` and stay out of My skills.

**To test it** (`bun run dev`, open the printed link):
1. Click Practice module and choose Reading and Writing: 27 questions, 32:00, with the domain counts. Start the clock.
2. Answer about half, then reload the page. In progress shows the Exam module; Resume, and the time left has kept running.
3. Try Hide/Show, open the navigator with the counter in the bottom bar and jump to a question, and use the Left and Right arrow keys. Mark one question for review.
4. On the last question, Next opens the review page. Check the unanswered and marked lists, then Submit and confirm. Read the results.
5. Start a Math module. Open Reference, jump to one of the last 6 questions (SPR) and try typing letters or more than 5 characters. Press Pause, pick a reason, then Resume.
6. Quick time-out: in the browser console run `localStorage.setItem('blackbook.dev.examSeconds','330')`, start a Math module and wait. You get the five-minute alert after 30 seconds, then an automatic submit at 0:00. The results say so and show the pause if you made one. Afterwards run `localStorage.removeItem('blackbook.dev.examSeconds')`.
7. Run `bun scripts/telemetry-check.ts` (it ends with "Cross-check passed"), and open My skills: the exam answers are not counted there.

## Phase 3 plan (unattended run, 2026-10-15)

Branch `claude/phase3-exam-shell` from `phase2d-done` (gates green there).

1. **Spec and interfaces (me).**
   - `docs/exam-spec.md` cites four official sources. Verified: 27 questions in 32 min and 22 in 35 min; domain shares; Reading and Writing domain order; SPR 5/6 characters; auto-submit at zero; no return to a submitted module. It also lists every assumption.
   - `src/config/examConfig.ts` holds each number, marked verified, derived or assumed.
   - `src/types/exam.ts` defines the exam state (deadline-based timer, pauses, phase) and the props for every screen. Session records gain an optional `exam`.
2. **Gemini, 3 writers in worktrees, Medium effort:**
   - `gemini/exam-nav`: bottom bar and navigator drawer.
   - `gemini/exam-header`: header with countdown, Hide/Show, the five-minute alert and the pause dialog.
   - `gemini/exam-panes`: Reading and Writing split pane, Math pane, SPR input (using my `isAllowedSprInput`), reference sheet.

   After those merge, `gemini/exam-review-results` builds the review page and the results layout.
3. **Timer engine (me, high risk).** `src/services/exam/timer.ts`, pure: remaining time from an absolute deadline, pause and resume, expiry, the five-minute alert. Tests with a fake clock cover a hidden tab, a reload, a deadline passed while closed, pause and resume, and double submit.
4. **Assembly (me).** `src/services/exam/assemble.ts`, pure: the live set only, domain counts and difficulty thirds from the config, unseen first, no duplicates, plain notes for any shortfall (never padded). Math is multiple choice first with SPR last; Reading and Writing follows the official order.
5. **State machine and persistence (me).** Exam actions on the existing drill store, reusing its strict save queue and Retry banner. States: setup, in progress, review, submitted. Every transition, answer, strike, flag and move is saved. Attempts have mode `exam`. The timer never waits on telemetry. Exam events go through the 2c logger with mode `exam`. Tests cover seen status (a question never navigated to stays unseen) and Browse hiding results of an unfinished exam.
6. **Wiring, browser run** (full Reading and Writing and Math modules, resume with the right time, one auto-submit using a dev-only short timer, one pause), the results cross-check with `bun scripts/telemetry-check.ts`, reports, tag.

## Morning report: Phase 2d (2026-10-15, unattended)

**Done and committed** on `claude/phase2d-browse-drafts`, tag `phase2d-done`. Nothing pushed. Details, decisions and what I could not verify are in `handoff/RUN-REPORT.md` (Phase 2d section).

- **In progress list.** The home screen and Past drills list every unfinished drill and single question, with answers so far, time, last activity, Resume and Discard. Discard asks first, and discarded sessions are kept as abandoned.
- **Browse status.** Every question shows Unseen, Seen or Done, times attempted, and the last result (from finished sessions only). Filters show counts. "Random question" prefers unseen questions.
- **Practice from Browse.** Clicking a question practices it as a one-question session with the same rules: nothing is revealed until Done, then you get the report. Coming back keeps your filters, page and scroll.
- **Scripts.** `bun scripts/status-check.ts` cross-checks status against the raw records and prints timings. `bun scripts/inspect-sessions.ts` lists the newest sessions.

**To test it** (`bun run dev`, open the printed link):
1. Start a 20-question drill, answer 5, close the tab. Open the link again: "In progress" lists it as "5 of 20 answered". Resume, and you are back on question 5 with your answers. Finish it, leaving some unanswered.
2. Browse: set a few filters, go to page 2, scroll down, click a question. Answer it, press Done, read the report, then press "Back to browse". Filters, page and scroll are as you left them. Set Status to Done to find the question: it shows Done with its result.
3. Set Status to Seen: the questions you skipped in step 1 are listed there, but not under Done.
4. Start a 3-question drill, answer question 1, press Next, then "Save and exit". In Browse that question shows Done with "—" as the result, because the drill is unfinished.
5. Press Random question a few times. Then try Discard in the In progress list: it asks first.
6. Run `bun scripts/status-check.ts`. It should end with "Status cross-check passed".

## Phase 2d: draft investigation (step 1, before any fix)

**Reproduction on the Phase 2c code** (20-question drill, 5 answered; data read with `bun scripts/inspect-sessions.ts` after each exit):

| Exit | Session record | Draft and final answers | Event log | What the UI offered |
|---|---|---|---|---|
| Full page load (reopening the link; the tool cannot close a real tab) | in progress, on question 5, 5 of 20 answered | 5 stored: 4 final (Next), 1 draft (question 5) | 24 events | Home banner: "unfinished drill (5 of 20 answered)" with Resume and Discard |
| Refresh | same | same | same | same banner |
| Resume, then "Save and exit", Browse, back, My skills, back | same, plus active time saved on exit (9 s to 13 s) | same | 28 events (hide and navigation logged) | banner after each step |
| Server restarted (process killed, started again) | same | same | same | banner after reload |

**Root cause of what you saw (the Phase 2 code you tested, commit 2b537b8): both a save bug and a missing UI.**
1. **Save.** A picked choice lived only in the question screen's own state until Submit (`QuestionView.tsx` line 43; only `submit` wrote an attempt, `drillStore.ts` line 103). Leaving before Submit lost the pick, and nothing was saved as a draft.
2. **UI.** The only way back was one banner on the home screen for the newest unfinished drill (`App.tsx` line 133). Worse, "Start a drill" deleted the unfinished drill without asking (`drillStore.ts` lines 143 and 144), and Discard deleted it too.

Phase 2c already fixed the save side: every change is a draft write, sessions are never deleted, and starting a new drill keeps the old one. Phase 2d adds the missing UI.

## Phase 2d plan

Branch `claude/phase2d-browse-drafts` from `phase2c-done`.

**What Browse shows now:** it loads the whole bank and filters by section, domain, skill, difficulty, format, source and live status, 50 per page. Clicking a row opens an inline preview with a Check button that reveals the answer at once. That preview is not saved and not logged, and it breaks deferred feedback. It is replaced.

1. **Interfaces (me).**
   - `source` on sessions (`drill`, `browse`, later `exam`). Session record version 3, with migration 3 setting `source` to `drill` on existing sessions.
   - Browse row, filter and status types.
   - Props for the browser (now driven by props), the In progress list, and an `inProgressSlot` on Past drills.
2. **Status (me).**
   - One server query: `GET /api/status` derives seen, done, times attempted, last result (finished sessions only) and the "flag for later" mark from events, attempts and sessions in one pass. Nothing is stored twice.
   - Backfill: any attempt also counts as seen.
   - Pure `applyFilters` and `filterCounts` in `src/services/browse`.
   - A cross-check test and `scripts/status-check.ts`, which recomputes status from the raw rows and compares.
3. **Single-question practice (me).** `startSingle(questionId)` in the drill store: a session of length 1 with source `browse`, the same deferred feedback, and Done then the report. Browse stays mounted, hidden while you practice, so filters and scroll stay. Past drills labels these "Single question". They count toward My skills like any finished drill.
4. **Gemini, 2 writers:**
   - `gemini/browse-ui`: status badges, filters with counts, Random, clickable rows (`QuestionBrowser.tsx`).
   - `gemini/in-progress`: the In progress list with Resume and Discard (with a confirmation), on the home screen and on Past drills.
5. **Wiring, tests (resume twice, discard, restart, reload), browser run, timings on the full bank, reports, tag.**

## Morning report: Phase 2c (2026-10-15, unattended)

**Done and committed** on `claude/phase2c-telemetry`, tag `phase2c-done`. Nothing pushed. Full details, decisions and what I could not verify are in `handoff/RUN-REPORT.md` (Phase 2c section).

- Drills give no feedback until Finish. Picking a choice is the answer, Back and Next move freely, and Finish lists unanswered and flagged questions first.
- Every change is saved at once, as a draft; Next and Finish make answers final. A failed save keeps everything on screen, shows Retry and blocks moving on.
- Sessions are kept forever, as in progress, finished or abandoned. Past drills lists the finished ones and reopens their reports. Your Phase 2 drill was upgraded and is listed.
- Every interaction goes into an append-only event log (see `docs/telemetry.md`). `bun scripts/telemetry-check.ts` cross-checks it against the stored answers.
- The Data page exports everything as JSON (no question text) and can delete the telemetry or all progress.
- My skills counts only final answers in finished drills.

**To test it** (`bun run dev`, open the printed link):
1. Start a drill with 20 questions and tick "Ask how sure I am". Answer some, change a few, flag a few, rate some.
2. Close the tab midway. Open the link again: the home screen offers Resume. Resume puts you on the same question with answers, strike-outs, flags and ratings kept.
3. Mid-drill, type `k` + Enter in the dev terminal to stop the server, then pick an answer: the red banner appears and Next is blocked. Type `s` + Enter, then press Retry (or wait 5 s) and carry on.
4. Finish. Check the list of unanswered and flagged questions, confirm, and read the report. Open a few explanations.
5. Home, then Past drills: the drill is listed and reopens.
6. Run `bun scripts/telemetry-check.ts` in a second terminal: it ends with "Cross-check passed".
7. Home, then Your data: Export (check the file), then Delete telemetry. Events go to 0 and attempts stay.

## Phase 2c plan (unattended run, 2026-10-15)

Branch `claude/phase2c-telemetry` from 2b537b8. Gate fix first: `bun run sync` stopped as "stalled" while reading 3,767 cached files from a cold disk; local reads now count as progress (9ace59b).

1. **Interfaces (me).** `src/types/session.ts`: the version 2 session record (mode, status in progress / finished / abandoned, per-question progress with draft answer, change count, active and first-visit time, strikes, flag, confidence), the event record, and the props for every new screen. `docs/telemetry.md` with every event and payload. Commit, then start Gemini.
2. **Gemini, 2 writers in worktrees, Medium effort:**
   - `gemini/drill-play`: `DrillPlay.tsx` (question, Back, Next, Finish, confidence control, Retry banner), `FinishConfirm.tsx`, the confidence toggle in `DrillSetup.tsx`, and their tests.
   - `gemini/drill-report`: `DrillReport.tsx`, `PastDrills.tsx`, `DataPage.tsx` and their tests.
3. **Storage (me).** Migration 2: sessions table with the new statuses, mode and finish time; attempts gain status (draft or final), mode, change count, first-visit time and confidence; an append-only `events` table indexed by session and question. Migrations can be TypeScript functions, so old session JSON is upgraded in place, and `upgradeSession` is tested. One request saves a session and its attempts in one transaction. New routes: list sessions, append, list and delete events, export, storage stats.
4. **Telemetry logger (me).** `src/services/telemetry/logger.ts`: `log()` only pushes to memory. A flush every 2 s and on hide or close (keepalive, chunked under 60 KB), a bounded queue (5,000 events) kept in localStorage when the server is down, a dropped counter on `window.__blackbookTelemetry` and in the console, and ids generated in the browser so a resend never duplicates.
5. **Derived metrics (me).** `src/services/telemetry/metrics.ts`, pure, with tests on synthetic streams (rapid switching, tab hidden mid-question, reload and resume).
6. **Drill store rewrite (me).** Deferred feedback, selection = answer, Back, Next, Finish, draft upserts on every change through one serialized save queue (a failed save blocks navigation and shows Retry), finalize on Next and Finish, score at Finish, Discard marks the session abandoned, and telemetry from every action.
7. **Wiring (me).** Merge the Gemini branches one at a time; DrillFlow, Past drills, the Data page and My skills (only final attempts in finished drill sessions count).
8. **Verification.** `scripts/telemetry-check.ts` prints the derived metrics for the last session and cross-checks them against the stored attempts, plus the event log size per 20-question drill and the extrapolation to 1,000. A browser run: a 20-question drill, a mid-drill reload and resume, the server killed mid-drill, export, and delete telemetry.

## Morning report (2026-10-15, Part A, unattended run)

**Part A is done through step 5 and committed** on `claude/phase1-ingest` (the last commit adds this report). Nothing pushed. Phase 3 not started.
`bun run typecheck` is clean, `bun run test` passes (25 files, 253 tests), `bun run sync` exits 0, and `git ls-files` shows no data/, fixtures/ or .env files.

### Done (all verified unless marked)
1. `AGENTS.md`:
   - Distribution section: a local app, no hosting, no Supabase or login.
   - Rule 2 exception for the consent line.
   - Stack updated, and phases updated (Packaging is now phase 6).
   - Parallelism: the 3-writer cap and your review sentence.
2. Shared pipeline in `src/services/sync/pipeline.ts`:
   - `limits.ts` keeps the current values: 2 in flight, 250 ms gap.
   - Events, cancel, a 30 s stall watchdog, and stop rules: 3 refusals (403/429) in a row, 5 network failures in a row, or 10 failed questions in a row.
   - `scripts/sync.ts` is now a thin wrapper.
   - Old and new sync produce an identical bank: 3,695 questions, 0 differences, same skipped list.
   - Live-set questions are fetched first.
3. Local server in `server/`:
   - Bun on 127.0.0.1:47821, with Host and Origin checks and a per-launch token.
   - Progress stream, cancel, free cache, and idle shutdown (off in dev, covered by a test).
   - Checked against the real server with curl: wrong Host gives 403, a foreign Origin 403, a missing or wrong token 401.
4. Storage:
   - User data in `bun:sqlite`: WAL mode, foreign keys on, every write in a transaction.
   - Schema version in `PRAGMA user_version`, with numbered migrations.
   - The bank is one JSON file, swapped in by an atomic rename. Raw downloads go in a cache folder.
   - The HTTP adapters pass the same contract tests as the in-memory ones.
   - The IndexedDB adapters and the `idb` package are deleted.
5. `bun run dev` starts the server and the UI. The home screen has:
   - Download button and section picker (live set first by default).
   - Consent dialog with your approved wording; counts and time match the chosen scope.
   - Progress panel, Refresh, and file import as the fallback (the server now handles the import).

   Your follow-up items:
   - **Item 2, never lose an answer.** The result shows at once, but the answer stays in memory until the server confirms the save.
     - Meanwhile Next reads "Saving..." and is disabled, and "Save and exit" is refused.
     - A red banner offers Retry.
     - Covered by a unit test, plus a real browser test with the server killed mid-drill: after Retry, 3 attempts were saved, once each.
   - **Item 4, token handling.** The token is read once, exchanged for an HttpOnly, SameSite=Strict session cookie, and stripped from the address bar with `history.replaceState`. History length stayed 1, and page scripts cannot see the cookie.
   - **Item 5, stream buffering.** The Vite proxy does not buffer the progress stream: the first snapshot arrives at once and the 10 s pings arrive on time, the same as connecting directly.
6. Gemini, Medium effort:
   - Two writers ran in parallel: `gemini/empty-bank-ui` (DownloadStart) and `gemini/download-modals` (DownloadConsent, DownloadProgressPanel, formatBytes).
   - Both stayed in their files and were merged after review.
   - The consent text matches the approved wording word for word, and the source name appears nowhere else.
   - I changed nothing in their code.

### Real download test (browser, empty data/app)
- **Download:** Math live set.
  - I cancelled at 170 of 927. No bank was written, the cache was kept, and requests stopped.
  - Retry resumed with 170 cached and finished in 2:47: 927 questions, 0 skipped.
  - The result is identical to the terminal sync's Math live set (927 of 927, same content).
- **Free cache** removed the raw folder.
- **Drill:** a 10-question drill, the results screen and My skills all worked. My skills showed 10 attempts, matching the database.
- **File import** of the full terminal bank: 3,695 imported, 72 skipped.

### Bugs found and fixed during the run
- **Live-set filter used the wrong id.** The filter and live-first order used `questionId` instead of the detail id, and my first test faked the same wrong id. Both fixed.
- **Some tests never ran.** Vitest only ran `*.test.ts` files, so Gemini's Phase 2 `DrillSetup.test.tsx` never ran. I fixed the pattern, and that test passes.
- **Server-down message.** When the server was down, the Vite proxy's 502 showed as "Request failed (502)". It now shows the plain "local program is not responding" message.
- **Stale banner.** A "could not save your session" banner stayed after the server came back. It now clears on the next good save.
- **Vite didn't start.** It inherited the dev script's stdin; child processes now get no stdin.
- **Port 3000 busy.** Two stale Vite processes from Phase 2 were holding the port. I stopped them.

### Decisions I made
- **Session cookie as well as the in-memory token.** Memory alone would lock the page out on every reload, and Vite reloads on code changes.
  - The cookie is HttpOnly, SameSite=Strict and limited to /api. It ends when the browser closes and is useless after a restart, because the token changes.
  - Easy to revert to memory-only.
- **SQLite in tests.** Vitest runs on Node, so tests use Node's built-in `node:sqlite` (the same engine); the app uses `bun:sqlite`. No new dependency: small local type declarations in `server/bun.d.ts` instead of adding `@types/bun`.
- **No foreign keys between tables, on purpose.** Deleting a session must never delete answers. The foreign-keys pragma is on for future tables.
- **Refresh never shrinks the bank.** A narrower Refresh, for example live set only, keeps the questions outside its scope.
- **Time estimates include preparing questions.** The consent estimate includes the measured normalize step (about 0.09 s per question). It shows about 12 minutes for both live sets and 5 for Math live, not the 9 and 16 minutes I quoted earlier. The real Math live run took under 3 minutes.
- **Dev-script controls.** `bun run dev` keeps the UI up if the server dies:
  - `k` and Enter stops the server; `s` and Enter restarts it with the same token. Your kill-mid-drill test needs this.
  - `BLACKBOOK_NO_OPEN=1` skips opening a browser.
- **Read-only bank interface.** `QuestionStore` is split into a read-only `QuestionStore` and a `WritableQuestionStore`; only the server and tests can replace the bank.
- **Consent on every run.** Retry after a failed or cancelled download shows the consent dialog again.

### Not verified / could not see
- **Fine visual detail.** Screenshots from the automation browser are downscaled to 640x400. I checked the layout and all text, but not spacing, colours or focus rings on the new screens.
- **A full download in the app.** I only ran Math live, not both sections with everything. The full run is covered by the identical-output check against the terminal sync.
- **Idle shutdown** is only unit-tested, since it is off in dev.
- **Real refusals.** The source never sent a real 429 or 403; those paths are tested with a fake source only.
- **Restarts in the packaged app (Part B).** The token changes on restart, so an unsaved answer in an open page could not be saved. Noted for Part B.

### How to test from an empty state
1. Stop anything still running from earlier. Then delete the app data folder:
   - Bash: `rm -rf data/app`
   - PowerShell: `Remove-Item -Recurse -Force data\app`

   This keeps `data/question_bank.json` and `data/raw` from the terminal sync.
2. Run `bun install`, which removes the dropped `idb` package. Then run `bun run dev`.
   - It opens `http://localhost:3000/?token=...`. If no browser opens, copy the link from the terminal.
   - The token disappears from the address bar after the page loads.
3. Download one section:
   - Untick Reading and Writing and keep "Live set only".
   - Press **Download questions**, tick "I understand." and press **Download**.
   - Math live is about 930 requests and took under 3 minutes here.
   - Try **Cancel** part way, then **Retry**: it resumes and shows "cached N".
4. When it says Download complete, press **Done**. Then press **Start a drill**, pick Math, press **Start Drill**, and answer two questions.
5. Kill the server mid-drill: in the `bun run dev` terminal type `k` and press Enter.
   - Answer the next question. You should see the result, a red "not saved yet" banner with Retry, and a Next button that shows "Saving..." and does nothing.
   - Type `s` and Enter in the terminal, press **Retry**, then **Next**.
6. Finish the drill, open **My skills**, and check that the attempt counts match what you answered.

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
