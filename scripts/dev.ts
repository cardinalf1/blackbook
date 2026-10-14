// bun run dev: starts the local server and the Vite UI together, then opens the app.
// The access token is new on every `bun run dev` and is only ever in the first-load URL.
// Set BLACKBOOK_NO_OPEN=1 to skip opening a browser window.
//
// While it runs, type in this terminal:
//   k + Enter  stop the local server (the UI keeps running; use this to test lost-connection handling)
//   s + Enter  start the local server again with the same access key
// Ctrl+C stops everything.

import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';

const token = randomBytes(24).toString('base64url');
const url = `http://localhost:3000/?token=${token}`;
const isWin = process.platform === 'win32';

let stopping = false;
let server: ChildProcess | null = null;
let ui: ChildProcess | null = null;

function shutdown(code: number): void {
  if (stopping) return;
  stopping = true;
  for (const c of [server, ui]) if (c && c.exitCode === null) c.kill();
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function startServer(): void {
  if (server && server.exitCode === null) {
    console.log('[dev] The server is already running.');
    return;
  }
  const child = spawn('bun', ['server/main.ts', '--dev'], { stdio: 'inherit', env: { ...process.env, BLACKBOOK_TOKEN: token }, shell: isWin });
  child.on('exit', (code) => {
    if (stopping) return;
    console.log(`[dev] Server stopped (${code ?? 'signal'}). Type s + Enter to start it again, or Ctrl+C to quit.`);
  });
  server = child;
}

function stopServer(): void {
  if (!server || server.exitCode !== null) {
    console.log('[dev] The server is not running.');
    return;
  }
  // On Windows the server runs under a shell; kill the whole tree so the port is freed.
  if (isWin && server.pid !== undefined) spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else server.kill();
}

startServer();
ui = spawn('bunx', ['vite'], { stdio: 'inherit', shell: isWin });
ui.on('exit', (code) => {
  console.log(`[dev] UI exited (${code ?? 'signal'}). Stopping everything.`);
  shutdown(code ?? 0);
});

createInterface({ input: process.stdin }).on('line', (line) => {
  const cmd = line.trim().toLowerCase();
  if (cmd === 'k') stopServer();
  else if (cmd === 's') startServer();
});

setTimeout(() => {
  console.log(`\n[dev] Open Blackbook: ${url}\n[dev] (the link works once per start; after that the page keeps its session)`);
  console.log('[dev] Type k + Enter to stop the server, s + Enter to start it again, Ctrl+C to quit.\n');
  if (process.env.BLACKBOOK_NO_OPEN === '1') return;
  const opener = isWin ? ['cmd', ['/c', 'start', '""', `"${url}"`]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    spawn(opener[0] as string, opener[1] as string[], { stdio: 'ignore', shell: isWin, detached: true }).unref();
  } catch {
    // opening a browser is a convenience; the link above is enough
  }
}, 2500);
