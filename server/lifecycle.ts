// Start and stop rules for the user database, shared by the local server and its tests:
// - a database saved by a newer Blackbook is refused before anything touches it;
// - an older one is copied to the backups folder before any migration runs;
// - a marker file tells the next start that the program did not stop cleanly, and then the
//   database is checked for damage.

import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SqlDb } from './sql';
import { SCHEMA_VERSION } from './userDb';

export type SchemaCheck =
  | { kind: 'current'; version: number }
  | { kind: 'migrate'; from: number; to: number }
  | { kind: 'newer'; version: number; supported: number };

export function schemaVersionOf(db: SqlDb): number {
  return db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
}

export function checkSchema(db: SqlDb, supported = SCHEMA_VERSION): SchemaCheck {
  const v = schemaVersionOf(db);
  if (v > supported) return { kind: 'newer', version: v, supported };
  // Version 0 is a brand-new file: there is nothing to keep, so no copy.
  if (v > 0 && v < supported) return { kind: 'migrate', from: v, to: supported };
  return { kind: 'current', version: v };
}

export const NEWER_DB_MESSAGE =
  'Your progress was saved by a newer version of Blackbook than this one. To keep it safe, this version will not open it. Install the newest Blackbook from the release page, then open it again.';

/** Prefix of the copies written before a migration. Kept forever: there are only a few. */
export const MIGRATION_BACKUP_PREFIX = 'before-migration-v';

/**
 * Copies the whole database into `backupDir` before a migration, in one consistent step
 * (`VACUUM INTO` reads a snapshot, so it is safe while the file is open). Returns the file path.
 */
export async function backupBeforeMigration(db: SqlDb, backupDir: string, from: number, now: number): Promise<string> {
  await mkdir(backupDir, { recursive: true });
  const path = join(backupDir, `${MIGRATION_BACKUP_PREFIX}${from}-${now}.db`);
  db.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
  const st = await stat(path);
  if (st.size === 0) throw new Error('The copy made before updating your data is empty.');
  return path;
}

/** SQLite's own check of every page and index. 'ok' or the first problem it found. */
export function integrityCheck(db: SqlDb): 'ok' | string {
  const rows = db.all<{ integrity_check: string }>('PRAGMA integrity_check(1)');
  const first = rows[0]?.integrity_check ?? 'no answer';
  return first === 'ok' ? 'ok' : first;
}

/** Writes everything still in the write-ahead log into the main file, so the folder is self-contained. */
export function checkpoint(db: SqlDb): void {
  db.get('PRAGMA wal_checkpoint(TRUNCATE)');
}

/**
 * A file that exists only while the program runs. Finding it at start means the last run ended
 * without a clean stop (a crash, a killed process, or a power cut).
 */
export class RunMarker {
  constructor(private readonly path: string) {}

  /** Writes the marker. Returns true when the previous run did not stop cleanly. */
  async begin(pid: number): Promise<boolean> {
    let unclean = false;
    try {
      await stat(this.path);
      unclean = true;
    } catch {
      unclean = false;
    }
    await writeFile(this.path, String(pid), 'utf8');
    return unclean;
  }

  async end(): Promise<void> {
    await rm(this.path, { force: true });
  }
}

/** Moves a damaged database aside (with its -wal and -shm files) so a fresh one can start. Returns the new name. */
export async function setAsideDamaged(dbPath: string, now: number): Promise<string> {
  const aside = `${dbPath}.damaged-${now}`;
  await rename(dbPath, aside);
  for (const ext of ['-wal', '-shm']) {
    try {
      await rename(`${dbPath}${ext}`, `${aside}${ext}`);
    } catch {
      // not there
    }
  }
  return aside;
}
