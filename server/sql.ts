// A tiny SQLite interface the server codes against. In the app it is backed by Bun's built-in
// `bun:sqlite` (sqlBun.ts); Vitest runs on Node, so tests use Node's built-in `node:sqlite`
// (sqlNode.ts). Both are the same SQLite engine and both take positional `?` parameters.

export type SqlParam = string | number | null;

export interface SqlDb {
  exec(sql: string): void;
  run(sql: string, ...params: SqlParam[]): void;
  get<T>(sql: string, ...params: SqlParam[]): T | undefined;
  all<T>(sql: string, ...params: SqlParam[]): T[];
  close(): void;
}

/** Runs `fn` in one transaction: all of its writes land, or none do. */
export function transaction<T>(db: SqlDb, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** WAL journaling, foreign keys on, and a short wait instead of failing when the file is busy. */
export function configure(db: SqlDb): SqlDb {
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}
