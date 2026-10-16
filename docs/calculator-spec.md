# Calculator spec (Phase 9)

What the real test's calculator does, what Blackbook builds, and why the embedded graphing calculator is **not** turned on. Labels: **Verified** (seen in the owner's screenshots of a real practice test, 2026-10-16, or read in a source below), **Assumed** (Blackbook's choice), **Not seen**.

## Sources (read 2026-10-16)

1. Desmos API v1.11 documentation. <https://www.desmos.com/api/v1.11/docs/index.html>
2. Desmos API Terms of Service, "Version 1.0, Updated: July 11, 2025". The live page (<https://www.desmos.com/api-terms>) renders with script only; the same text is published in Desmos's policies repository: <https://github.com/desmosinc/policies/blob/main/api-terms.md>
3. The owner's screenshots in `handoff/screens/bluebook/` (local only, never committed).

## What the real test shows (Verified from the screenshots)

- A floating panel with a drag handle, a close control and a resize handle in the lower right corner.
- Two modes switched at the top: Graphing and Scientific. Graphing opens first.
- Graphing: an expression list with add, keyboard, undo, redo, settings and collapse controls; zoom in, zoom out and a graph-settings control on the graph. The default window shows about -10 to 10 on the x axis.
- On Math multiple-choice questions the panel sits over the empty left side; on typed-answer questions it floats over the question column.
- **Not seen:** Scientific mode on screen, what happens to expressions between questions, the panel's limits when dragged.

## What the Desmos API offers (Verified, source 1)

- **A key is required:** "In order to include the Desmos API in your page, you must supply an API key as a URL parameter." Keys come from desmos.com/my-api. The four-function and scientific calculators "must be separately enabled per API key".
- Script: `https://www.desmos.com/api/v1.11/calculator.js?apiKey=...` (loaded from Desmos's servers at run time).
- `GraphingCalculator(element, options)` with options for the expression list, keypad, settings menu, zoom buttons and graph paper; `setMathBounds` for the window; `getState` and `setState` to save and restore; `observeEvent('change')`. `ScientificCalculator` and `FourFunctionCalculator` have a smaller option set and the same state methods.

## What the terms allow (Verified, source 2)

- Two tiers: a free "Trial Tier" and a paid "Commercial Tier".
- Trial Tier, section 2a: "Your use must be solely for (a) personal, non-commercial use or (b) a 90 day trial for internal testing to evaluate in preparation for commercial use. Commercial use includes any use of the API in an Application that is accessed by End Users in production, or any internal use of the API for a business purpose."
- Section 3a: before any use outside the Trial Tier limits, upgrade to a paid plan or sign a Commercial Addendum through partnerships@desmos.com.
- Section 5c: "Your API Key is intended to be used by you and to identify your Application. You will keep your API Key confidential and make reasonable efforts to prevent and discourage others from using your API Key."
- Section 5b(iii): the Desmos branding may not be removed, altered or obscured.

## Decision: not turned on

The terms do not clearly allow Blackbook's use. Blackbook is free, but it is an application handed to classmates who use it on their own computers, and the terms count "any use of the API in an Application that is accessed by End Users in production" as commercial, whatever the price. One key shared in the package is ruled out by section 5c. Each user requesting their own key for personal use might fit "personal, non-commercial use", but the terms do not say so plainly. As the Phase 9 prompt asks, the embed step stops here.

What is built instead:

- The calculator **panel** (drag, corner resize, close, the Graphing/Scientific switch, its place, size and mode kept inside a module and reset in the next) and its **telemetry** (opened, closed, mode switched, open time per question; never what is typed).
- A clean extension point: `CalculatorEngine` in `src/types/testRoom.ts`, `mount(element, mode, savedState)` returning `getState`, `resize` and `destroy`. With no engine, the panel says so in plain words and points here. If an engine fails to load (offline, blocked), the panel says that and the test carries on.
- The engine never receives question content: only the mode and its own saved state.

## To turn it on later (owner's decision)

1. Ask Desmos (partnerships@desmos.com) whether a free study app shared with a few classmates, each user entering their own key, is allowed under the Trial Tier, or get a written OK. Record the answer here.
2. If allowed: write `src/services/calculator/desmos.ts` implementing `CalculatorEngine` (load the script with the user's key, `GraphingCalculator` with `setMathBounds({ left: -10, right: 10, bottom: -10, top: 10 })` for graphing, `ScientificCalculator` for scientific, `getState`/`setState` for the saved state). Keep the key in Settings like the Groq key, stored on the local server, never in the repo.
3. Load it inside a sandboxed iframe (`sandbox="allow-scripts"`, no `allow-same-origin`) so a remote script never runs with access to the app's origin and its per-launch token; the local server's Content-Security-Policy must allow the Desmos origin for that frame only.
4. Keep the Desmos branding visible (terms 5b(iii)).

## Assumed

- The calculator keeps its expressions, place, size and mode across questions inside one module and starts fresh in the next module.
- Default place and size: left side below the header, 380 by 540 pixels (`CALCULATOR_DEFAULT_RECT`).
