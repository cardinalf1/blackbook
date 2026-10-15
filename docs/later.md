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
