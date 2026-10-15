# Run report: Phases 2c, 2d and 3 (unattended run, 2026-10-15)

The summary for the whole run goes at the top when the run ends. Phase sections follow.

## Phase 2c: deferred feedback, session history, telemetry

Branch `claude/phase2c-telemetry` (from 2b537b8). Tag `phase2c-done`.

### Gate before starting
- `bun run typecheck` and `bun run test` were green, but **`bun run sync` failed**: "stopped (stalled)" with 3,767 details cached and 0 to fetch. Reading the cache from a cold disk took over 30 s, and the watchdog only counted network activity as progress. Fixed in 9ace59b (local reads count as progress), with a test that fails without the fix. Sync then exited 0.

### Definition of done
| Item | Status |
|---|---|
| typecheck, tests, sync, nothing from the source in git, nothing pushed | Met. 32 files, 315 tests. Sync exit 0. `git ls-files` has no data/ or fixtures/. |
| 20-question drill, no feedback until the end, change answers, flag, close midway and resume, finish, report | Met in the browser (Reading and Writing, 20 questions): 3 answers changed, 3 flagged, 2 left unanswered, reload at question 8 and Resume from the home banner, Finish check listed unanswered 12, 20 and flagged 2, 4, 6, report shown. |
| Finished session in Past drills, reopens | Met. The Phase 2 drill from before the migration is listed too. |
| Kill the server mid-drill: selection kept with Retry, nothing lost, outage events delivered, dropped 0 | Met. Killed the server process only (by PID). The selection stayed, the red "not saved yet" banner showed Retry and Next was blocked. After restarting, the next background save went through on its own and cleared the banner. The logger had 2 failed flushes, then sent everything: queued 0, dropped 0. |
| Script prints derived metrics and cross-checks against stored attempts | Met: `bun scripts/telemetry-check.ts`. On the 20-question drill it found one real bug (below), which is fixed; the re-run on a fresh drill with a reload passed every check. |
| Event log size for a 20-question drill, with extrapolation | Met: 147 events, 31.3 KB (1.57 KB per question), about 1.5 MB per 1,000 questions plus index pages. |
| Export is valid JSON with sessions, attempts and events and no question text; Delete telemetry keeps attempts | Met. The export (102,920 bytes) parsed, and a scan of 147,470 text windows from all 3,695 questions (stimulus, stem, choices, explanation) found 0 matches. Delete telemetry: events 176 to 0, attempts stayed 32. |
| Morning report in SESSION.md | Met. |

### Bug the browser run found
The cross-check flagged the question open during the reload: 12.0 s from events against 16.4 s stored. The logger's page-hide flush ran before the question screen logged its "question hidden (unload)" event, so that one event never left the page. Now, once the page starts hiding, every later event is kept locally and sent at once. Unit test added; a second browser drill with a reload then matched exactly (8.9 s vs 8.9 s).

### My skills, drill and exam
Only final answers in finished sessions count, filtered by mode (`countableAttempts(attempts, sessions, 'drill')`). Drafts, unfinished and discarded sessions never count. Exam attempts are stored with mode `exam` and will be kept out of drill skills by the same filter.

### Latency (logger must not slow the UI)
In the browser: `log()` costs about 1.4 µs per call, and serializing a full 76 KB batch takes 0.07 ms. Over 30 choice clicks, click-to-paint was a median 10.0 ms and at most 11.3 ms, each click logging an event and saving the answer: the next frame. I did not run an A/B with the logger switched off; there is no switch (noted in docs/later.md).

### Gemini
Two writers at Medium in worktrees, `gemini/drill-play` and `gemini/drill-report`. Both stayed in their files and reported real typecheck and test output. Review findings, fixed by me:
- DrillReport called `onItemToggle` inside a state updater, which runs twice under StrictMode and would double every logged open and close.
- My first fix for that read a stale set, so two quick clicks lost one. Gemini's unmount test caught it.
- The report did not say when an answer key was read from the explanation text (rule 9). Added.

### Decisions I made
1. **Flags.** Each session keeps its own flags (for the Finish check and the report). The old cross-session "flag for later" list is still updated at the same time, so Browse can filter by it later.
2. **Active time** is time on screen with the tab visible, the same as Phase 2. Idle time (no key, click, touch, wheel or scroll for 30 s) is recorded and reported separately, not subtracted. Pointer movement is not input and is never recorded.
3. **Typed answers** are saved on every keystroke but counted as one answer (one change, one `spr_changed` event) once typing pauses for 800 ms or the question is left.
4. **Confidence** is cleared when the answer changes, because the rating was about the old answer.
5. **Final versus draft.** Next and Finish make answers final. Back and jumps keep drafts. Changing an answer makes it a draft again. A cleared answer stays a draft with an empty response, so it never counts as done.
6. **Unanswered questions count as wrong** in the drill score (the score is out of every question asked).
7. **Finished and discarded sessions are locked.** The server refuses changes (409); an identical resend is allowed.
8. **Starting a new drill keeps the unfinished one** (several can be in progress). Phase 2 deleted the old one.
9. **Discard** asks with a browser confirm for now. Phase 2d replaces this with the In progress section.
10. **Migration 2 upgrades Phase 2 data in place.** I copied the dev database to `data/backup-pre-2c/` first (git-ignored).
11. **Two extra event columns, `page_id` and `seq`**, so order and monotonic time are exact within a page load.
12. **`window_blur`** is only logged while the tab is visible, since switching tabs already logs `tab_hidden`.
13. **Replaced files deleted:** `src/services/drill/session.ts` and its test, and `src/components/results/DrillResults.tsx`, replaced by `src/services/session/record.ts` and `DrillReport.tsx`. QuestionView's old drill props are now unused; left in place for Phase 2d.

### Could not verify
- Fine visual detail. Screenshots come back at 640x400. With the page magnified 2x the Finish dialog's layout, lists and focus ring were readable, but small text was soft. Colors, spacing and focus rings elsewhere were not checked by eye.
- A Math drill in the browser (the section picker click missed), so the typed-answer flow was tested in unit tests only.
- A real browser close (I reloaded instead) and a real tab switch. Hidden-tab handling is tested on synthetic streams.

### Problems during the run
- I ran `taskkill /IM node.exe` once to stop a runaway test. That was too broad. Both Gemini tasks had already finished and nothing else was affected, as far as I can tell. From then on I stopped processes by PID only.
- A `git stash -u` round trip changed the line endings of your three files in `phaseexec/` (LF to CRLF). I converted them back to LF; the content is unchanged.
- I made one checkpoint commit that did not typecheck. I undid it with a soft reset before merging (no history kept).

## Phase 2d: draft access, browse-to-practice, seen status

Branch `claude/phase2d-browse-drafts` (from `phase2c-done`). Tag `phase2d-done`.

### Gate before starting
Green at `phase2c-done` (typecheck, 315 tests, sync exit 0); only docs changed after that run.

### Definition of done
| Item | Status |
|---|---|
| typecheck, tests, sync, nothing from the source in git, nothing pushed | Met. 35 files, 349 tests. Sync exit 0. |
| Reproduction table and root cause in SESSION.md | Met. On the Phase 2c code every exit (reload, refresh, Save and exit then Browse and My skills, server restart) kept the session and its drafts and offered Resume. What you saw came from the Phase 2 code: picks were not saved until Submit (a save bug), and the only way back was one banner that "Start a drill" silently deleted (a missing UI). So it was both. |
| 20-question drill, answer 5, close, reopen, see it under In progress, resume with everything, finish | Met in the browser. In progress showed "Drill · 5 of 20 answered"; Resume came back on question 5 with its choice selected; I answered two more and finished; the report showed. A reload stood in for closing the tab. |
| Click a question in Browse, answer, finish, report, back to Browse with filters, marked Seen and Done; Random works and prefers unseen | Met. Filters (Reading and Writing, Not done), page 2 and scroll (853 against 900 px) came back, and the question then read "Done · 1 · Incorrect". Random opened three different questions. The preference for unseen is proven by unit tests, not in the browser (I did not record each pick's status first). |
| An unanswered question in a finished drill is Seen but not Done | Met. Browser: the 13 questions skipped in the resumed drill moved to Seen (54 seen, 41 done). Store test as well. |
| A question in an in-progress session shows no correctness in Browse | Met. Browser: a final answer in an unfinished drill reads "Done · 1 · —". Contract tests on the memory and HTTP stores as well. |
| Status cross-check passes; list stays responsive on the full bank (timings) | Met. `bun scripts/status-check.ts` passes (SQL status equals a recount from the raw rows), and a randomized test compares SQL with the reference on 5 random histories. Timings: status query 1 to 2 ms; building 3,695 rows 1 to 2 ms; one filter change plus every count 23 to 39 ms (Bun). In the browser the first Browse open took 855 ms (it reads the 35 MB bank once per bank), and a filter change to the next painted frame took 56 to 68 ms. |
| Morning report in SESSION.md | Met. |

### What Browse showed before
The whole bank with section, domain, skill, difficulty, format, source and live filters, 50 per page. Clicking a row opened an inline preview with a Check button that revealed the answer at once, saved nothing and logged nothing. That preview is gone; clicking now starts a single-question session.

### Single questions and My skills
A single question is a session of length 1 with `source: 'browse'` and mode `drill`. It saves a draft on every change, logs telemetry, and shows the same report after Done. Past drills and In progress label it "Single question". It counts toward My skills like any finished drill, through the same filter (final answers in finished drill sessions); the Phase 5 dashboard can separate sources by `source`.

### Gemini
Two writers at Medium in worktrees: `gemini/browse-ui` (QuestionBrowser) and `gemini/in-progress` (InProgressList, the slot on Past drills). Both stayed in their files, and their test runs matched mine. One finding, fixed by me: QuestionBrowser declared every prop optional through function overloads so the old App would still compile. I removed them when wiring App.

### Decisions I made
1. **Seen** means a `question_shown` event or any stored answer, which covers answers from before the event log. A "flag for later" alone does not count as seen.
2. **Deleting telemetry** removes the showings, so questions shown but never answered go back to Unseen. Answered questions stay Seen and Done.
3. **Done** means a final, non-empty answer in any session, unfinished and discarded ones included. **Times attempted** counts those answers. **Last result** comes only from the newest final answer in a finished session.
4. **Done on a single question** finishes at once when it is answered; with no answer the usual check appears first.
5. A single question's session stores the question's domain, skill and difficulty as its filters, so Past drills can describe it.
6. **Random** picks from the filtered list: unseen first, then seen but not done, then anything.
7. Browse remembers filters, page and scroll for the rest of the page session (in memory), not across a reload.
8. **Session record version 3 and migration 3** add `source`; existing sessions became `drill`. The dev database backup from before 2c is in `data/backup-pre-2c/`. Migration 3 only adds a column and a field.
9. **Left as is:** the home screen's "Step through 20 random questions" (Phase 1) still shows answers at once and is not logged, so it does not mark questions as seen. It is outside this phase's list; noted in docs/later.md.

### Could not verify
- Fine visual detail. Screenshots come back at 640x400; even magnified, the browse table and the In progress card were too blurry to judge spacing and color. I checked layout through element positions only.
- A real tab close (I used a reload).

### Problems during the run
- The T3 session restarted twice. The dev server and one gate command were cut off, and I reran the gates afterwards.
