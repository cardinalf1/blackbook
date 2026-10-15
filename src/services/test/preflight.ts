// Before a test starts: can every module, including BOTH possible module 2s of each section, be
// built from unseen questions? Then assembly can never fail halfway. Pure: rows come in.

import { EXAM_MODULES } from '../../config/examConfig';
import type { BrowseRow } from '../../types/browse';
import type { Section } from '../../types/sat';
import type { SectionPreflight, TestKind, TestPreflight } from '../../types/test';
import { assembleModule, type Rng } from '../exam/assemble';

const SECTION_LABEL: Record<Section, string> = { rw: 'Reading and Writing', math: 'Math' };

interface Variant {
  label: string;
  moduleNumber: 1 | 2;
  tier: 'routing' | 'easier' | 'harder';
}
const VARIANTS: readonly Variant[] = [
  { label: 'Module 1', moduleNumber: 1, tier: 'routing' },
  { label: 'the easier Module 2', moduleNumber: 2, tier: 'easier' },
  { label: 'the harder Module 2', moduleNumber: 2, tier: 'harder' },
];

/** Builds module 1 and each module 2 variant (excluding module 1's questions) from `rows`. */
function check(rows: readonly BrowseRow[], section: Section, rng: Rng): { complete: boolean; lines: string[] } {
  const want = EXAM_MODULES[section].questions;
  const lines: string[] = [];
  let complete = true;
  const m1 = assembleModule(rows, { section, moduleNumber: 1, tier: 'routing' }, rng);
  const used = new Set(m1.questionIds);
  for (const v of VARIANTS) {
    const m = v.moduleNumber === 1 ? m1 : assembleModule(rows, { section, moduleNumber: 2, tier: v.tier }, rng, undefined, used);
    if (m.questionIds.length < want) complete = false;
    for (const n of m.notes) lines.push(`${SECTION_LABEL[section]}, ${v.label}: ${n}`);
  }
  return { complete, lines };
}

export function preflightSection(rows: readonly BrowseRow[], section: Section, rng: Rng = Math.random): SectionPreflight {
  const unseen = check(rows.filter((r) => r.status === 'unseen'), section, rng);
  const any = check(rows, section, rng);
  const unseenOk = unseen.complete && unseen.lines.length === 0;
  const shortfalls = unseenOk
    ? []
    : unseen.lines.length > 0
      ? unseen.lines
      : [`${SECTION_LABEL[section]}: not enough unseen questions to build both modules.`];
  return { section, unseenOk, anyOk: any.complete, shortfalls };
}

export function sectionsFor(kind: TestKind): Section[] {
  return kind === 'full' ? ['rw', 'math'] : [kind];
}

export function preflightTest(rows: readonly BrowseRow[], kind: TestKind, rng: Rng = Math.random): TestPreflight {
  const sections = sectionsFor(kind).map((s) => preflightSection(rows, s, rng));
  return { sections, allUnseen: sections.every((s) => s.unseenOk), allPossible: sections.every((s) => s.anyOk) };
}
