// bun scripts/status-check.ts [--data DIR]
//
// Cross-checks the Browse status (seen, done, attempts, last result, flag) that the local program
// derives in SQL against a recount from the raw attempts, sessions, events and flags, and times
// the status query and the browse filtering on the full bank. Exits 1 on any mismatch.

import { join, resolve } from 'node:path';
import { applyFilters, buildRows, filterCounts } from '../src/services/browse/filter';
import { deriveStatus, shownIds } from '../src/services/browse/status';
import { DEFAULT_BROWSE_FILTERS } from '../src/types/browse';
import { DiskBankStore } from '../server/bankStore';
import { openSqlite } from '../server/sqlBun';
import { SqliteUserStore } from '../server/userDb';

const i = process.argv.indexOf('--data');
const dataDir = resolve(i >= 0 ? (process.argv[i + 1] ?? '') : join('data', 'app'));
const users = new SqliteUserStore(openSqlite(join(dataDir, 'user.db')));
const bank = new DiskBankStore(join(dataDir, 'bank.json'));

const t0 = performance.now();
const fromSql = await users.questionStatus();
const sqlMs = performance.now() - t0;

const [attempts, sessions, events, flags] = await Promise.all([users.listAttempts(), users.listSessions(), users.listEvents(), users.listFlags()]);
const reference = deriveStatus(attempts, sessions, shownIds(events), flags);

const problems: string[] = [];
const refById = new Map(reference.map((s) => [s.questionId, s]));
if (fromSql.length !== reference.length) problems.push(`rows: SQL ${fromSql.length} vs recount ${reference.length}`);
for (const s of fromSql) {
  const r = refById.get(s.questionId);
  if (JSON.stringify(s) !== JSON.stringify(r)) problems.push(`${s.questionId}: SQL ${JSON.stringify(s)} vs recount ${JSON.stringify(r)}`);
}

// Independent spot checks from the raw rows, without either derivation.
const unfinished = new Set(sessions.filter((s) => s.status !== 'finished').map((s) => s.id));
for (const s of fromSql) {
  const mine = attempts.filter((a) => a.questionId === s.questionId && a.status === 'final' && a.response !== '');
  if (s.attempts !== mine.length) problems.push(`${s.questionId}: attempts ${s.attempts} vs ${mine.length} final answers`);
  if (s.lastResult !== null && mine.every((a) => unfinished.has(a.sessionId))) problems.push(`${s.questionId}: shows a result but every answer is in an unfinished session`);
}

const questions = await bank.query({});
const t1 = performance.now();
const rows = buildRows(questions, fromSql);
const buildMs = performance.now() - t1;
const t2 = performance.now();
const filtered = applyFilters(rows, { ...DEFAULT_BROWSE_FILTERS, status: 'not_done', section: 'math' });
const counts = filterCounts(rows, DEFAULT_BROWSE_FILTERS);
const filterMs = performance.now() - t2;

const by = (st: string) => rows.filter((r) => r.status === st).length;
console.log(`Bank: ${rows.length} questions. Unseen ${by('unseen')}, seen not done ${by('seen')}, done ${by('done')}.`);
console.log(`Status rows from SQL: ${fromSql.length} (questions with any history). Flagged: ${fromSql.filter((s) => s.flagged).length}. With a result: ${fromSql.filter((s) => s.lastResult).length}.`);
console.log(`Filter counts (no filters): status ${JSON.stringify(counts.status)}`);
console.log(`Timings: status query ${sqlMs.toFixed(1)} ms, building ${rows.length} rows ${buildMs.toFixed(1)} ms, one filter plus all counts ${filterMs.toFixed(1)} ms (${filtered.length} rows matched).`);

if (problems.length > 0) {
  console.log(`\nSTATUS CROSS-CHECK FAILED (${problems.length}):`);
  for (const p of problems.slice(0, 30)) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('\nStatus cross-check passed: SQL status equals a recount from raw attempts, sessions, events and flags.');
