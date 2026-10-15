// Mistake-tag storage, the version 5 migration, snapshots and restore, against a real SQLite file.

import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSession, finish } from '../src/services/session/record';
import type { MistakeTag } from '../src/types/mistakes';
import type { EventRecord, SessionRecord, StoredAttempt } from '../src/types/session';
import { BackupError, BackupManager, DAILY_KEEP, dayStamp } from './backups';
import type { SqlDb } from './sql';
import { openSqlite } from './sqlNode';
import { MIGRATIONS, migrate, SqliteUserStore } from './userDb';
import { parseUserData } from './validate';

let dir: string;
const dbs: SqlDb[] = [];
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bb-backup-'));
});
afterEach(async () => {
  for (const d of dbs.splice(0)) d.close();
  await rm(dir, { recursive: true, force: true });
});

function open(name: string): SqliteUserStore {
  const db = openSqlite(join(dir, name));
  dbs.push(db);
  return new SqliteUserStore(db);
}

const CONFIG = { section: 'math' as const, domainCode: 'all', skillCodes: [], difficulties: [], count: 2, liveOnly: true };
const attempt = (sessionId: string, questionId: string, correct: boolean): StoredAttempt => ({
  id: `${sessionId}:${questionId}`, sessionId, questionId, mode: 'drill', status: 'final', response: 'A', correct, timeMs: 1200, firstVisitMs: 1200, changes: 0, confidence: null, at: 50,
});
const shown = (id: string, sessionId: string, questionId: string): EventRecord => ({
  id, sessionId, mode: 'drill', questionId, type: 'question_shown', ts: 5, monoMs: 1, pageId: 'p', seq: 0, payload: { index: 0, visit: 1 },
});
const tag = (id: string, sessionId: string, questionId: string, reason: MistakeTag['reason'], at: number, note = ''): MistakeTag => ({
  id, sessionId, questionId, reason, note, suggested: false, at,
});

async function fill(store: SqliteUserStore): Promise<void> {
  const a = finish(createSession('s1', 'drill', CONFIG, ['q1', 'q2'], 10), 0, () => true, 60);
  await store.saveSession(a, [attempt('s1', 'q1', true), attempt('s1', 'q2', false)]);
  const retry = finish(createSession('s2', 'drill', CONFIG, ['q2'], 100, 'retry'), 0, () => true, 160);
  await store.saveSession(retry, [attempt('s2', 'q2', true)]);
  await store.saveSession(createSession('s3', 'drill', CONFIG, ['q3'], 200));
  await store.appendEvents([shown('e1', 's1', 'q1'), shown('e2', 's3', 'q3')]);
  await store.setFlag('q1', true);
  await store.addTag(tag('t1', 's1', 'q2', 'careless', 70));
  await store.addTag(tag('t2', 's1', 'q2', 'misread', 80, 'read the units wrong'));
}

describe('mistake tags', () => {
  it('are appended, never changed: the newest is in force and history stays', async () => {
    const store = open('a.db');
    await fill(store);
    const all = await store.listTags();
    expect(all.map((t) => t.reason)).toEqual(['careless', 'misread']);
    // Resending the same tag stores it once.
    await store.addTag(tag('t2', 's1', 'q2', 'misread', 80, 'read the units wrong'));
    expect(await store.listTags()).toHaveLength(2);
  });

  it('cannot be edited in place', async () => {
    const db = openSqlite(join(dir, 'b.db'));
    dbs.push(db);
    const store = new SqliteUserStore(db);
    await store.addTag(tag('t1', 's1', 'q1', 'other', 1));
    expect(() => db.run("UPDATE mistake_tags SET reason = 'careless'")).toThrow(/append-only/);
  });

  it('never change the attempts they describe', async () => {
    const store = open('c.db');
    await fill(store);
    const before = JSON.stringify(await store.listAttempts());
    await store.addTag(tag('t3', 's1', 'q2', 'guessed', 90));
    expect(JSON.stringify(await store.listAttempts())).toBe(before);
  });

  it('are part of Delete all data', async () => {
    const store = open('d.db');
    await fill(store);
    await store.clearAll();
    expect(await store.listTags()).toEqual([]);
  });
});

describe('migration 5', () => {
  it('keeps existing sessions and lets a session start from the retry queue', async () => {
    const db = openSqlite(join(dir, 'm.db'));
    dbs.push(db);
    migrate(db, MIGRATIONS.slice(0, 4));
    const old = createSession('old', 'drill', CONFIG, ['q1'], 5);
    db.run(
      'INSERT INTO sessions (id, mode, source, status, started_at, finished_at, last_activity_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      old.id, old.mode, old.source, old.status, old.startedAt, old.finishedAt, old.lastActivityAt, JSON.stringify(old),
    );
    migrate(db);
    const store = new SqliteUserStore(db);
    expect((await store.listSessions()).map((s) => s.id)).toEqual(['old']);
    await store.saveSession(createSession('r1', 'drill', CONFIG, ['q1'], 6, 'retry'));
    expect((await store.getSession('r1'))?.source).toBe('retry');
    // The generated columns the analytics queries use survive the rebuild.
    expect(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM sessions WHERE test_id IS NULL')?.n).toBe(2);
  });
});

describe('backup and restore', () => {
  it('restoring an export into an empty database reproduces the sessions, counts and status', async () => {
    const a = open('src.db');
    await fill(a);
    const exported = JSON.parse(JSON.stringify(await a.exportAll())) as unknown;
    const parsed = parseUserData(exported);
    expect(typeof parsed).not.toBe('string');
    const b = open('empty.db');
    expect(await b.listSessions()).toEqual([]);
    await b.replaceAll(parsed as Exclude<typeof parsed, string>);
    expect(await b.listSessions()).toEqual(await a.listSessions());
    expect(await b.listAttempts()).toEqual(await a.listAttempts());
    expect(await b.listEvents()).toEqual(await a.listEvents());
    expect(await b.listTags()).toEqual(await a.listTags());
    expect(await b.listFlags()).toEqual(await a.listFlags());
    expect(await b.questionStatus()).toEqual(await a.questionStatus());
    expect(await b.stats()).toEqual(await a.stats());
  });

  it('refuses a damaged file and leaves current data alone', async () => {
    const store = open('x.db');
    await fill(store);
    const mgr = new BackupManager(join(dir, 'backups'), store);
    const bad = { ...(await store.exportAll()), attempts: [{ id: 'nope' }] };
    await expect(mgr.restore(bad)).rejects.toBeInstanceOf(BackupError);
    await expect(mgr.restore({ app: 'something-else' })).rejects.toThrow(/not a Blackbook export/);
    expect(await store.listSessions()).toHaveLength(3);
    expect(await readdir(join(dir, 'backups')).catch(() => [])).toEqual([]);
  });

  it('writes one snapshot a day, keeps the last 7, and holds no question content', async () => {
    const store = open('snap.db');
    await fill(store);
    let now = new Date(2026, 9, 1, 9).getTime();
    const mgr = new BackupManager(join(dir, 'backups'), store, () => now);
    expect(await mgr.snapshotIfDue()).toBe(`blackbook-${dayStamp(now)}.json`);
    expect(await mgr.snapshotIfDue()).toBeNull();
    for (let day = 1; day <= 9; day++) {
      now += 24 * 3600_000;
      await mgr.snapshotIfDue();
    }
    const files = (await readdir(join(dir, 'backups'))).sort();
    expect(files).toHaveLength(DAILY_KEEP);
    expect(files[0]).toBe(`blackbook-${dayStamp(new Date(2026, 9, 4).getTime())}.json`);
    const text = await readFile(join(dir, 'backups', files[6] as string), 'utf8');
    const data = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(['app', 'attempts', 'events', 'exportedAt', 'flags', 'mistakeTags', 'schemaVersion', 'sessions']);
    expect((await mgr.list()).lastBackupAt).not.toBeNull();
  });

  it('restores a snapshot over changed data after saving a safety copy', async () => {
    const store = open('r.db');
    await fill(store);
    const mgr = new BackupManager(join(dir, 'backups'), store);
    const name = (await mgr.snapshotIfDue()) as string;
    const before = await store.listSessions();
    await store.clearAll();
    await store.saveSession(createSession('later', 'drill', CONFIG, ['q9'], 999));
    const result = await mgr.restoreSnapshot(name);
    expect(result).toMatchObject({ sessions: 3, attempts: 3, mistakeTags: 2 });
    expect(await store.listSessions()).toEqual(before);
    const list = await mgr.list();
    expect(list.backups.some((b) => b.kind === 'before_restore')).toBe(true);
    // The safety copy holds what was there before the restore.
    const safety = list.backups.find((b) => b.kind === 'before_restore') as { name: string };
    const kept = JSON.parse(await readFile(join(dir, 'backups', safety.name), 'utf8')) as { sessions: SessionRecord[] };
    expect(kept.sessions.map((s) => s.id)).toEqual(['later']);
    await expect(mgr.restoreSnapshot('../escape.json')).rejects.toThrow(/not found/);
    await writeFile(join(dir, 'backups', 'blackbook-2020-01-01.json'), '{nope', 'utf8');
    await expect(mgr.restoreSnapshot('blackbook-2020-01-01.json')).rejects.toThrow(/damaged/);
  });

  it('reads an export made before Phase 6, which has no tags or flags', async () => {
    const a = open('old.db');
    await fill(a);
    const { mistakeTags: _t, flags: _f, ...legacy } = await a.exportAll();
    const parsed = parseUserData(JSON.parse(JSON.stringify(legacy)) as unknown);
    expect(typeof parsed).not.toBe('string');
    expect((parsed as { mistakeTags: unknown[] }).mistakeTags).toEqual([]);
  });
});
