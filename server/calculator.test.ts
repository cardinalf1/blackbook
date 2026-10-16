// The Desmos key and calculator page with a fake Desmos: the key goes in, never comes back out
// except inside the sandboxed calculator page, and is in no export, backup, status or message.

import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSanitizer } from '../src/services/normalize/sanitize';
import { KeyStore } from './ai/keyStore';
import { createHandler } from './app';
import { DiskBankStore } from './bankStore';
import { BackupManager } from './backups';
import { CalculatorService, DESMOS_SCRIPT } from './calculator';
import type { DownloadManager } from './download';
import { TOKEN_HEADER } from './security';
import type { SqlDb } from './sql';
import { openSqlite } from './sqlNode';
import { SqliteUserStore } from './userDb';

// Synthetic, not a real key: the same shape as one (32 hex characters), built at run time so the
// repo scan in src/services/secrets.test.ts never finds a key-shaped string in a committed file.
const KEY = 'ab12'.repeat(8);
const TOKEN = 'test-token-0123456789';
const HOST = '127.0.0.1:47821';
const UI = 'http://localhost:3000';

let dir: string;
let db: SqlDb | null = null;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bb-calc-'));
});

afterEach(async () => {
  db?.close();
  db = null;
  await rm(dir, { recursive: true, force: true });
});

function fakeDesmos(reply: (url: string) => Response | 'offline') {
  const urls: string[] = [];
  const fetch = async (input: string) => {
    urls.push(input);
    const r = reply(input);
    if (r === 'offline') throw new TypeError('fetch failed');
    return r;
  };
  return { fetch, urls };
}

function service(reply: Parameters<typeof fakeDesmos>[0]) {
  const desmos = fakeDesmos(reply);
  const calc = new CalculatorService({ keys: new KeyStore(join(dir, 'secrets', 'desmos-key'), 'Desmos key'), fetch: desmos.fetch });
  return { calc, desmos };
}

describe('Desmos key', () => {
  it('Test asks Desmos for the script with the key and reads its answer', async () => {
    const ok = service(() => new Response('/* js */', { status: 200 }));
    expect((await ok.calc.test()).message).toContain('No Desmos key');
    await ok.calc.setKey(KEY);
    expect(await ok.calc.test()).toMatchObject({ ok: true });
    expect(ok.desmos.urls[0]).toBe(`${DESMOS_SCRIPT}?apiKey=${KEY}`);

    const bad = service(() => new Response('Unrecognized API key', { status: 403 }));
    await bad.calc.setKey(KEY);
    const t = await bad.calc.test();
    expect(t.ok).toBe(false);
    expect(t.message).toContain('does not recognize');
    expect(t.message).not.toContain(KEY);

    const offline = service(() => 'offline');
    await offline.calc.setKey(KEY);
    expect((await offline.calc.test()).message).toContain('offline');
  });

  it('refuses a key that does not look like one, and Remove deletes the file', async () => {
    const { calc } = service(() => new Response('', { status: 200 }));
    await expect(calc.setKey('short')).rejects.toThrow('Desmos key');
    await calc.setKey(KEY);
    expect(await readdir(join(dir, 'secrets'))).toEqual(['desmos-key']);
    expect(await calc.removeKey()).toEqual({ hasKey: false });
    expect(await readdir(join(dir, 'secrets'))).toEqual([]);
  });

  it('the calculator page exists only with a key, loads the official script, and is locked down', async () => {
    const { calc } = service(() => new Response('', { status: 200 }));
    expect(await calc.frame('graphing')).toBeNull();
    await calc.setKey(KEY);
    const g = await calc.frame('graphing');
    expect(g?.html).toContain(`${DESMOS_SCRIPT}?apiKey=${KEY}`);
    expect(g?.html).toContain('GraphingCalculator');
    expect(g?.html).toContain('setMathBounds({ left: -10, right: 10');
    expect(g?.headers['cache-control']).toBe('no-store');
    const csp = g?.headers['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(g?.html).toContain(`nonce="${nonce}"`);
    expect((await calc.frame('scientific'))?.html).toContain("var MODE = \"scientific\"");
  });
});

describe('Desmos routes', () => {
  async function setup() {
    db = openSqlite(join(dir, 'user.db'));
    const users = new SqliteUserStore(db);
    const { calc } = service(() => new Response('', { status: 200 }));
    const handler = createHandler({
      security: { token: TOKEN, allowedHosts: new Set([HOST]), allowedOrigins: new Set([UI]) },
      bank: new DiskBankStore(join(dir, 'bank.json')),
      users,
      downloads: {} as DownloadManager,
      sanitize: createSanitizer(window),
      dataFolder: dir,
      calculator: calc,
    });
    const call = (path: string, init: RequestInit = {}) =>
      handler(new Request(`http://${HOST}${path}`, { ...init, headers: { host: HOST, origin: UI, [TOKEN_HEADER]: TOKEN } }));
    return { users, call, handler };
  }

  it('the key goes in and never comes out of status, export or a backup', async () => {
    const { users, call } = await setup();
    expect(await (await call('/api/calculator/status')).json()).toEqual({ hasKey: false });
    expect((await call('/api/calculator/frame?mode=graphing')).status).toBe(404);
    const put = await call('/api/calculator/key', { method: 'PUT', body: JSON.stringify({ key: KEY }) });
    expect(await put.text()).not.toContain(KEY);
    expect(await (await call('/api/calculator/status')).json()).toEqual({ hasKey: true });
    const frame = await call('/api/calculator/frame?mode=graphing');
    expect(frame.status).toBe(200);
    expect(frame.headers.get('content-security-policy')).toContain("default-src 'none'");

    expect(JSON.stringify(await users.exportAll())).not.toContain(KEY);
    const mgr = new BackupManager(join(dir, 'backups'), users);
    const name = (await mgr.snapshotIfDue()) as string;
    expect(await readFile(join(dir, 'backups', name), 'utf8')).not.toContain(KEY);

    expect((await call('/api/calculator/key', { method: 'PUT', body: JSON.stringify({ key: 'x' }) })).status).toBe(400);
    expect(await (await call('/api/calculator/key', { method: 'DELETE' })).json()).toEqual({ hasKey: false });
  });

  it('needs the access token like every other route', async () => {
    const { handler } = await setup();
    const res = await handler(new Request(`http://${HOST}/api/calculator/frame?mode=graphing`, { headers: { host: HOST } }));
    expect(res.status).toBe(401);
  });
});
