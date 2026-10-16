// Phase 10 server pieces for the desktop app: the start rules for the database (newer refused,
// backup before a migration, check after an unclean stop), the exit snapshot, the control line,
// the data folder guard, key encryption, static files, /healthz and the log. Synthetic data only.

import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSession } from '../src/services/session/record';
import { redact } from '../src/services/diagnostics/redact';
import { KeyStore, type KeyCipher } from './ai/keyStore';
import { createHandler } from './app';
import { BackupManager, EXIT_KEEP } from './backups';
import { DiskBankStore } from './bankStore';
import { channelCipher, ControlChannel, encodeLine, lineSplitter, parseLine, type ControlIo, type ToShell } from './control';
import { DataDirRefused, defaultDataFolder, resolveDataDir } from './dataDir';
import { DownloadManager } from './download';
import { FsDetailCache } from './files';
import { backupBeforeMigration, checkpoint, checkSchema, integrityCheck, RunMarker, setAsideDamaged } from './lifecycle';
import { createLogger, rotateIfNeeded } from './log';
import { cookieNameForPort } from './security';
import type { SqlDb } from './sql';
import { openSqlite } from './sqlNode';
import { APP_CSP, createStaticHandler, safePath } from './staticFiles';
import { MIGRATIONS, migrate, SCHEMA_VERSION, SqliteUserStore } from './userDb';

let dir: string;
const dbs: SqlDb[] = [];
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bb-desktop-'));
});
afterEach(async () => {
  for (const d of dbs.splice(0)) {
    try {
      d.close();
    } catch {
      // closed by the test
    }
  }
  await rm(dir, { recursive: true, force: true });
});

function openDb(name = 'user.db'): SqlDb {
  const db = openSqlite(join(dir, name));
  dbs.push(db);
  return db;
}

const CONFIG = { section: 'math' as const, domainCode: 'all', skillCodes: [], difficulties: [], count: 1, liveOnly: true };

describe('database start rules', () => {
  it('refuses a database saved by a newer version before touching it', () => {
    const db = openDb();
    migrate(db);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    expect(checkSchema(db)).toEqual({ kind: 'newer', version: SCHEMA_VERSION + 1, supported: SCHEMA_VERSION });
    // The store itself refuses too, as a second line of defence.
    expect(() => new SqliteUserStore(db)).toThrow(/newer version/);
  });

  it('copies an older database before migrating it, and the copy opens at the old version', async () => {
    const db = openDb();
    migrate(db, MIGRATIONS.slice(0, 3));
    db.run("CREATE TABLE marker (v TEXT)");
    db.run("INSERT INTO marker VALUES ('kept')");
    const check = checkSchema(db);
    expect(check).toEqual({ kind: 'migrate', from: 3, to: SCHEMA_VERSION });
    const copy = await backupBeforeMigration(db, join(dir, 'backups'), 3, 1234);
    expect(copy).toMatch(/before-migration-v3-1234\.db$/);
    migrate(db);
    const old = openSqlite(copy);
    dbs.push(old);
    expect(old.get<{ user_version: number }>('PRAGMA user_version')?.user_version).toBe(3);
    expect(old.get<{ v: string }>('SELECT v FROM marker')?.v).toBe('kept');
  });

  it('needs no copy for a brand-new file or a current one', () => {
    const db = openDb();
    expect(checkSchema(db).kind).toBe('current');
    migrate(db);
    expect(checkSchema(db)).toEqual({ kind: 'current', version: SCHEMA_VERSION });
  });

  it('marks an unclean stop and clears the mark on a clean one', async () => {
    const m = new RunMarker(join(dir, 'running.lock'));
    expect(await m.begin(1)).toBe(false);
    // Crash: no end(). The next start notices.
    expect(await new RunMarker(join(dir, 'running.lock')).begin(2)).toBe(true);
    await m.end();
    expect(await new RunMarker(join(dir, 'running.lock')).begin(3)).toBe(false);
  });

  it('passes the integrity check on a healthy file and sets a damaged one aside', async () => {
    const db = openDb();
    migrate(db);
    expect(integrityCheck(db)).toBe('ok');
    checkpoint(db);
    db.close();
    const aside = await setAsideDamaged(join(dir, 'user.db'), 99);
    expect(aside).toMatch(/user\.db\.damaged-99$/);
    expect((await readdir(dir)).includes('user.db')).toBe(false);
  });

  it('reports a damaged database file', async () => {
    const db = openDb();
    migrate(db);
    db.run('CREATE TABLE big (v TEXT)');
    for (let i = 0; i < 200; i++) db.run('INSERT INTO big VALUES (?)', 'x'.repeat(500));
    checkpoint(db);
    db.close();
    const path = join(dir, 'user.db');
    const bytes = await readFile(path);
    // Scribble over the middle pages, keeping the header readable.
    for (let i = 8192; i < Math.min(bytes.length, 40000); i++) bytes[i] = (i * 7) % 256;
    await writeFile(path, bytes);
    const broken = openDb();
    let result: string;
    try {
      result = integrityCheck(broken);
    } catch (e) {
      result = String(e);
    }
    expect(result).not.toBe('ok');
  });
});

describe('exit snapshot', () => {
  it('writes one when there is data, none when empty, and keeps the newest few', async () => {
    const store = new SqliteUserStore(openDb());
    let t = 1000;
    const backups = new BackupManager(join(dir, 'backups'), store, () => t);
    expect(await backups.snapshotOnExit()).toBeNull();
    await store.saveSession(createSession('s1', 'drill', CONFIG, ['q1'], 1));
    for (let i = 0; i < EXIT_KEEP + 2; i++) {
      t += 1;
      expect(await backups.snapshotOnExit()).toBe(`on-exit-${t}.json`);
    }
    const list = await backups.list();
    const exits = list.backups.filter((b) => b.kind === 'on_exit');
    expect(exits).toHaveLength(EXIT_KEEP);
    expect(exits[0]?.name).toBe(`on-exit-${t}.json`);
    // It can be restored like any snapshot.
    await expect(backups.restoreSnapshot(`on-exit-${t}.json`)).resolves.toMatchObject({ sessions: 1 });
  });
});

describe('control line', () => {
  it('encodes and parses messages and ignores log lines', () => {
    const msg: ToShell = { type: 'fatal', code: 'newer-db', message: 'x' };
    expect(parseLine<ToShell>(encodeLine(msg).trimEnd(), ['fatal'])).toEqual(msg);
    expect(parseLine<ToShell>('ordinary log line', ['fatal'])).toBeNull();
    expect(parseLine<ToShell>('@@blackbook {broken', ['fatal'])).toBeNull();
    expect(parseLine<ToShell>(encodeLine(msg), ['ready'])).toBeNull();
  });

  it('splits chunks into lines across boundaries', () => {
    const lines: string[] = [];
    const s = lineSplitter((l) => lines.push(l));
    s.push('ab');
    s.push('c\nde');
    s.push('f\n\ng');
    s.end();
    expect(lines).toEqual(['abc', 'def', '', 'g']);
  });

  function fakeIo() {
    const written: string[] = [];
    let data: (c: string) => void = () => undefined;
    let end: () => void = () => undefined;
    const io: ControlIo = { write: (t) => void written.push(t), onData: (fn) => (data = fn), onEnd: (fn) => (end = fn) };
    return { io, written, feed: (c: string) => data(c), close: () => end() };
  }

  it('asks the shell to encrypt and decrypt, and gives up cleanly when the line closes', async () => {
    const f = fakeIo();
    const ch = new ControlChannel(f.io, 1000);
    const cipher = channelCipher(ch);
    const p = cipher.encrypt('plain');
    const req = parseLine<ToShell>(f.written[0] ?? '', ['cipher']);
    expect(req).toMatchObject({ type: 'cipher', op: 'encrypt', data: 'plain' });
    f.feed(encodeLine({ type: 'cipher-result', id: (req as { id: number }).id, ok: true, data: 'c2VhbGVk' }));
    await expect(p).resolves.toBe('c2VhbGVk');
    const q = cipher.available();
    let closed = false;
    ch.onClosed(() => (closed = true));
    f.close();
    await expect(q).resolves.toBe(false);
    expect(closed).toBe(true);
  });

  it('times out an unanswered request instead of hanging', async () => {
    const f = fakeIo();
    const ch = new ControlChannel(f.io, 20);
    await expect(ch.request('available')).resolves.toEqual({ ok: false });
  });

  it('passes prepare-exit to the program', () => {
    const f = fakeIo();
    const ch = new ControlChannel(f.io);
    const ids: number[] = [];
    ch.onPrepareExit((id) => ids.push(id));
    f.feed(encodeLine({ type: 'prepare-exit', id: 7 }));
    expect(ids).toEqual([7]);
  });
});

describe('data folder', () => {
  it('uses the per-user app-data folder, never the program folder', () => {
    expect(defaultDataFolder({ APPDATA: 'C:\\Roaming' }, 'win32', 'C:\\Home')).toBe(join('C:\\Roaming', 'Blackbook'));
    expect(defaultDataFolder({}, 'darwin', '/Users/someone')).toBe(join('/Users/someone', 'Library', 'Application Support', 'Blackbook'));
  });

  it('takes the flag first, then BLACKBOOK_DATA_DIR, then the default', () => {
    const t = tmpdir();
    const env = { BLACKBOOK_TEST: '1', BLACKBOOK_DATA_DIR: join(t, 'env') };
    expect(resolveDataDir({ flag: join(t, 'flag'), env, fallback: join(t, 'fb') })).toBe(join(t, 'flag'));
    expect(resolveDataDir({ flag: null, env, fallback: join(t, 'fb') })).toBe(join(t, 'env'));
  });

  it('fails loudly when a test run points at the real folder', () => {
    const env = { BLACKBOOK_TEST: '1' };
    expect(() => resolveDataDir({ flag: null, env, fallback: defaultDataFolder() })).toThrow(DataDirRefused);
    expect(() => resolveDataDir({ flag: join('data', 'app'), env, fallback: join(tmpdir(), 'x') })).toThrow(DataDirRefused);
  });
});

describe('key encryption', () => {
  // Stands in for the OS key store: reversible, and visibly not the plain key.
  const fakeCipher = (ok = true): KeyCipher => ({
    available: async () => ok,
    encrypt: async (p) => Buffer.from(`sealed:${p}`).toString('base64'),
    decrypt: async (b) => Buffer.from(b, 'base64').toString().replace(/^sealed:/, ''),
  });
  const KEY = 'abcdefghijklmnopqrstuvwxyz012345';

  it('seals the key so the plain key is never on disk', async () => {
    const path = join(dir, 'secrets', 'groq-key');
    const ks = new KeyStore(path, 'Groq key', fakeCipher());
    await ks.set(KEY);
    expect(await ks.protection()).toBe('encrypted');
    const files = await readdir(join(dir, 'secrets'));
    expect(files).toEqual(['groq-key.enc']);
    expect(await readFile(join(dir, 'secrets', 'groq-key.enc'), 'utf8')).not.toContain(KEY);
    // A restart (new store, same folder) still has it.
    expect(await new KeyStore(path, 'Groq key', fakeCipher()).get()).toBe(KEY);
  });

  it('falls back to an owner-only file when encryption is unavailable, and says so', async () => {
    const path = join(dir, 'secrets', 'desmos-key');
    const ks = new KeyStore(path, 'Desmos key', fakeCipher(false));
    await ks.set(KEY);
    expect(await ks.protection()).toBe('file');
    expect(await readFile(path, 'utf8')).toBe(KEY);
  });

  it('seals a key saved before encryption was available', async () => {
    const path = join(dir, 'secrets', 'groq-key');
    await new KeyStore(path).set(KEY);
    const ks = new KeyStore(path, 'Groq key', fakeCipher());
    expect(await ks.get()).toBe(KEY);
    expect(await readdir(join(dir, 'secrets'))).toEqual(['groq-key.enc']);
    await ks.remove();
    expect(await readdir(join(dir, 'secrets'))).toEqual([]);
  });
});

describe('static files and health', () => {
  async function distFolder() {
    const d = join(dir, 'dist');
    await writeFile(join(dir, 'secret.txt'), 'outside');
    await import('node:fs/promises').then((fs) => fs.mkdir(join(d, 'assets'), { recursive: true }));
    await writeFile(join(d, 'index.html'), '<!doctype html><div id="root"></div>');
    await writeFile(join(d, 'assets', 'app-1.js'), 'console.log(1)');
    return d;
  }

  it('keeps every path inside the folder', () => {
    expect(safePath('/app/dist', '/assets/a.js')).toBe(resolve('/app/dist', 'assets', 'a.js'));
    expect(safePath('/app/dist', '/../secret.txt')).toBeNull();
    expect(safePath('/app/dist', '/%2e%2e/secret.txt')).toBeNull();
    expect(safePath('/app/dist', '/a%00b')).toBeNull();
  });

  function handler(staticDir: string | null) {
    const bank = new DiskBankStore(join(dir, 'bank.json'));
    return createHandler({
      security: { token: 'tok-123456', allowedHosts: new Set(['127.0.0.1:5000']), allowedOrigins: new Set(['http://127.0.0.1:5000']), cookieName: cookieNameForPort(5000) },
      bank,
      users: new SqliteUserStore(openDb()),
      downloads: new DownloadManager({ bank, cache: new FsDetailCache(join(dir, 'raw')), window: {} as never, fetch: async () => new Response(''), dataFolder: dir }),
      sanitize: (h: string) => h,
      dataFolder: dir,
      health: { version: '1.2.3', schemaVersion: 7 },
      ...(staticDir ? { staticFiles: createStaticHandler(staticDir) } : {}),
    });
  }
  const get = (h: (r: Request) => Promise<Response>, path: string, headers: Record<string, string> = {}) =>
    h(new Request(`http://127.0.0.1:5000${path}`, { headers: { host: '127.0.0.1:5000', ...headers } }));

  it('serves the page with the CSP, falls back for app routes, and 404s missing files', async () => {
    const h = handler(await distFolder());
    const page = await get(h, '/');
    expect(page.status).toBe(200);
    expect(page.headers.get('content-security-policy')).toBe(APP_CSP);
    expect(page.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await get(h, '/some/route')).status).toBe(200);
    expect((await get(h, '/assets/app-1.js')).headers.get('content-type')).toMatch(/javascript/);
    expect((await get(h, '/assets/missing.js')).status).toBe(404);
    expect((await get(h, '/..%2fsecret.txt')).status).toBe(404);
  });

  it('allows only the app itself in the page policy', () => {
    expect(APP_CSP).toContain("default-src 'self'");
    expect(APP_CSP).toContain("script-src 'self'");
    expect(APP_CSP).toContain("connect-src 'self'");
    expect(APP_CSP).not.toMatch(/https?:/);
    expect(APP_CSP).not.toContain('unsafe-eval');
  });

  it('answers /healthz with the version and schema only, and checks Host', async () => {
    const h = handler(null);
    const r = await get(h, '/healthz');
    expect(await r.json()).toEqual({ version: '1.2.3', schemaVersion: 7 });
    expect((await h(new Request('http://evil.test/healthz', { headers: { host: 'evil.test' } }))).status).toBe(403);
  });

  it('accepts only the cookie named for this port', async () => {
    const h = handler(null);
    expect((await get(h, '/api/bank/count', { cookie: 'bb_session_5000=tok-123456' })).status).toBe(200);
    expect((await get(h, '/api/bank/count', { cookie: 'bb_session_5001=tok-123456' })).status).toBe(401);
    expect((await get(h, '/api/bank/count', { cookie: 'bb_session=tok-123456' })).status).toBe(401);
  });
});

describe('log', () => {
  it('scrubs keys, tokens and home paths, and rotates at the limit', async () => {
    const path = join(dir, 'logs', 'blackbook.log');
    const log = createLogger({ path, maxBytes: 400 });
    log.addSecret('launch-token-123');
    log.info('key gsk_abcdefghijklmnop12345 token launch-token-123 url https://x.test/a?apiKey=SECRETSECRET');
    log.info('C:\\Users\\Someone\\AppData\\Roaming\\Blackbook and /Users/someone/Library');
    const text = await readFile(path, 'utf8');
    expect(text).not.toMatch(/gsk_abcdefgh|launch-token-123|SECRETSECRET|Someone|someone/);
    for (let i = 0; i < 20; i++) log.info(`line ${i} ${'x'.repeat(60)}`);
    const names = await readdir(join(dir, 'logs'));
    expect(names).toContain('blackbook.log.1');
    expect(names.length).toBeLessThanOrEqual(4);
    expect((await stat(path)).size).toBeLessThan(800);
  });

  it('rotation keeps at most three old files', async () => {
    const path = join(dir, 'r.log');
    for (let i = 0; i < 6; i++) {
      await writeFile(path, 'y'.repeat(50));
      rotateIfNeeded(path, 10, 3);
    }
    expect((await readdir(dir)).sort()).toEqual(['r.log.1', 'r.log.2', 'r.log.3']);
  });

  it('redact handles the shapes used in diagnostics', () => {
    expect(redact('Bearer abcdefghijklmnop')).toBe('Bearer [removed]');
    expect(redact('/home/pat/x')).toBe('~/x');
    expect(redact('saved key ABCDEFGHIJKLMNOPQRSTUV', { secrets: ['ABCDEFGHIJKLMNOPQRSTUV'] })).toBe('saved key [removed]');
  });
});
