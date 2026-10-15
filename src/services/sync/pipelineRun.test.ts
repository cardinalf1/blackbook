import { describe, expect, it } from 'vitest';
import * as fx from '../__fixtures__/synthetic';
import { LIMITS, type Limits } from './limits';
import { DownloadStopped, runPipeline, type CachedDetail, type DetailCache, type PipelineDeps, type PipelineEvent } from './pipeline';

// A fake source built from synthetic fixtures only (AGENTS.md rule 1). No network.

const template = (fx.rawListRows as Record<string, unknown>[])[0] as Record<string, unknown>;

function row(n: number, section: 'rw' | 'math', updateDate = 1700000000000): Record<string, unknown> {
  const hex = n.toString(16).padStart(8, '0');
  return {
    ...template,
    questionId: hex,
    external_id: `e${hex.slice(1)}-0000-0000-0000-000000000000`,
    uId: `u${hex.slice(1)}-0000-0000-0000-000000000000`,
    pPcc: section === 'math' ? 'SAT#H' : 'SAT#INI',
    primary_class_cd: section === 'math' ? 'H' : 'INI',
    primary_class_cd_desc: section === 'math' ? 'Algebra' : 'Information and Ideas',
    skill_cd: section === 'math' ? 'H.A.' : 'CID',
    skill_desc: section === 'math' ? 'Linear equations in one variable' : 'Central Ideas and Details',
    updateDate,
  };
}

type Reply = Response | 'hang' | 'network';

interface SourceOpts {
  rw?: number;
  math?: number;
  live?: (questionId: string) => boolean;
  detail?: (id: string, call: number) => Reply;
  lookup?: () => unknown;
  updateDate?: number;
}

function json(v: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function source(o: SourceOpts = {}) {
  const rw = Array.from({ length: o.rw ?? 3 }, (_, i) => row(i + 1, 'rw', o.updateDate));
  const math = Array.from({ length: o.math ?? 3 }, (_, i) => row(100 + i, 'math', o.updateDate));
  const live = o.live ?? (() => false);
  // Like the real lookup, the live set lists detail ids (external_id), not the short questionId.
  const ids = (rows: Record<string, unknown>[]) => rows.filter((r) => live(r.questionId as string)).map((r) => r.external_id as string);
  const calls: string[] = [];
  let detailCalls = 0;
  const fetch: typeof globalThis.fetch = (input, init) => {
    const url = String(input);
    if (url.endsWith('/lookup')) {
      calls.push('lookup');
      return Promise.resolve(json(o.lookup ? o.lookup() : { readingLiveItems: ids(rw), mathLiveItems: ids(math) }));
    }
    const body = JSON.parse(String(init?.body)) as { test?: number; external_id?: string };
    if (url.endsWith('/get-questions')) {
      calls.push(`list:${body.test}`);
      return Promise.resolve(json(body.test === 1 ? rw : math));
    }
    const id = body.external_id as string;
    calls.push(id);
    const r = o.detail ? o.detail(id, ++detailCalls) : json(fx.rawDigitalMcq);
    if (r === 'network') return Promise.reject(new TypeError('fetch failed'));
    if (r === 'hang') {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    }
    return Promise.resolve(r);
  };
  return { fetch, calls, rw, math };
}

class MapCache implements DetailCache {
  map = new Map<string, CachedDetail>();
  async get(id: string) {
    return this.map.get(id) ?? null;
  }
  async put(id: string, e: CachedDetail) {
    this.map.set(id, e);
  }
}

const fast: Limits = { ...LIMITS, minGapMs: 0, baseDelayMs: 1, maxDelayMs: 5, stallMs: 60_000 };

function deps(fetch: typeof globalThis.fetch, over: Partial<PipelineDeps> = {}): PipelineDeps & { events: PipelineEvent[]; sleeps: number[] } {
  const events: PipelineEvent[] = [];
  const sleeps: number[] = [];
  return {
    fetch,
    cache: new MapCache(),
    window: window as unknown as PipelineDeps['window'],
    limits: fast,
    onEvent: (e) => events.push(e),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    yieldNow: async () => undefined,
    ...over,
    events,
    sleeps,
  };
}

const all = { sections: ['rw', 'math'] as ('rw' | 'math')[], liveOnly: false };

describe('runPipeline', () => {
  it('downloads, normalizes and reports every question in scope', async () => {
    const src = source();
    const d = deps(src.fetch);
    const { bank, report } = await runPipeline(all, d);
    expect(bank.questions).toHaveLength(6);
    expect(report.bySection).toEqual({ rw: 3, math: 3 });
    expect(report.unexpectedSkipReasons).toEqual([]);
    expect(JSON.stringify(bank)).not.toContain('<math');
    expect(d.events.find((e) => e.type === 'plan')).toMatchObject({ questions: 6, cached: 0, toFetch: 6 });
  });

  it('fetches live-set questions first and can limit to the live set and to one section', async () => {
    const liveIds = new Set(['00000003', '00000065']);
    const src = source({ live: (id) => liveIds.has(id) });
    await runPipeline(all, deps(src.fetch));
    const details = src.calls.filter((c) => c.startsWith('e'));
    expect(details.slice(0, 2).sort()).toEqual(['e0000003-0000-0000-0000-000000000000', 'e0000065-0000-0000-0000-000000000000']);

    const src2 = source({ live: (id) => liveIds.has(id) });
    const d2 = deps(src2.fetch);
    const r = await runPipeline({ sections: ['math'], liveOnly: true }, d2);
    expect(r.bank.questions.map((q) => q.displayId)).toEqual(['00000065']);
    expect(r.bank.questions[0]?.active).toBe(true);
    expect(d2.events.find((e) => e.type === 'plan')).toMatchObject({ questions: 1, live: 1 });
    expect(src2.calls).not.toContain('list:1');
  });

  it('resumes from the cache and refetches only changed questions', async () => {
    const cache = new MapCache();
    await runPipeline(all, deps(source().fetch, { cache }));
    const again = source();
    await runPipeline(all, deps(again.fetch, { cache }));
    expect(again.calls.filter((c) => c.startsWith('e'))).toEqual([]);

    const changed = source({ updateDate: 1800000000000 });
    await runPipeline(all, deps(changed.fetch, { cache }));
    expect(changed.calls.filter((c) => c.startsWith('e'))).toHaveLength(6);
  });

  it('backs off on 429, honours Retry-After, and continues', async () => {
    const src = source({ detail: (_id, n) => (n === 1 ? json({}, 429, { 'Retry-After': '3' }) : json(fx.rawDigitalMcq)) });
    const d = deps(src.fetch, { limits: { ...fast, maxDelayMs: 30_000 } });
    const { bank } = await runPipeline(all, d);
    expect(bank.questions).toHaveLength(6);
    expect(d.sleeps).toContain(3000);
    expect(d.events.some((e) => e.type === 'retry')).toBe(true);
  });

  it('stops the whole run after repeated 403 and does not retry on its own', async () => {
    const src = source({ rw: 10, math: 10, detail: () => json({}, 403) });
    const run = runPipeline(all, deps(src.fetch));
    await expect(run).rejects.toMatchObject({ reason: 'blocked' });
    expect(src.calls.filter((c) => c.startsWith('e')).length).toBeLessThanOrEqual(LIMITS.blockedStopAfter + 1);
  });

  it('stops after repeated 429 even though 429 alone is retried', async () => {
    const src = source({ detail: () => json({}, 429) });
    await expect(runPipeline(all, deps(src.fetch))).rejects.toMatchObject({ reason: 'blocked' });
  });

  it('stops as offline after repeated network failures', async () => {
    const src = source({ detail: () => 'network' });
    const err = await runPipeline(all, deps(src.fetch)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DownloadStopped);
    expect(err).toMatchObject({ reason: 'offline' });
  });

  it('detects a stall, names the last request, and stops', async () => {
    const src = source({ detail: () => 'hang' });
    const d = deps(src.fetch, { limits: { ...fast, stallMs: 60 } });
    const err = (await runPipeline(all, d).catch((e: unknown) => e)) as DownloadStopped;
    expect(err.reason).toBe('stalled');
    expect(err.lastRequest?.questionId).toMatch(/^e/);
    expect(err.message).toContain(err.lastRequest?.questionId ?? 'x');
  });

  it('does not call a slow read of a full local cache a stall', async () => {
    const src = source({ rw: 4, math: 4 });
    const cache = new MapCache();
    await runPipeline(all, deps(src.fetch, { cache }));
    // Each cached read takes 25 ms, 8 reads take 200 ms in total: well past a 60 ms stall limit.
    const slow: DetailCache = {
      get: async (id) => {
        await new Promise((r) => setTimeout(r, 25));
        return cache.get(id);
      },
      put: (id, v) => cache.put(id, v),
    };
    const { bank } = await runPipeline(all, deps(src.fetch, { cache: slow, limits: { ...fast, stallMs: 60 } }));
    expect(bank.questions).toHaveLength(8);
  });

  it('can be cancelled mid-run, keeping what was already cached', async () => {
    const ctl = new AbortController();
    const cache = new MapCache();
    const src = source({
      rw: 10,
      math: 10,
      detail: (_id, n) => {
        if (n === 4) ctl.abort();
        return json(fx.rawDigitalMcq);
      },
    });
    const err = await runPipeline(all, deps(src.fetch, { cache, signal: ctl.signal })).catch((e: unknown) => e);
    expect(err).toMatchObject({ reason: 'cancelled' });
    expect(cache.map.size).toBeGreaterThan(0);
    expect(cache.map.size).toBeLessThan(20);
  });

  it('rejects changed shapes instead of guessing', async () => {
    await expect(runPipeline(all, deps(source({ lookup: () => ({ nope: 1 }) }).fetch))).rejects.toMatchObject({ reason: 'shape' });

    const bad = source();
    const badList: typeof fetch = (input, init) =>
      String(input).endsWith('/get-questions') ? Promise.resolve(json([{ questionId: 5 }])) : bad.fetch(input, init);
    await expect(runPipeline(all, deps(badList))).rejects.toMatchObject({ reason: 'shape' });
  });

  it('skips a malformed detail and reports it as unexpected', async () => {
    const src = source({ detail: (_id, n) => (n === 2 ? json({ type: 'mcq' }) : json(fx.rawDigitalMcq)) });
    const { bank, report } = await runPipeline(all, deps(src.fetch));
    expect(bank.questions).toHaveLength(5);
    expect(bank.skipped).toHaveLength(1);
    expect(report.unexpectedSkipReasons).toEqual(['detail-shape']);
  });

  it('records fetch failures and stops after too many in a row', async () => {
    const one = source({ detail: (_id, n) => (n === 1 ? json({}, 404) : json(fx.rawDigitalMcq)) });
    const r = await runPipeline(all, deps(one.fetch));
    expect(r.report.fetchFailures).toBe(1);
    expect(r.bank.skipped[0]?.reason).toBe('http 404');

    const many = source({ rw: 20, math: 20, detail: () => json({}, 404) });
    await expect(runPipeline(all, deps(many.fetch))).rejects.toMatchObject({ reason: 'failures' });
  });
});
