import { createRequire } from 'node:module';
import { configure, type SqlDb, type SqlParam } from './sql';

const req = createRequire(import.meta.url);

/** Opens (creating if needed) a database with Node's built-in SQLite. Used by tests under Vitest. */
export function openSqlite(path: string): SqlDb {
  const { DatabaseSync } = req('node:sqlite');
  const db = new DatabaseSync(path);
  return configure({
    exec: (sql) => db.exec(sql),
    run: (sql, ...p) => void db.prepare(sql).run(...p),
    get: <T>(sql: string, ...p: SqlParam[]) => db.prepare(sql).get(...p) as T | undefined,
    all: <T>(sql: string, ...p: SqlParam[]) => db.prepare(sql).all(...p) as T[],
    close: () => db.close(),
  });
}
