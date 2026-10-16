// The AI layer with a mocked Groq: fallbacks, payload rules, validators and key handling.
// Synthetic questions only (AGENTS.md rule 1).

import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { numbersAllowed } from '../src/services/ai/insights';
import { createSession, finish } from '../src/services/session/record';
import { MemoryQuestionStore } from '../src/services/storage/memory';
import type { AnalyticsStore, BehaviorCounts } from '../src/types/analytics';
import type { Question } from '../src/types/sat';
import type { StoredAttempt } from '../src/types/session';
import { AiError, AiService } from './ai/service';
import { KeyStore } from './ai/keyStore';
import { BackupManager } from './backups';
import type { SqlDb } from './sql';
import { openSqlite } from './sqlNode';
import { SqliteUserStore } from './userDb';

const KEY = 'gsk_test_0123456789abcdefghijklmnopqrstuvwxyz';
let dir: string;
let db: SqlDb | null = null;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bb-ai-'));
});
afterEach(async () => {
  db?.close();
  db = null;
  await rm(dir, { recursive: true, force: true });
});

function bankQuestions(): Question[] {
  const out: Question[] = [];
  for (const skill of ['S1', 'S2', 'S3']) {
    for (const difficulty of ['E', 'M', 'H'] as const) {
      for (let k = 0; k < 6; k++) {
        const id = `${skill}-${difficulty}-${k}`;
        out.push({
          id, source: 'digital', displayId: id, section: 'math', domainCode: 'H', domain: 'Algebra', skillCode: skill, skill: `Skill ${skill}`,
          difficulty, scoreBand: difficulty === 'E' ? 2 : difficulty === 'M' ? 4 : 6, active: true,
          stimulusHtml: `<p>Passage for ${id} <img src="x.png"></p>`, stemHtml: `<p>STEMTEXT ${id}</p>`,
          answer: { kind: 'mcq', choices: [`<p>CHOICE A ${id}</p>`, 'b', 'c', 'd'], correct: 'A', keyOrigin: 'structured' },
          rationaleHtml: `<p>RATIONALETEXT ${id}</p>`, updatedAt: 0,
        });
      }
    }
  }
  return out;
}

const zeroBehavior: BehaviorCounts = {
  answered: 0, questionsWithChange: 0, changes: 0, correctToIncorrect: 0, incorrectToCorrect: 0, incorrectToIncorrect: 0, mcqAnswered: 0,
  questionsWithStrike: 0, strikeActions: 0, rated: 0, sureWrong: 0, sureRight: 0, unsureRight: 0, unsureWrong: 0, guessRight: 0, guessWrong: 0,
};
const stubAnalytics = {
  overview: async () => ({ sessions: { drill: 3, exam: 0 }, attempts: { drill: { attempts: 30, correct: 12, timeMs: 1 }, exam: { attempts: 0, correct: 0, timeMs: 0 } }, activeMs: { drill: 1, exam: 0 }, bank: { total: 54, live: 54, seen: 30, seenLive: 30 }, daily: [], unattributed: 0 }),
  skills: async () => ({ rows: [{ section: 'math', domainCode: 'H', domain: 'Algebra', skillCode: 'S1', skill: 'Skill S1', bankTotal: 18, bankLive: 18, unseenLive: 8, counts: { drill: { attempts: 10, correct: 2, timeMs: 1 }, exam: { attempts: 0, correct: 0, timeMs: 0 } }, recent: [] }] }),
  timing: async () => ({ baselines: [], flaggedCounts: { rushedWrong: { drill: 4, exam: 0 }, stuck: { drill: 2, exam: 0 } }, flagged: [], modules: [] }),
  misses: async () => [],
  behavior: async () => ({ counts: { drill: { ...zeroBehavior, correctToIncorrect: 3, incorrectToCorrect: 1 }, exam: zeroBehavior } }),
} as unknown as AnalyticsStore;

interface Call {
  body: Record<string, unknown>;
  headers: Headers;
}

/** A fake Groq. `reply` gets the parsed request and returns the model's JSON, a status, or 'hang'. */
function fakeGroq(reply: (req: { aliases: string[]; user: Record<string, unknown> }) => unknown | { status: number; retryAfter?: string } | 'hang' | 'not-json') {
  const calls: Call[] = [];
  const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ body, headers: new Headers(init?.headers) });
    const messages = body.messages as { content: string }[];
    const user = JSON.parse(messages[1]?.content ?? '{}') as Record<string, unknown>;
    const aliases = ((user.candidates as { alias: string }[] | undefined) ?? []).map((c) => c.alias);
    const out = reply({ aliases, user });
    if (out === 'hang') {
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    }
    if (out === 'not-json') return new Response(JSON.stringify({ choices: [{ message: { content: 'this is not json' } }] }), { status: 200 });
    if (typeof out === 'object' && out !== null && 'status' in out) {
      const o = out as { status: number; retryAfter?: string };
      return new Response('{}', { status: o.status, headers: o.retryAfter ? { 'retry-after': o.retryAfter } : {} });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(out) } }] }), { status: 200 });
  }) as typeof fetch;
  return { calls, fetchFn };
}

async function world(reply: Parameters<typeof fakeGroq>[0], opts: { key?: boolean } = {}) {
  db = openSqlite(join(dir, 'user.db'));
  const users = new SqliteUserStore(db);
  const bank = new MemoryQuestionStore();
  const qs = bankQuestions();
  await bank.replaceAll(qs, { fetchedAt: 'x', importedAt: 'y', count: qs.length, skippedCount: 0 });
  // Skill S1 weak (1 of 5), S2 middling (3 of 5), S3 strong (5 of 5); first attempts in finished drills.
  let n = 0;
  for (const [skill, right] of [['S1', 1], ['S2', 3], ['S3', 5]] as const) {
    const ids = [0, 1, 2, 3, 4].map((k) => `${skill}-M-${k}`);
    const s = finish(createSession(`d${n++}`, 'drill', { section: 'math', domainCode: 'all', skillCodes: [], difficulties: [], count: 5, liveOnly: true }, ids, 1), 0, () => true, 10);
    const attempts: StoredAttempt[] = ids.map((q, i) => ({ id: `${s.id}:${q}`, sessionId: s.id, questionId: q, mode: 'drill', status: 'final', response: 'B', correct: i < right, timeMs: 50_000, firstVisitMs: 50_000, changes: 0, confidence: null, at: 5 }));
    await users.saveSession(s, attempts);
  }
  await users.addTag({ id: 't1', sessionId: 'd0', questionId: 'S1-M-4', reason: 'careless', note: 'SECRETMISTAKENOTE', suggested: false, at: 6 });
  await users.setNote('S1', 'MYRULESNOTE');
  const keys = new KeyStore(join(dir, 'secrets', 'groq-key'));
  if (opts.key !== false) await keys.set(KEY);
  const g = fakeGroq(reply);
  const ai = new AiService({ users, bank, analytics: stubAnalytics, keys, fetch: g.fetchFn, sleep: async () => undefined, timeoutMs: 50, now: () => 1000 });
  return { users, bank, keys, ai, calls: g.calls };
}

async function reset(): Promise<void> {
  db?.close();
  db = null;
  await rm(join(dir, 'user.db'), { force: true });
  await rm(join(dir, 'user.db-wal'), { force: true });
  await rm(join(dir, 'user.db-shm'), { force: true });
}

const pickAll = ({ aliases }: { aliases: string[] }) => ({ groups: [{ label: 'Slips', reason: 'same concept missed', aliases }] });
const REQ = { section: 'math' as const, size: 10, ruleOnly: false };

describe('AI fallbacks', () => {
  it('with no key, the weak drill is rule-based and Groq is never called', async () => {
    const w = await world(pickAll, { key: false });
    const r = await w.ai.weakDrill(REQ);
    expect(r).toMatchObject({ origin: 'rule', fallbackReason: 'no_key' });
    expect(r.questionIds.length).toBe(10);
    expect(w.calls).toHaveLength(0);
    expect((await w.ai.report('all_time', false)).origin).toBe('rule');
  });

  it('with AI off, nothing is sent', async () => {
    const w = await world(pickAll);
    await w.ai.updateSettings({ enabled: false });
    expect((await w.ai.weakDrill(REQ)).fallbackReason).toBe('off');
    expect(w.calls).toHaveLength(0);
  });

  it('after the key is removed, calls stop', async () => {
    const w = await world(pickAll);
    await w.ai.removeKey();
    expect((await w.ai.status()).hasKey).toBe(false);
    expect((await w.ai.weakDrill(REQ)).fallbackReason).toBe('no_key');
    expect(w.calls).toHaveLength(0);
  });

  it('invalid JSON, a timeout, and repeated 429 all fall back', async () => {
    expect((await (await world(() => 'not-json')).ai.weakDrill(REQ)).fallbackReason).toBe('invalid_reply');
    await reset();
    expect((await (await world(() => 'hang')).ai.weakDrill(REQ)).fallbackReason).toBe('timeout');
    await reset();
    const limited = await world(() => ({ status: 429, retryAfter: '1' }));
    expect((await limited.ai.weakDrill(REQ)).fallbackReason).toBe('rate_limited');
    expect(limited.calls).toHaveLength(2);
  });

  it('a 429 followed by success is retried once', async () => {
    let first = true;
    const w = await world((req) => {
      if (first) {
        first = false;
        return { status: 429, retryAfter: '1' };
      }
      return pickAll(req);
    });
    expect((await w.ai.weakDrill(REQ)).origin).toBe('ai');
    expect(w.calls).toHaveLength(2);
  });
});

describe('the weak-skill drill reply is checked by code', () => {
  it('drops hallucinated ids and duplicates, and enforces size and the per-skill cap', async () => {
    const w = await world(({ aliases }) => ({ groups: [{ label: 'A', reason: 'r', aliases: ['c99', 'nope', ...aliases, aliases[0]] }] }));
    const r = await w.ai.weakDrill(REQ);
    expect(r.origin).toBe('ai');
    expect(r.questionIds).toHaveLength(10);
    expect(new Set(r.questionIds).size).toBe(10);
    expect(r.notes.join(' ')).toMatch(/unknown/);
    const bySkill = new Map<string, number>();
    for (const id of r.questionIds) bySkill.set(id.split('-')[0] as string, (bySkill.get(id.split('-')[0] as string) ?? 0) + 1);
    for (const n of bySkill.values()) expect(n).toBeLessThanOrEqual(5);
    // Never a question already answered (consumed).
    for (const id of r.questionIds) expect(['S1-M-0', 'S1-M-1', 'S1-M-2', 'S1-M-3', 'S1-M-4']).not.toContain(id);
  });

  it('a reply with nothing usable is discarded for the rule-based pick', async () => {
    const w = await world(() => ({ groups: [{ label: 'A', reason: 'r', aliases: ['zz1', 'zz2'] }] }));
    const r = await w.ai.weakDrill(REQ);
    expect(r).toMatchObject({ origin: 'rule', fallbackReason: 'invalid_reply' });
    expect(r.questionIds).toHaveLength(10);
  });

  it('caches by request hash, so asking again spends no call', async () => {
    const w = await world(pickAll);
    await w.ai.weakDrill(REQ);
    const again = await w.ai.weakDrill(REQ);
    expect(again.cached).toBe(true);
    expect(w.calls).toHaveLength(1);
  });
});

describe('what leaves the machine', () => {
  const textOf = (c: Call) => JSON.stringify(c.body);

  it('with the text toggle off, no question text, no real ids, no notes and no key are in the payload', async () => {
    const w = await world(pickAll);
    await w.ai.weakDrill(REQ);
    const sent = textOf(w.calls[0] as Call);
    for (const banned of ['STEMTEXT', 'Passage for', 'CHOICE A', 'RATIONALETEXT', 'SECRETMISTAKENOTE', 'MYRULESNOTE', KEY, 'S1-E-0', '"stem"', '"passage"', '"choices"']) {
      expect(sent).not.toContain(banned);
    }
    expect((w.calls[0] as Call).headers.get('authorization')).toBe(`Bearer ${KEY}`);
  });

  it('with text on, only candidate questions are sent, never rationales or notes', async () => {
    const w = await world(pickAll);
    await expect(w.ai.updateSettings({ includeText: true })).rejects.toBeInstanceOf(AiError);
    await w.ai.updateSettings({ includeText: true, textConfirmedAt: 999 });
    const preview = await w.ai.previewWeakDrill(REQ);
    expect(preview.usedText).toBe(true);
    await w.ai.weakDrill(REQ);
    const sent = textOf(w.calls[0] as Call);
    expect(sent).toContain('STEMTEXT');
    expect(sent).not.toContain('[image]x.png');
    for (const banned of ['RATIONALETEXT', 'SECRETMISTAKENOTE', 'MYRULESNOTE', KEY]) expect(sent).not.toContain(banned);
    // The answered (consumed) questions are not candidates, so their text never goes.
    expect(sent).not.toContain('STEMTEXT S1-M-0');
    // Every question whose text was sent is in the candidate list of that request.
    const user = JSON.parse(((w.calls[0] as Call).body.messages as { content: string }[])[1]?.content ?? '{}') as { candidates: { alias: string; stem?: string }[] };
    expect(user.candidates.length).toBeLessThanOrEqual(60);
    const stems = [...sent.matchAll(/STEMTEXT ([A-Z0-9-]+)/g)].map((m) => m[1]);
    expect(stems.length).toBe(user.candidates.filter((c) => c.stem).length);
  });

  it('the key is in no event, export or backup, and never in a test-connection message', async () => {
    const w = await world(() => ({ status: 401 }));
    await w.ai.weakDrill(REQ);
    const t = await w.ai.testConnection();
    expect(t.ok).toBe(false);
    expect(t.message).not.toContain(KEY);
    const events = await w.users.listEvents();
    expect(events.some((e) => e.type === 'ai_call')).toBe(true);
    expect(JSON.stringify(events)).not.toContain(KEY);
    expect(JSON.stringify(await w.users.exportAll())).not.toContain(KEY);
    const mgr = new BackupManager(join(dir, 'backups'), w.users);
    const name = (await mgr.snapshotIfDue()) as string;
    expect(await readFile(join(dir, 'backups', name), 'utf8')).not.toContain(KEY);
    expect(await readdir(join(dir, 'backups'))).toHaveLength(1);
    expect(JSON.stringify(await w.ai.status())).not.toContain(KEY);
  });

  it('a key that does not look like one is refused', async () => {
    const w = await world(pickAll, { key: false });
    await expect(w.ai.setKey('short')).rejects.toBeInstanceOf(AiError);
  });
});

describe('the AI report', () => {
  it('drops sentences whose numbers are not in the facts', async () => {
    const w = await world(() => ({
      picks: [
        { id: 'skills_below_target', sentence: 'Skill S1 sits at 20% of answers right.' },
        { id: 'fast_vs_slow', sentence: 'You rushed 99 questions.' },
        { id: 'answer_changes', sentence: 'Changing answers hurt 3 times and helped 1 time.' },
        { id: 'overall', sentence: 'Overall 12 of 30 right.' },
        { id: 'pool_health', sentence: 'Plenty of fresh questions remain.' },
        { id: 'invented', sentence: 'Made up.' },
      ],
      nextWeek: 'Do 500 questions.',
    }));
    const r = await w.ai.report('all_time', false);
    expect(r.origin).toBe('ai');
    expect(r.lines.map((l) => l.insightId)).toEqual(['skills_below_target', 'answer_changes', 'overall']);
    // pool_health is no longer an insight (Phase 8), so its sentence is dropped like an unknown id.
    expect(r.dropped).toBe(3);
    // The invented number in "next week" is replaced by the rule-based line.
    expect(r.nextWeek).not.toContain('500');
  });

  it('checks numbers exactly', () => {
    expect(numbersAllowed('3 of 10 right, 30%', [3, 10, 30])).toBe(true);
    expect(numbersAllowed('3.5 seconds', [3])).toBe(false);
  });
});
