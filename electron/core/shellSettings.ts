// The desktop shell's own settings, in `shell.json` in the data folder: window state, the page
// zoom from the View menu, the update-check switch and its last result. Written atomically.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseWindowState, type WindowState } from './windowState';
import type { UpdateInfo } from './updateCheck';

export interface ShellSettings {
  window: WindowState;
  /** Electron zoom level (0 = 100%). */
  zoomLevel: number;
  updateCheck: boolean;
  lastUpdateCheckAt: number | null;
  latest: UpdateInfo | null;
}

export const DEFAULT_SHELL_SETTINGS: ShellSettings = {
  window: { bounds: null, maximized: false },
  zoomLevel: 0,
  updateCheck: true,
  lastUpdateCheckAt: null,
  latest: null,
};

export function parseShellSettings(raw: unknown): ShellSettings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SHELL_SETTINGS };
  const r = raw as Record<string, unknown>;
  const zoom = typeof r.zoomLevel === 'number' && Number.isFinite(r.zoomLevel) ? Math.max(-3, Math.min(3, r.zoomLevel)) : 0;
  const latestRaw = r.latest as { version?: unknown; url?: unknown } | null | undefined;
  const latest =
    latestRaw && typeof latestRaw.version === 'string' && typeof latestRaw.url === 'string' && latestRaw.url.startsWith('https://github.com/')
      ? { version: latestRaw.version, url: latestRaw.url }
      : null;
  const window: WindowState = parseWindowState(r.window);
  return {
    window,
    zoomLevel: zoom,
    updateCheck: r.updateCheck !== false,
    lastUpdateCheckAt: typeof r.lastUpdateCheckAt === 'number' ? r.lastUpdateCheckAt : null,
    latest,
  };
}

export async function loadShellSettings(path: string): Promise<ShellSettings> {
  try {
    return parseShellSettings(JSON.parse(await readFile(path, 'utf8')) as unknown);
  } catch {
    return { ...DEFAULT_SHELL_SETTINGS };
  }
}

export async function saveShellSettings(path: string, s: ShellSettings): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(s, null, 2), 'utf8');
  await rename(tmp, path);
}
