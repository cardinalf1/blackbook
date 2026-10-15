import { describe, expect, it } from 'vitest';
import { EXAM_MODULES } from '../../config/examConfig';
import { TIER_MIX } from '../../config/scoringConfig';
import type { BrowseRow } from '../../types/browse';
import type { Difficulty, Section } from '../../types/sat';
import { assembleModule } from '../exam/assemble';
import { advance, applyRouting, attachSession, breakRemainingMs, currentSlot, currentStep, endBreak, isOver, markPaused, moduleKey, newSlot, newTest, plannedQuestions, specFor, stepsFor } from './flow';
import { preflightSection, preflightTest } from './preflight';
import { decideRoute } from './routing';

// Synthetic rows only. `perCell` questions for every domain, skill, difficulty and format.
const RW_SKILLS: Record<string, string[]> = { CAS: ['WIC', 'TSP', 'CTC'], INI: ['CID', 'COE', 'INF'], SEC: ['BOU', 'FSS'], EOI: ['SYN', 'TRA'] };
const MATH_SKILLS: Record<string, string[]> = { H: ['H.A.', 'H.B.'], P: ['P.A.', 'P.C.'], Q: ['Q.A.', 'Q.B.'], S: ['S.A.', 'S.B.'] };

function pool(perCell: number, over: (r: BrowseRow) => BrowseRow = (r) => r): BrowseRow[] {
  const rows: BrowseRow[] = [];
  let n = 0;
  const add = (section: Section, domainCode: string, skillCode: string, difficulty: Difficulty, format: 'mcq' | 'spr') => {
    for (let k = 0; k < perCell; k++) {
      rows.push(
        over({
          id: `${section}-${n++}`, displayId: `d${n}`, section, domainCode, domain: domainCode, skillCode, skill: skillCode, difficulty,
          format, source: 'digital', active: true, status: 'unseen', examShown: false, attempts: 0, lastResult: null, flagged: false,
        }),
      );
    }
  };
  for (const [dom, skills] of Object.entries(RW_SKILLS)) for (const sk of skills) for (const d of ['E', 'M', 'H'] as Difficulty[]) add('rw', dom, sk, d, 'mcq');
  for (const [dom, skills] of Object.entries(MATH_SKILLS)) for (const sk of skills) for (const d of ['E', 'M', 'H'] as Difficulty[]) for (const f of ['mcq', 'spr'] as const) add('math', dom, sk, d, f);
  return rows;
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('tier-aware assembly', () => {
  const rows = pool(12);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const diffs = (ids: string[]) => ids.map((i) => (byId.get(i) as BrowseRow).difficulty);
  const count = (xs: Difficulty[], d: Difficulty) => xs.filter((x) => x === d).length;

  it('module 2 differs by route: the easier one leans easy, the harder one leans hard', () => {
    for (const section of ['rw', 'math'] as const) {
      const easy = diffs(assembleModule(rows, specFor(section, 2, 'easier'), seeded(1)).questionIds);
      const hard = diffs(assembleModule(rows, specFor(section, 2, 'harder'), seeded(1)).questionIds);
      expect(count(easy, 'E')).toBeGreaterThan(count(easy, 'H'));
      expect(count(hard, 'H')).toBeGreaterThan(count(hard, 'E'));
      expect(count(hard, 'H')).toBeGreaterThan(count(easy, 'H'));
      expect(easy).toHaveLength(EXAM_MODULES[section].questions);
      expect(hard).toHaveLength(EXAM_MODULES[section].questions);
    }
  });

  it('the tier mix in the config is what the assembler follows', () => {
    expect(TIER_MIX.easier[0]).toBeGreaterThan(TIER_MIX.easier[2]);
    expect(TIER_MIX.harder[2]).toBeGreaterThan(TIER_MIX.harder[0]);
  });

  it('no question appears twice in one test: module 2 excludes module 1', () => {
    const m1 = assembleModule(rows, specFor('math', 1, 'routing'), seeded(2));
    for (const tier of ['easier', 'harder'] as const) {
      const m2 = assembleModule(rows, specFor('math', 2, tier), seeded(3), undefined, new Set(m1.questionIds));
      expect(m2.questionIds.some((id) => m1.questionIds.includes(id))).toBe(false);
    }
  });
});

describe('preflight', () => {
  it('a big pool passes for every kind', () => {
    const rows = pool(12);
    for (const kind of ['full', 'rw', 'math'] as const) {
      const p = preflightTest(rows, kind, seeded(4));
      expect(p.allUnseen).toBe(true);
      expect(p.allPossible).toBe(true);
      expect(p.sections.every((s) => s.shortfalls.length === 0)).toBe(true);
    }
  });

  it('a thin unseen pool is reported, and including seen questions fixes it', () => {
    // Plenty of questions, but only a few unseen ones.
    const rows = pool(12, (r) => ({ ...r, status: Number(r.id.split('-')[1]) % 7 === 0 ? 'unseen' : 'done' }));
    const p = preflightSection(rows, 'rw', seeded(5));
    expect(p.unseenOk).toBe(false);
    expect(p.shortfalls.length).toBeGreaterThan(0);
    expect(p.anyOk).toBe(true);
  });

  it('a pool too small to build both modules even with seen questions is blocked', () => {
    const rows = pool(1);
    const p = preflightSection(rows, 'math', seeded(6));
    expect(p.anyOk).toBe(false);
    expect(p.unseenOk).toBe(false);
    const t = preflightTest(rows, 'full', seeded(6));
    expect(t.allPossible).toBe(false);
  });

  it('checks both module 2 variants, not only module 1', () => {
    // Enough for module 1 alone, but not enough hard questions for the harder module 2 after it.
    const rows = pool(12, (r) => (r.section === 'rw' && r.difficulty === 'H' ? { ...r, active: Number(r.id.split('-')[1]) % 6 === 0 } : r));
    const p = preflightSection(rows, 'rw', seeded(7));
    expect(p.unseenOk).toBe(false);
    expect(p.shortfalls.some((l) => l.includes('harder Module 2') || l.includes('Module 1'))).toBe(true);
  });
});

describe('test flow', () => {
  const m1 = (section: Section) => newSlot(specFor(section, 1, 'routing'), ['a', 'b'], []);
  const route = (section: Section, r: 'easier' | 'harder') => ({ ...decideRoute(section, [{ weight: 1, correct: r === 'harder' }], 5), route: r });

  it('plans the sequence for each kind', () => {
    expect(stepsFor('full').map((s) => (s.type === 'break' ? 'break' : s.key))).toEqual(['rw1', 'rw2', 'break', 'math1', 'math2']);
    expect(stepsFor('rw')).toHaveLength(2);
    expect(stepsFor('math')).toHaveLength(2);
    expect(plannedQuestions('full')).toBe(2 * 27 + 2 * 22);
  });

  it('walks a full test: module, routing, module, break, module, routing, module, over', () => {
    let t = newTest('full', false, [m1('rw'), m1('math')]);
    expect(currentSlot(t)?.key).toBe('rw1');
    t = attachSession(t, 'rw1', 's1');
    expect(currentSlot(t)?.sessionId).toBe('s1');
    t = applyRouting(t, route('rw', 'harder'), newSlot(specFor('rw', 2, 'harder'), ['c'], []));
    t = advance(t, 100);
    expect(currentSlot(t)).toMatchObject({ key: 'rw2', tier: 'harder' });
    t = advance(t, 200, 600_000);
    expect(currentStep(t)?.type).toBe('break');
    expect(t.break).toMatchObject({ startedAt: 200, deadlineAt: 600_200, endedAt: null });
    expect(breakRemainingMs(t.break!, 300_200)).toBe(300_000);
    t = endBreak(t, 400, true);
    expect(currentSlot(t)?.key).toBe('math1');
    expect(t.break).toMatchObject({ endedAt: 400, endedEarly: true });
    t = applyRouting(t, route('math', 'easier'), newSlot(specFor('math', 2, 'easier'), ['d'], []));
    t = advance(t, 500);
    expect(currentSlot(t)).toMatchObject({ key: 'math2', tier: 'easier' });
    t = advance(t, 600);
    expect(isOver(t)).toBe(true);
    expect(currentSlot(t)).toBeNull();
  });

  it('ending a break twice, or a section routed twice, changes nothing', () => {
    let t = newTest('full', false, [m1('rw'), m1('math')]);
    t = applyRouting(t, route('rw', 'easier'), newSlot(specFor('rw', 2, 'easier'), ['c'], []));
    const again = applyRouting(t, route('rw', 'harder'), newSlot(specFor('rw', 2, 'harder'), ['z'], []));
    expect(again).toBe(t);
    t = advance(advance(t, 1), 2);
    const ended = endBreak(t, 3, false);
    expect(endBreak(ended, 4, true)).toBe(ended);
    expect(ended.break?.endedEarly).toBe(false);
  });

  it('a break that runs out reads zero, and a started slot keeps its first session', () => {
    const t = advance(advance(newTest('full', false, [m1('rw')]), 1), 10, 1000);
    expect(breakRemainingMs(t.break!, 5000)).toBe(0);
    const a = attachSession(newTest('rw', false, [m1('rw')]), 'rw1', 'first');
    expect(attachSession(a, 'rw1', 'second').slots.rw1?.sessionId).toBe('first');
    expect(moduleKey('math', 2)).toBe('math2');
  });

  it('one pause marks the whole test for good', () => {
    const t = newTest('rw', false, [m1('rw')]);
    const p = markPaused(t, true);
    expect(p.paused).toBe(true);
    expect(markPaused(p, false).paused).toBe(true);
  });
});
