// No API key in the repo, in handoff notes or in an export. Fails when a key-shaped string shows
// up: a Desmos key (32 hex characters on its own) or a Groq key ("gsk_" and a long run of letters
// and digits). Test keys elsewhere are built at run time ('ab12'.repeat(8)) so they never match here.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openSqlite } from '../../server/sqlNode';
import { SqliteUserStore } from '../../server/userDb';
import { createSession, finish } from './session/record';

const KEY_SHAPES: readonly RegExp[] = [/(?<![0-9a-fA-F])[0-9a-fA-F]{32}(?![0-9a-fA-F])/, /gsk_[A-Za-z0-9]{40,}/];

export function findKeyShaped(text: string): string | null {
  for (const re of KEY_SHAPES) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

const ROOT = join(import.meta.dirname, '..', '..');
const BINARY = /\.(png|jpe?g|gif|ico|woff2?|ttf|lockb)$/i;

function handoffFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    // Screenshots are local only and binary.
    if (statSync(p).isDirectory()) {
      if (name !== 'screens') out.push(...handoffFiles(p));
    } else if (!BINARY.test(name)) {
      out.push(p);
    }
  }
  return out;
}

describe('no key-shaped strings', () => {
  it('the shapes match real-looking keys and not ids', () => {
    expect(findKeyShaped(`apiKey=${'0f'.repeat(16)}`)).not.toBeNull();
    expect(findKeyShaped(`gsk_${'A1'.repeat(26)}`)).not.toBeNull();
    expect(findKeyShaped('id 3f2b8c1e-9d4a-4f6b-8a7c-1e2d3c4b5a69')).toBeNull();
    expect(findKeyShaped(`sha ${'ab'.repeat(20)}`)).toBeNull();
  });

  it('in no committed file', () => {
    const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter((f) => f !== '' && !BINARY.test(f));
    expect(files.length).toBeGreaterThan(100);
    const hits = files
      .filter((f) => existsSync(join(ROOT, f)))
      .map((f) => [f, findKeyShaped(readFileSync(join(ROOT, f), 'utf8'))] as const)
      .filter(([, hit]) => hit !== null)
      .map(([f]) => f);
    expect(hits).toEqual([]);
  });

  it('in no handoff file, committed or not', () => {
    const hits = handoffFiles(join(ROOT, 'handoff')).filter((p) => findKeyShaped(readFileSync(p, 'utf8')) !== null);
    expect(hits).toEqual([]);
  });

  it('in no export of user data', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bb-secrets-'));
    const db = openSqlite(join(dir, 'user.db'));
    try {
      const users = new SqliteUserStore(db);
      const s = finish(createSession(crypto.randomUUID(), 'drill', { section: 'math', domainCode: 'all', skillCodes: [], difficulties: [], count: 1, liveOnly: true }, [crypto.randomUUID()], 1), 0, () => true, 2);
      await users.saveSession(s, []);
      expect(findKeyShaped(JSON.stringify(await users.exportAll()))).toBeNull();
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
