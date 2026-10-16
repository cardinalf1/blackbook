// The Groq key on disk. It lives in its own file inside the user-data folder (outside the repo when
// packaged; under the git-ignored data/ folder in dev), never in the database, so no export, backup
// or query can include it. In the desktop app it is encrypted with the operating system's key store;
// otherwise it is a plain file with owner-only permissions where the OS supports them (not on Windows).
// Nothing here logs the key or puts it in an error message.

import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { KeyProtection } from '../../src/types/keys';

const KEY_SHAPE = /^[A-Za-z0-9_-]{20,200}$/;

/**
 * Encryption backed by the operating system (Electron's safeStorage: DPAPI on Windows, the
 * Keychain on Mac). The desktop app provides it; without it keys fall back to an owner-only file.
 */
export interface KeyCipher {
  available(): Promise<boolean>;
  /** Returns base64 ciphertext. */
  encrypt(plain: string): Promise<string>;
  decrypt(base64: string): Promise<string>;
}

async function readText(path: string): Promise<string | null> {
  try {
    const t = (await readFile(path, 'utf8')).trim();
    return t === '' ? null : t;
  } catch {
    return null;
  }
}

async function writePrivate(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, { encoding: 'utf8', mode: 0o600 });
  try {
    await chmod(path, 0o600);
  } catch {
    // Windows ignores POSIX modes; the file is still under the user's own profile folder.
  }
}

export class KeyStore {
  private cached: string | null | undefined;
  private readonly encPath: string;

  /** `label` names the key in the one error message, e.g. "Groq key". */
  constructor(
    private readonly path: string,
    private readonly label = 'Groq key',
    private readonly cipher: KeyCipher | null = null,
  ) {
    this.encPath = `${path}.enc`;
  }

  /** Plain check of the shape only; the key is never echoed. */
  static isPlausible(key: string): boolean {
    return KEY_SHAPE.test(key.trim());
  }

  private async canEncrypt(): Promise<boolean> {
    if (!this.cipher) return false;
    try {
      return await this.cipher.available();
    } catch {
      return false;
    }
  }

  async get(): Promise<string | null> {
    if (this.cached !== undefined) return this.cached;
    let key: string | null = null;
    const sealed = await readText(this.encPath);
    if (sealed !== null && this.cipher) {
      try {
        key = (await this.cipher.decrypt(sealed)).trim() || null;
      } catch {
        key = null;
      }
    }
    if (key === null) {
      key = await readText(this.path);
      // A key saved before encryption was available: seal it now and remove the plain copy.
      if (key !== null && (await this.canEncrypt())) {
        try {
          await this.seal(key);
        } catch {
          // keep the plain file; it still works
        }
      }
    }
    this.cached = key;
    return key;
  }

  async has(): Promise<boolean> {
    return (await this.get()) !== null;
  }

  /** How the saved key is kept on disk, or null when there is none. */
  async protection(): Promise<KeyProtection | null> {
    if (!(await this.has())) return null;
    return (await readText(this.encPath)) !== null && (await readText(this.path)) === null ? 'encrypted' : 'file';
  }

  private async seal(k: string): Promise<void> {
    if (!this.cipher) throw new Error('No encryption available.');
    await writePrivate(this.encPath, await this.cipher.encrypt(k));
    await rm(this.path, { force: true });
  }

  async set(key: string): Promise<void> {
    const k = key.trim();
    if (!KeyStore.isPlausible(k)) throw new Error(`That does not look like a ${this.label}.`);
    if (await this.canEncrypt()) {
      await this.seal(k);
    } else {
      await writePrivate(this.path, k);
      await rm(this.encPath, { force: true });
    }
    this.cached = k;
  }

  async remove(): Promise<void> {
    await rm(this.path, { force: true });
    await rm(this.encPath, { force: true });
    this.cached = null;
  }
}

/** Replaces every occurrence of `key` in `text`. Used on anything that might reach a screen or log. */
export function redact(text: string, key: string | null): string {
  if (!key) return text;
  return text.split(key).join('[key removed]');
}
