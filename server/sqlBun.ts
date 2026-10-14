import { Database } from 'bun:sqlite';
import { configure, type SqlDb, type SqlParam } from './sql';

/** Opens (creating if needed) a database with Bun's built-in SQLite. Used by the app. */
export function openSqlite(path: string): SqlDb {
  const db = new Database(path, { create: true });
  return configure({
    exec: (sql) => db.exec(sql),
    run: (sql, ...p) => void db.prepare(sql).run(...p),
    get: <T>(sql: string, ...p: SqlParam[]) => (db.prepare(sql).get(...p) ?? undefined) as T | undefined,
    all: <T>(sql: string, ...p: SqlParam[]) => db.prepare(sql).all(...p) as T[],
    close: () => db.close(),
  });
}
