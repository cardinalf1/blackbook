// The app-wide event logger, wired to the local program and to localStorage for events that
// could not be sent before the page went away.

import { telemetryStore } from '../storage';
import type { EventRecord } from '../../types/session';
import { createEventLogger, type EventLogger, type QueuePersistence } from './logger';

const QUEUE_KEY = 'blackbook.telemetry.unsent';

const localQueue: QueuePersistence = {
  load() {
    try {
      const raw = window.localStorage.getItem(QUEUE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? (parsed as EventRecord[]) : [];
    } catch {
      return [];
    }
  },
  save(events) {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(events));
  },
  clear() {
    window.localStorage.removeItem(QUEUE_KEY);
  },
};

let lastReport = 0;

export const telemetry: EventLogger = createEventLogger({
  store: telemetryStore,
  persistence: localQueue,
  onDropped: (dropped) => {
    // At most once a second, so a flood of drops does not flood the console as well.
    const t = Date.now();
    if (t - lastReport < 1000) return;
    lastReport = t;
    console.warn(`[blackbook telemetry] dropped events: ${dropped}`);
  },
});

let started = false;

/** Starts flushing and hooks page hide and close. Call once the local program has accepted us. */
export function startTelemetry(): void {
  if (started) return;
  started = true;
  telemetry.start();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') telemetry.flushOnHide();
  });
  window.addEventListener('pagehide', () => telemetry.flushOnHide());
  // For checking from the dev console: window.__blackbookTelemetry.stats()
  (window as unknown as { __blackbookTelemetry: { stats: EventLogger['stats'] } }).__blackbookTelemetry = { stats: () => telemetry.stats() };
  console.info('[blackbook telemetry] started; dropped events: 0. Check with __blackbookTelemetry.stats()');
}
