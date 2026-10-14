// Politeness limits for downloading from the source. These are deliberately fixed: the UI cannot
// change them, and changing them here needs the project owner's explicit approval (AGENTS.md).
//
// Why these values (measured 2026-10-14, see docs/api-notes.md): the source's own web app fetches
// one question at a time as a person clicks. Median latency was about 520 ms at both 1 and 2 in
// flight, with no throttling signals, so 2 in flight adds no measurable strain while halving the
// download time. Nothing above 2 was tested and nothing above 2 is allowed.
export const LIMITS = {
  /** Requests in flight at once. */
  maxInFlight: 2,
  /** Minimum time between the starts of two requests on the same worker. */
  minGapMs: 250,
  /** Attempts per request, counting the first one. Retries cover network errors, 408, 429 and 5xx. */
  attempts: 5,
  /** Exponential backoff base and cap, jittered to 50-100%. A Retry-After header wins when present. */
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  /** A single request is abandoned (and retried) after this long. */
  requestTimeoutMs: 20_000,
  /** No request activity for this long, outside a declared backoff wait, stops the run as stalled. */
  stallMs: 30_000,
  /** This many 403 or 429 responses in a row stop the whole run. It does not retry on its own. */
  blockedStopAfter: 3,
  /** This many network failures in a row (no response at all) stop the run as offline. */
  networkStopAfter: 5,
  /** This many questions failing in a row, for any reason, stop the run. */
  failuresStopAfter: 10,
} as const;

export type Limits = { readonly [K in keyof typeof LIMITS]: number };
