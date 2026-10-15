// A synthetic bank of browse rows with a live pool for every domain, skill, difficulty and format.
// Synthetic only: no real question text or ids.

import type { BrowseRow } from '../../types/browse';
import type { Difficulty, Section } from '../../types/sat';

const RW_SKILLS: Record<string, string[]> = { CAS: ['WIC', 'TSP', 'CTC'], INI: ['CID', 'COE', 'INF'], SEC: ['BOU', 'FSS'], EOI: ['SYN', 'TRA'] };
const MATH_SKILLS: Record<string, string[]> = { H: ['H.A.', 'H.B.'], P: ['P.A.', 'P.C.'], Q: ['Q.A.', 'Q.B.'], S: ['S.A.', 'S.B.'] };

export function syntheticPool(perCell = 6, over: (r: BrowseRow) => BrowseRow = (r) => r): BrowseRow[] {
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

/** A small deterministic random source for repeatable assembly. */
export function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
