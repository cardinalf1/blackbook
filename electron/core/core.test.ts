// @vitest-environment node
// The desktop shell's pure parts, plus one end-to-end run of the smoke test against the real local
// program (started from source with Bun) on a temp folder: start, save, stop, port freed, restart,
// data still there, port freed again.

import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_VERSION } from '../../src/version';
import { buildDiagnostics } from './diagnostics';
import { decideNavigation, isAllowedExternal, isAllowedRequest } from './navigation';
import { DEFAULT_SHELL_SETTINGS, loadShellSettings, parseShellSettings, saveShellSettings } from './shellSettings';
import { runExitSequence } from './shutdown';
import { Sidecar } from './sidecar';
import { portIsFree, runSmokeTest } from './smokeTest';
import { compareVersions, fetchLatest, isDue, LATEST_RELEASE_API, parseLatestRelease, RELEASES_PAGE } from './updateCheck';
import { MIN_HEIGHT, MIN_WIDTH, parseWindowState, restoreBounds } from './windowState';

const ORIGIN = 'http://127.0.0.1:51234';

describe('navigation', () => {
  it('lets the window show only the local program', () => {
    expect(decideNavigation(`${ORIGIN}/anything`, ORIGIN)).toBe('allow');
    expect(decideNavigation('http://127.0.0.1:9999/', ORIGIN)).toBe('deny');
    expect(decideNavigation('http://localhost:51234/', ORIGIN)).toBe('deny');
    expect(decideNavigation('file:///etc/passwd', ORIGIN)).toBe('deny');
    expect(decideNavigation('javascript:alert(1)', ORIGIN)).toBe('deny');
    expect(decideNavigation(`${ORIGIN}/`, null)).toBe('deny');
  });

  it('opens only allowlisted https sites in the browser', () => {
    expect(decideNavigation('https://console.groq.com/keys', ORIGIN)).toBe('external');
    expect(decideNavigation('https://www.desmos.com/my-api', ORIGIN)).toBe('external');
    expect(decideNavigation('https://github.com/x/y/releases', ORIGIN)).toBe('external');
    expect(isAllowedExternal('http://console.groq.com/')).toBe(false);
    expect(isAllowedExternal('https://evil.example/')).toBe(false);
    expect(isAllowedExternal('https://console.groq.com.evil.example/')).toBe(false);
    expect(isAllowedExternal('https://user:pw@github.com/')).toBe(false);
    expect(isAllowedExternal('https://github.com:8443/')).toBe(false);
  });

  it('lets the session reach only the local program and Desmos (for its frame)', () => {
    expect(isAllowedRequest(`${ORIGIN}/api/bank/count`, ORIGIN)).toBe(true);
    expect(isAllowedRequest('https://www.desmos.com/api/v1.11/calculator.js', ORIGIN)).toBe(true);
    expect(isAllowedRequest('https://saved-work.desmos.com/x', ORIGIN)).toBe(true);
    expect(isAllowedRequest('data:image/png;base64,AAAA', ORIGIN)).toBe(true);
    expect(isAllowedRequest('https://api.groq.com/openai/v1/chat/completions', ORIGIN)).toBe(false);
    expect(isAllowedRequest('https://www.google-analytics.com/collect', ORIGIN)).toBe(false);
    expect(isAllowedRequest('https://api.github.com/repos/x/y', ORIGIN)).toBe(false);
    expect(isAllowedRequest('http://127.0.0.1:1/', ORIGIN)).toBe(false);
    expect(isAllowedRequest('file:///C:/Windows/win.ini', ORIGIN)).toBe(false);
    expect(isAllowedRequest('https://desmos.com.evil.example/', ORIGIN)).toBe(false);
  });
});

describe('window state', () => {
  const screens = [{ x: 0, y: 0, width: 1920, height: 1040 }];
  it('restores a visible window and enforces the minimum size', () => {
    expect(restoreBounds({ x: 10, y: 10, width: 500, height: 300 }, screens)).toEqual({ x: 10, y: 10, width: MIN_WIDTH, height: MIN_HEIGHT });
    expect(restoreBounds({ x: 10, y: 10, width: 5000, height: 5000 }, screens)).toEqual({ x: 10, y: 10, width: 1920, height: 1040 });
  });
  it('drops a position that is off every screen', () => {
    expect(restoreBounds({ x: 4000, y: 10, width: 1200, height: 800 }, screens)).toBeNull();
    expect(restoreBounds(null, screens)).toBeNull();
  });
  it('parses junk safely', () => {
    expect(parseWindowState('x')).toEqual({ bounds: null, maximized: false });
    expect(parseWindowState({ bounds: { x: 'a' }, maximized: true })).toEqual({ bounds: null, maximized: true });
  });
});

describe('shell settings', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bb-shell-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('survive a restart (window, zoom, update switch)', async () => {
    const path = join(dir, 'shell.json');
    expect(await loadShellSettings(path)).toEqual(DEFAULT_SHELL_SETTINGS);
    const s = { ...DEFAULT_SHELL_SETTINGS, window: { bounds: { x: 1, y: 2, width: 1300, height: 900 }, maximized: true }, zoomLevel: 1, updateCheck: false };
    await saveShellSettings(path, s);
    expect(await loadShellSettings(path)).toEqual(s);
  });

  it('keeps the update check on unless turned off, and only trusts github.com links', () => {
    expect(parseShellSettings({}).updateCheck).toBe(true);
    expect(parseShellSettings({ latest: { version: '9.9.9', url: 'https://evil.example/' } }).latest).toBeNull();
    expect(parseShellSettings({ zoomLevel: 99 }).zoomLevel).toBe(3);
  });
});

describe('exit sequence', () => {
  it('runs page, program, stop in order', async () => {
    const order: string[] = [];
    const r = await runExitSequence({
      flushPage: async () => void order.push('page'),
      prepareProgram: async () => void order.push('program'),
      stopProgram: async () => void order.push('stop'),
    });
    expect(order).toEqual(['page', 'program', 'stop']);
    expect(r).toEqual({ page: 'done', program: 'done', stop: 'done', cutShort: false });
  });

  it('never hangs: a silent page still lets the program save, and a hard limit ends it', async () => {
    const order: string[] = [];
    const r = await runExitSequence(
      {
        flushPage: () => new Promise(() => undefined),
        prepareProgram: async () => void order.push('program'),
        stopProgram: () => new Promise(() => undefined),
      },
      { pageMs: 20, programMs: 20, stopMs: 20, totalMs: 200 },
    );
    expect(order).toEqual(['program']);
    expect(r.page).toBe('timeout');
    expect(r.stop).toBe('timeout');
    const cut = await runExitSequence(
      { flushPage: () => new Promise(() => undefined), prepareProgram: () => new Promise(() => undefined), stopProgram: () => new Promise(() => undefined) },
      { pageMs: 1000, programMs: 1000, stopMs: 1000, totalMs: 30 },
    );
    expect(cut.cutShort).toBe(true);
  });
});

describe('update notice', () => {
  it('compares versions', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('v1.2.0', '1.10.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.0-beta.1')).toBe(1);
    expect(compareVersions('junk', '1.0.0')).toBe(0);
  });

  it('checks at most once a day', () => {
    expect(isDue(null, 1000)).toBe(true);
    expect(isDue(1000, 1000 + 3_600_000)).toBe(false);
    expect(isDue(1000, 1000 + 86_400_000)).toBe(true);
  });

  it('reports only a newer, published release with a github.com link', () => {
    expect(parseLatestRelease({ tag_name: 'v1.1.0', html_url: `${RELEASES_PAGE}/tag/v1.1.0` }, '1.0.0')).toEqual({ version: '1.1.0', url: `${RELEASES_PAGE}/tag/v1.1.0` });
    expect(parseLatestRelease({ tag_name: 'v1.0.0' }, '1.0.0')).toBeNull();
    expect(parseLatestRelease({ tag_name: 'v2.0.0', draft: true }, '1.0.0')).toBeNull();
    expect(parseLatestRelease({ tag_name: 'v2.0.0', html_url: 'https://evil.example/' }, '1.0.0')?.url).toBe(RELEASES_PAGE);
  });

  it('sends one plain GET to GitHub with no token or cookies, and treats failure as no notice', async () => {
    const seen: { url: string; init: RequestInit | undefined }[] = [];
    const ok: typeof fetch = async (i, init) => {
      seen.push({ url: String(i), init });
      return new Response(JSON.stringify({ tag_name: 'v1.2.0', html_url: `${RELEASES_PAGE}/tag/v1.2.0` }), { status: 200 });
    };
    expect(await fetchLatest(ok, '1.0.0')).toMatchObject({ version: '1.2.0' });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe(LATEST_RELEASE_API);
    expect(seen[0]?.init?.method ?? 'GET').toBe('GET');
    expect(seen[0]?.init?.body).toBeUndefined();
    expect(seen[0]?.init?.credentials).toBe('omit');
    expect(JSON.stringify(seen[0]?.init?.headers)).not.toMatch(/authorization/i);
    expect(await fetchLatest(async () => new Response('', { status: 403 }), '1.0.0')).toBeNull();
    expect(await fetchLatest(async () => Promise.reject(new Error('offline')), '1.0.0')).toBeNull();
  });
});

describe('diagnostics', () => {
  it('removes keys, the token, home paths and anything that looks like page content', () => {
    const text = buildDiagnostics({
      version: '1.0.0',
      platform: 'win32',
      arch: 'x64',
      osRelease: '10',
      electron: '44',
      logLines: [`${homedir()}\\AppData\\Roaming\\Blackbook opened`, 'saved key gsk_ABCDEFGHIJKLMNOP1234', 'token tok-secret-123', '<p>Which choice completes the text?</p>'],
      facts: [],
      secrets: ['tok-secret-123'],
      home: homedir(),
    });
    expect(text).toContain('Version: 1.0.0');
    expect(text).not.toContain(homedir());
    expect(text).not.toContain('gsk_ABCDEFGH');
    expect(text).not.toContain('tok-secret-123');
    expect(text).not.toContain('Which choice');
  });
});

const hasBun = spawnSync(process.platform === 'win32' ? 'bun.exe' : 'bun', ['--version']).status === 0;

describe.skipIf(!hasBun)('smoke test against the real local program', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bb-smoke-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('starts, saves, stops, frees the port, restarts with the data, and stops again', async () => {
    const token = 'smoke-token-0123456789';
    const lines: string[] = [];
    const env: NodeJS.ProcessEnv = { ...process.env, BLACKBOOK_TOKEN: token, BLACKBOOK_TEST: '1' };
    const make = () =>
      new Sidecar({
        command: process.platform === 'win32' ? 'bun.exe' : 'bun',
        args: [join('server', 'main.ts'), '--control', '--port', '0', '--data-dir', dir],
        env,
        cipher: null,
        log: () => undefined,
        onCrash: () => lines.push('crash'),
      });
    const ok = await runSmokeTest({ makeSidecar: make, token, expectVersion: APP_VERSION, fetch: (i, init) => fetch(i, init), log: (l) => lines.push(l) });
    expect(lines.filter((l) => l.startsWith('FAIL'))).toEqual([
      // No --static here, so the page step is the one expected failure in this source-only run.
      expect.stringContaining('page served') as unknown as string,
    ]);
    expect(ok).toBe(false);
    expect(lines).toContain('PASS session still there after a restart');
    expect(lines).not.toContain('crash');
    const log = await readFile(join(dir, 'logs', 'blackbook.log'), 'utf8');
    expect(log).not.toContain(token);
  }, 60_000);

  it('a killed program is reported as a crash and leaves no port behind', async () => {
    let crashed = false;
    const s = new Sidecar({
      command: process.platform === 'win32' ? 'bun.exe' : 'bun',
      args: [join('server', 'main.ts'), '--control', '--port', '0', '--data-dir', dir],
      env: { ...process.env, BLACKBOOK_TOKEN: 'tok-0123456789', BLACKBOOK_TEST: '1' },
      cipher: null,
      log: () => undefined,
      onCrash: () => (crashed = true),
    });
    const ready = await s.start();
    process.kill(s.pid as number);
    for (let i = 0; i < 100 && !crashed; i++) await new Promise((r) => setTimeout(r, 50));
    expect(crashed).toBe(true);
    expect(await portIsFree(ready.port)).toBe(true);
    // The next start notices the unclean stop and checks the database.
    const again = new Sidecar({
      command: process.platform === 'win32' ? 'bun.exe' : 'bun',
      args: [join('server', 'main.ts'), '--control', '--port', '0', '--data-dir', dir],
      env: { ...process.env, BLACKBOOK_TOKEN: 'tok-0123456789', BLACKBOOK_TEST: '1' },
      cipher: null,
      log: () => undefined,
      onCrash: () => undefined,
    });
    const r2 = await again.start();
    expect(r2.startup).toMatchObject({ uncleanExit: true, integrity: 'ok' });
    await again.stop();
    expect(await portIsFree(r2.port)).toBe(true);
  }, 60_000);
});
