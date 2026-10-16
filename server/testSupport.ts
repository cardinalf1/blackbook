// Shared by the analytics, hidden-session and dashboard tests: loads synthetic raw data into an
// in-memory database. Synthetic data only.

import type { RawData } from '../src/services/analytics/brute';
import { SqlAnalytics, toMetaRow } from './analytics';
import { openSqlite } from './sqlNode';
import { SqliteUserStore } from './userDb';

export async function loadInto(raw: RawData): Promise<{ analytics: SqlAnalytics; store: SqliteUserStore }> {
  const db = openSqlite(':memory:');
  const store = new SqliteUserStore(db);
  for (const s of raw.sessions) {
    await store.saveSession(s, raw.attempts.filter((a) => a.sessionId === s.id));
  }
  for (let i = 0; i < raw.events.length; i += 5000) await store.appendEvents(raw.events.slice(i, i + 5000));
  const rows = raw.questions.map(toMetaRow);
  return { analytics: new SqlAnalytics(db, { load: async () => ({ signature: 'test', rows }) }), store };
}
