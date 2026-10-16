// bun run desktop: builds the page and the Electron shell, then opens the desktop app unpackaged.
// The local program runs from source with Bun. Data goes to data/desktop (git-ignored) unless
// --data-dir is given, so trying the app never touches the real per-user folder.

import { spawnSync, spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

const isWin = process.platform === 'win32';
const run = (cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run('bunx', ['vite', 'build']);
run('bun', ['scripts/build-electron.ts']);

const extra = process.argv.slice(2);
const args = ['.', ...(extra.includes('--data-dir') ? [] : ['--data-dir', resolve(join('data', 'desktop'))]), ...extra];
const env = { ...process.env };
// Some tools set this globally; it would make Electron run as plain Node.
delete env.ELECTRON_RUN_AS_NODE;
const electron = join('node_modules', 'electron', 'dist', isWin ? 'electron.exe' : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron');
const child = spawn(electron, args, { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
