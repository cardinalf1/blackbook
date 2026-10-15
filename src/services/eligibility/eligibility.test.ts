// The global done rule, proven end to end: real sessions and attempts go into the in-memory store,
// status comes out of questionStatus, and assembly, preflight and pool health all read the one rule.

import { describe, expect, it } from 'vitest';
import { seededRng, syntheticPool } from '../__fixtures__/pool';
import { buildRows } from '../browse/filter';
import { assembleModule } from '../exam/assemble';
import { createSession } from '../session/record';
import { MemoryAttemptStore } from '../storage/attemptsMemory';
import { poolHealth } from '../test/pool';
import { preflightSection, preflightTest } from '../test/preflight';
import type { BrowseRow } from '../../types/browse';
import type { Question } from '../../types/sat';
import type { SessionRecord, StoredAttempt } from '../../types/session';
import { countTiers, eligibleRows, STRICT_POLICY, tierOf } from './eligibility';

const CONFIG = { section: 'rw' as const, domainCode: 'all', skillCodes: [], difficulties: [], count: 1, liveOnly: true };

/** The bank as the store sees it. Only facets matter here, so each question is a minimal stub. */
function bankOf(rows: readonly BrowseRow[]): Question[] {
  return rows.map((r) => ({
    id: r.id, displayId: r.displayId, section: r.section, domainCode: r.domainCode, domain: r.domain, skillCode: r.skillCode,
    skill: r.skill, difficulty: r.difficulty, source: r.source, active: r.active, answer: { kind: r.format },
  })) as unknown as Question[];
}

const finalAttempt = (sessionId: string, questionId: string): StoredAttempt => ({
  id: `${sessionId}:${questionId}`, sessionId, questionId, mode: 'drill', status: 'final', response: 'A', correct: true, timeMs: 1000, firstVisitMs: 1000, changes: 0, confidence: null, at: 10,
});

async function rowsAfter(store: MemoryAttemptStore, base: readonly BrowseRow[]): Promise<BrowseRow[]> {
  return buildRows(bankOf(base), await store.questionStatus());
}

/** An abandoned exam module whose first `visited` questions were shown. */
function examSession(id: string, ids: string[], visited: number): SessionRecord {
  const s = createSession(id, 'exam', CONFIG, ids, 1);
  for (const q of ids.slice(0, visited)) s.progress[q] = { ...(s.progress[q] as NonNullable<(typeof s.progress)[string]>), visits: 1 };
  return {
    ...s,
    status: 'abandoned',
    exam: {
      module: { section: 'rw', moduleNumber: 1, tier: 'routing' },
      timer: { durationMs: 1000, deadlineAt: null, pausedRemainingMs: null },
      pauses: [],
      phase: 'in_progress',
      submittedBy: null,
      timerHidden: false,
      fiveMinuteAlertShown: false,
      assemblyNotes: [],
    },
  };
}

const SPEC = { section: 'rw' as const, moduleNumber: 1 as const, tier: 'routing' as const };

describe('the global done rule', () => {
  const base = syntheticPool(4);
  const ids = base.filter((r) => r.section === 'rw').map((r) => r.id);

  it('a Browse single question I finalized is never assembled into an exam', async () => {
    const store = new MemoryAttemptStore();
    const single = createSession('b1', 'drill', CONFIG, [ids[0] as string], 1, 'browse');
    await store.saveSession({ ...single, status: 'finished' }, [finalAttempt('b1', ids[0] as string)]);
    const rows = await rowsAfter(store, base);
    expect(tierOf(rows.find((r) => r.id === ids[0]) as BrowseRow)).toBe('consumed');
    for (let seed = 1; seed <= 30; seed++) {
      expect(assembleModule(rows, SPEC, seededRng(seed)).questionIds).not.toContain(ids[0]);
    }
  });

  it('an exam question I only saw and never answered is also excluded', async () => {
    const store = new MemoryAttemptStore();
    await store.saveSession(examSession('x1', [ids[1] as string, ids[2] as string], 1));
    const rows = await rowsAfter(store, base);
    const shown = rows.find((r) => r.id === ids[1]) as BrowseRow;
    expect(shown.status).toBe('seen');
    expect(tierOf(shown)).toBe('consumed');
    // The second question was never reached, so it stays fresh.
    expect(tierOf(rows.find((r) => r.id === ids[2]) as BrowseRow)).toBe('fresh');
    expect(eligibleRows(rows, STRICT_POLICY).some((r) => r.id === ids[1])).toBe(false);
    for (let seed = 1; seed <= 30; seed++) {
      expect(assembleModule(rows, SPEC, seededRng(seed)).questionIds).not.toContain(ids[1]);
    }
  });

  it('a drill question seen but not finished is used only after confirmation', async () => {
    const store = new MemoryAttemptStore();
    // A drill that showed its first question and was left unfinished: seen, not done.
    await store.saveSession(createSession('d1', 'drill', CONFIG, [ids[3] as string], 1));
    await store.appendEvents([{ id: 'ev1', sessionId: 'd1', mode: 'drill', questionId: ids[3] as string, type: 'question_shown', ts: 2, monoMs: 1, pageId: 'p', seq: 0, payload: { index: 0, visit: 1 } }]);
    const rows = await rowsAfter(store, base);
    expect(tierOf(rows.find((r) => r.id === ids[3]) as BrowseRow)).toBe('soft');
    expect(eligibleRows(rows, STRICT_POLICY).some((r) => r.id === ids[3])).toBe(false);
    expect(eligibleRows(rows, { allowSoft: true, allowRepeats: false }).some((r) => r.id === ids[3])).toBe(true);

    // Everything else in Expression of Ideas is gone: only the seen question could fill that gap.
    const thin = base.filter((r) => !(r.section === 'rw' && r.domainCode === 'EOI') || r.id === ids[3]);
    const thinRows = buildRows(bankOf(thin), await store.questionStatus());
    expect(assembleModule(thinRows, SPEC, seededRng(1)).questionIds).not.toContain(ids[3]);
  });

  it('seen-but-unanswered questions fill the gap once confirmed, and consumed ones still stay out', () => {
    const rows = syntheticPool(4, (r) => (r.section === 'rw' && Number(r.id.split('-')[1]) % 2 === 0 ? { ...r, status: 'seen' } : { ...r, status: 'done', attempts: 1 }));
    const soft = assembleModule(rows, SPEC, seededRng(1), undefined, undefined, { allowSoft: true, allowRepeats: false });
    expect(soft.freshness.consumed).toBe(0);
    expect(soft.freshness.soft).toBe(soft.questionIds.length);
    expect(soft.questionIds.length).toBeGreaterThan(0);
  });

  it('consumed questions return only with the repeats confirmation', () => {
    const rows = syntheticPool(4, (r) => ({ ...r, status: 'done', attempts: 1 }));
    expect(assembleModule(rows, SPEC, seededRng(1)).questionIds).toHaveLength(0);
    expect(assembleModule(rows, SPEC, seededRng(1), undefined, undefined, { allowSoft: true, allowRepeats: false }).questionIds).toHaveLength(0);
    const repeats = assembleModule(rows, SPEC, seededRng(1), undefined, undefined, { allowSoft: true, allowRepeats: true });
    expect(repeats.questionIds).toHaveLength(27);
    expect(repeats.freshness.consumed).toBe(27);
  });

  it('preflight needs the repeats level when everything is consumed, for Module 1 and both Module 2s', () => {
    const rows = syntheticPool(6, (r) => ({ ...r, status: 'done', attempts: 1 }));
    expect(preflightSection(rows, 'rw', seededRng(2))).toMatchObject({ unseenOk: false, softOk: false, anyOk: true });
    expect(preflightTest(rows, 'full', seededRng(2))).toMatchObject({ allUnseen: false, allSoft: false, allPossible: true });
  });

  it('counts tiers from the same classification', () => {
    const rows = syntheticPool(2, (r) => {
      const n = Number(r.id.split('-')[1]);
      return n % 3 === 0 ? { ...r, status: 'done' } : n % 3 === 1 ? { ...r, status: 'seen' } : r;
    });
    const c = countTiers(rows);
    expect(c.fresh + c.soft + c.consumed).toBe(rows.length);
    expect(c.consumed).toBe(rows.filter((r) => r.status === 'done').length);
  });
});

describe('pool health', () => {
  it('simulates against the difficulty profile instead of dividing totals', () => {
    // Plenty of questions overall but few hard ones in Reading and Writing: totals say many tests, the profile says fewer.
    const sparseHard = syntheticPool(8, (r) => (r.section === 'rw' && r.difficulty === 'H' && Number(r.id.split('-')[1]) % 8 !== 0 ? { ...r, active: false } : r));
    const full = poolHealth(syntheticPool(8), STRICT_POLICY, seededRng(3));
    const thin = poolHealth(sparseHard, STRICT_POLICY, seededRng(3));
    expect(full.rw).toBeGreaterThanOrEqual(2);
    expect(thin.rw).toBeLessThan(full.rw);
    expect(thin.full).toBe(Math.min(thin.rw, thin.math));
  });

  it('counts down as questions are used up', () => {
    const rows = syntheticPool(8);
    const before = poolHealth(rows, STRICT_POLICY, seededRng(4));
    const used = new Set(assembleModule(rows, SPEC, seededRng(4)).questionIds);
    const after = poolHealth(rows.map((r) => (used.has(r.id) ? { ...r, status: 'done' as const } : r)), STRICT_POLICY, seededRng(4));
    expect(after.rw).toBeLessThanOrEqual(before.rw);
    expect(after.math).toBe(before.math);
  });

  it('is fast on a bank the size of the real one', () => {
    const rows = syntheticPool(60);
    const t = performance.now();
    poolHealth(rows, STRICT_POLICY, seededRng(5));
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
