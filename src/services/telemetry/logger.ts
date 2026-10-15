// The event logger. `log()` only appends to an in-memory queue, so it can never block or slow the
// UI; batches go to the local program every couple of seconds and when the page is hidden.
// Unsent events survive a brief outage (retry with backoff) and a reload (copied to a local
// queue when the page hides). The queue is bounded; overflow drops the oldest and counts them.
// Answer saves do not go through here: they stay strict and visible (see the drill store).

import type { TelemetryStore } from '../storage/attemptTypes';
import type { EventPayloads, EventRecord, EventType, SessionMode } from '../../types/session';

export interface EventContext {
  sessionId: string;
  mode: SessionMode;
  questionId?: string | null;
}

/** Where unsent events wait across a reload. localStorage in the app, a plain object in tests. */
export interface QueuePersistence {
  load(): EventRecord[];
  save(events: readonly EventRecord[]): void;
  clear(): void;
}

export interface LoggerStats {
  queued: number;
  sent: number;
  dropped: number;
  failedFlushes: number;
  lastError: string | null;
}

export interface EventLogger {
  log<T extends EventType>(type: T, ctx: EventContext, payload: EventPayloads[T]): void;
  /** Sends everything queued, in batches. Resolves when the queue is empty or a send failed. */
  flush(): Promise<void>;
  /** For pagehide and a hidden tab: keeps unsent events locally and sends one keepalive batch. */
  flushOnHide(): void;
  /** Loads events left from an earlier page and begins flushing. */
  start(): void;
  stop(): void;
  stats(): LoggerStats;
}

export interface LoggerDeps {
  store: Pick<TelemetryStore, 'appendEvents'>;
  persistence?: QueuePersistence | null;
  now?: () => number;
  mono?: () => number;
  newId?: () => string;
  pageId?: string;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  flushEveryMs?: number;
  maxBackoffMs?: number;
  maxQueue?: number;
  /** keepalive requests are limited to 64 KB in flight per page, so batches stay under this. */
  maxBatchBytes?: number;
  onDropped?: (dropped: number) => void;
}

export const DEFAULT_MAX_QUEUE = 5000;
export const DEFAULT_FLUSH_MS = 2000;

export function createEventLogger(deps: LoggerDeps): EventLogger {
  const now = deps.now ?? Date.now;
  const mono = deps.mono ?? (() => performance.now());
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const pageId = deps.pageId ?? newId();
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const flushEveryMs = deps.flushEveryMs ?? DEFAULT_FLUSH_MS;
  const maxBackoffMs = deps.maxBackoffMs ?? 30_000;
  const maxQueue = deps.maxQueue ?? DEFAULT_MAX_QUEUE;
  const maxBatchBytes = deps.maxBatchBytes ?? 60_000;

  let queue: EventRecord[] = [];
  let seq = 0;
  let timer: unknown = null;
  let inFlight: Promise<void> | null = null;
  let backoffMs = flushEveryMs;
  let persisted = false;
  let stopped = false;
  const st: LoggerStats = { queued: 0, sent: 0, dropped: 0, failedFlushes: 0, lastError: null };

  const schedule = (ms: number) => {
    if (timer !== null || stopped) return;
    timer = setTimer(() => {
      timer = null;
      void flush();
    }, ms);
  };

  /** Older events (from an earlier page) go to the head, new ones to the tail. */
  const enqueue = (events: readonly EventRecord[], atHead = false) => {
    if (atHead) queue.unshift(...events);
    else queue.push(...events);
    if (queue.length > maxQueue) {
      const over = queue.length - maxQueue;
      queue.splice(0, over);
      st.dropped += over;
      deps.onDropped?.(st.dropped);
    }
  };

  /** Takes events from the head of the queue up to the byte limit (always at least one). */
  const nextBatch = (): EventRecord[] => {
    const batch: EventRecord[] = [];
    let bytes = 20;
    for (const e of queue) {
      const size = JSON.stringify(e).length + 1;
      if (batch.length > 0 && bytes + size > maxBatchBytes) break;
      batch.push(e);
      bytes += size;
    }
    return batch;
  };

  const markSent = (batch: readonly EventRecord[]) => {
    const ids = new Set(batch.map((e) => e.id));
    queue = queue.filter((e) => !ids.has(e.id));
    st.sent += batch.length;
    if (persisted) {
      if (queue.length === 0) {
        deps.persistence?.clear();
        persisted = false;
      } else deps.persistence?.save(queue);
    }
  };

  const flush = (): Promise<void> => {
    if (inFlight) return inFlight;
    if (queue.length === 0) return Promise.resolve();
    inFlight = (async () => {
      try {
        while (queue.length > 0 && !stopped) {
          const batch = nextBatch();
          await deps.store.appendEvents(batch);
          markSent(batch);
          backoffMs = flushEveryMs;
          st.lastError = null;
        }
      } catch (e) {
        st.failedFlushes++;
        st.lastError = e instanceof Error ? e.message : String(e);
        backoffMs = Math.min(maxBackoffMs, backoffMs * 2);
        schedule(backoffMs);
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };

  return {
    log(type, ctx, payload) {
      if (stopped) return;
      enqueue([
        {
          id: newId(),
          sessionId: ctx.sessionId,
          mode: ctx.mode,
          questionId: ctx.questionId ?? null,
          type,
          ts: now(),
          monoMs: Math.round(mono() * 10) / 10,
          pageId,
          seq: seq++,
          payload,
        },
      ]);
      schedule(flushEveryMs);
    },

    flush,

    flushOnHide() {
      if (queue.length === 0) return;
      try {
        deps.persistence?.save(queue);
        persisted = deps.persistence != null;
      } catch {
        // storage full or blocked: the keepalive send below is the remaining chance
      }
      const batch = nextBatch();
      // Not awaited: the page may be going away. A resend after reload is deduplicated by id.
      deps.store.appendEvents(batch, { keepalive: true }).then(
        () => markSent(batch),
        () => undefined,
      );
    },

    start() {
      stopped = false;
      const left = deps.persistence?.load() ?? [];
      if (left.length > 0) {
        const have = new Set(queue.map((e) => e.id));
        enqueue(left.filter((e) => !have.has(e.id)), true);
        persisted = true;
        void flush();
      }
    },

    stop() {
      stopped = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },

    stats() {
      return { ...st, queued: queue.length };
    },
  };
}
