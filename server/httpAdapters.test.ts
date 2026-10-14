// The HTTP adapters must behave exactly like the in-memory ones. The same contract runs against
// both, with the HTTP side going through the real request handler (no network).

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fx from '../src/services/__fixtures__/synthetic';
import { ApiError, createApiClient, SERVER_DOWN } from '../src/services/api/client';
import { createSanitizer } from '../src/services/normalize/sanitize';
import type { AttemptStore } from '../src/services/storage/attemptTypes';
import { MemoryAttemptStore } from '../src/services/storage/attemptsMemory';
import { HttpAttemptStore, HttpQuestionStore } from '../src/services/storage/http';
import { MemoryQuestionStore } from '../src/services/storage/memory';
import type { QuestionStore, WritableQuestionStore } from '../src/services/storage/types';
import type { PipelineDeps } from '../src/services/sync/pipeline';
import type { SessionRecord } from '../src/types/drill';
import type { Question } from '../src/types/sat';
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

async function httpStores(): Promise<{ questions: QuestionStore; attempts: AttemptStore; bank: WritableQuestionStore }> {
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
  return { questions: bank as QuestionStore, attempts: new MemoryAttemptStore() as AttemptStore, bank: bank as WritableQuestionStore };
}

const q = (id: string, over: Partial<Question> = {}): Question => ({ ...(fx.syntheticQuestions[0] as Question), id, ...over });
const session = (id: string, startedAt: number, status: SessionRecord['status'] = 'active'): SessionRecord => ({
  id,
  config: { section: 'math', domainCode: 'all', skillCodes: [], difficulties: [], count: 1, liveOnly: true },
  queueIds: ['a'],
  index: 0,
  startedAt,
  status,
  answered: {},
  struck: {},
  currentElapsedMs: 0,
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

  it('attempt store: attempts, flags, sessions, clearAll', async () => {
    const { attempts } = await make();
    const a = { id: 's1:a', questionId: 'a', response: '1/2', correct: true, timeMs: 900, sessionId: 's1', at: 10 };
    await attempts.addAttempt(a);
    await attempts.addAttempt({ ...a, correct: false });
    expect(await attempts.listAttempts()).toEqual([{ ...a, correct: false }]);
    expect(await attempts.attemptsForSession('other')).toEqual([]);
    await attempts.setFlag('a/b c', true);
    expect((await attempts.listFlags()).map((f) => f.questionId)).toEqual(['a/b c']);
    await attempts.setFlag('a/b c', false);
    expect(await attempts.listFlags()).toEqual([]);
    await attempts.saveSession(session('old', 1));
    await attempts.saveSession(session('new', 2));
    await attempts.saveSession(session('done', 3, 'finished'));
    expect((await attempts.getActiveSession())?.id).toBe('new');
    expect((await attempts.getSession('done'))?.status).toBe('finished');
    await attempts.deleteSession('new');
    expect((await attempts.getActiveSession())?.id).toBe('old');
    await attempts.clearAll();
    expect(await attempts.listAttempts()).toEqual([]);
    expect(await attempts.getActiveSession()).toBeNull();
  });
});

describe('api client errors', () => {
  it('turns an unreachable server into a plain message, and keeps server error text', async () => {
    const down = createApiClient({ fetch: () => Promise.reject(new TypeError('fetch failed')) });
    await expect(down.request('/api/health')).rejects.toMatchObject({ status: null, message: SERVER_DOWN });
    const proxyError = createApiClient({ fetch: async () => new Response('<html>proxy error</html>', { status: 500 }) });
    await expect(proxyError.request('/api/health')).rejects.toMatchObject({ status: null });
    const refused = createApiClient({ fetch: async () => new Response(JSON.stringify({ error: 'Nope.' }), { status: 409 }) });
    const err = await refused.request('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, message: 'Nope.' });
  });
});
