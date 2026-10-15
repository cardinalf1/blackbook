// Before a test starts: can every module, including BOTH possible module 2s of each section, be
// built from the questions the eligibility rule allows? Then assembly can never fail halfway.
// Pure: rows come in. The rule itself lives in services/eligibility; this file only asks it.

import { EXAM_MODULES } from '../../config/examConfig';
import type { BrowseRow } from '../../types/browse';
import type { Section } from '../../types/sat';
import type { SectionPreflight, TestKind, TestPreflight } from '../../types/test';
import { assembleModule, type Rng } from '../exam/assemble';
import { STRICT_POLICY, type EligibilityPolicy } from '../eligibility/eligibility';

const SECTION_LABEL: Record<Section, string> = { rw: 'Reading and Writing', math: 'Math' };

interface Variant {
  label: string;
  moduleNumber: 1 | 2;
  tier: 'routing' | 'easier' | 'harder';
}
export const VARIANTS: readonly Variant[] = [
  { label: 'Module 1', moduleNumber: 1, tier: 'routing' },
  { label: 'the easier Module 2', moduleNumber: 2, tier: 'easier' },
  { label: 'the harder Module 2', moduleNumber: 2, tier: 'harder' },
];

export interface SectionBuild {
  /** Every module reached its full size. */
  complete: boolean;
  /** Plain-language shortfall lines; empty when each module met its full plan. */
  lines: string[];
  /** Question ids of Module 1 and of each module 2 variant. */
  module1: string[];
  easier: string[];
  harder: string[];
}

/** Builds module 1 and each module 2 variant (excluding module 1's questions) under `policy`. */
export function buildSection(
  rows: readonly BrowseRow[],
  section: Section,
  rng: Rng,
  policy: EligibilityPolicy,
  exclude: ReadonlySet<string> = new Set(),
): SectionBuild {
  const want = EXAM_MODULES[section].questions;
  const lines: string[] = [];
  let complete = true;
  const m1 = assembleModule(rows, { section, moduleNumber: 1, tier: 'routing' }, rng, undefined, exclude, policy);
  const used = new Set([...exclude, ...m1.questionIds]);
  const ids: Record<string, string[]> = { routing: m1.questionIds };
  for (const v of VARIANTS) {
    const m = v.moduleNumber === 1 ? m1 : assembleModule(rows, { section, moduleNumber: 2, tier: v.tier }, rng, undefined, used, policy);
    ids[v.tier] = m.questionIds;
    if (m.questionIds.length < want) complete = false;
    for (const n of m.notes) lines.push(`${SECTION_LABEL[section]}, ${v.label}: ${n}`);
  }
  return { complete, lines, module1: ids.routing as string[], easier: ids.easier as string[], harder: ids.harder as string[] };
}

const check = (rows: readonly BrowseRow[], section: Section, rng: Rng, policy: EligibilityPolicy) => buildSection(rows, section, rng, policy);

export function preflightSection(rows: readonly BrowseRow[], section: Section, rng: Rng = Math.random): SectionPreflight {
  const fresh = check(rows, section, rng, STRICT_POLICY);
  const soft = check(rows, section, rng, { allowSoft: true, allowRepeats: false });
  const any = check(rows, section, rng, { allowSoft: true, allowRepeats: true });
  const unseenOk = fresh.complete && fresh.lines.length === 0;
  const softOk = soft.complete && soft.lines.length === 0;
  const shortfalls = unseenOk
    ? []
    : fresh.lines.length > 0
      ? fresh.lines
      : [`${SECTION_LABEL[section]}: not enough questions you have not already seen to build both modules.`];
  return { section, unseenOk, softOk, anyOk: any.complete, shortfalls };
}

export function sectionsFor(kind: TestKind): Section[] {
  return kind === 'full' ? ['rw', 'math'] : [kind];
}

export function preflightTest(rows: readonly BrowseRow[], kind: TestKind, rng: Rng = Math.random): TestPreflight {
  const sections = sectionsFor(kind).map((s) => preflightSection(rows, s, rng));
  return {
    sections,
    allUnseen: sections.every((s) => s.unseenOk),
    allSoft: sections.every((s) => s.softOk),
    allPossible: sections.every((s) => s.anyOk),
  };
}
