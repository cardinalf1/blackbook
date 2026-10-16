// Starts the local Blackbook server: bun server/main.ts [--dev] [--port N] [--data DIR] [--token T] [--idle-minutes N]
//
// Binds to 127.0.0.1 only. In dev the UI comes from Vite on port 3000, which proxies /api here.

import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { createSanitizer } from '../src/services/normalize/sanitize';
import type { PipelineDeps } from '../src/services/sync/pipeline';
import { createHandler } from './app';
import { DiskBankStore } from './bankStore';
import { BackupManager } from './backups';
import { AiService } from './ai/service';
import { KeyStore } from './ai/keyStore';
import { DownloadManager } from './download';
import { FsDetailCache } from './files';
import { createIdleMonitor } from './idle';
import { openSqlite } from './sqlBun';
import { SqliteUserStore } from './userDb';
import { SqlAnalytics } from './analytics';

export const DEFAULT_PORT = 47821;
export const DEV_UI_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

interface Args {
  dev: boolean;
  port: number;
  data: string | null;
  token: string | null;
  idleMinutes: number | null;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { dev: false, port: DEFAULT_PORT, data: null, token: process.env.BLACKBOOK_TOKEN ?? null, idleMinutes: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--dev') a.dev = true;
    else if (k === '--port') a.port = Number(argv[++i]);
    else if (k === '--data') a.data = argv[++i] ?? null;
    else if (k === '--token') a.token = argv[++i] ?? null;
    else if (k === '--idle-minutes') a.idleMinutes = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${k}`);
  }
  if (!Number.isInteger(a.port) || a.port <= 0 || a.port > 65535) throw new Error('--port must be a port number');
  return a;
}

/** Per-user data folder outside the project, used when running as the packaged app. */
export function defaultDataFolder(): string {
  if (process.platform === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Blackbook');
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'Blackbook');
  return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'blackbook');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dataFolder = resolve(args.data ?? (args.dev ? join('data', 'app') : defaultDataFolder()));
  await mkdir(dataFolder, { recursive: true });
  const token = args.token ?? randomBytes(24).toString('base64url');

  const { window } = new JSDOM('');
  const pipelineWindow = window as unknown as PipelineDeps['window'];
  const bank = new DiskBankStore(join(dataFolder, 'bank.json'));
  const db = openSqlite(join(dataFolder, 'user.db'));
  const users = new SqliteUserStore(db);
  const backups = new BackupManager(join(dataFolder, 'backups'), users);
  try {
    const made = await backups.snapshotIfDue();
    if (made) console.log(`Backup written: ${made}`);
  } catch (e) {
    console.error(`Could not write today's backup: ${e instanceof Error ? e.message : String(e)}`);
  }
  const analytics = new SqlAnalytics(db, { load: () => bank.analyticsMeta() });
  const cache = new FsDetailCache(join(dataFolder, 'raw'));
  const downloads = new DownloadManager({ bank, cache, window: pipelineWindow, fetch: (i, init) => fetch(i, init), dataFolder });
  await downloads.refreshCacheSize();

  const ownOrigins = [`http://127.0.0.1:${args.port}`, `http://localhost:${args.port}`];
  const idleMinutes = args.idleMinutes ?? (args.dev ? 0 : 20);
  let server: BunServer | null = null;
  const idle =
    idleMinutes > 0
      ? createIdleMonitor({
          timeoutMs: idleMinutes * 60_000,
          isBusy: () => downloads.isRunning(),
          onIdle: () => {
            console.log(`No activity for ${idleMinutes} minutes. Shutting down.`);
            server?.stop(true);
            process.exit(0);
          },
        })
      : null;

  const handler = createHandler({
    security: {
      token,
      allowedHosts: new Set(ownOrigins.map((o) => o.replace('http://', ''))),
      allowedOrigins: new Set([...ownOrigins, ...(args.dev ? DEV_UI_ORIGINS : [])]),
    },
    bank,
    users,
    backups,
    ai: new AiService({ users, bank, analytics, keys: new KeyStore(join(dataFolder, 'secrets', 'groq-key')), fetch: (i, init) => fetch(i, init) }),
    analytics,
    downloads,
    sanitize: createSanitizer(window as unknown as Parameters<typeof createSanitizer>[0]),
    dataFolder,
    onActivity: () => idle?.touch(),
  });

  try {
    server = Bun.serve({ port: args.port, hostname: '127.0.0.1', idleTimeout: 0, fetch: handler });
  } catch (e) {
    throw new Error(`Port ${args.port} is busy. Is Blackbook already running? (${e instanceof Error ? e.message : String(e)})`);
  }
  console.log(`Blackbook server on http://127.0.0.1:${server.port} (data: ${dataFolder}${idle ? `, idle shutdown after ${idleMinutes} min` : ''})`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
