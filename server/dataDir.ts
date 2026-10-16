// Where user data lives. The desktop app uses the per-user app-data folder, never the program
// folder, so reinstalling or updating never touches it:
//   Windows: %APPDATA%\Blackbook    Mac: ~/Library/Application Support/Blackbook
// `--data-dir DIR` or BLACKBOOK_DATA_DIR overrides it (tests and the smoke test use a temp folder).
// Under a test run (BLACKBOOK_TEST=1 or VITEST) anything outside the temp folder is refused, so a
// test can never write to someone's real progress.

import { homedir, tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

export const APP_FOLDER_NAME = 'Blackbook';

export function defaultDataFolder(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform, home = homedir()): string {
  if (platform === 'win32') return join(env.APPDATA ?? join(home, 'AppData', 'Roaming'), APP_FOLDER_NAME);
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', APP_FOLDER_NAME);
  return join(env.XDG_DATA_HOME ?? join(home, '.local', 'share'), APP_FOLDER_NAME);
}

export class DataDirRefused extends Error {
  constructor(dir: string) {
    super(`Refusing to use ${dir} during a test run: tests must use a folder inside the system temp folder.`);
    this.name = 'DataDirRefused';
  }
}

export function isTestRun(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BLACKBOOK_TEST === '1' || env.VITEST !== undefined;
}

function inside(child: string, parent: string): boolean {
  const c = resolve(child).toLowerCase();
  const p = resolve(parent).toLowerCase();
  return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep);
}

/**
 * The data folder: the explicit choice (flag, then environment), or `fallback` (the app-data
 * folder, or the repo's data/app in dev). Throws DataDirRefused for a test run outside temp.
 */
export function resolveDataDir(opts: { flag: string | null; env?: NodeJS.ProcessEnv; fallback: string; temp?: string }): string {
  const env = opts.env ?? process.env;
  const chosen = resolve(opts.flag ?? env.BLACKBOOK_DATA_DIR ?? opts.fallback);
  if (isTestRun(env) && !inside(chosen, opts.temp ?? tmpdir())) throw new DataDirRefused(chosen);
  return chosen;
}
