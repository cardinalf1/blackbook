// The Blackbook desktop app: Electron's main process.
//
// It starts the local program (the compiled Bun server, shipped beside the app) on 127.0.0.1 and a
// free port, gives the window a session cookie for it, and shows the page the program serves. It
// owns the window, the menu, single-instance behaviour, key encryption (safeStorage), the
// save-on-exit sequence and the crash screen. Design: docs/desktop-architecture.md.
//
//   Blackbook [--data-dir DIR] [--version] [--smoke-test]

import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, safeStorage, screen, session, shell, type IpcMainEvent, type IpcMainInvokeEvent, type MenuItemConstructorOptions } from 'electron';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { homedir, release, tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_VERSION } from '../src/version';
import { defaultDataFolder, resolveDataDir } from '../server/dataDir';
import { createLogger, logFile } from '../server/log';
import { cookieNameForPort } from '../server/security';
import { crashPageHtml, dataUrl } from './core/crashPage';
import { buildDiagnostics } from './core/diagnostics';
import { decideNavigation, isAllowedExternal, isAllowedRequest } from './core/navigation';
import { loadShellSettings, saveShellSettings, type ShellSettings } from './core/shellSettings';
import { runExitSequence, TIMED_TEST_DIALOG } from './core/shutdown';
import { Sidecar, SidecarFatal, type ShellCipher } from './core/sidecar';
import { runSmokeTest } from './core/smokeTest';
import { fetchLatest, isDue } from './core/updateCheck';
import { DEFAULT_SIZE, MIN_HEIGHT, MIN_WIDTH, restoreBounds } from './core/windowState';

// ---- arguments, before anything else ----

const argv = process.argv.slice(app.isPackaged ? 1 : 2);
const flag = (name: string) => argv.includes(name);
const flagValue = (name: string): string | null => {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] ?? null) : null;
};

if (flag('--version')) {
  process.stdout.write(`${APP_VERSION}\n`);
  app.exit(0);
}

const smokeTest = flag('--smoke-test');
const dataDir = smokeTest ? null : resolveDataDir({ flag: flagValue('--data-dir'), fallback: defaultDataFolder() });

// Electron's own files (caches, cookies) live in a subfolder, beside but apart from the user's data.
if (dataDir) app.setPath('userData', join(dataDir, 'shell'));
app.enableSandbox();

const log = createLogger({ path: logFile(dataDir ?? tmpdir(), smokeTest ? 'smoke.log' : 'shell.log'), echo: smokeTest || !app.isPackaged });

// ---- where the program and the page are ----

function sidecarCommand(): { command: string; args: string[] } {
  if (app.isPackaged) {
    const exe = process.platform === 'win32' ? 'blackbook-server.exe' : 'blackbook-server';
    return { command: join(process.resourcesPath, 'sidecar', exe), args: ['--static', join(process.resourcesPath, 'web')] };
  }
  // Unpackaged (`bun run desktop`): run the server source with Bun and serve the fresh web build.
  return { command: process.platform === 'win32' ? 'bun.exe' : 'bun', args: [join(app.getAppPath(), 'server', 'main.ts'), '--static', join(app.getAppPath(), 'dist')] };
}

const cipher: ShellCipher = {
  available: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
  decrypt: (b64) => safeStorage.decryptString(Buffer.from(b64, 'base64')),
};

function makeSidecar(folder: string, token: string, onCrash: (code: number | null, signal: string | null) => void): Sidecar {
  const { command, args } = sidecarCommand();
  const env: NodeJS.ProcessEnv = { ...process.env, BLACKBOOK_TOKEN: token };
  delete env.ELECTRON_RUN_AS_NODE;
  return new Sidecar({
    command,
    args: [...args, '--control', '--port', '0', '--data-dir', folder],
    env,
    cipher: smokeTest ? null : cipher,
    log: (line) => log.info(`[program] ${line}`),
    onCrash,
  });
}

// ---- smoke test: no window ----

async function smoke(): Promise<void> {
  const folder = await mkdtemp(join(tmpdir(), 'blackbook-smoke-'));
  const token = randomBytes(24).toString('base64url');
  log.info(`Smoke test ${APP_VERSION} on ${process.platform}-${process.arch}`);
  let ok = false;
  try {
    ok = await runSmokeTest({
      makeSidecar: () => makeSidecar(folder, token, (code) => log.error(`program stopped unexpectedly (${code})`)),
      token,
      expectVersion: APP_VERSION,
      fetch: (i, init) => fetch(i, init),
      log: (line) => log.info(line),
    });
  } catch (e) {
    log.error(`Smoke test crashed: ${e instanceof Error ? e.message : String(e)}`);
  }
  await rm(folder, { recursive: true, force: true }).catch(() => undefined);
  app.exit(ok ? 0 : 1);
}

// ---- the app ----

const token = randomBytes(24).toString('base64url');
log.addSecret(token);
let settingsPath = '';
let settings: ShellSettings;
let win: BrowserWindow | null = null;
let program: Sidecar | null = null;
let appOrigin: string | null = null;
let quitting: 'no' | 'running' | 'done' = 'no';
let lastDownload: string | null = null;
const facts: string[] = [];

const saveSettings = () => void saveShellSettings(settingsPath, settings).catch((e: unknown) => log.warn(`Could not save shell settings: ${String(e)}`));

function trusted(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  if (!win || e.sender !== win.webContents) return false;
  const url = e.senderFrame?.url ?? '';
  return (appOrigin !== null && url.startsWith(`${appOrigin}/`)) || url.startsWith('data:text/html');
}

let nextAsk = 1;
/** Sends `channel` to the page and waits for its reply on `replyChannel`, or `fallback` after `ms`. */
function askPage<T>(channel: string, replyChannel: string, ms: number, fallback: T): Promise<T> {
  const w = win;
  if (!w || w.isDestroyed() || appOrigin === null || !w.webContents.getURL().startsWith(appOrigin)) return Promise.resolve(fallback);
  const id = nextAsk++;
  return new Promise((resolve) => {
    const done = (v: T) => {
      clearTimeout(t);
      ipcMain.removeListener(replyChannel, onReply);
      resolve(v);
    };
    const onReply = (e: IpcMainEvent, rid: number, value: T) => {
      if (rid === id && trusted(e)) done(value);
    };
    const t = setTimeout(() => done(fallback), ms);
    ipcMain.on(replyChannel, onReply);
    w.webContents.send(channel, id);
  });
}

function showCrash(title: string, detail: string, canRestart: boolean): void {
  if (!win || win.isDestroyed()) return;
  appOrigin = null;
  void win.loadURL(dataUrl(crashPageHtml({ title, detail, canRestart })));
}

async function startProgram(): Promise<void> {
  if (!dataDir) return;
  program = makeSidecar(dataDir, token, (code, signal) => {
    facts.push(`Local program stopped unexpectedly (code ${code ?? signal ?? 'unknown'}) at ${new Date().toISOString()}.`);
    log.error(`Local program stopped unexpectedly (code ${code ?? signal ?? 'unknown'}).`);
    showCrash('Blackbook stopped working', 'The part of Blackbook that saves your work stopped unexpectedly. Your saved answers are safe. Press Restart to continue.', true);
  });
  try {
    const ready = await program.start();
    appOrigin = `http://127.0.0.1:${ready.port}`;
    facts.push(`Local program ${ready.version}, schema ${ready.schemaVersion}, started ${new Date().toISOString()}.`);
    // The page never sees the token: the shell sets the session cookie itself.
    await session.defaultSession.cookies.set({
      url: `${appOrigin}/api`,
      name: cookieNameForPort(ready.port),
      value: token,
      path: '/api',
      httpOnly: true,
      sameSite: 'strict',
    });
    await win?.loadURL(`${appOrigin}/`);
  } catch (e) {
    const fatal = e instanceof SidecarFatal ? e : new SidecarFatal('exited', e instanceof Error ? e.message : String(e));
    log.error(`Could not start the local program: ${fatal.message}`);
    if (fatal.code === 'newer-db') {
      dialog.showMessageBoxSync({ type: 'warning', title: 'Blackbook', message: 'This Blackbook is older than your saved progress', detail: fatal.message, buttons: ['Quit'] });
      quitting = 'done';
      app.quit();
      return;
    }
    showCrash('Blackbook could not start', fatal.message, true);
  }
}

function createWindow(): void {
  const saved = restoreBounds(settings.window.bounds, screen.getAllDisplays().map((d) => d.workArea));
  win = new BrowserWindow({
    ...(saved ?? DEFAULT_SIZE),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: '#0A0A0C',
    title: 'Blackbook',
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
      devTools: !app.isPackaged,
      navigateOnDragDrop: false,
    },
  });
  if (settings.window.maximized) win.maximize();
  win.once('ready-to-show', () => win?.show());
  win.webContents.on('did-finish-load', () => {
    if (appOrigin && win?.webContents.getURL().startsWith(appOrigin)) win.webContents.setZoomLevel(settings.zoomLevel);
  });
  const remember = () => {
    if (!win || win.isDestroyed()) return;
    settings.window = { bounds: win.isMaximized() || win.isMinimized() ? settings.window.bounds : win.getBounds(), maximized: win.isMaximized() };
  };
  win.on('resize', remember);
  win.on('move', remember);
  win.on('maximize', remember);
  win.on('unmaximize', remember);
  win.on('close', (e) => {
    remember();
    saveSettings();
    if (quitting === 'done') return;
    if (process.platform === 'darwin' && quitting === 'no') {
      // Mac convention: closing the window keeps the app in the dock. Save what the page holds first.
      e.preventDefault();
      void askPage('bb:flush', 'bb:flush-done', 3000, false).then(() => win?.hide());
      return;
    }
    e.preventDefault();
    void beginQuit();
  });
  // Windows sign-out or shutdown: no dialog, save as much as the system allows.
  win.on('session-end', () => void beginQuit({ noDialog: true }));
  win.on('closed', () => {
    win = null;
  });
  void startProgram();
}

/** The whole save-on-exit path. Shows the timed-test dialog unless told not to. */
async function beginQuit(opts: { noDialog?: boolean } = {}): Promise<void> {
  if (quitting !== 'no') return;
  quitting = 'running';
  if (!opts.noDialog && win && !win.isDestroyed()) {
    const state = await askPage('bb:query-state', 'bb:state', 1500, { timedTestInProgress: false });
    if (state.timedTestInProgress) {
      const choice = await dialog.showMessageBox(win, { type: 'question', ...TIMED_TEST_DIALOG, buttons: [...TIMED_TEST_DIALOG.buttons] });
      if (choice.response === TIMED_TEST_DIALOG.cancelId) {
        quitting = 'no';
        return;
      }
    }
  }
  const report = await runExitSequence({
    flushPage: () => askPage('bb:flush', 'bb:flush-done', 3000, false),
    prepareProgram: async () => {
      const r = await (program?.prepareExit() ?? Promise.resolve({ ok: true, snapshot: null }));
      if (!r.ok) throw new Error('prepare failed');
    },
    stopProgram: () => program?.stop() ?? Promise.resolve(),
  });
  log.info(`Exit: page ${report.page}, program ${report.program}, stop ${report.stop}${report.cutShort ? ', cut short' : ''}.`);
  saveSettings();
  quitting = 'done';
  app.quit();
}

function setZoom(step: 1 | -1 | 0): void {
  const wc = win?.webContents;
  if (!wc) return;
  const next = step === 0 ? 0 : Math.max(-3, Math.min(3, wc.getZoomLevel() + step * 0.5));
  wc.setZoomLevel(next);
  settings.zoomLevel = next;
  saveSettings();
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const nav = (page: 'help' | 'about') => () => {
    win?.show();
    win?.webContents.send('bb:navigate', page);
  };
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ label: 'Blackbook', submenu: [{ label: 'About Blackbook', click: nav('about') }, { type: 'separator' as const }, { role: 'hide' as const }, { role: 'hideOthers' as const }, { type: 'separator' as const }, { label: 'Quit Blackbook', accelerator: 'Cmd+Q', click: () => void beginQuit() }] }]
      : []),
    { label: 'File', submenu: [{ label: 'Quit', accelerator: isMac ? 'Cmd+Q' : 'Ctrl+Q', click: () => void beginQuit() }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => setZoom(1) },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => setZoom(-1) },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: () => setZoom(0) },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' as const }]),
      ],
    },
    { label: 'Help', submenu: [{ label: 'Blackbook Help', click: nav('help') }, ...(isMac ? [] : [{ label: 'About Blackbook', click: nav('about') }])] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function lockDown(): void {
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-navigate', (e, url) => {
      const d = decideNavigation(url, appOrigin);
      if (d === 'allow') return;
      e.preventDefault();
      if (d === 'external') void shell.openExternal(url);
    });
    wc.on('will-redirect', (e, url) => {
      if (decideNavigation(url, appOrigin) !== 'allow') e.preventDefault();
    });
    wc.setWindowOpenHandler(({ url }) => {
      if (isAllowedExternal(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });
    wc.on('will-attach-webview', (e) => e.preventDefault());
  });
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write'));
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'clipboard-sanitized-write');
  // The window may only reach the local program (and Desmos, inside its own frame). Everything else is blocked.
  ses.webRequest.onBeforeRequest((details, cb) => {
    const ok = isAllowedRequest(details.url, appOrigin);
    if (!ok) log.warn(`Blocked a request to ${details.url.split('?')[0]}`);
    cb({ cancel: !ok });
  });
  // A file the page offers as a download (the question-bank zip, a data export) goes where the user picks.
  ses.on('will-download', (_e, item) => {
    item.setSaveDialogOptions({ defaultPath: join(app.getPath('documents'), item.getFilename()) });
    item.once('done', (_ev, state) => {
      if (state === 'completed') lastDownload = item.getSavePath();
    });
  });
}

function registerIpc(): void {
  const handle = <A extends unknown[], R>(channel: string, fn: (...args: A) => R | Promise<R>) =>
    ipcMain.handle(channel, (e, ...args: unknown[]) => {
      if (!trusted(e)) throw new Error('Not allowed.');
      return fn(...(args as A));
    });
  handle('bb:version', () => ({ version: APP_VERSION, electron: process.versions.electron, platform: process.platform, arch: process.arch }));
  handle('bb:quit', () => void beginQuit());
  handle('bb:open-data-folder', async () => {
    if (dataDir) await shell.openPath(dataDir);
  });
  handle('bb:show-last-download', () => {
    if (!lastDownload || !existsSync(lastDownload)) return false;
    shell.showItemInFolder(lastDownload);
    return true;
  });
  handle('bb:open-external', async (url: unknown) => {
    if (typeof url !== 'string' || !isAllowedExternal(url)) return false;
    await shell.openExternal(url);
    return true;
  });
  handle('bb:copy-diagnostics', (pageLines: unknown) => {
    const lines: string[] = [];
    for (const name of ['blackbook.log', 'shell.log']) {
      try {
        lines.push(...readFileSync(logFile(dataDir ?? tmpdir(), name), 'utf8').split('\n').filter(Boolean).slice(-30).map((l) => `[${name}] ${l}`));
      } catch {
        // no log yet
      }
    }
    if (Array.isArray(pageLines)) lines.push(...pageLines.filter((l): l is string => typeof l === 'string').slice(-20).map((l) => `[page] ${l}`));
    clipboard.writeText(
      buildDiagnostics({ version: APP_VERSION, platform: process.platform, arch: process.arch, osRelease: release(), electron: process.versions.electron, logLines: lines, facts, secrets: [token], home: homedir() }),
    );
    return true;
  });
  const updateStatus = () => ({ enabled: settings.updateCheck, latest: settings.updateCheck ? settings.latest : null, lastCheckedAt: settings.lastUpdateCheckAt });
  handle('bb:update-status', updateStatus);
  handle('bb:set-update-check', (enabled: unknown) => {
    settings.updateCheck = enabled === true;
    saveSettings();
    if (settings.updateCheck) void checkForUpdate();
    return updateStatus();
  });
  handle('bb:restart-program', async () => {
    await program?.stop(2000);
    await startProgram();
  });
}

async function checkForUpdate(): Promise<void> {
  if (!settings.updateCheck || !isDue(settings.lastUpdateCheckAt, Date.now())) return;
  settings.lastUpdateCheckAt = Date.now();
  settings.latest = await fetchLatest((i, init) => fetch(i, init), APP_VERSION);
  saveSettings();
  log.info(`Update check: ${settings.latest ? `version ${settings.latest.version} is available` : 'up to date or unreachable'}.`);
}

if (smokeTest) {
  void app.whenReady().then(smoke);
} else if (!app.requestSingleInstanceLock()) {
  // Another Blackbook is open: it gets focus (second-instance below) and this one leaves quietly.
  app.exit(0);
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  app.on('before-quit', (e) => {
    if (quitting === 'done') return;
    e.preventDefault();
    void beginQuit();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') void beginQuit({ noDialog: true });
  });
  app.on('activate', () => {
    if (win) win.show();
    else if (quitting === 'no') createWindow();
  });
  void app.whenReady().then(async () => {
    settingsPath = join(dataDir as string, 'shell.json');
    settings = await loadShellSettings(settingsPath);
    log.info(`Blackbook ${APP_VERSION} starting (${process.platform}-${process.arch}, key encryption ${safeStorage.isEncryptionAvailable() ? 'available' : 'NOT available'}).`);
    lockDown();
    registerIpc();
    buildMenu();
    createWindow();
    setTimeout(() => void checkForUpdate(), 15_000);
  });
}
