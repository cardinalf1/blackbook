// Builds one exam module from the live set. Pure: rows (with seen status) and randomness come in.
// Shape and order come from src/config/examConfig.ts; see docs/exam-spec.md for what is verified.
// A domain short of questions is reported in plain words; the module is never padded with other
// domains' questions and never repeats a question.

import { TIER_MIX } from '../../config/scoringConfig';
import { DIFFICULTY_MIX, EXAM_MODULES, MATH_ORDER, RW_DIFFICULTY_ONLY_DOMAINS, RW_SKILL_ORDER } from '../../config/examConfig';
import type { BrowseRow, SeenStatus } from '../../types/browse';
import type { AssembledModule, ExamModuleSpec } from '../../types/exam';
import type { Difficulty } from '../../types/sat';

export type Rng = () => number;

const DIFF_RANK: Record<Difficulty, number> = { E: 0, M: 1, H: 2 };
const FRESH_RANK: Record<SeenStatus, number> = { unseen: 0, seen: 1, done: 2 };
const DIFF_WORD: Record<Difficulty, string> = { E: 'easy', M: 'medium', H: 'hard' };

/** Splits `total` across `weights` by largest remainder; ties go to the earlier entry. */
export function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((s, n) => s + n, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] = (out[i] as number) + 1;
    left--;
  }
  return out;
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** Up to `n` rows from `pool`, unseen first, then seen but not done, then done; random within each. */
function pickFresh(pool: readonly BrowseRow[], n: number, rng: Rng): BrowseRow[] {
  if (n <= 0) return [];
  return shuffle(pool, rng)
    .sort((a, b) => FRESH_RANK[a.status] - FRESH_RANK[b.status])
    .slice(0, n);
}

/**
 * Picks `n` rows of one domain and format: easy, medium and hard in the proportions of the module's tier (equal thirds for module 1) where the pool
 * allows; a short difficulty is filled from the others in the same domain and format (noted).
 */
function pickSpread(pool: readonly BrowseRow[], n: number, rng: Rng, label: string, notes: string[], mix: readonly number[]): BrowseRow[] {
  const targets = apportion(n, mix);
  const chosen: BrowseRow[] = [];
  let short = 0;
  DIFFICULTY_MIX.forEach((d, i) => {
    const want = targets[i] as number;
    const got = pickFresh(pool.filter((r) => r.difficulty === d), want, rng);
    if (got.length < want) notes.push(`Not enough ${DIFF_WORD[d]} ${label} questions: ${got.length} of ${want}. Others of the same kind fill the gap.`);
    short += want - got.length;
    chosen.push(...got);
  });
  if (short > 0) {
    const used = new Set(chosen.map((r) => r.id));
    chosen.push(...pickFresh(pool.filter((r) => !used.has(r.id)), short, rng));
  }
  return chosen;
}

function skillRank(code: string): number {
  const i = RW_SKILL_ORDER.indexOf(code);
  return i < 0 ? RW_SKILL_ORDER.length : i;
}

export function assembleModule(
  rows: readonly BrowseRow[],
  spec: ExamModuleSpec,
  rng: Rng = Math.random,
  mathOrder: 'spec' | 'official' = MATH_ORDER,
  exclude: ReadonlySet<string> = new Set(),
): AssembledModule {
  const shape = EXAM_MODULES[spec.section];
  const live = rows.filter((r) => r.active && r.section === spec.section && !exclude.has(r.id));
  const notes: string[] = [];
  const mix = TIER_MIX[spec.tier];
  const isMath = spec.section === 'math';

  // Student-produced responses per domain (Math only), in proportion to each domain's count.
  const sprPerDomain = isMath ? apportion(shape.sprCount, shape.domains.map((d) => d.count)) : shape.domains.map(() => 0);

  const domainOrder = new Map(shape.domains.map((d, i) => [d.code, i]));
  const picked: BrowseRow[] = [];
  const domains: AssembledModule['domains'] = [];

  shape.domains.forEach((d, i) => {
    const pool = live.filter((r) => r.domainCode === d.code);
    const sprWant = sprPerDomain[i] as number;
    const mcqWant = d.count - sprWant;
    let got: BrowseRow[] = [];
    if (isMath) {
      const spr = pickSpread(pool.filter((r) => r.format === 'spr'), sprWant, rng, `${d.label} student-produced response`, notes, mix);
      const mcq = pickSpread(pool.filter((r) => r.format === 'mcq'), mcqWant, rng, `${d.label} multiple-choice`, notes, mix);
      got = [...mcq, ...spr];
    } else {
      got = pickSpread(pool, d.count, rng, d.label, notes, mix);
    }
    if (got.length < d.count) {
      notes.push(`Only ${got.length} live ${d.label} questions were available for ${d.count} places. The module has ${d.count - got.length} fewer questions; nothing was added in their place.`);
    }
    domains.push({ code: d.code, label: d.label, planned: d.count, actual: got.length });
    picked.push(...got);
  });

  const byDomainThenDifficulty = (a: BrowseRow, b: BrowseRow) =>
    (domainOrder.get(a.domainCode) ?? 99) - (domainOrder.get(b.domainCode) ?? 99) || DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty];

  let ordered: BrowseRow[];
  if (!isMath) {
    // VERIFIED: domain order; by skill then easiest to hardest, except difficulty only in SEC.
    ordered = [...picked].sort((a, b) => {
      const dom = (domainOrder.get(a.domainCode) ?? 99) - (domainOrder.get(b.domainCode) ?? 99);
      if (dom !== 0) return dom;
      if (!RW_DIFFICULTY_ONLY_DOMAINS.includes(a.domainCode)) {
        const sk = skillRank(a.skillCode) - skillRank(b.skillCode);
        if (sk !== 0) return sk;
      }
      return DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty];
    });
  } else if (mathOrder === 'spec') {
    ordered = [...picked.filter((r) => r.format === 'mcq').sort(byDomainThenDifficulty), ...picked.filter((r) => r.format === 'spr').sort(byDomainThenDifficulty)];
  } else {
    ordered = [...picked].sort(
      (a, b) => DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty] || (domainOrder.get(a.domainCode) ?? 99) - (domainOrder.get(b.domainCode) ?? 99),
    );
  }

  const freshness = { unseen: 0, seen: 0, done: 0 };
  for (const r of ordered) freshness[r.status]++;
  return { spec, questionIds: ordered.map((r) => r.id), notes, domains, freshness };
}
