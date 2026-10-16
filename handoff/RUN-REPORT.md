# Morning report: Phase 9 (test-room tools and layout; 2026-10-16, unattended)

## Read this first: your local data is empty

While checking the screens I found that `data/app/user.db` (the dev data folder) has **0 sessions and 0 events**. The Phase 8 inventory counted 719 events. The database files were last written at **11:43 and 11:45 today, before this session started**, and I did not run anything against that folder that writes to it: my browser check ran on a copy (`data/p9check`, now deleted). I don't know what emptied it.

**Your backup from 05:15 today is intact:** `data/app/backups/blackbook-2026-10-16.json`, 180 KB, holding 14 sessions, 74 attempts, 386 events and 4 flags. Anything you did after 05:15 is probably not in it. I did not restore it, because that is your call. To restore: `bun run dev`, the settings menu (top right of Home), "Your data", "Backups and restore", and restore `blackbook-2026-10-16`. Restoring first saves a "before restore" snapshot. Do it before you start the dev server on another day, because the server writes a new daily backup at its first start of the day.

## Status

**Phase 9 is done** on branch `claude/phase9-test-room`, tag `phase9-done`. Nothing is pushed.

Final gates:
- Typecheck clean, 124 test files and 893 tests passing.
- `bun run sync` exit 0.
- Nothing from `data/`, `fixtures/`, `docs/research/` or `handoff/screens/` is tracked, and no PNG at all.

The test count went from 801 to 893: about 130 new tests, minus 39 UI tests of the seven Phase 3 screen parts the test room replaced (removed). The timer, routing and persistence tests from Phases 3 and 4 are unchanged and pass.

`handoff/BUGS.md` was empty, so there were no bugs to fix.

**What I wrote:**
- SPR grading, limits and preview parsing.
- The contracts, the tool store and the telemetry events.
- Highlight storage, overlap rules and DOM marks.
- Figure splitting.
- The test-room composition wired to the exam state machine, and the drill tools.
- The calculator terms check, every doc, and the tests for all of it.

**What Gemini 3.8 Flash built:** the UI spec from your screenshots (High effort) and the presentational parts. Four writers ran at Medium effort in worktrees, never more than three at once:
1. Header, footer, question menu, review screen, split panes, question bar, eliminator in the choice list.
2. Reference panel and figure zoom.
3. Calculator panel, answer box and preview, response directions.
4. Highlight toolbar, note editor, line reader.

I reviewed every diff and merged them one at a time, running the tests after each.

**Fixes after review:**
- A zoomed figure was clipped instead of scrolling.
- The 45-45-90 triangle was drawn with unequal legs.
- The calculator would have saved its state under the wrong mode.
- The docked side column ignored the expanded reference width.
- The line reader's handle covered one of its three lines.
- More had no label.
- The UI spec had errors: brand name in the title, missing rectangle formula, "no divider handle" (there is one), incomplete figure controls, quoted official headings, an invented "Answer:" label, a wrong calculator description, and the highlight toolbar and zoom indicator missing.

## Definition of done

| Item | Status |
|---|---|
| Typecheck, tests, sync, nothing tracked, nothing pushed, tag | Met |
| BUGS.md items | Not applicable: empty |
| Exam modes show the new shell | Met. Seen in the browser at 1366x768, Math and Reading and Writing |
| Full Math module with Reference, eliminator, Mark for Review, question menu, review screen, typed answer with live preview | Met. Done in the browser on a copy of your data, up to submitting |
| Calculator | **Partly met.** The panel (drag, corner resize, close, Graphing/Scientific, per-module state, telemetry) is built and seen. The **Desmos embed is not**, because the terms check failed (below) |
| Every example in the directions table is a test; limits enforced as typed | Met (`src/services/exam/sprDirections.test.ts`, data in `SPR_EXAMPLES`; also on the real screen in `TestRoom.test.tsx`) |
| Reading and Writing never shows Reference or the calculator; has Highlights and Notes, line reader, zoom | Met. Tested on screen and seen in the browser |
| Tool inventory test passes for both sections | Met: `src/config/testRoomConfig.test.ts` (the lists) and `src/components/testroom/TestRoom.test.tsx` (the rendered screen, Math multiple choice, Math typed answer, Reading and Writing) |
| Phase 3 and 4 timer, routing and persistence tests unchanged and passing | Met |
| exam-spec and calculator-spec carry verified, inferred and unverified labels; skin decision recorded | Met (`docs/exam-spec.md`, "Test room (Phase 9)"; `docs/calculator-spec.md`) |

## Decisions I made

- **Desmos is not embedded.** The API terms (v1.0, 2025-07-11) allow the free tier "solely for personal, non-commercial use". They also say "Commercial use includes any use of the API in an Application that is accessed by End Users in production", and the key must not be shared. A free package handed to classmates is not clearly allowed. The panel shows "No calculator is set up in this copy of Blackbook" and points to the spec. A `CalculatorEngine` interface (`src/services/calculator/engine.ts`) is the place to plug one in. `docs/calculator-spec.md` has the quotes and the steps: ask partnerships@desmos.com, then a per-user key in Settings, loaded in a sandboxed iframe.
- **SPR grading (inferred, labeled):** a decimal of 3 or more places that truncates or rounds a fraction in the key at its last place is accepted (`SPR_DECIMAL_MIN_PLACES` in `scoringConfig.ts`). It matches every official example and applies only against fraction forms, whose value is exact. Grading is live, so old drill reports may now show such answers as correct. Three old tests that encoded the exact-only rule were updated. `SCORING_CONFIG_VERSION` was not bumped (routing and estimates are unchanged).
- **Characters as typed:** `.`, `-` and `/` all count (the first two inferred from the examples; the slash unverified). A key press or paste past the limit is ignored.
- **The look is ours.** Behavior and layout follow the screenshots; colors, icons, figures and wording are Blackbook's own. The reference drawings are new SVGs, and the directions are in our words.
- **Footer left** shows "Math, Module 1" (no name is stored).
- **More menu:** Help (our text), Shortcuts (our keys), Line Reader (Reading and Writing only), Unscheduled Break, Emergency pause (Blackbook only, moved here from the header), and Exit (clock keeps running, moved here from the corner). Assistive Technology is not built.
- **Unscheduled break:** the module clock keeps running; the question's own active time stops.
- **Eliminator** starts off in each module and stays on across questions. Struck choices stay struck when it is turned off.
- **Calculator** state, place and mode last within a module and reset in the next. Zoom (75 to 200%, Ctrl plus, minus and 0) lasts for the app session.
- **Highlights** are stored on the session record per question (`annotations`, validated on the server: offsets, style, note of at most 1000 characters, at most 100 per question). A new highlight takes over the text it covers. Telemetry logs counts only, never the text or the note.
- **Line numbers:** not built. The bank's passages carry no line-number markup, so none were invented.
- **Figures** with a drawing or picture get zoom in and out, a percentage, Reset and full screen. Tables don't.
- **Drills** keep their screen and gain Calculator and Reference (Math), highlights and notes (Reading and Writing) and figure zoom. Their typed-answer box is unchanged.
- **Browser check on a copy:** I ran the server with `--data data/p9check` (a copy without your secrets folder), so starting test modules did not use up questions in your pool. The copy is deleted.

## What I could not see

- **Not seen in the browser:** a figure's zoom controls and full screen on a real question (unit-tested only); the Directions dropdown text; Help and Shortcuts dialogs; the five-minute alert in the new header; emergency pause from More; pointer-dragging the divider, calculator and line reader (keyboard and unit tests only); the expanded reference.
- **Not seen in your screenshots** (assumed, listed in `docs/exam-spec.md` and `docs/later.md` as screenshots to take):
  - the review page;
  - the Math More menu;
  - Help, Shortcuts and Assistive Technology contents;
  - the Directions dropdown open;
  - the line reader on screen;
  - the unscheduled break screen and the exit dialog;
  - a typed value in the Answer Preview;
  - Scientific mode;
  - figure full screen;
  - the note editor and the underline dropdown;
  - the timer hidden and the five-minute warning;
  - whether the eliminator starts on.

## Quota or tool problems

- None from Gemini; all five tasks finished on the first try.
- The T3 browser preview worked this time (Phase 8's timed out).
- The session was interrupted once during the final gates; I checked the commit had landed and reran the gates.

## Exact steps to test it yourself

1. **Restore your backup first** (top of this report), then `bun run dev`.
2. Take a test, One module, pick Math, Start the clock.
3. **Header:** Directions on the left; timer and Hide in the center; Calculator, Reference and More on the right; 100% in the corner. Press Ctrl plus and Ctrl minus (the corner changes), then Ctrl 0.
4. **Question 1 (multiple choice):** no Back. Click the crossed "ABC" at the right of the question bar: a crossed-letter button appears by each choice. Click one, then click it again to restore it. Mark for Review fills the bookmark.
5. **Reference:** opens docked on the right and squeezes the question; the expand icon widens it; X closes it.
6. **Calculator:** a floating panel with Graphing and Scientific, a grip to drag, a corner to resize and X. It says no calculator is set up (expected; see `docs/calculator-spec.md`).
7. **A typed-answer question:** directions and examples table on the left, no ABC toggle. Type `-1/3`: the preview shows a stacked fraction. Try `0.6667`: it stops at `0.666`. `%`, `,`, `$` and spaces are refused.
8. **Footer:** "Question N of 22" opens the menu (current pin, dashed unanswered, bookmark on marked) with "Go to Review Page". The review page lists every question; Submit module asks to confirm that you cannot return.
9. **More:** Unscheduled Break hides the question while the clock keeps running, and "Resume testing" brings it back. Exit leaves with the clock running.
10. **Reading and Writing module:** the header shows Highlights & Notes and More, with no Calculator or Reference. Select words in the passage and a toolbar appears: three colors, underline, note (and delete on an existing highlight). Add a note, go Next and Back, and the highlight and note are still there. More, Line Reader shows a three-line window; drag its bar or use the arrow keys; Escape closes it.
11. **Drill (Math):** Calculator and Reference buttons sit in the question header. **Drill (Reading and Writing):** select passage text to highlight it.
12. The checklist as a test: `bunx vitest run src/components/testroom/TestRoom.test.tsx src/config/testRoomConfig.test.ts`.

---

# Morning report: Phase 8 (simple home, one merged dashboard; 2026-10-16, unattended)

## Status

**Phase 8 is done** on branch `claude/phase8-dashboard`, tag `phase8-done`. Nothing is pushed. Final gates: typecheck clean, 107 test files and 801 tests passing, `bun run sync` exit 0, nothing from `data/`, `fixtures/`, `docs/research/`, `handoff/screens/` or any key file tracked. `handoff/BUGS.md` was empty, so there were no bugs to fix.

I wrote the tokens, the hidden-session flag (migration 7), the insight fixes, the dashboard endpoint and builder, the scope logic, the Up next picker, the navigation model, the App wiring, the Past drills hide controls, the cross-check and every test for them. Three Gemini 3.8 Flash (Medium) workers built the presentational parts in worktrees: (1) Home, the settings menu, the test chooser, the Question bank page and My rules notes; (2) the scope bar, coach card, numbers row and trends; (3) the skills map, mistakes, habits, tests table and detail links. I reviewed each diff and merged them one at a time, running the tests after each merge. Fixes I made after review: no nested `<main>` and no forced full height on Home (it would have scrolled at 768 px), and KPI tiles that showed "0%" or a blank where they should say "no answers" or "not enough data".

**A Groq key is now set on this computer**, so the coach came back **AI-assisted from a real Groq call** when I opened the dashboard. That was the only real AI call I made.

## Definition of done

| Item | Status |
|---|---|
| typecheck, tests, sync, nothing tracked, nothing pushed, tag | Met |
| BUGS.md items | Not applicable: the file was empty |
| Home: one primary action, four groups, settings menu | Met. Seen in the browser at 1366x768: scroll height 768, so no scrolling |
| Test: every pre-Phase 8 screen within two clicks of Home | Met (`src/services/home/routes.test.ts`, plus `App.test.tsx`, which checks every destination opens a screen) |
| Home targets before and after | Before: 13 buttons in one block, plus Refresh questions, Choose File and Start retry when retries were due (15 to 16 targets), and 2 duplicate bank cards. After: **6 top-level targets** (Up next, four group cards, Settings). Counting every link inside the cards, 13 clickable elements (Up next, "or choose something else", 10 group links, Settings) |
| Bank loaded: no import form or duplicate bank cards on Home; empty bank: empty-bank screen | Met (`App.test.tsx`). The bank block moved to Settings > Question bank (seen in the browser) |
| One Dashboard; old routes redirect; every old metric within two clicks | Met. `viewFor('analytics' / 'aiReport' / 'mySkillsTop')` goes to the Dashboard; the checklist test is in `server/dashboard.test.ts` and `routes.test.ts`. The app has no URLs, so "routes" here means the app's view names |
| No empty cards; no weakest skill under 5 first attempts; no pool-health insight with a sample size | Met (`src/services/ai/insights.test.ts`, `server/dashboard.test.ts`). On your data the headline is now "weakest 1 of 11", not "Transitions 0% after 2" |
| Hiding: off the dashboard only; no-repeat and retries still count it | Met (`server/hidden.test.ts`, `server/dashboard.test.ts`, and the cross-check on synthetic data) |
| Cross-check passes, endpoint timing reported | Met. Synthetic set (5,000 answers, 200,000 events): page matches brute force for 6 scopes, **median 216 ms, max 265 ms** (budget 300). Your data: matches, about 30 ms. Your data has no hidden sessions yet, so the hidden checks ran on synthetic data only |

## Decisions I made

- **Screenshots** had random names; I renamed them to `home.png`, `browse.png`, `analytics.png` and `report.png` and added `handoff/screens/` to `.gitignore`. The "after" captures are in `handoff/screens/after/`.
- **Hidden sessions** are stored in their own table, `hidden_sessions` (migration 7), so saving a session never clears the mark. Hiding a test hides its modules. Hidden sessions are also left out of the timing baselines and the weak-skill ranking (those are analytics), but they still count for "questions done", seen status, the retry queue, no-repeat and pool health. "Hide all before" uses local midnight of the chosen day.
- **Coach:** it needs 3 finished sessions (hidden ones not counted) before it shows insights; until then it says "Do N more drills to unlock this". The endpoint always returns rule-based lines, and the page then asks `GET /api/ai/coach` for AI wording, which keeps the endpoint under budget. The model picks and words; it never sees or chooses the action buttons.
- **"Below target" skills** count only skills with 5 or more first attempts. "First attempt" means what the app already counts: finished, final answers outside retry sessions.
- **Up next:** "enough data for a weak-skill drill" means 3 skills that each have 3 or more first attempts (the weak drill's own minimum). The starter drill is 20 questions in the section you have practiced less (Reading and Writing on a tie).
- **Changes against the previous period** appear only when both periods have 10 or more answers. Study time compares the last 7 days with the 7 days before, whatever the scope.
- **Official domain weights** (docs/exam-spec.md) are in `DOMAIN_WEIGHTS`, keyed by the bank's domain codes. Practice share is your answering time per domain within its section, in scope.
- **"One section"** in the test chooser opens test setup with Reading and Writing preselected; you can switch to Math there. **"800 modes"** opens drill setup with the practice-modes panel focused. **"Random 20"** sits in that panel and opens the old step-through viewer, which saves nothing.
- **Old analytics pages** stay as they were (their own tabs and filter bar) and are reached only as drill-downs. Back from them returns to the Dashboard.
- **Date fields** in the scope bar and in "Hide all before" read "Any date" or "Pick a date" until you focus them (`src/components/ui/DateField.tsx`), instead of the raw "dd-----yyyy" mask. The old analytics filter bar still has the raw mask (in `later.md`).

## What I could not see

- The T3 browser preview timed out on every screenshot (the tab was never visible), so I captured the screens with headless Chrome at 1366x768 and cropped each section. I checked every capture one by one: Home, the settings menu, the test chooser, Home at 420 px wide, each Dashboard section, More filters, the 7-day scope, the skill drill-down, Past drills with the hide controls, the Question bank page, My rules notes and drill setup with the practice modes.
- **Not seen in the browser:** a chart drawn as lines (your data has fewer than 3 points per series, so the tables showed, which is correct), the reasons breakdown (you have no tags yet), the 800 mode rows (no sets yet), an unlock state for the coach, and hiding or showing a real session (I only opened the confirmation and cancelled, so your data is unchanged).
- Keyboard order and focus rings were checked in the jsdom tests and by reading the code, not by tabbing through a real browser.

## Before and after

| Screen | Before (`handoff/screens/`) | After (`handoff/screens/after/`) |
|---|---|---|
| Home | `home.png`: 13 buttons, two bank cards, import form, stray lines | `home-1366.png`, `home-settings-menu.png`, `home-test-chooser.png`, `home-narrow.png` |
| Analytics | `analytics.png`: six tabs and a filter bar before any content, a line drawn from 2 points | `dash-top.png` and one capture per section (`dash-*.png`); with under 3 points a table replaces the line (`dash-trends.png`) |
| Report | `report.png`: an empty "AI-assisted" first card, "Transitions 0% after 2", pool health with "Sample size: 20" | `dash-coach.png`: 3 insights, each with N and one action; no pool-health insight |
| Browse | `browse.png` | Unchanged apart from the "One random question" entry |

## Quota or tool problems

None from Gemini; all three tasks finished on the first try. The T3 preview screenshots timed out (see above). Stopping the dev server left its child processes running, so I stopped them by port (3000 and 47821).

## Exact steps to test it yourself

1. `bun run dev`. Home shows one white Up next button, four cards and Settings at the top right. With your data it says "Practice your 4 weakest skills".
2. Settings > Question bank: Refresh questions and Import are there, and no longer on Home. Back.
3. Take a test: the chooser offers Full test, One section and One module. Escape closes it.
4. Practice > 800 modes: drill setup opens on the practice modes, with Random 20 at the top.
5. Progress > Dashboard. Try the section index (Coach, Numbers and so on), the scope buttons, Both / Reading and Writing / Math, and More filters (the dates say "Any date").
6. Coach: the label says AI-assisted when your key works, otherwise rule-based. Each line has one button; "Drill your 3 weakest skills" starts a drill.
7. Skills: click a skill name; the detail page opens on that skill. Back returns to the Dashboard.
8. Mistakes: "Tag 5 misses from last session" opens that session's report for tagging. Once you tag misses, the reasons breakdown appears.
9. Detailed views: each of the 8 links opens an old page; Back returns to the Dashboard.
10. Past drills: click "Hide from analytics" on an early session, then go back to the Dashboard (All time); the numbers drop. "Show hidden sessions" brings the row back, and "Show in analytics" undoes the hide. Starting a full test still won't reuse questions from hidden sessions.
11. "Hide all sessions before..." asks for a date and a confirmation before it does anything.
12. `bun scripts/analytics-check.ts` and `bun scripts/analytics-check.ts --synthetic` both end with "Cross-check passed."

---

# Morning report: Phase 7 (AI layer, 800 modes, pacing, rules notes; 2026-10-16, unattended)

## Status

**Phase 7 is done** on branch `claude/phase7-ai-modes`, tag `phase7-done`. Nothing is pushed. Final gates: typecheck clean, 88 test files and 692 tests passing, `bun run sync` exit 0, nothing from `data/`, `fixtures/`, `docs/research/` or any key file tracked. There was no `handoff/BUGS.md`.

The Groq client, key handling, payload builder, validators, candidates, insight menu, fallbacks, the 800 presets' logic, pacing calculations and all their tests are mine. Three Gemini 3.8 Flash workers built the Settings screen, the weak-skill drill, report and 800 panel screens, and the pacing sections, live hint and rules-note box. I reviewed and merged each one separately, running the full tests after each merge, then did the App wiring, the preset countdown and the rules note on drill setup myself.

**There was no Groq key during the run**, so no real AI call was made. Everything AI-side is proven with a mocked Groq. On your real data I ran the rule-based weak drill and report through the local server, and the "what will be sent" preview in the browser.

## Definition of done

| Item | Status |
|---|---|
| typecheck, tests, sync, nothing tracked, nothing pushed, tag | Met |
| With no key, every feature works rule-based | Met. Seen on your data: weak drill and report both returned `origin: rule, fallbackReason: no_key`; the screen says "Needs a Groq key in Settings" |
| With a key, weak drill and report work and are labeled AI-assisted | Met with a mocked Groq only (`server/ai.test.ts`). **Not verified against the real Groq API** (no key) |
| No question text leaves with the toggle off; only candidate questions with it on | Met (tests: no stem, passage, choice, rationale, real id, note or key in the payload with text off; with text on, only candidates' text, never rationales or notes) |
| `docs/ai-spec.md` with verified Groq details, payload rules, limits | Met |
| Key in Settings, removable, not in exports, backups, logs or events | Met in tests (events, export, snapshot and status reply checked for the key). The Settings screen itself was tested in jsdom, not with a real key |
| 800 modes, pacing sections, rules notes | Met in tests; the weak-drill screen and preview seen in the browser |
| Difficulty signal for hard-only modes | Difficulty label **H**, which in your live bank is exactly scoreBand 6 and 7 (Math: 115 + 154 live, Reading and Writing: 164 + 159) |
| Step 0: Browse single end to end and consumed | Met (`drillStore.test.ts`: a finished Browse single comes out `consumed`) |

## Decisions I made

- **Model:** `openai/gpt-oss-120b`, the documented model with strict JSON-schema output; `gpt-oss-20b` is the fallback in config. Temperature 0.2, 20 s timeout, one retry on 429.
- **Payload size:** 60 candidates at most. Text is cut to 600 characters per field. Requests are kept under about 6,000 tokens because the gpt-oss models allow 8,000 tokens per minute; lower-ranked candidates lose their text first.
- **Key file:** `<data folder>/secrets/groq-key`, with mode 600 where supported. On Windows it relies on your profile folder's permissions.
- **Settings and rules notes** are in a new `settings` table and a `rules_notes` table (migration 6). Both are included in exports and backups, never the key. Migration 6 also drops the `source` CHECK so new sources need no rebuild; the server still validates sources.
- **AI cache** stores replies only, keyed by a SHA-256 of the request. "Delete all progress" also empties it.
- **Weak skills** need 3 first-attempt answers and are ranked by the Wilson lower bound (exams count, retries do not). The drill takes the 4 weakest skills, caps one skill at 50% and one difficulty at 70%, and drops an AI proposal entirely if less than half of it survives the rules.
- **Report target:** the "below target" line uses an 80% practice target, which is a choice, not a score claim. Thin data means fewer than 20 answers.
- **800 timing:** a soft countdown at the real pace (about 95 s or 71 s per question). Nothing is auto-submitted, so drills stay drills. It and the live pace hint update when the drill screen re-renders, not every second (noted in `later.md`).
- **Pacing checkpoints and the last five minutes** are worked out from per-question active time in question order. This is exact for drills and labeled as an approximation for exam modules.
- **Weak-skill sessions** count as first attempts, like any drill.

## What I could not verify

- Any real Groq call: the reply quality, real rate-limit behavior, and the side-by-side of text on vs off (`docs/ai-spec.md` says so, and `later.md` lists the comparison to run).
- Whether Groq trains on API data: its docs page does not say. The app states that.
- Visuals: screenshots came back downscaled, so screens were checked through their text, apart from the jsdom tests. Not opened in the browser: Settings, the report screen, the 800 panel, pacing sections, the notes box.

## Quota or tool problems

None from Gemini; all three tasks finished. Two background test-server processes ended with "exit 127" when I stopped them; that was the stop, not a failure.

## Exact steps to test it yourself

1. `bun run dev`. Home has Weak-skill drill, Study report and Settings.
2. Without a key: Weak-skill drill, then Build drill. It shows the preview first, then a "rule-based" drill. Start it, finish it, and the report shows a Pacing section.
3. Settings: paste your Groq key, Save, Test connection. The key is never shown again.
4. Weak-skill drill again: the label should say "AI-assisted". Turn on "Include question text" (accept the confirmation), use "Show exactly what will be sent" to see the text, then build again.
5. Study report: Last 7 days or All time, then Regenerate. Lines say "thin data" where samples are small.
6. Start a drill, open the Practice modes panel, and start Math 800: a soft countdown appears. Finish a Conventions set with no misses and its card shows a streak of 1.
7. Pick one skill on the drill setup and write a rules note. It also shows on the Mistake log (filter by that skill) and under missed questions in reports.
8. Export your data and search the file for your key: it is not there. Remove key in Settings, and the features go back to rule-based.

---

# Morning report: Phase 6 (foundations, 2026-10-16, unattended)

## Status

**Phase 6 is done** on branch `claude/phase6-foundations`, tag `phase6-done`. Nothing is pushed. Final gates: typecheck clean, 80 test files and 638 tests passing, `bun run sync` exit 0, nothing from `data/`, `fixtures/`, `docs/research/` or `.env` tracked. There was no `handoff/BUGS.md`.

The eligibility rule, preflight, pool simulation, migration 5, mistake and retry data model, backups and restore, research corrections and the inventory script are mine. Three Gemini 3.8 Flash workers built the UI in worktrees: the mistake review panel and Mistake log, the retry card with pool health and Browse markers, and the Data page restore section. I reviewed each diff and merged them one at a time, running the full tests after each merge, then fixed what I found myself (listed below).

## Definition of done

| Item | Status |
|---|---|
| typecheck, tests, sync, nothing tracked, nothing pushed, tag | Met |
| BUGS.md items | Not applicable, no file |
| Eligibility rule proven by tests | Met. `src/services/eligibility/eligibility.test.ts`: a finalized Browse single is never assembled (30 seeds); an exam question only seen is excluded; a drill question seen but not finished is used only after confirmation. The store-level tests also show a second test never reuses a question shown in a discarded first one, and repeats need the explicit box |
| Cross-check output | `bun scripts/eligibility-check.ts`: "Cross-check passed: the rule agrees with the raw attempts, sessions and events." 74 questions answered, 33 shown in exams |
| Pool health realistic on your data | Home and test setup show "Full tests left: 6, Reading and Writing: 10, Math: 6 (estimate)". Computed in 20 ms by simulating assembly |
| Labels from Step 2 in the spec and config, no early break end in real mode | Met (`docs/exam-spec.md` "Research corrections", `scoringConfig.ts` comments) |
| Mistake tagging, Mistake log, retry queue, restore, with tests | Met in tests. In the browser I saw Home, test setup and the Data page (backup list with today's snapshot); I did not tag a real miss, run a retry or restore in the browser (see below) |
| `docs/analytics-inventory.md` generated by script | Met (`bun scripts/analytics-inventory.ts --write`) |

## What changed for you

- **Global done rule.** A question you answered anywhere (drill, Browse, retry, exam) or saw in any exam module, including paused or discarded exams and questions you never answered, never enters a full test or section test. Seen-but-unanswered drill and Browse questions are used only if you tick "Include questions I have seen but not answered". Repeats need "Allow repeats of questions I have already done", and such a test's report says "Contains repeats" with a note on the estimate.
- **Pool health** on Home and the test setup screen.
- **Browse** rows show "In exam pool" or "Used". Opening a pool question when that section has fewer than 3 tests left shows "Doing this removes it from future full tests."
- **Break:** no "End break" button in the real exam mode. It is still there when the dev shortened-break override is set.
- **Student-produced responses:** one decimal point or one fraction bar, never both, and no leading slash.
- **Review mistakes** panel on every report (drill, Browse single, retry, each exam module). Suggestions come from your own timing, a guess rating, or a blank at the end of an exam module. You confirm them with one click, and the panel says they are only suggestions. **Mistake log** button on Home.
- **Retry queue:** "N questions due for retry" with Start retry on Home. Nothing is due yet because your misses are less than 2 days old. My skills shows a separate "Retries: C of A correct" line.
- **Backups:** a snapshot is written at server start, at most one per day, and the last 7 are kept, in `data/app/backups/` (dev) or the app data folder. The Data page lists them and restores from a snapshot or an export file, after a confirmation.

## Decisions I made

- **"Done" for an unfinished session:** a final answer (you pressed Next) counts as done even if the session is unfinished or discarded. Only shown-but-unanswered questions count as seen. This is the conservative reading of "in-progress counts as seen, not done".
- **Exam-shown** is read from the session records (visits) as well as from `question_shown` events, so deleting telemetry cannot put exam questions back in the pool.
- **Pool health** counts one test as using Module 1 plus the harder Module 2, since the route is unknown in advance. It needs the full difficulty profile with no shortfall notes, the same criterion as the preflight. It stops counting at 50.
- **Practice module (Phase 3)** also uses the strict rule now. If the pool runs short, the module comes out shorter and says so. There is no repeats switch there yet.
- **First attempts vs retries:** sessions with source "retry" are left out of My skills, `countableAttempts` and every analytics query (SQL and the brute-force oracle). Retry results appear only on their own line. "First attempts" here means "not a retry session". A question repeated through Browse still counts twice, as it did before.
- **Retry queue** is derived from attempts, so no table was needed. Wrong answered final attempts in finished non-retry sessions enter it at 2 days. A correct retry advances it to 7, then 21 days, and a correct retry at 21 days graduates it. A wrong answer anywhere resets it to 2 days. A correct answer outside a retry does not advance it. Blanks are not queued. A retry session serves at most 20 questions, longest overdue first. Intervals live in `src/config/mistakeConfig.ts`.
- **Mistake tags** are keyed by session and question. Editing only the note stores a new row but logs no event. Events carry ids and reasons, never the note.
- **Migration 5** rebuilds the sessions table, because SQLite cannot change the `source` CHECK in place. It recreates the generated columns and indexes. It ran on your database: 14 sessions and 74 attempts are intact.
- **Restore** writes a "before-restore" safety copy first (the last 3 are kept), validates every record, and replaces everything in one transaction. **Settings:** the app stores none, so exports have none. Noted in `docs/later.md`.
- **Score caps** 600/400 are unchanged, labeled community-derived and unverified, with the requested copy. The easier route's range was already wider by 20 points each side; a test now pins that.
- **Break at zero** still continues by itself; the real app waits for a click. Recorded as a divergence and in `later.md`.
- After review I changed the Gemini mistake panel so it no longer pre-selects "Careless" when there is no suggestion, and it shows save errors.

## What I could not verify

- The preview browser returned screenshots downscaled to 640x400, so I checked the screens through their text and accessibility tree, not at full resolution. Spacing and contrast of the new panels are unchecked.
- Not run in the browser: tagging a real miss, the Mistake log with data, a retry session (none due), a restore, the Browse warning (your pool is above 3 tests), the "Contains repeats" banner. All are covered by unit and component tests only.
- Windows only.

## Quota or tool problems

- Two of my shell heredocs broke on quoting; I redid those edits with the file tools.
- A Vite from an earlier session was already on port 3000, so `bun run dev` could not start its own. I reused that Vite with a server I started myself, and stopped my server afterwards.

## Exact steps to test it yourself

1. `bun run dev`, open the link. Home shows pool health and the Mistake log button.
2. Practice test: the setup shows "Full tests left: N (estimate)". With enough fresh questions, Start works with no boxes ticked.
3. Do one drill and get one wrong. Open its report, then Review mistakes, then tag it or accept a suggestion. Home, then Mistake log: the row is there; filter it, then Open report.
4. Browse: answered questions say "Used". Run `bun scripts/eligibility-check.ts` and the consumed count has gone up.
5. Two days after a miss, Home shows "1 questions due for retry". Start retry, finish it, and My skills shows the Retries line.
6. Your data: today's snapshot is listed. Restore it and confirm, and the counts come back. Restoring a non-Blackbook JSON shows an error and changes nothing.
7. `bun scripts/analytics-inventory.ts` prints what is collected.

---

# Morning report: Phase 5 (analytics dashboard, 2026-10-16, unattended)

## Status

**Phase 5 is done** on branch `claude/phase5-analytics`, tag `phase5-done`. Nothing is pushed. Final gates: typecheck clean, 71 test files and 561 tests passing, `bun run sync` exit 0, no `data/`, `fixtures/` or `.env` files tracked. There was no `handoff/BUGS.md`.

Gemini wrote the six screens, the filter bar and three chart components in three worktrees; I reviewed each branch before merging. Aggregation, ranking, baselines, the oracle, the check script and the launch wiring are mine.

## What you can do now

Home has an **Analytics** button with six tabs and a filter bar (date range, kind, section, exclude paused tests, exclude single-question sessions):
Overview, Skills (sortable, filterable, click a skill for its sessions and missed questions with rationale), Timing and pacing, Behavior, Test history, Study next. Definitions are in `docs/analytics.md`.

## Definition of done

| Item | Status |
|---|---|
| typecheck, tests, sync | Met (561 tests) |
| BUGS.md items fixed | Not applicable, no file |
| Cross-check on real and synthetic data | Met. `bun scripts/analytics-check.ts` and `--synthetic` both print "Cross-check passed" over 12 filter combinations plus one skill detail |
| Query timings | Met. Synthetic set of 5,064 answers and 203,602 events: median 3 to 77 ms per summary, slowest single call 123 ms (target 300). The timing query was first 376 ms; I fixed it by computing baselines once and replacing correlated event subqueries with joins |
| Small samples marked, method and parameters on screen, 1-of-1 vs 18-of-20 test | Met (`rank.test.ts`; method note on Study next; "low N" tags) |
| Study next launches a prefilled drill and a misses-first review | Met, both seen end to end in the browser: the misses drill served 14 questions in exactly the API's oldest-miss-first order; the top-skills drill served 10 questions on 3 skills. I discarded those two test sessions afterwards |

## Decisions I made

- **Question facts for SQL** are copied into a temp table from the bank file whenever it changes; the database never stores question content.
- **Kinds:** besides drill, single, section run and full test, I added "Practice module" for lone Phase 3 modules.
- **Mixed rates:** every screen shows drill and exam apart. Study next pools them for ranking only and says so in `docs/analytics.md`.
- **Baselines ignore the filters** (all finished answers, per mode, section and difficulty), so a narrow date range cannot move a threshold. A group under 20 answers is never flagged.
- **Swap counts** use direct choice replacements on multiple-choice questions (typed answers excluded); "answers changed" uses the stored change count.
- **Last five minutes** counts questions first answered after the five-minute alert event.
- **Ranking:** Wilson lower bound (z 1.2816); skills under 5 answers get a fixed 0.45 plus an unseen bonus. These numbers are choices, all in `src/config/analyticsConfig.ts`.
- **Misses** are questions whose latest finished answer was wrong; review drills carry `DrillConfig.questionIds`, one drill per section, `liveOnly` off.
- **Charts** are hand-written SVG; no dependency added.

## What I could not verify

- Visual quality: I saw the Overview at low resolution and read the other screens as text. Spacing, contrast and chart appearance are unchecked, and Test history and the exam-pacing views had no data in your account (no finished tests), so they were seen empty only. The synthetic set exercises them in tests, not in a browser.
- Everything on your real data is based on only 74 answers.
- Windows only.

## Quota or tool problems

None. Gemini finished all three tasks. Shell quoting broke several of my edits and I redid them with the file tools.

## Exact steps to test it yourself

1. `bun run dev`, open the printed link, click **Analytics**. Overview shows Drills and Exam modules side by side, each with its N.
2. Skills: sort by Weakest first, type in the filter, click a skill, press Show question on a missed one.
3. Timing and pacing: thresholds appear only for groups with 20 or more answers; until then it says "not enough data".
4. Behavior: answer-change counts and net effect; confidence rows appear only if you drilled with confidence on.
5. Test history: after finishing two practice tests, range bars appear; a scoring config change would show the version warning.
6. Study next: press "Review my misses in ..." and "Drill top skills in ...". Discard the sessions from In progress afterwards if you do not want them.
7. `bun scripts/analytics-check.ts` and `bun scripts/analytics-check.ts --synthetic` print the cross-check and timings.

---

# Morning report: Phase 4 (full practice test, 2026-10-16, unattended)

## Status

**Phase 4 is done** on branch `claude/phase4-full-test`, tag `phase4-done`. Nothing is pushed. Phase 5 is not started. Final gates: typecheck clean, 60 test files and 503 tests passing, `bun run sync` exit 0, and no `data/`, `fixtures/` or `.env` files tracked.

Gemini wrote four of the screens (setup, module-ready, break, report); I reviewed every line and merged them one at a time. Everything touching timers, state, persistence, routing and the estimate is mine.

## What you can do now

On the home page, **Practice test** offers a full test (Reading and Writing, 10-minute break, Math), Reading and Writing only, or Math only. Module 1 of each section is built up front; after Module 1 the app routes to an easier or harder Module 2 and builds it from questions not already used. The final page shows an **estimated score range** per section (and a total for a full test), labeled as an approximation, with the routing result and the usual accuracy tables. An unfinished test appears under **In progress** (as "Full test", with "Module N of 4" or "On the break"); a finished one under **Past drills**. Both resume and reopen from there.

## Definition of done

| Item | Status |
|---|---|
| Routing after Module 1 and easier/harder Module 2 | Met. Both directions are unit tested and the easier route was seen in the browser. The harder route was not seen in the browser (my dev run answered nearly nothing) |
| Assembly with preflight, no repeated questions across modules | Met (tests). The setup screen shows shortfalls and the "include seen" choice; a thin pool refuses to start |
| Full-test state machine, persisted, resumable | Met. Reloading mid-module, right after a submit and mid-break were all tested; mid-break and after-submit also in the browser |
| Break screen, absolute deadline, ends at zero by itself or early | Met, in the browser with a 20 second dev break. Reloading mid-break showed the right time left |
| In progress and Past drills labels | Met. In progress seen in the browser; the Past drills row is covered by tests only |
| Pause marks the test | Met. A pause in Math Module 2 showed on the report |
| Estimate range with its label | Met. Never a single number; the range widens with unanswered questions |
| `scripts/test-estimate.ts` cross-check | Met. Run on the dev run's data: attempts match answers, routing and estimate recompute equal, "Cross-check passed" |
| Telemetry events documented, `docs/scoring-spec.md`, `docs/exam-spec.md` updated | Met |
| Task 1 (earlier): Math order official by default | Met. The old order stays behind `MATH_ORDER = 'spec'` |

## Decisions I made

- **Persistence without a schema change:** the test is a "container" session (mode `exam`, no questions of its own) whose `test` field holds the state. Each module is an ordinary exam session linked by `exam.testId`. A single idempotent `reconcile` reads the container and its modules and applies whatever transition is missing, so closing the browser at any moment is safe. The server validator accepts a container and still rejects anything inconsistent.
- **Module sessions are hidden from the lists;** only the container shows, as one "Full test" row.
- **Assumed numbers** (all in `src/config/scoringConfig.ts`, marked assumed, listed in `docs/scoring-spec.md`): band weights, the 0.5 weighted routing threshold, the easier and harder difficulty mixes, the 600 ceiling on the easier route, the 400 floor on the harder route, the linear conversion, the range widths, and the 10-minute break. Each stored estimate and routing decision keeps the config version it was computed with.
- **`scoreBand` is real data:** I checked it over the bank: integers 1 to 7 that nest inside Easy (1 to 3), Medium (4 to 5), Hard (6 to 7). The weights use it; their values are assumptions.
- **A Start button before each module** so its clock does not run while you read the previous result. No per-module results are shown mid-test; everything is on the final report.
- **Leaving a started module** keeps its clock running, like a single module.
- A discarded test marks the test and its open module abandoned. Nothing is deleted.

## What I could not verify

- **Full-length runs.** The browser run used a 40 second module limit and a 20 second break (dev-only localStorage keys `blackbook.dev.examSeconds` and `blackbook.dev.breakSeconds`). Real 32 and 35 minute modules and a real 10 minute break were not run. The clocks use absolute deadlines and the tests use a fake clock, but a full-length run is on you.
- **The harder-route path in the browser**, and any estimate with realistic answers. The dev run left most questions unanswered, so the estimate there was 200 to 380 and 200 to 370. The scoring unit tests cover both routes and realistic mixes.
- **Visual quality.** I read the text of every screen and looked at none of them properly; I did not review spacing or contrast. The dev screen says "1 minutes" because 40 seconds rounds up; the real 32 and 35 do not.
- **The real routing rule and conversion.** They are not public. The estimate is a transparent approximation, good for comparing your own tests with each other, not for predicting test day.
- **Windows-only run.** Nothing was tried on Mac.

## Known rough edges

- The estimate card shows "midpoint about N" next to the range; with very few answers the midpoint sits at the bottom of the range (200 to 380, midpoint about 200).
- The setup screen's description hard-codes the real module lengths (27 and 22 questions, 32 and 35 minutes) even when a dev override is set.
- Line endings: some files are LF in the working tree; git warns about CRLF on commit. Nothing is broken.

## Quota or tool problems

None. Two Gemini tasks ran in separate worktrees without trouble. A few shell edits failed from quoting and were redone with files.

## Exact steps to test it yourself

1. `bun run dev`, open the printed link. Click **Practice test**, leave "Full test" selected and press Start test.
2. Press Start module for Reading and Writing Module 1 and answer some questions. Reload the page. Home shows "Full test · Module 1 of 4". Resume, then Start module, and the clock keeps its saved time.
3. Submit Module 1 on the review page. You land on a ready screen for Module 2, with a note saying whether you were routed to the easier or harder one. Start it and submit.
4. The break appears with a countdown. Reload mid-break, Resume, and confirm the time left is right. Either press End break and continue, or let it reach zero.
5. Do the Math modules. In one, press Pause, pick a reason, and Resume.
6. Read the final page: estimate range with its label, the pause note, the routing line per section, the tables, and the questions with explanations. Check that **Past drills** lists it as "Full test" (I only checked this in tests).
7. Fast version: in the browser console, run `localStorage.setItem('blackbook.dev.examSeconds','40'); localStorage.setItem('blackbook.dev.breakSeconds','20')`, reload, and run the whole test in about 5 minutes. Remove both keys afterwards.
8. Run `bun scripts/test-estimate.ts` and look for "Cross-check passed".

---

# Run report: Phases 2c, 2d and 3 (unattended run, 2026-10-15)

## Summary

All three phases are **done**, each tagged on its own branch. Nothing is pushed. The final state is branch `claude/phase3-exam-shell` (tag `phase3-done`): typecheck clean, 52 test files and 437 tests passing, `bun run sync` exit 0, and no `data/`, `fixtures/` or `.env` files tracked.

| Phase | Status | Branch, tag | Definition of done |
|---|---|---|---|
| 2c: deferred feedback, history, telemetry | Done | `claude/phase2c-telemetry`, `phase2c-done` | All items met |
| 2d: drafts, browse to practice, seen status | Done | `claude/phase2d-browse-drafts`, `phase2d-done` | All items met |
| 3: exam shell, one timed module | Done | `claude/phase3-exam-shell`, `phase3-done` | All items met |

Each branch starts from the previous phase's tag, so `claude/phase3-exam-shell` contains everything.

**Definition-of-done items not met:** none. Some items were met in a form other than the one described:
- A reload stood in for closing the tab.
- Auto-submit ran with a dev-only 5:30 module limit instead of the full 35 minutes.
- Random's preference for unseen questions is proven by unit tests, not in the browser.

**Main decisions** (full lists in each phase section):
- Drill score counts unanswered questions as wrong.
- My skills counts only final answers in finished sessions, and drills and exams are kept apart by mode.
- Sessions are never deleted: Discard marks them abandoned, and finished sessions are locked on the server.
- "Seen" means shown on screen or answered. Deleting telemetry turns shown-but-unanswered questions back to Unseen.
- The Math question order follows your spec (multiple choice first, SPR last). The official manual says otherwise; a config switch, `MATH_ORDER`, selects the official order.
- Each exam module counts all 27 or 22 questions (no pretest). Per-module domain counts are derived from the official section shares.
- A dev-only localStorage key shortens module time for testing.
- An "Exam module" opened from Past drills shows the standard report.

**Not verified:**
- Fine visual detail in every phase. The preview screenshots come back at 640x400, and even magnified the text was soft. I checked layout through element positions, and every screen through its text.
- A real tab close, a real tab switch, and a real 32- or 35-minute run to zero.
- Behaviour of the official app that the sources don't describe (timer hide, alert style, review page, navigator). It is listed in `docs/exam-spec.md` for you to compare.

**Quota and tool problems:**
- The T3 session restarted three times. Cut-off background commands were rerun, and no work was lost (the ledger and commits covered each restart).
- One `/compact` failed on a usage limit; the run continued.
- I once killed every `node.exe` to stop a runaway test, which was too broad. Nothing else appeared affected, and I used PIDs only after that.
- A `git stash -u` changed the line endings of your `phaseexec/` files. I restored them to LF, and their content is unchanged.
- One checkpoint commit that failed typecheck was undone before merging.
- One commit with a failing test (4512b18) was fixed in the next commit (e7c8b21).

**How to test each phase.** Run `bun install`, then `bun run dev`, then open the printed link. The step-by-step lists are at the top of `handoff/SESSION.md`, one per phase:
- **2c:** run a 20-question drill with changes, flags and confidence ratings. Close and resume it. Type `k` in the dev terminal mid-drill, answer, then type `s` and press Retry. Finish, read the report, and check Past drills. Run `bun scripts/telemetry-check.ts`. On "Your data", export and then delete telemetry.
- **2d:** in the In progress list, resume a 5-of-20 drill. In Browse, set filters, practice a question with Done, come back with filters, page and scroll kept, and check Seen, Done and the "—" result for an unfinished drill. Try Random and Discard. Run `bun scripts/status-check.ts`.
- **3:** under "Practice module", take a full Reading and Writing module: reload midway (the time continues), use Hide, the navigator and the arrow keys, then Review and Submit. For Math, the reference sheet and the SPR box rules apply. Pause once to see it marked in the results. For a quick time-out test, in the browser console run `localStorage.setItem('blackbook.dev.examSeconds','330')`, start a Math module and wait 5:30. Remove the key afterwards. Run `bun scripts/telemetry-check.ts` for the cross-check.


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

## Phase 3: exam shell (one timed module end to end)

Branch `claude/phase3-exam-shell` (from `phase2d-done`). Tag `phase3-done`.

### Gate before starting
Green at `phase2d-done`: typecheck, 349 tests, sync exit 0.

### Definition of done
| Item | Status |
|---|---|
| typecheck, tests, sync, nothing from the source in git, nothing pushed | Met. 52 files, 437 tests. Sync exit 0 (run at the end). |
| A full 27-question Reading and Writing module and a full 22-question Math module | Met in the browser. Reading and Writing: 27 questions in the official domain order (8 / 7 / 7 / 5), 25 answered, 2 marked for review, navigator jump, arrow keys, Hide and Show, review page, Submit with confirmation, results. Math: 22 questions (16 multiple choice, then 6 SPR), reference sheet, the SPR input rules, a pause, the five-minute alert, then time ran out. |
| Close the tab midway and resume with the right time left | Met. Reading and Writing showed 31:55 on question 14. After a reload and Resume from In progress it was back on question 14 showing 31:45, the 10 seconds the reload took. |
| One module runs out of time and auto-submits | Met. The Math module ran with the dev-only 5:30 limit, in a tab that was not visible. At zero it submitted on its own, without the review page. The results say "Time ran out. The module was submitted automatically.", time used 5:30 of 5:30. The answers given (4 multiple choice and one SPR, `7/2`) were stored and graded; the cross-check passed (active 330.0 s vs 329.9 s stored, score 0 / 22 both ways). |
| Pause is flagged in the results | Met. An emergency pause with the reason "Technical problem" hid the questions and stopped the clock: 5:11 at the pause, 5:10 after resuming six seconds later. The results show "Paused: this is not a clean timed run." with the time, the reason and the length (0:07). |
| Tests prove timer correctness under a hidden tab and a reload, and the deadline passing while closed | Met. `src/services/exam/timer.test.ts` covers a hidden tab (throttled ticks against the deadline), a sleep jump, a reload (the stored timer gives the same time left), the deadline passing while closed, pause and resume, and the five-minute rule. `src/hooks/useExamClock.test.tsx` covers the redraw after a long gap and a single expiry callback. `src/stores/examStore.test.ts` covers resume after reload with the right time, auto-submit on reopen after the deadline, and a single submit when the timer and the button fire together. |
| Exam attempts stored apart from drill attempts; results match the stored answers (cross-check) | Met. Attempts carry mode `exam` (25 final ones for the Reading and Writing module). `bun scripts/telemetry-check.ts` on that module: answers, change counts, active time (33.4 s against 33.4 s stored), grades and score (5 / 27 from events, 5 / 27 stored) all agree. My skills counts only drill attempts (`countableAttempts(..., 'drill')`), and a test proves exam attempts stay out. |
| Morning report in SESSION.md | Met. |

### Spec and sources
`docs/exam-spec.md` cites the SAT Suite alignment pages for Reading and Writing and for Math, the translated Bluebook test directions (PDF), and the Digital SAT Suite technical manual (PDF). I read the PDFs locally.
- **Verified:** 27 questions in 32 min and 22 in 35 min; the domain shares; the Reading and Writing domain order and the order inside each domain; about 25% of Math questions are SPR; SPR up to 5 characters, or 6 with a minus sign; auto-submit at zero; no return after moving on.
- **Derived:** the per-module domain counts.
- **Assumed:** everything else, each labelled in `src/config/examConfig.ts`.

### Decisions I made
1. **Math order conflicts with the source.** Your spec asks for multiple choice first and SPR in the last quarter, each block by domain and then easiest to hardest. The technical manual says Math runs easiest to hardest across the whole module and does not say where SPR questions go. I followed your spec as the default and added `MATH_ORDER = 'official'` in `examConfig.ts` to switch.
2. **No pretest questions.** All 27 or 22 questions count. Domain counts per module come from the whole-section shares (8 / 7 / 7 / 5 and 8 / 8 / 3 / 3), and 6 SPR questions per Math module.
3. **Difficulty mix.** Equal thirds of easy, medium and hard per domain. A short difficulty is filled from the same domain and format and noted; a short domain is reported and never padded.
4. **Exam actions live on the existing session store.** They reuse its save queue and Retry banner, so a failed save blocks moving on and blocks submitting, and Retry finishes a pending submit. Telemetry goes through the same 2c logger with mode `exam`.
5. **Active time per question stops while paused** (the question is hidden) and on the review page.
6. **"Leave (the clock keeps running)".** A small button saves and returns home; the module stays In progress, and its clock keeps running. Not in the spec; added so the module is not a trap.
7. **Dev-only short timer.** The localStorage key `blackbook.dev.examSeconds` shortens module time in a dev build only, so auto-submit can be tested without waiting 35 minutes. The setup screen says so when it applies.
8. **Opening an exam from Past drills** shows the standard report (labelled "Exam module" in the list). The full results screen with the time-out and pause notes appears right after submitting.
9. **Review page wording.** I removed a sentence (from my own brief) claiming that on test day you cannot move on before time expires. No source supports it.

### Gemini
Four writers at Medium in worktrees: `gemini/exam-nav`, `gemini/exam-header` and `gemini/exam-panes` ran in parallel, then `gemini/exam-review-results`. All stayed in their files; each reported real typecheck and test output, and my runs after each merge matched. I reviewed the SPR input (it calls my `nextSprValue`), the reference sheet formulas (correct, written as text), and the header (no timers or Date.now; it only displays). Fixes by me: the review-page sentence above, and a heading for the report embedded in the results.

### Could not verify
- Fine visual detail at full resolution (screenshots come back at 640x400): the split pane widths, the navigator styling and the focus rings were checked through the DOM, not by eye.
- A real 32- or 35-minute run to zero. Auto-submit ran with the dev 5:30 limit, through the same code path.
- Behavior of the official app that the sources do not describe: Hide/Show, the five-minute alert style, the review page layout and navigator details. All are listed as assumed in `docs/exam-spec.md` for you to check.

### Problems during the run
- One commit (4512b18) went in with a failing test: my command chain did not stop on the failure. It was fixed in the next commit (e7c8b21); since then I check test output before every commit.
- The first "Practice module" click in the browser raced the page's initial load; the second worked. Not reproduced afterwards.
