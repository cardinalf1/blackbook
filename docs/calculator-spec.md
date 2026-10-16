# Calculator spec (Phase 9)

What the real test's calculator does, what Blackbook builds, and how the Desmos calculator is turned on with each user's own key. Labels: **Verified** (seen in the owner's screenshots of a real practice test, 2026-10-16, or read in a source below), **Assumed** (Blackbook's choice or untested), **Unverified** (could not be checked), **Not seen**.

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

## First decision (Phase 9): not turned on for a shared app

The terms do not clearly allow Blackbook's use. Blackbook is free, but it is an application handed to classmates who use it on their own computers, and the terms count "any use of the API in an Application that is accessed by End Users in production" as commercial, whatever the price. One key shared in the package is ruled out by section 5c. Each user requesting their own key for personal use might fit "personal, non-commercial use", but the terms do not say so plainly. As the Phase 9 prompt asks, the embed step stops here.

What is built instead:

- The calculator **panel** (drag, corner resize, close, the Graphing/Scientific switch, its place, size and mode kept inside a module and reset in the next) and its **telemetry** (opened, closed, mode switched, open time per question; never what is typed).
- A clean extension point: `CalculatorEngine` in `src/types/testRoom.ts`, `mount(element, mode, savedState)` returning `getState`, `resize` and `destroy`. With no engine, the panel says so in plain words and points here. If an engine fails to load (offline, blocked), the panel says that and the test carries on.
- The engine never receives question content: only the mode and its own saved state.

## Decision (Phase 9 follow-up, 2026-10-16): on, with each user's own key

The owner accepts the free Trial Tier terms for personal use. The app is shared with two friends, and **each uses their own key**. Nobody's key is shipped, shared or committed. Without a key, nothing changes from Phase 9: the panel says no calculator is set up and where to add a key.

Phase 9's first decision ("not turned on") stands for any shared or bundled key.

## How the key is used (findings, 2026-10-16)

| Item | Label | Detail |
|---|---|---|
| The key goes in the script URL: `https://www.desmos.com/api/v1.11/calculator.js?apiKey=KEY` | Verified | API docs v1.11 ("you must supply an API key as a URL parameter") |
| `v1.11` redirects to the current patch release (`/api/v1.11.4/calculator.js`) | Verified | A request without following redirects returned 302 |
| Desmos checks the key when serving the script: an unknown key gets **403 "Unrecognized API key"**, a missing key gets 403 "Missing or malformed required url parameter: apiKey" | Verified | Requests made from this computer with a made-up key and with none |
| A recognized key gets 200 | **Assumed** | No real key was available to try. Settings > Test treats 200 as recognized |
| Whether a key is limited to certain websites (origins or referrers), and whether `localhost` is accepted | **Unverified** | The docs do not mention it, and desmos.com/my-api needs a login. Settings > Test runs from the local program without a page origin, so it cannot detect an origin limit. If the panel says the calculator could not load while Test passes, an origin limit is the likely cause |
| Scientific (and four-function) "must be separately enabled per API key", and calling a constructor that is not enabled "is an error" | Verified | API docs |
| What the Scientific mode does with a key that has it disabled | **Assumed** | The panel shows "could not load" for that mode, and Graphing still works |
| Desmos needs `eval` and blob workers (allowed in the frame's CSP) | **Assumed** | Not checkable without a key; the CSP allows `'unsafe-eval'`, `blob:` and `*.desmos.com` only |

## How it is built

- **Key storage.** Settings > Desmos calculator: Save key, Test, Remove key. The key goes to the local program and is written to `secrets/desmos-key` in the user-data folder (under the git-ignored `data/app` in dev). It is never in the database, so no export or backup can hold it, and it is never sent back: the app only learns `hasKey`. Test and error messages never contain it (`server/calculator.ts`, tests in `server/calculator.test.ts`).
- **Loading.** With a key, the calculator panel loads `GET /api/calculator/frame?mode=graphing|scientific` from the local program into an iframe with `sandbox="allow-scripts"` (no `allow-same-origin`).
  - That page loads the official script with the key and creates a `GraphingCalculator` (keypad, expressions, settings, zoom buttons, window -10 to 10) or a `ScientificCalculator`.
  - The page is `no-store` and has its own Content-Security-Policy: Desmos hosts only, inline code by nonce, framed only by the app.
  - Desmos's script runs in an opaque origin, so it never has access to the app's origin, its access token or its data. The app's own code never handles the key.
- **State.** The frame sends the calculator's state after each change. The panel keeps it in memory per mode, restores it when the panel or mode comes back, keeps it across questions in a module, and drops it at the next module. It is never saved with the session and never logged.
- **Failure.** No key: the "no calculator is set up" message pointing to Settings. Script blocked, offline, unknown key, or nothing within 15 seconds: "The calculator could not load (offline or blocked). Everything else keeps working." The test never waits on the calculator.
- **Telemetry** is unchanged: opened, closed, mode switched, open time per question. Never expressions or state.
- **Branding.** Desmos's own branding inside the calculator is left as it is (terms 5b(iii)).
- **Leak guard.** `src/services/secrets.test.ts` fails if a key-shaped string (32 hex characters, or `gsk_` and a long token) appears in any committed file, any handoff file or a user-data export.

## Assumed

- The calculator keeps its expressions, place, size and mode across questions inside one module and starts fresh in the next module.
- Default place and size: left side below the header, 380 by 540 pixels (`CALCULATOR_DEFAULT_RECT`).
- The load timeout of 15 seconds (`DESMOS_LOAD_TIMEOUT_MS`).
