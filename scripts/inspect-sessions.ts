// bun scripts/inspect-sessions.ts: prints the newest sessions, their saved answers and event counts. Read-only.
import { join } from 'node:path';
import { openSqlite } from '../server/sqlBun';
const db = openSqlite(join(process.cwd(), 'data', 'app', 'user.db'));
const rows = db.all<{ id: string; status: string; data: string; last_activity_at: number }>("SELECT id, status, data, last_activity_at FROM sessions ORDER BY started_at DESC LIMIT 4");
for (const r of rows) {
  const s = JSON.parse(r.data);
  const answered = s.queueIds.filter((q: string) => s.progress[q]?.response != null).length;
  const att = db.get<{ n: number; d: number; f: number }>("SELECT COUNT(*) n, SUM(status='draft') d, SUM(status='final') f FROM attempts WHERE session_id = ?", r.id);
  const ev = db.get<{ n: number }>("SELECT COUNT(*) n FROM events WHERE session_id = ?", r.id);
  console.log(`${r.id.slice(0, 8)} ${r.status.padEnd(11)} index=${s.index} answered=${answered}/${s.queueIds.length} attempts=${att?.n} (draft ${att?.d ?? 0}, final ${att?.f ?? 0}) events=${ev?.n} active=${Math.round(s.totalActiveMs / 1000)}s`);
}
