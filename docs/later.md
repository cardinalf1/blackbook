# Out-of-phase ideas

One line per idea, grouped by phase (AGENTS.md rule 8).

## Phase 1 (Ingest)
- Optional in-browser "download from the source" button (pending the user's decision, no server proxy).
- PSAT question banks (PSAT 8/9, PSAT 10, PSAT/NMSQT).

## Phase 2 (Drill mode)
- Filter drill sets by question format (MCQ vs. SPR) and active status.
- Bookmarking and tagging questions for targeted review.

## Phase 3 (Exam shell)
- Desmos calculator integration in the exam header for Math sections.
- Exam UI question navigator matrix showing answered, unanswered, and flagged items.
- Answer choice eliminator tool to cross out options.
- Split-pane layout with independent scrolling and resizable divider for stimulus passages.
- Question flag toggle and 5-minute remaining warning banner.
- Student-produced response (SPR) numeric keypad and input validation.

## Phase 4 (Module flow)
- Multi-stage adaptive test routing between easy and hard second modules based on first-module performance.
- Timed break screen between sections with countdown timer.
- Score range estimation (clearly labeled as an estimate) calculated across both sections.

## Phase 5 (Analytics & Sync)
- Supabase results sync for attempt history and per-skill accuracy (user stats only, zero question content).
- Accuracy by domain and skill with identification of weakest skills and recommended focus areas.
- Pacing analytics showing average time spent per question and difficulty tier.

## Phase 6 (Extras)
- Light theme toggle alongside the default dark theme.
- Electron desktop wrapper for offline local installation.
- Telemetry diagnostics and export of attempt logs.

## Polish (any phase)
- Skill names in the bank can carry trailing spaces; normalize them at sync.
- Show real progress while the facets load for the setup screen (reads the whole bank, about 1 to 2 seconds).
- Drill sessions that lose all unanswered questions to a bank replacement resume as empty; offer to discard.
- The setup screen and question browser load the whole bank over the local API (about 35 MB); add a facets endpoint if it feels slow.
- Data folder actions: open the folder, export progress as JSON, reset progress, delete the bank (Part B, with packaging).
- Show the time a refresh will take using the cache, not only the fresh-download estimate.
- Drill report: close (and stop timing) an open explanation when a filter hides its row.
- Data page: show where the data folder is and offer to open it.
- Telemetry: a dev-only switch to turn the logger off, for A/B latency checks.
- Home "Step through 20 random questions" still reveals answers at once and is not logged; replace it with Browse practice or remove it.
- QuestionView's old drill props are unused since Phase 2c; remove them.
- Browse: remember filters across reloads.
- Calibration: let a user record their official scores next to test results, so the score estimate's conversion could be fitted. Needs enough points to mean anything.
- Full test: a "directions" screen before each module like the real app.

## Phase 5 (Analytics)
- Record official scores after test day to calibrate the estimate (needs the owner to supply them).
- Export analytics tables as CSV.
- Compare skills against a target score once a calibration source exists.

## Phase 6 (foundations)
- Check in a real Bluebook practice test whether "." and "/" count toward the 5/6-character limit of a student-produced response (the owner will check; Blackbook counts them today).
- Check where student-produced items sit inside a Math module, and the other items in the "Check in real Bluebook" list in `docs/exam-spec.md`.
- Real break: wait for a click to start the next section after the break ends, instead of continuing by itself.
- Settings: the app stores none yet (only dev overrides), so backups hold none; add them to the export if a settings store appears.

## Phase 7 (AI and modes)
- Run the weak-skill drill once with question text on and once off (same day, same size) and record in docs/ai-spec.md what the text changed: groups, near-duplicates avoided, slip targeting.
- Try openai/gpt-oss-20b against 120b for the same requests; the smaller one has the same rate limits and may be faster.
- A clock-based pace hint (it updates only when the drill screen re-renders today).

## Phase 8 (home and dashboard)
- Older screens (drill, exam, browse, settings, data, mistake log) can adopt the monochrome tokens in `src/components/ui/tokens.ts`.
- The old analytics drill-down pages still carry their own six tabs and filter bar; they could become single pages with the dashboard scope passed in.
- Coach AI wording is fetched after the page loads; caching it per scope on the server would make it instant on revisit.
- Desmos, annotations and the reference sheet (after checking real Bluebook behavior). Done in Phase 9 except the Desmos embed (see docs/calculator-spec.md).

## Phase 9 (test room)
- Screenshots to take in a real practice test: the review page; the Math More menu; Help, Shortcuts and Assistive Technology open; the Directions dropdown open; the line reader on screen; the unscheduled break screen; Exit confirmation; a typed answer in the Answer Preview (a fraction and a decimal); the calculator in Scientific mode; a figure in full screen and at a zoom other than 100%; the highlight note editor and the underline style dropdown; the timer hidden and the five-minute warning; whether the eliminator starts on.
- Desmos is on with each user's own key (Phase 9 follow-up). Still to check with a real key: whether keys are limited to some websites, Scientific mode on a key without it enabled, and whether the frame's CSP is enough.
- Underline styles (the dropdown next to the underline control) and Assistive Technology are not built.
- Drills keep their own SPR box (6 characters, any text); they could use the exam box with the typed limits and preview.
- The line reader darkens the header and footer too; it could limit itself to the passage pane.
- The reference panel shows one formula card per row; two columns would fit more without scrolling.
