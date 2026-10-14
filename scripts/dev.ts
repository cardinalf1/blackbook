// bun run dev: starts the local server and the Vite UI together, then opens the app.
// The access token is new on every start and is only ever in the first-load URL.
// Set BLACKBOOK_NO_OPEN=1 to skip opening a browser window.

import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const token = randomBytes(24).toString('base64url');
const url = `http://localhost:3000/?token=${token}`;
const children: ChildProcess[] = [];

function run(name: string, cmd: string, args: string[], env: Record<string, string> = {}): ChildProcess {
  const child = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env }, shell: process.platform === 'win32' });
  child.on('exit', (code) => {
    console.log(`[dev] ${name} exited (${code ?? 'signal'}). Stopping everything.`);
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

let stopping = false;
function shutdown(code: number): void {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill();
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('server', 'bun', ['server/main.ts', '--dev'], { BLACKBOOK_TOKEN: token });
run('ui', 'bunx', ['vite']);

setTimeout(() => {
  console.log(`\n[dev] Open Blackbook: ${url}\n[dev] (the link works once per start; after that the page keeps its session)\n`);
  if (process.env.BLACKBOOK_NO_OPEN === '1') return;
  const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', `"${url}"`]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    spawn(opener[0] as string, opener[1] as string[], { stdio: 'ignore', shell: process.platform === 'win32', detached: true }).unref();
  } catch {
    // opening a browser is a convenience; the link above is enough
  }
}, 2500);
