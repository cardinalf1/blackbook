// The HTTP adapters must behave exactly like the in-memory ones. The same contract runs against
// both, with the HTTP side going through the real request handler (no network).

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fx from '../src/services/__fixtures__/synthetic';
import { ApiError, createApiClient, SERVER_DOWN } from '../src/services/api/client';
import { createSanitizer } from '../src/services/normalize/sanitize';
import type { AttemptStore, TelemetryStore } from '../src/services/storage/attemptTypes';
import { MemoryAttemptStore } from '../src/services/storage/attemptsMemory';
import { HttpAttemptStore, HttpQuestionStore } from '../src/services/storage/http';
import { MemoryQuestionStore } from '../src/services/storage/memory';
import type { QuestionStore, WritableQuestionStore } from '../src/services/storage/types';
import type { PipelineDeps } from '../src/services/sync/pipeline';
import { createSession, finish } from '../src/services/session/record';
import type { Question } from '../src/types/sat';
import type { EventRecord, SessionRecord, StoredAttempt } from '../src/types/session';
import { createHandler } from './app';
import { DiskBankStore } from './bankStore';
import { DownloadManager } from './download';
import { FsDetailCache } from './files';
import type { SqlDb } from './sql';
import { openSqlite } from './sqlNode';
import { SqliteUserStore } from './userDb';

let dir: string;
let db: SqlDb | null = null;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bb-http-'));
});
afterEach(async () => {
  db?.close();
  db = null;
  await rm(dir, { recursive: true, force: true });
});

const HOST = '127.0.0.1:47821';
const TOKEN = 'contract-token';

type UserStores = AttemptStore & TelemetryStore;

async function httpStores(): Promise<{ questions: QuestionStore; attempts: UserStores; bank: WritableQuestionStore }> {
  const bank = new DiskBankStore(join(dir, 'bank.json'));
  db = openSqlite(join(dir, 'user.db'));
  const handler = createHandler({
    security: { token: TOKEN, allowedHosts: new Set([HOST]), allowedOrigins: new Set(['http://localhost:3000']) },
    bank,
    users: new SqliteUserStore(db),
    downloads: new DownloadManager({ bank, cache: new FsDetailCache(join(dir, 'raw')), window: window as unknown as PipelineDeps['window'], fetch, dataFolder: dir }),
    sanitize: createSanitizer(window),
    dataFolder: dir,
  });
  const api = createApiClient({
    baseUrl: `http://${HOST}`,
    token: () => TOKEN,
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set('host', HOST);
      return handler(new Request(String(input), { ...init, headers }));
    },
  });
  return { questions: new HttpQuestionStore(api), attempts: new HttpAttemptStore(api), bank };
}

async function memoryStores() {
  const bank = new MemoryQuestionStore();
  return { questions: bank as QuestionStore, attempts: new MemoryAttemptStore() as UserStores, bank: bank as WritableQuestionStore };
}

const q = (id: string, over: Partial<Question> = {}): Question => ({ ...(fx.syntheticQuestions[0] as Question), id, ...over });
const CONFIG = { section: 'math' as const, domainCode: 'all', skillCodes: [], difficulties: [], count: 2, liveOnly: true };
const session = (id: string, startedAt: number, mode: SessionRecord['mode'] = 'drill'): SessionRecord => {
  const s = createSession(id, mode, CONFIG, ['a', 'b'], startedAt);
  if (mode !== 'exam') return s;
  return {
    ...s,
    exam: {
      module: { section: 'math', moduleNumber: 1, tier: 'routing' },
      timer: { durationMs: 35 * 60_000, deadlineAt: startedAt + 35 * 60_000, pausedRemainingMs: null },
      pauses: [],
      phase: 'in_progress',
      submittedBy: null,
      timerHidden: false,
      fiveMinuteAlertShown: false,
      assemblyNotes: [],
    },
  };
};
const stored = (sessionId: string, questionId: string, over: Partial<StoredAttempt> = {}): StoredAttempt => ({
  id: `${sessionId}:${questionId}`,
  sessionId,
  questionId,
  mode: 'drill',
  status: 'draft',
  response: '1/2',
  correct: true,
  timeMs: 900,
  firstVisitMs: null,
  changes: 0,
  confidence: null,
  at: 10,
  ...over,
});
const event = (id: string, sessionId: string, ts: number, seq: number): EventRecord => ({
  id,
  sessionId,
  mode: 'drill',
  questionId: 'a',
  type: 'choice_selected',
  ts,
  monoMs: seq * 10.5,
  pageId: 'p',
  seq,
  payload: { choice: 'A' },
});

describe.each([
  ['memory', memoryStores],
  ['http', httpStores],
])('storage contract: %s', (_name, make) => {
  it('question store: empty, then filled, queried and cleared', async () => {
    const { questions, bank } = await make();
    expect(await questions.count()).toBe(0);
    expect(await questions.getMeta()).toBeNull();
    const meta = { fetchedAt: 'f', importedAt: 'i', count: 2, skippedCount: 0 };
    await bank.replaceAll([q('a', { section: 'rw', difficulty: 'E' }), q('b', { section: 'math', difficulty: 'H' })], meta);
    expect(await questions.count()).toBe(2);
    expect(await questions.getMeta()).toEqual(meta);
    expect((await questions.get('b'))?.section).toBe('math');
    expect(await questions.get('nope')).toBeUndefined();
    expect((await questions.query({ section: 'rw' })).map((x) => x.id)).toEqual(['a']);
    expect((await questions.query({ difficulty: 'H' })).map((x) => x.id)).toEqual(['b']);
    await questions.clear();
    expect(await questions.count()).toBe(0);
  });

  it('user store: a session and its attempts save together, upsert, and list', async () => {
    const { attempts } = await make();
    await attempts.saveSession(session('s1', 1), [stored('s1', 'a')]);
    await attempts.saveSession(session('s1', 1), [stored('s1', 'a', { status: 'final', response: 'B', correct: false, changes: 2, confidence: 'unsure' })]);
    expect(await attempts.listAttempts()).toEqual([stored('s1', 'a', { status: 'final', response: 'B', correct: false, changes: 2, confidence: 'unsure' })]);
    expect(await attempts.listAttempts('other')).toEqual([]);
    await attempts.saveSession(session('s2', 2));
    await attempts.saveSession(session('x1', 3, 'exam'));
    expect((await attempts.listSessions()).map((s) => s.id)).toEqual(['x1', 's2', 's1']);
    expect((await attempts.listSessions({ mode: 'drill', status: 'in_progress' })).map((s) => s.id)).toEqual(['s2', 's1']);
    expect(await attempts.getSession('s1')).toEqual(session('s1', 1));
    expect(await attempts.getSession('none')).toBeNull();
  });

  it('user store: a finished session is closed for good', async () => {
    const { attempts } = await make();
    const done = finish(session('s1', 1), 500, () => true, 9);
    await attempts.saveSession(done);
    await attempts.saveSession(done); // identical resend
    await expect(attempts.saveSession({ ...done, status: 'in_progress' })).rejects.toThrow(/cannot be changed/);
    expect((await attempts.listSessions({ status: 'finished' })).map((s) => s.id)).toEqual(['s1']);
  });

  it('user store: flags and clearAll', async () => {
    const { attempts } = await make();
    await attempts.setFlag('a/b c', true);
    expect((await attempts.listFlags()).map((f) => f.questionId)).toEqual(['a/b c']);
    await attempts.setFlag('a/b c', false);
    expect(await attempts.listFlags()).toEqual([]);
    await attempts.saveSession(session('s1', 1), [stored('s1', 'a')]);
    await attempts.appendEvents([event('e1', 's1', 5, 0)]);
    await attempts.clearAll();
    expect(await attempts.listAttempts()).toEqual([]);
    expect(await attempts.listSessions()).toEqual([]);
    expect(await attempts.listEvents()).toEqual([]);
  });

  it('event log: append is idempotent on id, ordered, filtered, counted, exported and cleared', async () => {
    const { attempts } = await make();
    await attempts.saveSession(session('s1', 1), [stored('s1', 'a')]);
    await attempts.appendEvents([event('e2', 's1', 20, 1), event('e1', 's1', 10, 0)]);
    await attempts.appendEvents([event('e1', 's1', 10, 0), event('e3', 's2', 15, 0)], { keepalive: true });
    expect((await attempts.listEvents()).map((e) => e.id)).toEqual(['e1', 'e3', 'e2']);
    expect(await attempts.listEvents('s1')).toEqual([event('e1', 's1', 10, 0), event('e2', 's1', 20, 1)]);
    const stats = await attempts.stats();
    expect(stats).toMatchObject({ events: 3, sessions: 1, attempts: 1 });
    expect(stats.eventBytes).toBeGreaterThan(100);
    const out = await attempts.exportAll();
    expect(out.app).toBe('blackbook');
    expect(out.sessions).toHaveLength(1);
    expect(out.attempts).toHaveLength(1);
    expect(out.events).toHaveLength(3);
    await attempts.clearEvents();
    expect(await attempts.listEvents()).toEqual([]);
    expect(await attempts.listAttempts()).toHaveLength(1); // answers stay
  });

  it('status: seen from showings or answers, done from final answers, results only from finished sessions', async () => {
    const { attempts } = await make();
    // s1 finished: a correct, b wrong (draft only, so not done), c cleared.
    const s1 = finish(createSession('s1', 'drill', CONFIG, ['a', 'b', 'c'], 1), 0, () => true, 50);
    await attempts.saveSession(s1, [
      stored('s1', 'a', { status: 'final', correct: true, at: 20 }),
      stored('s1', 'b', { status: 'draft', correct: false, at: 21 }),
      stored('s1', 'c', { status: 'draft', response: '', correct: false, at: 22 }),
    ]);
    // s2 still in progress: a answered wrong and final. Must not change a's last result.
    await attempts.saveSession(session('s2', 2), [stored('s2', 'a', { status: 'final', correct: false, at: 99 })]);
    // d only shown, e only flagged.
    await attempts.appendEvents([{ ...event('e1', 's2', 5, 0), questionId: 'd', type: 'question_shown', payload: { index: 0, visit: 1 } }]);
    await attempts.setFlag('e', true);
    // An exam module that was shown f (never answered) and never reached g; h's showing exists only as an exam event.
    const x1: SessionRecord = {
      ...createSession('x1', 'exam', CONFIG, ['f', 'g'], 3),
      status: 'abandoned',
      exam: {
        module: { section: 'math', moduleNumber: 1, tier: 'routing' },
        timer: { durationMs: 1000, deadlineAt: null, pausedRemainingMs: null },
        pauses: [],
        phase: 'in_progress',
        submittedBy: null,
        timerHidden: false,
        fiveMinuteAlertShown: false,
        assemblyNotes: [],
      },
    };
    await attempts.saveSession(x1);
    await attempts.appendEvents([{ ...event('e2', 'x1', 6, 0), mode: 'exam', questionId: 'h', type: 'question_shown', payload: { index: 0, visit: 1 } }]);
    const got = await attempts.questionStatus();
    const base = { done: false, examShown: false, attempts: 0, lastResult: null, flagged: false };
    expect(got).toEqual([
      { ...base, questionId: 'a', seen: true, done: true, attempts: 2, lastResult: 'correct' },
      { ...base, questionId: 'b', seen: true },
      { ...base, questionId: 'c', seen: true },
      { ...base, questionId: 'd', seen: true },
      // A flag alone does not count as seen (the showing may have been deleted with the telemetry).
      { ...base, questionId: 'e', seen: false, flagged: true },
      // Shown in an exam, even a discarded one and never answered: used up for exams. g was never reached.
      { ...base, questionId: 'f', seen: true, examShown: true },
      { ...base, questionId: 'h', seen: true, examShown: true },
    ]);
  });
});

describe('api client errors', () => {
  it('turns an unreachable server into a plain message, and keeps server error text', async () => {
    const down = createApiClient({ fetch: () => Promise.reject(new TypeError('fetch failed')) });
    await expect(down.request('/api/health')).rejects.toMatchObject({ status: null, message: SERVER_DOWN });
    const proxyError = createApiClient({ fetch: async () => new Response('<html>proxy error</html>', { status: 500 }) });
    await expect(proxyError.request('/api/health')).rejects.toMatchObject({ status: null });
    const badGateway = createApiClient({ fetch: async () => new Response('', { status: 502 }) });
    await expect(badGateway.request('/api/health')).rejects.toMatchObject({ status: null, message: SERVER_DOWN });
    const refused = createApiClient({ fetch: async () => new Response(JSON.stringify({ error: 'Nope.' }), { status: 409 }) });
    const err = await refused.request('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, message: 'Nope.' });
  });
});
