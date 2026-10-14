// Polite HTTP for the sync: JSON POST/GET with retries, exponential backoff with jitter,
// Retry-After support, and a small worker pool with a minimum gap between requests.
// Defaults come from limits.ts. Everything is cancellable through an AbortSignal.

import { LIMITS } from './limits';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
  }
}

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
  fetch: typeof fetch;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  random: () => number;
  onRetry?: (info: { url: string; attempt: number; delayMs: number; error: string }) => void;
  /** Called after every attempt: the HTTP status, or null when no response arrived. */
  onAttempt?: (info: { url: string; status: number | null; error?: string }) => void;
}

export function abortError(signal: AbortSignal): Error {
  const r: unknown = signal.reason;
  return r instanceof Error ? r : new DOMException('Aborted', 'AbortError');
}

/** Resolves after `ms`, or rejects as soon as `signal` aborts. */
export const defaultSleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal as AbortSignal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export const DEFAULT_RETRY: RetryOptions = {
  attempts: LIMITS.attempts,
  baseDelayMs: LIMITS.baseDelayMs,
  maxDelayMs: LIMITS.maxDelayMs,
  timeoutMs: LIMITS.requestTimeoutMs,
  fetch: (input, init) => fetch(input, init),
  sleep: defaultSleep,
  random: Math.random,
};

function retryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/** Delay before retry `attempt` (1-based): base * 2^(attempt-1), jittered to 50-100%, capped. */
export function backoffDelay(attempt: number, opts: Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs' | 'random'>): number {
  const exp = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1));
  return Math.round(exp * (0.5 + opts.random() * 0.5));
}

/** Parses Retry-After (seconds or HTTP date) into ms, or null. */
export function retryAfterMs(header: string | null, now: number = Date.now()): number | null {
  if (header === null) return null;
  const secs = Number(header);
  if (Number.isFinite(secs) && secs >= 0) return secs * 1000;
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}

/**
 * Fetches JSON. Retries network errors, timeouts, 408, 429 and 5xx. Throws HttpError for other
 * statuses immediately, and the last error once attempts run out.
 */
export async function fetchJson(url: string, init: RequestInit, options: Partial<RetryOptions> = {}): Promise<unknown> {
  const opts: RetryOptions = { ...DEFAULT_RETRY, ...options };
  const outer = init.signal ?? undefined;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    if (outer?.aborted) throw abortError(outer);
    let waitMs: number | null = null;
    try {
      const timeout = AbortSignal.timeout(opts.timeoutMs);
      const signal = outer ? AbortSignal.any([outer, timeout]) : timeout;
      const res = await opts.fetch(url, { ...init, signal });
      opts.onAttempt?.({ url, status: res.status });
      if (res.ok) return (await res.json()) as unknown;
      if (!retryable(res.status)) throw new HttpError(res.status, url);
      lastError = new HttpError(res.status, url);
      waitMs = retryAfterMs(res.headers.get('retry-after'));
    } catch (e) {
      if (outer?.aborted) throw abortError(outer);
      if (e instanceof HttpError && !retryable(e.status)) throw e;
      if (!(e instanceof HttpError)) opts.onAttempt?.({ url, status: null, error: e instanceof Error ? e.message : String(e) });
      lastError = e;
    }
    if (attempt === opts.attempts) break;
    const delayMs = Math.min(opts.maxDelayMs, waitMs ?? backoffDelay(attempt, opts));
    opts.onRetry?.({ url, attempt, delayMs, error: lastError instanceof Error ? lastError.message : String(lastError) });
    await opts.sleep(delayMs, outer);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Runs `worker` over `items` with at most `concurrency` in flight and at least `minGapMs` between
 * the starts of consecutive tasks on the same worker. Worker errors are passed to `onError` and
 * never reject the pool. Set `stop()` to true to finish early (in-flight tasks complete).
 */
export async function runPool<T>(
  items: readonly T[],
  opts: {
    concurrency: number;
    minGapMs: number;
    worker: (item: T) => Promise<void>;
    onError: (item: T, error: unknown) => void;
    stop?: () => boolean;
    sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
    signal?: AbortSignal;
    now?: () => number;
  },
): Promise<void> {
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? Date.now;
  let next = 0;
  const lane = async (): Promise<void> => {
    while (next < items.length && !(opts.stop?.() ?? false) && !opts.signal?.aborted) {
      const item = items[next++] as T;
      const started = now();
      try {
        await opts.worker(item);
      } catch (e) {
        opts.onError(item, e);
      }
      if (opts.signal?.aborted) return;
      const elapsed = now() - started;
      if (elapsed < opts.minGapMs && next < items.length) {
        try {
          await sleep(opts.minGapMs - elapsed, opts.signal);
        } catch {
          return; // aborted
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, lane));
}
