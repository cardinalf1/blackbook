// Starts the local Blackbook server:
//   bun server/main.ts [--dev] [--port N] [--data-dir DIR] [--token T] [--idle-minutes N]
//                      [--static DIR] [--control] [--version]
//
// Binds to 127.0.0.1 only. In dev the UI comes from Vite on port 3000, which proxies /api here.
// In the desktop app Electron starts the compiled program with --control --port 0 --static DIR:
// it picks a free port, serves the built page, reports the port over the control line, and stops
// cleanly when Electron closes the line (server/control.ts).

import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { createSanitizer } from '../src/services/normalize/sanitize';
import type { PipelineDeps } from '../src/services/sync/pipeline';
import { APP_VERSION } from '../src/version';
import { DashboardService } from './dashboard';
import { createHandler } from './app';
import { DiskBankStore } from './bankStore';
import { BackupManager } from './backups';
import { AiService } from './ai/service';
import { KeyStore, type KeyCipher } from './ai/keyStore';
import { CalculatorService } from './calculator';
import { channelCipher, ControlChannel, encodeLine, type StartupReport } from './control';
import { defaultDataFolder, resolveDataDir } from './dataDir';
import { DownloadManager } from './download';
import { FsDetailCache } from './files';
import { createIdleMonitor } from './idle';
import { backupBeforeMigration, checkpoint, checkSchema, integrityCheck, NEWER_DB_MESSAGE, RunMarker, setAsideDamaged } from './lifecycle';
import { createLogger, logFile } from './log';
import { cookieNameForPort } from './security';
import type { SqlDb } from './sql';
import { openSqlite } from './sqlBun';
import { createStaticHandler } from './staticFiles';
import { SCHEMA_VERSION, SqliteUserStore } from './userDb';
import { SqlAnalytics } from './analytics';

export const DEFAULT_PORT = 47821;
export const DEV_UI_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

export { defaultDataFolder };

interface Args {
  dev: boolean;
  port: number | null;
  data: string | null;
  token: string | null;
  idleMinutes: number | null;
  staticDir: string | null;
  control: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { dev: false, port: null, data: null, token: process.env.BLACKBOOK_TOKEN ?? null, idleMinutes: null, staticDir: null, control: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--dev') a.dev = true;
    else if (k === '--port') a.port = Number(argv[++i]);
    else if (k === '--data' || k === '--data-dir') a.data = argv[++i] ?? null;
    else if (k === '--token') a.token = argv[++i] ?? null;
    else if (k === '--idle-minutes') a.idleMinutes = Number(argv[++i]);
    else if (k === '--static') a.staticDir = argv[++i] ?? null;
    else if (k === '--control') a.control = true;
    else if (k === '--version') a.version = true;
    else throw new Error(`Unknown argument: ${k}`);
  }
  if (a.port !== null && (!Number.isInteger(a.port) || a.port < 0 || a.port > 65535)) throw new Error('--port must be a port number (0 picks a free one)');
  return a;
}

function nodeControlIo() {
  process.stdin.setEncoding('utf8');
  return {
    write: (t: string) => void process.stdout.write(t),
    onData: (fn: (c: string) => void) => void process.stdin.on('data', (c: string) => fn(c)),
    onEnd: (fn: () => void) => {
      process.stdin.on('end', fn);
      process.stdin.on('close', fn);
    },
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.version) {
    console.log(APP_VERSION);
    return;
  }
  const dataFolder = resolveDataDir({ flag: args.data, fallback: args.dev ? join('data', 'app') : defaultDataFolder() });
  await mkdir(dataFolder, { recursive: true });
  const log = createLogger({ path: logFile(dataFolder), echo: !args.control });
  const token = args.token ?? randomBytes(24).toString('base64url');
  log.addSecret(token);

  const control = args.control ? new ControlChannel(nodeControlIo()) : null;
  const fatal = (code: 'newer-db' | 'start', message: string): never => {
    log.error(`Start refused: ${message}`);
    if (control) process.stdout.write(encodeLine({ type: 'fatal', code, message }));
    else console.error(message);
    process.exit(code === 'newer-db' ? 3 : 1);
  };

  // ---- the database: refuse newer, back up before migrating, check after an unclean stop ----
  const dbPath = join(dataFolder, 'user.db');
  const backupDir = join(dataFolder, 'backups');
  const marker = new RunMarker(join(dataFolder, 'running.lock'));
  const uncleanExit = await marker.begin(process.pid);
  const startup: StartupReport = { uncleanExit, integrity: 'not-checked', setAside: null, latestBackup: null, migrationBackup: null };
  let db: SqlDb = openSqlite(dbPath);
  if (uncleanExit) {
    log.warn('The last run did not stop cleanly. Checking the database.');
    let result: string;
    try {
      result = integrityCheck(db);
    } catch (e) {
      result = e instanceof Error ? e.message : String(e);
    }
    startup.integrity = result === 'ok' ? 'ok' : 'failed';
    if (result !== 'ok') {
      log.error(`Database check failed (${result}). Setting it aside and starting a fresh one.`);
      db.close();
      startup.setAside = await setAsideDamaged(dbPath, Date.now());
      db = openSqlite(dbPath);
    }
  }
  const schema = checkSchema(db);
  if (schema.kind === 'newer') {
    db.close();
    await marker.end();
    fatal('newer-db', NEWER_DB_MESSAGE);
  }
  if (schema.kind === 'migrate') {
    try {
      startup.migrationBackup = await backupBeforeMigration(db, backupDir, schema.from, Date.now());
      log.info(`Copied the database before updating it from version ${schema.from} to ${schema.to}.`);
    } catch (e) {
      db.close();
      await marker.end();
      fatal('start', `Could not copy your data before updating it, so nothing was changed. (${e instanceof Error ? e.message : String(e)})`);
    }
  }

  const { window } = new JSDOM('');
  const pipelineWindow = window as unknown as PipelineDeps['window'];
  const bank = new DiskBankStore(join(dataFolder, 'bank.json'));
  const users = new SqliteUserStore(db);
  const backups = new BackupManager(backupDir, users);
  try {
    const made = await backups.snapshotIfDue();
    if (made) log.info(`Backup written: ${made}`);
  } catch (e) {
    log.error(`Could not write today's backup: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (startup.integrity === 'failed') startup.latestBackup = (await backups.list()).backups[0]?.name ?? null;
  const analytics = new SqlAnalytics(db, { load: () => bank.analyticsMeta() });
  const cache = new FsDetailCache(join(dataFolder, 'raw'));
  const downloads = new DownloadManager({ bank, cache, window: pipelineWindow, fetch: (i, init) => fetch(i, init), dataFolder });
  await downloads.refreshCacheSize();

  // The desktop app owns the lifetime; idle shutdown is for the browser launcher only.
  const idleMinutes = args.control ? 0 : (args.idleMinutes ?? (args.dev ? 0 : 20));
  let server: BunServer | null = null;
  let stopping: Promise<void> | null = null;
  let exitSnapshotDone = false;

  /** Finishes writes, writes the exit snapshot once, and folds the log into the database file. */
  const prepareExit = async (): Promise<string | null> => {
    downloads.cancel();
    await Promise.race([downloads.settled(), new Promise((r) => setTimeout(r, 3000))]);
    let snapshot: string | null = null;
    if (!exitSnapshotDone) {
      exitSnapshotDone = true;
      snapshot = await backups.snapshotOnExit();
    }
    checkpoint(db);
    return snapshot;
  };

  const stop = (reason: string): Promise<void> =>
    (stopping ??= (async () => {
      log.info(`Stopping (${reason}).`);
      try {
        await prepareExit();
      } catch (e) {
        log.error(`Exit snapshot failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      try {
        db.close();
      } catch {
        // already closed
      }
      await marker.end();
      server?.stop(true);
      process.exit(0);
    })());

  const idle =
    idleMinutes > 0
      ? createIdleMonitor({
          timeoutMs: idleMinutes * 60_000,
          isBusy: () => downloads.isRunning(),
          onIdle: () => void stop(`no activity for ${idleMinutes} minutes`),
        })
      : null;

  const cipher: KeyCipher | null = control ? channelCipher(control) : null;
  const groqKeys = new KeyStore(join(dataFolder, 'secrets', 'groq-key'), 'Groq key', cipher);
  const desmosKeys = new KeyStore(join(dataFolder, 'secrets', 'desmos-key'), 'Desmos key', cipher);
  const ai = new AiService({ users, bank, analytics, keys: groqKeys, fetch: (i, init) => fetch(i, init) });

  const allowedHosts = new Set<string>();
  const allowedOrigins = new Set<string>(args.dev ? DEV_UI_ORIGINS : []);
  const security = { token, allowedHosts, allowedOrigins, cookieName: 'bb_session' };
  const handler = createHandler({
    security,
    bank,
    users,
    backups,
    ai,
    calculator: new CalculatorService({ keys: desmosKeys, fetch: (i, init) => fetch(i, init) }),
    analytics,
    dashboard: new DashboardService({
      analytics,
      users,
      bank,
      aiAvailable: async () => {
        const s = await ai.status();
        return s.hasKey && s.settings.enabled;
      },
    }),
    downloads,
    sanitize: createSanitizer(window as unknown as Parameters<typeof createSanitizer>[0]),
    dataFolder,
    startup,
    version: APP_VERSION,
    desktop: args.control,
    health: { version: APP_VERSION, schemaVersion: SCHEMA_VERSION },
    ...(args.staticDir ? { staticFiles: createStaticHandler(args.staticDir) } : {}),
    onActivity: () => idle?.touch(),
  });

  const port = args.port ?? (args.control ? 0 : DEFAULT_PORT);
  try {
    server = Bun.serve({ port, hostname: '127.0.0.1', idleTimeout: 0, fetch: handler });
  } catch (e) {
    await marker.end();
    fatal('start', `Port ${port} is busy. Is Blackbook already running? (${e instanceof Error ? e.message : String(e)})`);
  }
  const actual = server?.port ?? port;
  for (const host of [`127.0.0.1:${actual}`, `localhost:${actual}`]) {
    allowedHosts.add(host);
    allowedOrigins.add(`http://${host}`);
  }
  security.cookieName = cookieNameForPort(actual);

  process.on('SIGINT', () => void stop('interrupted'));
  process.on('SIGTERM', () => void stop('terminated'));
  if (control) {
    control.onPrepareExit((id) => {
      prepareExit()
        .then((snapshot) => control.send({ type: 'exit-ready', id, snapshot, ok: true }))
        .catch((e: unknown) => {
          log.error(`Prepare for exit failed: ${e instanceof Error ? e.message : String(e)}`);
          control.send({ type: 'exit-ready', id, snapshot: null, ok: false });
        });
    });
    control.onClosed(() => void stop('the app closed'));
    control.send({ type: 'ready', port: actual, version: APP_VERSION, schemaVersion: SCHEMA_VERSION, startup });
  }
  const shownFolder = dataFolder.startsWith(homedir()) ? `~${dataFolder.slice(homedir().length)}` : dataFolder;
  log.info(`Blackbook ${APP_VERSION} on http://127.0.0.1:${actual} (data: ${shownFolder}${idle ? `, idle shutdown after ${idleMinutes} min` : ''})`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
