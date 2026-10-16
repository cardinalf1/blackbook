// The Groq key on disk. It lives in its own file inside the user-data folder (outside the repo when
// packaged; under the git-ignored data/ folder in dev), never in the database, so no export, backup
// or query can include it. Owner-only permissions where the OS supports them (not on Windows).
// Nothing here logs the key or puts it in an error message.

import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const KEY_SHAPE = /^[A-Za-z0-9_-]{20,200}$/;

export class KeyStore {
  private cached: string | null | undefined;

  constructor(private readonly path: string) {}

  /** Plain check of the shape only; the key is never echoed. */
  static isPlausible(key: string): boolean {
    return KEY_SHAPE.test(key.trim());
  }

  async get(): Promise<string | null> {
    if (this.cached !== undefined) return this.cached;
    try {
      const k = (await readFile(this.path, 'utf8')).trim();
      this.cached = k === '' ? null : k;
    } catch {
      this.cached = null;
    }
    return this.cached;
  }

  async has(): Promise<boolean> {
    return (await this.get()) !== null;
  }

  async set(key: string): Promise<void> {
    const k = key.trim();
    if (!KeyStore.isPlausible(k)) throw new Error('That does not look like a Groq key.');
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, k, { encoding: 'utf8', mode: 0o600 });
    try {
      await chmod(this.path, 0o600);
    } catch {
      // Windows ignores POSIX modes; the file is still under the user's own profile folder.
    }
    this.cached = k;
  }

  async remove(): Promise<void> {
    await rm(this.path, { force: true });
    this.cached = null;
  }
}

/** Replaces every occurrence of `key` in `text`. Used on anything that might reach a screen or log. */
export function redact(text: string, key: string | null): string {
  if (!key) return text;
  return text.split(key).join('[key removed]');
}
