// Server tests run under Vitest on Node, where SQLite comes from node:sqlite (same engine as
// bun:sqlite in the app). Synthetic data only.

import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fx from '../src/services/__fixtures__/synthetic';
import { createSanitizer } from '../src/services/normalize/sanitize';
import { LIMITS } from '../src/services/sync/limits';
import type { PipelineDeps } from '../src/services/sync/pipeline';
import type { DownloadProgress } from '../src/types/download';
import { deriveStatus, shownIds } from '../src/services/browse/status';
import { createSession, finish } from '../src/services/session/record';
import type { EventRecord, SessionRecord, StoredAttempt } from '../src/types/session';
import type { Question } from '../src/types/sat';
import { createHandler } from './app';
import { DiskBankStore } from './bankStore';
import { DownloadManager, mergeOutsideScope } from './download';
import { FsDetailCache } from './files';
import { createIdleMonitor } from './idle';
import { SESSION_COOKIE, TOKEN_HEADER } from './security';
import { transaction } from './sql';
import type { SqlDb } from './sql';
import { openSqlite as openRaw } from './sqlNode';
import { MIGRATIONS, migrate, schemaVersion, SqliteUserStore } from './userDb';

let dir: string;
let opened: SqlDb[] = [];
/** Opens a database and remembers it, so Windows can delete the temp folder afterwards. */
function openSqlite(path: string): SqlDb {
  const db = openRaw(path);
  const close = db.close.bind(db);
  let closed = false;
  db.close = () => {
    if (!closed) close();
    closed = true;
  };
  opened.push(db);
  return db;
}
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bb-server-'));
});
afterEach(async () => {
  for (const db of opened) db.close();
  opened = [];
  await rm(dir, { recursive: true, force: true });
});

const q = (id: string, over: Partial<Question> = {}): Question => ({ ...(fx.syntheticQuestions[0] as Question), id, ...over });

const CONFIG = { section: 'math' as const, domainCode: 'all', skillCodes: [], difficulties: [], count: 1, liveOnly: true };
const newSession = (id: string): SessionRecord => createSession(id, 'drill', CONFIG, ['q1'], 1);
function attempt(sessionId: string, questionId: string, over: Partial<StoredAttempt> = {}): StoredAttempt {
  return {
    id: `${sessionId}:${questionId}`, sessionId, questionId, mode: 'drill', status: 'draft', response: 'A', correct: true,
    timeMs: 1200, firstVisitMs: null, changes: 0, confidence: null, at: 1, ...over,
  };
}

describe('SQLite user store', () => {
  it('migrates a new database to the current schema with WAL and foreign keys on', async () => {
    const db = openSqlite(join(dir, 'user.db'));
    new SqliteUserStore(db);
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
    expect(db.get<{ journal_mode: string }>('PRAGMA journal_mode')?.journal_mode).toBe('wal');
    expect(db.get<{ foreign_keys: number }>('PRAGMA foreign_keys')?.foreign_keys).toBe(1);
    db.close();
  });

  it('applies new migrations in order and rolls a failing one back', async () => {
    const db = openSqlite(join(dir, 'm.db'));
    migrate(db, MIGRATIONS);
    const next = [...MIGRATIONS, 'ALTER TABLE flags ADD COLUMN note TEXT;'];
    migrate(db, next);
    expect(schemaVersion(db)).toBe(MIGRATIONS.length + 1);
    expect(() => migrate(db, [...next, 'CREATE TABLE ok (a); CREATE TABLE broken ('])).toThrow();
    expect(schemaVersion(db)).toBe(MIGRATIONS.length + 1);
    expect(db.get('SELECT name FROM sqlite_master WHERE name = ?', 'ok')).toBeUndefined();
    db.close();
  });

  it('refuses a database written by a newer version', async () => {
    const db = openSqlite(join(dir, 'n.db'));
    db.exec('PRAGMA user_version = 99');
    expect(() => migrate(db)).toThrow(/newer version/);
    db.close();
  });

  it('round-trips sessions, attempts, flags and events and survives reopening', async () => {
    const path = join(dir, 'u.db');
    const store = new SqliteUserStore(openSqlite(path));
    await store.saveSession(newSession('s1'), [attempt('s1', 'q1')]);
    await store.saveSession(newSession('s1'), [attempt('s1', 'q1', { correct: false, status: 'final' })]); // same id: updated
    await store.saveSession(newSession('s2'), [attempt('s2', 'q2')]);
    await store.setFlag('q9', true);
    const ev: EventRecord = { id: 'e1', sessionId: 's1', mode: 'drill', questionId: null, type: 'tab_hidden', ts: 1, monoMs: 2.5, pageId: 'p', seq: 0, payload: {} };
    await store.appendEvents([ev]);

    const again = new SqliteUserStore(openSqlite(path));
    expect(await again.listAttempts()).toHaveLength(2);
    expect((await again.listAttempts('s1'))[0]).toMatchObject({ correct: false, status: 'final' });
    expect((await again.listFlags()).map((f) => f.questionId)).toEqual(['q9']);
    expect((await again.listSessions({ status: 'in_progress' })).map((x) => x.id).sort()).toEqual(['s1', 's2']);
    expect(await again.listEvents()).toEqual([ev]);
  });

  it('upgrades Phase 2 data: old sessions and attempts survive with the new shape', async () => {
    const db = openSqlite(join(dir, 'old.db'));
    migrate(db, MIGRATIONS.slice(0, 1));
    const v1 = (id: string, status: string, answered: Record<string, unknown>, index: number) =>
      JSON.stringify({ id, config: CONFIG, queueIds: ['q1', 'q2'], index, startedAt: 100, status, answered, struck: { q2: ['C'] }, currentElapsedMs: 700 });
    const finishedAnswers = {
      q1: { response: 'A', correct: true, timeMs: 3000, at: 200 },
      q2: { response: 'B', correct: false, timeMs: 4000, at: 300 },
    };
    db.run('INSERT INTO sessions VALUES (?, ?, ?, ?)', 'old-done', 'finished', 100, v1('old-done', 'finished', finishedAnswers, 1));
    db.run('INSERT INTO sessions VALUES (?, ?, ?, ?)', 'old-open', 'active', 100, v1('old-open', 'active', { q1: { response: '1/2', correct: true, timeMs: 1000, at: 150 } }, 1));
    db.run('INSERT INTO attempts VALUES (?, ?, ?, ?, ?, ?, ?)', 'old-done:q1', 'q1', 'old-done', 'A', 1, 3000, 200);

    const store = new SqliteUserStore(db);
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
    const done = await store.getSession('old-done');
    expect(done).toMatchObject({ version: 3, source: 'drill', mode: 'drill', status: 'finished', finishedAt: 300, score: { correct: 1, total: 2 }, totalActiveMs: 7000 });
    expect(done?.progress.q2).toMatchObject({ response: 'B', struck: ['C'], activeMs: 4000, firstVisitMs: 4000, visits: 1 });
    const open = await store.getSession('old-open');
    expect(open).toMatchObject({ status: 'in_progress', index: 1, score: null, finishedAt: null });
    expect(open?.progress.q2).toMatchObject({ response: null, activeMs: 700, firstVisitMs: null });
    expect((await store.listAttempts())[0]).toMatchObject({ mode: 'drill', status: 'final', firstVisitMs: 3000, changes: 0, confidence: null });
  });

  it('status from SQL matches the reference derivation on random histories', async () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let round = 0; round < 5; round++) {
      const db = openSqlite(join(dir, `st${round}.db`));
      const store = new SqliteUserStore(db);
      const qs = Array.from({ length: 12 }, (_, i) => `q${i}`);
      const sessions: SessionRecord[] = [];
      for (let k = 0; k < 6; k++) {
        const ids = qs.filter(() => rnd() < 0.5);
        if (ids.length === 0) continue;
        const base = createSession(`s${k}`, 'drill', CONFIG, ids, k);
        const r = rnd();
        const s = r < 0.4 ? finish(base, 0, () => true, 100 + k) : r < 0.6 ? { ...base, status: 'abandoned' as const } : base;
        const list = ids.flatMap((q) => {
          const x = rnd();
          if (x < 0.25) return [];
          return [attempt(`s${k}`, q, { status: x < 0.5 ? 'draft' : 'final', response: x < 0.6 ? '' : 'A', correct: rnd() < 0.5, at: Math.floor(rnd() * 5) })];
        });
        await store.saveSession(s, list);
        sessions.push(s);
      }
      const events = qs.filter(() => rnd() < 0.3).map((q, n) => ({ id: `ev${n}`, sessionId: 's0', mode: 'drill' as const, questionId: q, type: 'question_shown' as const, ts: n, monoMs: n, pageId: 'p', seq: n, payload: { index: 0, visit: 1 } }));
      await store.appendEvents(events);
      for (const q of qs) if (rnd() < 0.15) await store.setFlag(q, true);
      const reference = deriveStatus(await store.listAttempts(), await store.listSessions(), shownIds(await store.listEvents()), await store.listFlags());
      expect(await store.questionStatus()).toEqual(reference);
    }
  });

  it('keeps the event log append-only', async () => {
    const db = openSqlite(join(dir, 'e.db'));
    const store = new SqliteUserStore(db);
    await store.appendEvents([{ id: 'e1', sessionId: 's', mode: 'drill', questionId: null, type: 'tab_hidden', ts: 1, monoMs: 1, pageId: 'p', seq: 0, payload: {} }]);
    expect(() => db.run("UPDATE events SET type = 'tab_visible'")).toThrow(/append-only/);
    await store.clearEvents();
    expect(await store.listEvents()).toEqual([]);
  });

  it('rolls back a transaction that fails part way', async () => {
    const db = openSqlite(join(dir, 't.db'));
    new SqliteUserStore(db);
    expect(() =>
      transaction(db, () => {
        db.run("INSERT INTO flags (question_id, at) VALUES ('a', 1)");
        db.run("INSERT INTO flags (question_id, at) VALUES ('a', 2)"); // primary key clash
      }),
    ).toThrow();
    expect(db.all('SELECT * FROM flags')).toEqual([]);
    db.close();
  });
});

describe('disk bank store', () => {
  const meta = { fetchedAt: 'f', importedAt: 'i', count: 2, skippedCount: 1 };

  it('starts empty, swaps atomically and persists', async () => {
    const path = join(dir, 'bank.json');
    const store = new DiskBankStore(path);
    expect(await store.getMeta()).toBeNull();
    expect(await store.count()).toBe(0);
    await store.replaceAll([q('a'), q('b', { section: 'math' })], meta, undefined, undefined, [{ id: 'x', reason: 'legacy-spr-no-key' }]);
    expect((await readdir(dir)).filter((f) => f.endsWith('.tmp'))).toEqual([]);

    const reopened = new DiskBankStore(path);
    expect(await reopened.count()).toBe(2);
    expect(await reopened.getMeta()).toEqual(meta);
    expect((await reopened.query({ section: 'math' })).map((x) => x.id)).toEqual(['b']);
    expect((await reopened.getSkipped())[0]?.id).toBe('x');
  });

  it('keeps the old bank when the swap is aborted', async () => {
    const store = new DiskBankStore(join(dir, 'bank.json'));
    await store.replaceAll([q('old')], meta);
    const ctl = new AbortController();
    ctl.abort();
    await expect(store.replaceAll([q('new')], meta, undefined, ctl.signal)).rejects.toThrow();
    expect((await new DiskBankStore(join(dir, 'bank.json')).query({})).map((x) => x.id)).toEqual(['old']);
  });
});

// ---- A fake source and an app wired to temp folders ----

const template = (fx.rawListRows as Record<string, unknown>[])[0] as Record<string, unknown>;
function fakeSource(opts: { detail?: (n: number) => Response | 'hang'; count?: number; liveEvery?: number } = {}) {
  const count = opts.count ?? 4;
  const rows = (section: 'rw' | 'math') =>
    Array.from({ length: count }, (_, i) => {
      const n = (section === 'rw' ? 0 : 500) + i + 1;
      const hex = n.toString(16).padStart(8, '0');
      return { ...template, questionId: hex, external_id: `e${hex.slice(1)}-0000-0000-0000-000000000000`, updateDate: 1700000000000 };
    });
  const every = opts.liveEvery ?? 2;
  const liveIds = (rs: Record<string, unknown>[]) => rs.filter((_, i) => i % every === 0).map((r) => r.external_id as string);
  let n = 0;
  const fetch: typeof globalThis.fetch = (input, init) => {
    const url = String(input);
    const ok = (v: unknown) => Promise.resolve(new Response(JSON.stringify(v), { status: 200 }));
    if (url.endsWith('/lookup')) return ok({ readingLiveItems: liveIds(rows('rw')), mathLiveItems: liveIds(rows('math')) });
    const body = JSON.parse(String(init?.body)) as { test?: number };
    if (url.endsWith('/get-questions')) return ok(rows(body.test === 1 ? 'rw' : 'math'));
    const r = opts.detail ? opts.detail(++n) : new Response(JSON.stringify(fx.rawDigitalMcq));
    if (r === 'hang') {
      return new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    }
    return Promise.resolve(r);
  };
  return { fetch };
}

const TOKEN = 'test-token-0123456789';
const HOST = '127.0.0.1:47821';
const UI = 'http://localhost:3000';

async function setup(source = fakeSource()) {
  const bank = new DiskBankStore(join(dir, 'bank.json'));
  const users = new SqliteUserStore(openSqlite(join(dir, 'user.db')));
  const downloads = new DownloadManager({
    bank,
    cache: new FsDetailCache(join(dir, 'raw')),
    window: window as unknown as PipelineDeps['window'],
    fetch: source.fetch,
    dataFolder: dir,
    pipeline: { limits: { ...LIMITS, minGapMs: 0, baseDelayMs: 1, maxDelayMs: 5 }, sleep: async () => undefined, yieldNow: async () => undefined },
  });
  const handler = createHandler({
    security: { token: TOKEN, allowedHosts: new Set([HOST]), allowedOrigins: new Set([UI]) },
    bank,
    users,
    downloads,
    sanitize: createSanitizer(window),
    dataFolder: dir,
    streamHeartbeatMs: 20,
  });
  const call = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
    handler(new Request(`http://${HOST}${path}`, { ...init, headers: { host: HOST, origin: UI, [TOKEN_HEADER]: TOKEN, ...init.headers } }));
  return { bank, users, downloads, handler, call };
}

describe('local API security', () => {
  it('rejects a wrong Host, a foreign Origin and a missing or wrong token', async () => {
    const { handler } = await setup();
    const req = (headers: Record<string, string>) => handler(new Request(`http://${HOST}/api/health`, { headers }));
    expect((await req({ host: HOST, origin: UI, [TOKEN_HEADER]: TOKEN })).status).toBe(200);
    expect((await req({ host: 'evil.example:47821', [TOKEN_HEADER]: TOKEN })).status).toBe(403);
    expect((await req({ host: HOST, origin: 'https://evil.example', [TOKEN_HEADER]: TOKEN })).status).toBe(403);
    expect((await req({ host: HOST, origin: UI })).status).toBe(401);
    expect((await req({ host: HOST, origin: UI, [TOKEN_HEADER]: 'nope' })).status).toBe(401);
  });

  it('exchanges the first-load token for an HttpOnly, SameSite=Strict session cookie', async () => {
    const { handler } = await setup();
    const bad = await handler(new Request(`http://${HOST}/api/session`, { method: 'POST', headers: { host: HOST, origin: UI }, body: JSON.stringify({ token: 'x' }) }));
    expect(bad.status).toBe(401);
    const res = await handler(new Request(`http://${HOST}/api/session`, { method: 'POST', headers: { host: HOST, origin: UI }, body: JSON.stringify({ token: TOKEN }) }));
    expect(res.status).toBe(204);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    const withCookie = await handler(new Request(`http://${HOST}/api/health`, { headers: { host: HOST, origin: UI, cookie: `${SESSION_COOKIE}=${TOKEN}` } }));
    expect(withCookie.status).toBe(200);
    const foreign = await handler(new Request(`http://${HOST}/api/session`, { method: 'POST', headers: { host: HOST, origin: 'https://evil.example' }, body: JSON.stringify({ token: TOKEN }) }));
    expect(foreign.status).toBe(403);
  });
});

describe('local API', () => {
  it('stores sessions with attempts, flags and events, and rejects malformed input', async () => {
    const { call } = await setup();
    const put = (id: string, body: unknown) => call(`/api/sessions/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    expect((await put('s1', { session: newSession('s1'), attempts: [attempt('s1', 'q1')] })).status).toBe(200);
    expect((await put('s2', { session: newSession('s1') })).status).toBe(400); // id mismatch
    expect((await put('s1', { session: { ...newSession('s1'), status: 'active' } })).status).toBe(400);
    expect((await put('s1', { session: newSession('s1'), attempts: [attempt('other', 'q1')] })).status).toBe(400);
    expect((await put('s1', { session: newSession('s1'), attempts: [{ ...attempt('s1', 'q1'), status: 'maybe' }] })).status).toBe(400);
    expect((await call('/api/sessions/s1', { method: 'PUT', body: '{not json' })).status).toBe(400);
    expect(await (await call('/api/attempts?sessionId=s1')).json()).toHaveLength(1);
    expect(await (await call('/api/sessions?status=in_progress&mode=drill')).json()).toMatchObject([{ id: 's1' }]);

    const done = finish(newSession('s1'), 10, () => true, 5);
    expect((await put('s1', { session: done })).status).toBe(200);
    expect((await put('s1', { session: { ...done, totalActiveMs: 99 } })).status).toBe(409);

    await call('/api/flags/q7', { method: 'PUT', body: JSON.stringify({ flagged: true }) });
    expect(await (await call('/api/flags')).json()).toMatchObject([{ questionId: 'q7' }]);

    const ev = { id: 'e1', sessionId: 's1', mode: 'drill', questionId: 'q1', type: 'nav_next', ts: 1, monoMs: 1, pageId: 'p', seq: 0, payload: { from: 0 } };
    const post = (events: unknown[]) => call('/api/events', { method: 'POST', body: JSON.stringify({ events }) });
    expect((await post([ev])).status).toBe(200);
    expect((await post([{ ...ev, type: 'mouse_moved' }])).status).toBe(400);
    expect((await post([{ ...ev, payload: { x: 'y'.repeat(3000) } }])).status).toBe(400);
    expect(await (await call('/api/events?sessionId=s1')).json()).toHaveLength(1);
    expect(await (await call('/api/data/stats')).json()).toMatchObject({ events: 1, sessions: 1, attempts: 1 });
    const exported = await call('/api/data/export');
    expect(exported.headers.get('content-disposition')).toContain('blackbook-data.json');
    expect(await exported.json()).toMatchObject({ app: 'blackbook', sessions: [{ id: 's1' }] });
    expect((await call('/api/events', { method: 'DELETE' })).status).toBe(200);
    expect(await (await call('/api/data/stats')).json()).toMatchObject({ events: 0, attempts: 1 });
  });

  it('imports a bank file atomically and serves it', async () => {
    const { call } = await setup();
    expect(await (await call('/api/bank/meta')).json()).toBeNull();
    const file = JSON.stringify({ schemaVersion: 1, fetchedAt: '2026-10-14T00:00:00.000Z', questions: [q('a'), q('b')], skipped: [] });
    const r = (await (await call('/api/bank/import', { method: 'POST', body: file })).json()) as { ok: boolean; imported: number };
    expect(r).toMatchObject({ ok: true, imported: 2 });
    expect(await (await call('/api/bank/count')).json()).toEqual({ count: 2 });
    expect(await (await call('/api/bank/questions/a')).json()).toMatchObject({ id: 'a' });
    expect((await call('/api/bank/questions/zzz')).status).toBe(404);
    const bad = (await (await call('/api/bank/import', { method: 'POST', body: '{"nope":1}' })).json()) as { ok: boolean };
    expect(bad.ok).toBe(false);
    expect(await (await call('/api/bank/count')).json()).toEqual({ count: 2 });
  });

  it('validates download scope', async () => {
    const { call } = await setup();
    expect((await call('/api/download/start', { method: 'POST', body: JSON.stringify({ sections: [], liveOnly: true }) })).status).toBe(400);
    expect((await call('/api/download/start', { method: 'POST', body: JSON.stringify({ sections: ['art'], liveOnly: true }) })).status).toBe(400);
  });

  it('streams progress snapshots without waiting for the run to end', async () => {
    const { call, downloads } = await setup(fakeSource({ detail: () => 'hang' }));
    const res = await call('/api/download/events');
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first).toMatch(/^data: \{"status":"idle"/);
    downloads.start({ sections: ['rw'], liveOnly: false });
    const next = new TextDecoder().decode((await reader.read()).value);
    expect(next).toContain('"status":"running"');
    downloads.cancel();
    await downloads.settled();
    await reader.cancel();
  });
});

describe('download manager', () => {
  it('downloads, swaps the bank in, and reports skips in plain language', async () => {
    const { downloads, bank } = await setup(fakeSource());
    expect(downloads.start({ sections: ['rw', 'math'], liveOnly: false })).toBe(true);
    expect(downloads.start({ sections: ['rw'], liveOnly: false })).toBe(false); // one at a time
    await downloads.settled();
    const p = downloads.snapshot();
    expect(p.status).toBe('succeeded');
    expect(p.summary).toMatchObject({ questions: 8, bySection: { rw: 4, math: 4 }, live: 4, skipped: [] });
    expect(await bank.count()).toBe(8);
    expect(p.cache.files).toBe(8);
    await downloads.freeCache();
    expect(downloads.snapshot().cache).toEqual({ bytes: 0, files: 0 });
  });

  it('downloads only the live set when asked', async () => {
    const { downloads, bank } = await setup(fakeSource());
    downloads.start({ sections: ['rw', 'math'], liveOnly: true });
    await downloads.settled();
    expect(await bank.count()).toBe(4);
    expect((await bank.query({})).every((x) => x.active)).toBe(true);
  });

  it('cancel and failure both leave the previous bank untouched', async () => {
    const meta = { fetchedAt: 'f', importedAt: 'i', count: 1, skippedCount: 0 };
    const hang = await setup(fakeSource({ detail: () => 'hang' }));
    await hang.bank.replaceAll([q('keep')], meta);
    hang.downloads.start({ sections: ['rw'], liveOnly: false });
    await new Promise((r) => setTimeout(r, 20));
    hang.downloads.cancel();
    await hang.downloads.settled();
    expect(hang.downloads.snapshot().status).toBe('cancelled');
    expect((await hang.bank.query({})).map((x) => x.id)).toEqual(['keep']);

    const blocked = await setup(fakeSource({ count: 10, detail: () => new Response('{}', { status: 403 }) }));
    await blocked.bank.replaceAll([q('keep')], meta);
    blocked.downloads.start({ sections: ['rw'], liveOnly: false });
    await blocked.downloads.settled();
    const p: DownloadProgress = blocked.downloads.snapshot();
    expect(p.status).toBe('failed');
    expect(p.error?.reason).toBe('blocked');
    expect(p.error?.message).toMatch(/will not retry/);
    expect((await blocked.bank.query({})).map((x) => x.id)).toEqual(['keep']);
  });

  it('a narrower refresh keeps questions outside its scope', () => {
    const existing = [q('rw-old', { section: 'rw' }), q('m-live', { section: 'math', active: true }), q('m-other', { section: 'math', active: false })];
    const downloaded = [q('m-live', { section: 'math', active: true, stemHtml: '<p>new</p>' })];
    const merged = mergeOutsideScope(existing, downloaded, { sections: ['math'], liveOnly: true });
    expect(merged.map((x) => x.id).sort()).toEqual(['m-live', 'm-other', 'rw-old']);
    expect(merged.find((x) => x.id === 'm-live')?.stemHtml).toBe('<p>new</p>');
  });
});

describe('idle shutdown', () => {
  afterEach(() => vi.useRealTimers());

  it('fires after the timeout without requests, never while busy, and only once', () => {
    vi.useFakeTimers();
    let busy = false;
    const onIdle = vi.fn();
    const idle = createIdleMonitor({ timeoutMs: 60_000, checkEveryMs: 1000, isBusy: () => busy, onIdle, now: () => Date.now() });
    vi.advanceTimersByTime(30_000);
    idle.touch();
    vi.advanceTimersByTime(45_000);
    expect(onIdle).not.toHaveBeenCalled();
    busy = true;
    vi.advanceTimersByTime(120_000);
    expect(onIdle).not.toHaveBeenCalled();
    busy = false;
    vi.advanceTimersByTime(61_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(600_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    idle.stop();
  });
});
