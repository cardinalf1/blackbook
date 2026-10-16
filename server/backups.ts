// Rolling snapshots of user data. One per day at most, the last 7 kept, written when the program
// starts. A snapshot is the same JSON as "Export my data": sessions, attempts, events, flags and
// mistake tags. It never holds the question bank and never a key. Before a restore replaces the
// current data, a safety copy of that data is written too (the last 3 are kept).

import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BackupInfo, BackupList, RestoreResult } from '../src/types/backup';
import type { UserDataExport } from '../src/types/session';
import { parseUserData, type ValidatedUserData } from './validate';

export const DAILY_KEEP = 7;
/** Safety copies (before a restore or a delete) kept, newest first. */
export const SAFETY_KEEP = 5;
/** Snapshots written when the app closes, kept newest first. */
export const EXIT_KEEP = 3;

const DAILY = /^blackbook-(\d{4}-\d{2}-\d{2})\.json$/;
const SAFETY = /^before-(restore|delete-all|delete-events)-(\d+)\.json$/;
const EXIT = /^on-exit-(\d+)\.json$/;

/** Actions that replace or remove user data; each gets a safety copy first. */
export type DestructiveAction = 'restore' | 'delete-all' | 'delete-events';

export interface BackupSource {
  exportAll(): Promise<UserDataExport>;
  replaceAll(data: ValidatedUserData): Promise<void>;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dayStamp = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export class BackupManager {
  constructor(
    private readonly dir: string,
    private readonly source: BackupSource,
    private readonly now: () => number = Date.now,
  ) {}

  private async write(name: string, data: UserDataExport): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const tmp = join(this.dir, `${name}.tmp`);
    await writeFile(tmp, JSON.stringify(data), 'utf8');
    await rename(tmp, join(this.dir, name));
  }

  private async names(): Promise<string[]> {
    try {
      return await readdir(this.dir);
    } catch {
      return [];
    }
  }

  private async prune(): Promise<void> {
    const files = await this.names();
    const daily = files.filter((f) => DAILY.test(f)).sort();
    const safety = files.filter((f) => SAFETY.test(f)).sort((a, b) => Number(SAFETY.exec(a)?.[2]) - Number(SAFETY.exec(b)?.[2]));
    const exits = files.filter((f) => EXIT.test(f)).sort((a, b) => Number(EXIT.exec(a)?.[1]) - Number(EXIT.exec(b)?.[1]));
    const doomed = [
      ...daily.slice(0, Math.max(0, daily.length - DAILY_KEEP)),
      ...safety.slice(0, Math.max(0, safety.length - SAFETY_KEEP)),
      ...exits.slice(0, Math.max(0, exits.length - EXIT_KEEP)),
    ];
    for (const f of doomed) await rm(join(this.dir, f), { force: true });
  }

  /** Writes today's snapshot unless one exists. Returns its name, or null when there is one already. */
  async snapshotIfDue(): Promise<string | null> {
    const name = `blackbook-${dayStamp(this.now())}.json`;
    if ((await this.names()).includes(name)) return null;
    await this.write(name, await this.source.exportAll());
    await this.prune();
    return name;
  }

  /**
   * Written when the app closes normally, so the newest work is in a snapshot too. Like a safety
   * copy, nothing is written when there is nothing to keep. Returns the name, or null.
   */
  async snapshotOnExit(): Promise<string | null> {
    const data = await this.source.exportAll();
    const empty = data.sessions.length + data.attempts.length + data.events.length + (data.mistakeTags?.length ?? 0) + (data.flags?.length ?? 0) === 0;
    if (empty) return null;
    const name = `on-exit-${this.now()}.json`;
    await this.write(name, data);
    await this.prune();
    return name;
  }

  async list(): Promise<BackupList> {
    const backups: BackupInfo[] = [];
    for (const name of await this.names()) {
      const safety = SAFETY.exec(name);
      const exit = EXIT.exec(name);
      const kind = DAILY.test(name) ? 'daily' : safety ? (safety[1] === 'restore' ? 'before_restore' : 'before_delete') : exit ? 'on_exit' : null;
      if (!kind) continue;
      const st = await stat(join(this.dir, name));
      const at = safety ? Number(safety[2]) : exit ? Number(exit[1]) : Math.round(st.mtimeMs);
      backups.push({ name, at, sizeBytes: st.size, kind });
    }
    backups.sort((a, b) => b.at - a.at);
    return { backups, lastBackupAt: backups[0]?.at ?? null };
  }

  /**
   * Saves the current data before `action` replaces or removes it. Throws when it cannot be written,
   * so the caller does not go ahead. Writes nothing when there is nothing to lose (no sessions,
   * attempts, events, tags or flags), so empty copies never push real ones out of the keep limit.
   * Returns the file name, or null when nothing was written.
   */
  async safetyCopy(action: DestructiveAction): Promise<string | null> {
    const data = await this.source.exportAll();
    const empty = data.sessions.length + data.attempts.length + data.events.length + (data.mistakeTags?.length ?? 0) + (data.flags?.length ?? 0) === 0;
    if (empty) return null;
    const name = `before-${action}-${this.now()}.json`;
    await this.write(name, data);
    await this.prune();
    return name;
  }

  /** Replaces current data with `raw` (a parsed export or snapshot) after saving a safety copy. */
  async restore(raw: unknown): Promise<RestoreResult> {
    const data = parseUserData(raw);
    if (typeof data === 'string') throw new BackupError(data);
    await this.safetyCopy('restore');
    await this.source.replaceAll(data);
    await this.prune();
    return { sessions: data.sessions.length, attempts: data.attempts.length, events: data.events.length, mistakeTags: data.mistakeTags.length };
  }

  async restoreSnapshot(name: string): Promise<RestoreResult> {
    if (!DAILY.test(name) && !SAFETY.test(name) && !EXIT.test(name)) throw new BackupError('That backup was not found.');
    let text: string;
    try {
      text = await readFile(join(this.dir, name), 'utf8');
    } catch {
      throw new BackupError('That backup was not found.');
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      throw new BackupError('That backup file is damaged.');
    }
    return this.restore(raw);
  }
}
