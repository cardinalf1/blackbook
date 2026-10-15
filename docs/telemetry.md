# Telemetry

Blackbook records what you do during a session, with timestamps, so later screens can show where time goes. It records behavior, not thoughts: nothing here measures reasoning. The closest honest signal is the optional confidence rating, which you give yourself.

Everything stays on your computer in the `events` table of `user.db`. The **Data** page can export it or delete it.

## What is never recorded

- Question text, passages, choices or explanations. Events name questions by id only.
- Mouse movement or pointer position.
- Anything that cannot be explained in one sentence.

## Event row

| Column | Meaning |
|---|---|
| `id` | Random id made in the browser, so a resend never duplicates a row |
| `session_id` | The session the event belongs to |
| `mode` | `drill` or `exam` |
| `question_id` | The question on screen, or empty for session-level events |
| `type` | One of the types below |
| `ts` | Wall clock, epoch ms |
| `mono_ms` | `performance.now()` when logged. Monotonic only within one page load |
| `page_id` | Random per page load; compare `mono_ms` only within the same `page_id` |
| `seq` | Order within the page load |
| `payload` | JSON, shape per type below |

Indexes: by `(session_id, ts)` and by `(question_id)`.

## Event types

Times are in milliseconds. "Choice" is a letter A to D.

### Session

| Type | Payload | When |
|---|---|---|
| `session_started` | `{count, askConfidence}` | A new session starts |
| `session_finished` | `{correct, total, totalActiveMs}` | Finish is confirmed and saved |
| `session_abandoned` | `{answered}` | An unfinished session is discarded |
| `session_resumed` | `{index}` | An unfinished session is opened again, after a reload or from the home screen |

### Question

| Type | Payload | When |
|---|---|---|
| `question_shown` | `{index, visit}` | The question is rendered on screen. `visit` counts from 1 |
| `question_hidden` | `{index, visitActiveMs, reason}` | The question leaves the screen. `reason` is `next`, `back`, `jump`, `finish`, `exit`, `unload`, and in exam modules also `review` (the review page opened) and `pause` (an emergency pause hid it) |
| `first_interaction` | `{sinceShownMs, kind}` | First select, strike, flag, typing or rating in this visit. `kind` is `select`, `strike`, `flag`, `type` or `confidence` |
| `choice_selected` | `{choice}` | A choice is picked with no answer before |
| `choice_changed` | `{from, to}` | A different choice replaces the answer |
| `choice_cleared` | `{from}` | The answer is removed (striking the selected choice does this) |
| `choice_struck` | `{choice}` | A choice is struck out |
| `strike_removed` | `{choice}` | A strike-out is undone |
| `spr_changed` | `{value}` | The typed answer changed. Debounced: logged 800 ms after typing stops, and when leaving the question |
| `spr_cleared` | `{}` | The typed answer was emptied |
| `flag_set` / `flag_removed` | `{}` | Flag for review toggled |
| `confidence_rated` | `{rating}` | `guess`, `unsure` or `sure`. Only when the session asks for confidence (drill only) |

### Navigation

| Type | Payload | When |
|---|---|---|
| `nav_back` | `{from}` | Back clicked (0-based index) |
| `nav_next` | `{from}` | Next clicked |
| `nav_jump` | `{from, to}` | A question picked from a list (the finish check now; the exam navigator in Phase 3) |
| `finish_clicked` | `{unanswered, flagged}` | Finish clicked; the confirmation opens |
| `finish_cancelled` | `{}` | The confirmation was closed without finishing |

### Attention

| Type | Payload | When |
|---|---|---|
| `tab_hidden` / `tab_visible` | `{}` | The browser tab is hidden or shown again |
| `window_blur` / `window_focus` | `{}` | The window loses or regains focus while the tab stays visible |
| `idle_start` | `{thresholdMs}` | No key press, click, touch, wheel or scroll for 30 s |
| `idle_end` | `{idleMs}` | Input again. `idleMs` counts from the last input, so it includes the 30 s |

Pointer movement does not count as input and is not recorded.

### Report

| Type | Payload | When |
|---|---|---|
| `report_opened` | `{}` | A finished session's report is shown |
| `rationale_viewed` | `{}` | A report item is expanded and its explanation is shown |
| `report_item_time` | `{dwellMs}` | A report item is collapsed, or the report closes while it is open |

### Exam modules (Phase 3)

Exam events have `mode: exam`. All the question, choice, flag and navigation events above are logged the same way. `question_shown` is logged only when a question is actually displayed, so a question never reached before time ran out has no showing and stays Unseen in Browse.

| Type | Payload | When |
|---|---|---|
| `timer_hidden` / `timer_shown` | `{}` | Hide or Show on the countdown |
| `five_minute_alert_shown` | `{}` | The five-minute alert appears (once per module) |
| `exam_paused` | `{reason}` | An emergency pause starts; `reason` is the option clicked |
| `exam_resumed` | `{pausedMs}` | The pause ends; `pausedMs` is its length |
| `reference_opened` / `reference_closed` | `{}` | The Math reference sheet opens or closes |
| `navigator_opened` / `navigator_closed` | `{}` | The question navigator opens or closes. A jump from it (or from the review page) is `nav_jump {from, to}` |
| `finish_clicked` | `{unanswered, flagged}` | Submit pressed on the review page |
| `session_finished` | `{correct, total, totalActiveMs}` | The module is submitted, by you or by the timer (the session record says which) |

### Full tests and section runs (Phase 4)

Logged on the test's container record (its `sessionId` is the test id, mode `exam`), by the test store only. They are written at transitions between modules and never while a module clock is running or on its screen.

| Type | Payload | When |
|---|---|---|
| `test_started` | `{kind, includeSeen}` | A full test or section run is built; `kind` is `full`, `rw` or `math` |
| `test_module_started` | `{key, tier}` | The user starts a module (`rw1`, `rw2`, `math1`, `math2`); `tier` is `routing`, `easier` or `harder` |
| `test_module_submitted` | `{key, by}` | A module ended, by the user or the timer |
| `test_routed` | `{section, route, weightedFraction, threshold, configVersion}` | Routing was decided after module 1 |
| `test_break_started` | `{durationMs}` | The break between sections begins |
| `test_break_ended` | `{early, usedMs}` | The break ended, early by the user or by running out |
| `test_finished` | `{kind, paused}` | The last module is in; the estimate is stored |
| `test_abandoned` | `{}` | The test was discarded |

The timer never waits on the logger: the countdown is recomputed from the saved deadline, and logging only appends to memory.

## Delivery

- `log()` only appends to an in-memory queue. It never waits on the network.
- The queue is sent in batches every 2 seconds, and when the page is hidden or closed, using `keepalive` requests (each under 60 KB).
- When the server does not answer, events stay queued and are retried with backoff. When the page is hidden while events are still unsent, they are also copied to `localStorage` and sent on the next load.
- Once the page has started hiding, every further event is copied to `localStorage` and sent at once, because other page-hide handlers (the question screen's "question hidden") run after the logger's own.
- The queue holds at most 5,000 events. Past that the oldest are dropped and counted. `window.__blackbookTelemetry.stats()` in the browser console shows the counter (with queued, sent and failed flushes); a drop is also printed to the console, at most once a second.
- This is separate from saving answers. Answer saves stay strict: a failed save shows a Retry banner and blocks navigation.

## Derived metrics

`src/services/telemetry/metrics.ts` turns a session's events into, per question: active and wall time, time to first interaction, the chain of answers, the number of changes, correct-to-incorrect and incorrect-to-correct swaps, struck choices, flag history, idle time and hidden-tab time. Per session: totals and distributions. Definitions:

- **Wall time:** from `question_shown` to the matching `question_hidden` (or, if the page closed without one, the session's next event), all visits added up.
- **Active time:** wall time minus time with the tab hidden. This is the same definition the attempt's `timeMs` uses.
- **Idle time:** the part of active time inside idle periods (from the last input to `idle_end`).

## Measured cost (Phase 2c, dev build, Chrome)

- `log()`: about 1.4 microseconds per call (20,000 calls in the browser).
- Serializing one full batch (76 KB) for sending: about 0.07 ms.
- Click on a choice to the next painted frame, with the event logged and the answer saved: median 10.0 ms, worst 11.3 ms over 30 clicks, which is the next animation frame.

## Size

A 20-question drill with changes, flags, an outage and a reload logged 147 events, about 31 KB (1.6 KB per question). At that rate 1,000 questions take about 1.5 MB in the event log, plus index pages.
