import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiClient } from '../src/services/api/client';
import { createSanitizer } from '../src/services/normalize/sanitize';
import { HttpPreferencesStore } from '../src/services/storage/http';
import type { PipelineDeps } from '../src/services/sync/pipeline';
import { createHandler } from './app';
import { DiskBankStore } from './bankStore';
import { DownloadManager } from './download';
import { FsDetailCache } from './files';
import { PreferencesService } from './preferences';
import type { SqlDb } from './sql';
import { openSqlite } from './sqlNode';
import { SqliteUserStore } from './userDb';

let dir: string;
let db: SqlDb | null = null;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bb-prefs-'));
});
afterEach(async () => {
  db?.close();
  db = null;
  await rm(dir, { recursive: true, force: true });
});

const HOST = '127.0.0.1:47821';
const TOKEN = 'test-token';

describe('preferences persistence (Step 2)', () => {
  it('loads empty preferences on first run', async () => {
    const prefs = new PreferencesService(dir);
    expect(await prefs.get()).toEqual({});
  });

  it('persists and reloads drill setup, browse filters, and tool preferences across relaunches', async () => {
    const prefs1 = new PreferencesService(dir);
    await prefs1.update({
      drillSetup: {
        section: 'math',
        domainCode: 'algebra',
        difficulties: ['H', 'M'],
        countInput: '15',
        liveOnly: false,
        askConfidence: true,
      },
      browseFilters: {
        section: 'rw',
        difficulty: 'E',
        query: 'inference',
      },
      toolPreferences: {
        lineReaderLines: 5,
        calculatorMode: 'scientific',
        zoomIndex: 3,
      },
      // disallowed key ignored
      hackerKey: 'attack',
    });

    // Simulate relaunching the app with fresh service instance
    const prefs2 = new PreferencesService(dir);
    const loaded = await prefs2.get();
    expect(loaded).toEqual({
      drillSetup: {
        section: 'math',
        domainCode: 'algebra',
        difficulties: ['H', 'M'],
        countInput: '15',
        liveOnly: false,
        askConfidence: true,
      },
      browseFilters: {
        section: 'rw',
        difficulty: 'E',
        query: 'inference',
      },
      toolPreferences: {
        lineReaderLines: 5,
        calculatorMode: 'scientific',
        zoomIndex: 3,
      },
    });
    expect((loaded as Record<string, unknown>).hackerKey).toBeUndefined();
  });

  it('HTTP adapter /api/preferences round-trips correctly', async () => {
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
        const req = new Request(input, { ...init, headers });
        return handler(req);
      },
    });

    const store = new HttpPreferencesStore(api);
    expect(await store.get()).toEqual({});

    await store.update({
      drillSetup: { section: 'rw', countInput: '20' },
      toolPreferences: { zoomIndex: 4 },
    });

    const refreshed = await store.get();
    expect(refreshed.drillSetup?.section).toBe('rw');
    expect(refreshed.drillSetup?.countInput).toBe('20');
    expect(refreshed.toolPreferences?.zoomIndex).toBe(4);
  });
});
