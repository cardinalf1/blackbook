// Disk helpers shared by the sync script and the local server.

import { mkdir, open, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { CachedDetail, DetailCache } from '../src/services/sync/pipeline';

/** Writes to a temporary file, flushes it to disk, then renames over the target in one step. */
export async function writeAtomic(path: string, data: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  const fh = await open(tmp, 'w');
  try {
    await fh.writeFile(data, 'utf8');
    await fh.sync();
  } finally {
    await fh.close();
  }
  await rename(tmp, path);
}

/** Raw detail responses, one file per question, so a stopped download resumes. */
export class FsDetailCache implements DetailCache {
  constructor(readonly dir: string) {}

  private path(id: string): string {
    return join(this.dir, `${id.replace(/[^A-Za-z0-9_-]/g, '_')}.json`);
  }

  async get(id: string): Promise<CachedDetail | null> {
    try {
      const parsed = JSON.parse(await readFile(this.path(id), 'utf8')) as unknown;
      if (typeof parsed === 'object' && parsed !== null && 'updatedAt' in parsed && 'detail' in parsed) {
        const { updatedAt, detail } = parsed as { updatedAt: unknown; detail: unknown };
        if (typeof updatedAt === 'number') return { updatedAt, detail };
      }
      return null;
    } catch {
      return null;
    }
  }

  async put(id: string, entry: CachedDetail): Promise<void> {
    await writeAtomic(this.path(id), JSON.stringify(entry));
  }

  /** Total size on disk in bytes, and file count. Zero when the folder does not exist. */
  async size(): Promise<{ bytes: number; files: number }> {
    let bytes = 0;
    let files = 0;
    try {
      for (const name of await readdir(this.dir)) {
        if (!name.endsWith('.json')) continue;
        bytes += (await stat(join(this.dir, name))).size;
        files++;
      }
    } catch {
      // no cache yet
    }
    return { bytes, files };
  }

  async clear(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true });
  }
}
