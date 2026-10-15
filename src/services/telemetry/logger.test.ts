import { describe, expect, it } from 'vitest';
import type { EventRecord } from '../../types/session';
import { createEventLogger, type LoggerDeps, type QueuePersistence } from './logger';

function harness(over: Partial<LoggerDeps> = {}) {
  const stored: EventRecord[] = [];
  const calls: { n: number; keepalive: boolean }[] = [];
  let up = true;
  const timers: (() => void)[] = [];
  let id = 0;
  const saved: { events: EventRecord[] | null } = { events: null };
  const persistence: QueuePersistence = {
    load: () => saved.events ?? [],
    save: (e) => {
      saved.events = [...e];
    },
    clear: () => {
      saved.events = null;
    },
  };
  const log = createEventLogger({
    store: {
      appendEvents: async (events, opts) => {
        calls.push({ n: events.length, keepalive: opts?.keepalive === true });
        if (!up) throw new Error('down');
        for (const e of events) if (!stored.some((s) => s.id === e.id)) stored.push(e);
      },
    },
    persistence,
    newId: () => `e${id++}`,
    pageId: 'p1',
    now: () => 1000 + id,
    mono: () => id,
    setTimer: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimer: () => undefined,
    ...over,
  });
  /** Fires the timers pending now (not ones they schedule), then lets the sends settle. */
  const runTimers = async () => {
    const due = timers.splice(0);
    for (const fn of due) fn();
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  return { log, stored, calls, timers, runTimers, saved, persistence, setUp: (v: boolean) => (up = v) };
}

const ctx = { sessionId: 's1', mode: 'drill' as const, questionId: 'q1' };

describe('event logger', () => {
  it('log() only queues; nothing is sent until the timer flushes', async () => {
    const h = harness();
    h.log.log('flag_set', ctx, {});
    h.log.log('choice_selected', ctx, { choice: 'A' });
    expect(h.calls).toHaveLength(0);
    expect(h.log.stats().queued).toBe(2);
    await h.runTimers();
    expect(h.stored.map((e) => e.type)).toEqual(['flag_set', 'choice_selected']);
    expect(h.stored.map((e) => e.seq)).toEqual([0, 1]);
    expect(h.log.stats()).toMatchObject({ queued: 0, sent: 2, dropped: 0 });
  });

  it('keeps events through an outage and delivers them once the server is back, without duplicates', async () => {
    const h = harness();
    h.setUp(false);
    for (let i = 0; i < 5; i++) h.log.log('nav_next', ctx, { from: i });
    await h.log.flush();
    expect(h.log.stats()).toMatchObject({ queued: 5, failedFlushes: 1 });
    // The failed flush scheduled a retry; it fails again while down.
    await h.runTimers();
    h.setUp(true);
    h.log.log('nav_next', ctx, { from: 5 });
    await h.log.flush();
    expect(h.stored.map((e) => (e.payload as { from: number }).from)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(h.log.stats()).toMatchObject({ queued: 0, dropped: 0 });
  });

  it('bounds the queue, dropping the oldest and counting them', async () => {
    const drops: number[] = [];
    const h = harness({ maxQueue: 3, onDropped: (n) => drops.push(n) });
    h.setUp(false);
    for (let i = 0; i < 5; i++) h.log.log('nav_next', ctx, { from: i });
    expect(h.log.stats()).toMatchObject({ queued: 3, dropped: 2 });
    expect(drops).toEqual([1, 2]);
    h.setUp(true);
    await h.log.flush();
    expect(h.stored.map((e) => (e.payload as { from: number }).from)).toEqual([2, 3, 4]);
  });

  it('splits sends into batches under the byte limit', async () => {
    const h = harness({ maxBatchBytes: 700 });
    for (let i = 0; i < 10; i++) h.log.log('spr_changed', ctx, { value: String(i) });
    await h.log.flush();
    expect(h.stored).toHaveLength(10);
    expect(h.calls.length).toBeGreaterThan(1);
    expect(h.calls.every((c) => c.n >= 1)).toBe(true);
  });

  it('on hide, keeps unsent events locally and sends one keepalive batch', async () => {
    const h = harness();
    h.log.log('tab_hidden', ctx, {});
    h.log.log('question_hidden', ctx, { index: 0, visitActiveMs: 1200, reason: 'unload' });
    h.log.flushOnHide();
    expect(h.calls).toEqual([{ n: 2, keepalive: true }]);
    expect(h.saved.events).toHaveLength(2);
    await Promise.resolve();
    await Promise.resolve();
    expect(h.saved.events).toBeNull(); // sent, so the local copy is cleared
    expect(h.stored).toHaveLength(2);
  });

  it('a reload during an outage loses nothing: the next page sends what the last one kept', async () => {
    const first = harness();
    first.setUp(false);
    first.log.log('choice_selected', ctx, { choice: 'B' });
    first.log.log('question_hidden', ctx, { index: 0, visitActiveMs: 900, reason: 'unload' });
    first.log.flushOnHide();
    await Promise.resolve();
    expect(first.saved.events).toHaveLength(2);

    // New page, same localStorage, server back up.
    const stored: EventRecord[] = [];
    const second = createEventLogger({
      store: {
        appendEvents: async (events) => {
          for (const e of events) if (!stored.some((s) => s.id === e.id)) stored.push(e);
        },
      },
      persistence: first.persistence,
      pageId: 'p2',
      setTimer: () => 0,
      clearTimer: () => undefined,
    });
    second.start();
    await second.flush();
    expect(stored.map((e) => e.type)).toEqual(['choice_selected', 'question_hidden']);
    expect(first.saved.events).toBeNull();
    expect(second.stats().dropped).toBe(0);
  });

  it('log() stays cheap: 10,000 calls take well under a frame each', () => {
    const h = harness({ maxQueue: 20_000, newId: () => crypto.randomUUID() });
    const t0 = performance.now();
    for (let i = 0; i < 10_000; i++) h.log.log('choice_selected', ctx, { choice: 'A' });
    const perCallMs = (performance.now() - t0) / 10_000;
    // A frame is 16 ms. Even on a slow CI machine one call should cost microseconds.
    expect(perCallMs).toBeLessThan(0.1);
  });
});
