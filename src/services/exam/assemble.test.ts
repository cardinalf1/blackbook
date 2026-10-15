import { describe, expect, it } from 'vitest';
import { EXAM_MODULES } from '../../config/examConfig';
import type { BrowseRow } from '../../types/browse';
import type { Difficulty, Section } from '../../types/sat';
import { apportion, assembleModule } from './assemble';

// Synthetic rows only: a live pool for each domain, skill, difficulty and format.
const RW_SKILLS: Record<string, string[]> = { CAS: ['WIC', 'TSP', 'CTC'], INI: ['CID', 'COE', 'INF'], SEC: ['BOU', 'FSS'], EOI: ['SYN', 'TRA'] };
const MATH_SKILLS: Record<string, string[]> = { H: ['H.A.', 'H.B.'], P: ['P.A.', 'P.C.'], Q: ['Q.A.', 'Q.B.'], S: ['S.A.', 'S.B.'] };

function pool(perCell = 6, over: (r: BrowseRow) => BrowseRow = (r) => r): BrowseRow[] {
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

describe('apportion', () => {
  it('splits by largest remainder and always adds up', () => {
    expect(apportion(27, [28, 26, 26, 20])).toEqual([8, 7, 7, 5]);
    expect(apportion(22, [35, 35, 15, 15])).toEqual([8, 8, 3, 3]);
    expect(apportion(6, [8, 8, 3, 3])).toEqual([2, 2, 1, 1]);
    expect(apportion(8, [1, 1, 1])).toEqual([3, 3, 2]);
    expect(apportion(0, [1, 1])).toEqual([0, 0]);
  });
});

describe('assembleModule', () => {
  const rows = pool();
  const byId = new Map(rows.map((r) => [r.id, r]));

  it('Reading and Writing: 27 unique live questions, domain counts from the config, official domain order', () => {
    const m = assembleModule(rows, { section: 'rw', moduleNumber: 1, tier: 'routing' }, seeded(1));
    expect(m.questionIds).toHaveLength(27);
    expect(new Set(m.questionIds).size).toBe(27);
    expect(m.notes).toEqual([]);
    const doms = m.questionIds.map((id) => byId.get(id)?.domainCode);
    expect(doms).toEqual([...Array(8).fill('CAS'), ...Array(7).fill('INI'), ...Array(7).fill('SEC'), ...Array(5).fill('EOI')]);
    // Inside a domain: by skill, then easiest to hardest (SEC: difficulty only).
    const rank = { E: 0, M: 1, H: 2 } as const;
    const cas = m.questionIds.slice(0, 8).map((id) => byId.get(id) as BrowseRow);
    for (let i = 1; i < cas.length; i++) {
      const a = cas[i - 1] as BrowseRow;
      const b = cas[i] as BrowseRow;
      const order = ['WIC', 'TSP', 'CTC'];
      expect(order.indexOf(a.skillCode) < order.indexOf(b.skillCode) || (a.skillCode === b.skillCode && rank[a.difficulty] <= rank[b.difficulty])).toBe(true);
    }
    const sec = m.questionIds.slice(15, 22).map((id) => rank[(byId.get(id) as BrowseRow).difficulty]);
    expect(sec).toEqual([...sec].sort());
  });

  it('a broad mix: a third of each domain at each difficulty', () => {
    const m = assembleModule(rows, { section: 'rw', moduleNumber: 1, tier: 'routing' }, seeded(2));
    const cas = m.questionIds.slice(0, 8).map((id) => byId.get(id)?.difficulty);
    expect(cas.filter((d) => d === 'E')).toHaveLength(3);
    expect(cas.filter((d) => d === 'M')).toHaveLength(3);
    expect(cas.filter((d) => d === 'H')).toHaveLength(2);
  });

  it('Math (official order, the default): 22 questions, easiest to hardest across the whole module, ties by domain', () => {
    const m = assembleModule(rows, { section: 'math', moduleNumber: 1, tier: 'routing' }, seeded(3));
    const picked = m.questionIds.map((id) => byId.get(id) as BrowseRow);
    expect(picked).toHaveLength(EXAM_MODULES.math.questions);
    expect(picked.filter((r) => r.format === 'spr')).toHaveLength(6);
    const count = (code: string) => picked.filter((r) => r.domainCode === code).length;
    expect([count('H'), count('P'), count('Q'), count('S')]).toEqual([8, 8, 3, 3]);
    const key = (r: BrowseRow) => ({ E: 0, M: 1, H: 2 }[r.difficulty]) * 10 + ['H', 'P', 'Q', 'S'].indexOf(r.domainCode);
    const keys = picked.map(key);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
  });

  it('Math (spec switch): multiple choice first, 6 student-produced responses last, each block by domain then difficulty', () => {
    const m = assembleModule(rows, { section: 'math', moduleNumber: 1, tier: 'routing' }, seeded(3), 'spec');
    const picked = m.questionIds.map((id) => byId.get(id) as BrowseRow);
    expect(picked).toHaveLength(EXAM_MODULES.math.questions);
    expect(picked.map((r) => r.format)).toEqual([...Array(16).fill('mcq'), ...Array(6).fill('spr')]);
    const key = (r: BrowseRow) => ['H', 'P', 'Q', 'S'].indexOf(r.domainCode) * 10 + { E: 0, M: 1, H: 2 }[r.difficulty];
    const mcq = picked.slice(0, 16).map(key);
    const spr = picked.slice(16).map(key);
    expect(mcq).toEqual([...mcq].sort((a, b) => a - b));
    expect(spr).toEqual([...spr].sort((a, b) => a - b));
  });

  it('uses the live set only', () => {
    const mixed = pool(6, (r) => ({ ...r, active: !r.id.endsWith('0') }));
    const m = assembleModule(mixed, { section: 'rw', moduleNumber: 1, tier: 'routing' }, seeded(4));
    expect(m.questionIds.every((id) => !id.endsWith('0'))).toBe(true);
  });

  it('prefers questions not seen before', () => {
    // Everything done except a few unseen per cell: the unseen ones must all be used first.
    const r2 = pool(6, (r) => ({ ...r, status: Number(r.id.split('-')[1]) % 6 < 2 ? 'unseen' : 'done' }));
    const m = assembleModule(r2, { section: 'rw', moduleNumber: 1, tier: 'routing' }, seeded(5), undefined, undefined, { allowSoft: true, allowRepeats: true });
    expect(m.freshness).toEqual({ fresh: 27, soft: 0, consumed: 0 });
  });

  it('a thin domain is reported in plain words and never padded or repeated', () => {
    const thin = pool().filter((r) => !(r.section === 'rw' && r.domainCode === 'EOI' && r.id.split('-')[1] !== undefined && Number(r.id.split('-')[1]) % 12 !== 0));
    const eoiLeft = thin.filter((r) => r.section === 'rw' && r.domainCode === 'EOI').length;
    expect(eoiLeft).toBeLessThan(5);
    const m = assembleModule(thin, { section: 'rw', moduleNumber: 1, tier: 'routing' }, seeded(6));
    expect(m.questionIds).toHaveLength(22 + eoiLeft);
    expect(new Set(m.questionIds).size).toBe(m.questionIds.length);
    expect(m.domains.find((d) => d.code === 'EOI')).toMatchObject({ planned: 5, actual: eoiLeft });
    expect(m.notes.some((n) => n.startsWith(`Only ${eoiLeft} live Expression of Ideas questions`))).toBe(true);
    // Other domains still exactly as planned: nothing borrowed across domains.
    expect(m.domains.filter((d) => d.code !== 'EOI').every((d) => d.actual === d.planned)).toBe(true);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const a = assembleModule(rows, { section: 'math', moduleNumber: 1, tier: 'routing' }, seeded(9)).questionIds;
    const b = assembleModule(rows, { section: 'math', moduleNumber: 1, tier: 'routing' }, seeded(9)).questionIds;
    const c = assembleModule(rows, { section: 'math', moduleNumber: 1, tier: 'routing' }, seeded(10)).questionIds;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
