import { describe, expect, it } from 'vitest';
import { backoffDelay, fetchJson, HttpError, retryAfterMs, runPool } from './http';

function fakeFetch(responses: (Response | Error)[]): { fetch: typeof fetch; calls: () => number } {
  let i = 0;
  return {
    fetch: async () => {
      const r = responses[Math.min(i++, responses.length - 1)];
      if (r instanceof Error) throw r;
      if (!r) throw new Error('no response');
      return r.clone();
    },
    calls: () => i,
  };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('fetchJson', () => {
  const sleeps: number[] = [];
  const base = { sleep: async (ms: number) => void sleeps.push(ms), random: () => 1, baseDelayMs: 100, maxDelayMs: 1000 };

  it('returns parsed JSON on success', async () => {
    const f = fakeFetch([json({ a: 1 })]);
    expect(await fetchJson('u', {}, { ...base, fetch: f.fetch })).toEqual({ a: 1 });
    expect(f.calls()).toBe(1);
  });

  it('retries network errors and 5xx with exponential backoff', async () => {
    sleeps.length = 0;
    const f = fakeFetch([new TypeError('network'), json({}, 503), json({ ok: true })]);
    expect(await fetchJson('u', {}, { ...base, fetch: f.fetch })).toEqual({ ok: true });
    expect(f.calls()).toBe(3);
    expect(sleeps).toEqual([100, 200]);
  });

  it('honors Retry-After on 429', async () => {
    sleeps.length = 0;
    const f = fakeFetch([json({}, 429, { 'retry-after': '0.5' }), json({ ok: 1 })]);
    await fetchJson('u', {}, { ...base, fetch: f.fetch });
    expect(sleeps).toEqual([500]);
  });

  it('does not retry other 4xx', async () => {
    const f = fakeFetch([json({}, 404)]);
    await expect(fetchJson('u', {}, { ...base, fetch: f.fetch })).rejects.toBeInstanceOf(HttpError);
    expect(f.calls()).toBe(1);
  });

  it('gives up after the configured attempts with the last error', async () => {
    const f = fakeFetch([json({}, 500)]);
    await expect(fetchJson('u', {}, { ...base, attempts: 3, fetch: f.fetch })).rejects.toThrow('HTTP 500');
    expect(f.calls()).toBe(3);
  });

  it('retries when the body is not JSON', async () => {
    const f = fakeFetch([new Response('<html>', { status: 200 }), json([1])]);
    expect(await fetchJson('u', {}, { ...base, fetch: f.fetch })).toEqual([1]);
  });
});

describe('backoffDelay and retryAfterMs', () => {
  it('jitters between 50% and 100% and caps', () => {
    const o = { baseDelayMs: 1000, maxDelayMs: 5000 };
    expect(backoffDelay(1, { ...o, random: () => 0 })).toBe(500);
    expect(backoffDelay(3, { ...o, random: () => 1 })).toBe(4000);
    expect(backoffDelay(10, { ...o, random: () => 1 })).toBe(5000);
  });
  it('parses seconds and dates', () => {
    expect(retryAfterMs('2')).toBe(2000);
    expect(retryAfterMs(null)).toBeNull();
    expect(retryAfterMs('Wed, 14 Oct 2026 10:00:10 GMT', Date.parse('Wed, 14 Oct 2026 10:00:00 GMT'))).toBe(10_000);
    expect(retryAfterMs('soon')).toBeNull();
  });
});

describe('runPool', () => {
  it('runs every item with bounded concurrency and isolates errors', async () => {
    let inFlight = 0;
    let peak = 0;
    const done: number[] = [];
    const errors: number[] = [];
    await runPool([1, 2, 3, 4, 5, 6], {
      concurrency: 2,
      minGapMs: 0,
      worker: async (n) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        if (n === 3) throw new Error('boom');
        done.push(n);
      },
      onError: (n) => errors.push(n),
    });
    expect(peak).toBe(2);
    expect(done.sort()).toEqual([1, 2, 4, 5, 6]);
    expect(errors).toEqual([3]);
  });

  it('waits out the minimum gap between tasks', async () => {
    const sleeps: number[] = [];
    let t = 0;
    await runPool([1, 2], {
      concurrency: 1,
      minGapMs: 250,
      worker: async () => void (t += 100),
      onError: () => undefined,
      sleep: async (ms) => void sleeps.push(ms),
      now: () => t,
    });
    expect(sleeps).toEqual([150]);
  });

  it('stops taking new items when asked', async () => {
    const seen: number[] = [];
    await runPool([1, 2, 3], { concurrency: 1, minGapMs: 0, worker: async (n) => void seen.push(n), onError: () => undefined, stop: () => seen.length >= 1 });
    expect(seen).toEqual([1]);
  });
});
