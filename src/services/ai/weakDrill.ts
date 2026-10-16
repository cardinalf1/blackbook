// Weak-skill drill: code ranks skills, builds the candidates, and enforces every constraint. The
// model (when used) only selects and orders from the candidates and writes short group reasons.
// Pure: rows, attempts and questions come in.

import { AI_MAX_CANDIDATES, AI_MAX_TEXT_CHARS, AI_TOKEN_BUDGET } from '../../config/aiConfig';
import type { Candidate, WeakDrillGroup } from '../../types/ai';
import type { BrowseRow } from '../../types/browse';
import type { MistakeReason } from '../../types/mistakes';
import type { Difficulty, Question, Section } from '../../types/sat';
import type { StoredAttempt } from '../../types/session';
import { wilsonLowerBound } from '../analytics/metrics';
import { tierOf } from '../eligibility/eligibility';
import { htmlToPlain } from './plainText';

/** Skills drawn from, weakest first. */
export const WEAK_SKILL_COUNT = 4;
/** Skills with fewer first-attempt answers than this are not ranked (too little to say "weak"). */
export const MIN_SKILL_ANSWERS = 3;
/** No skill may fill more than this share of the drill when other skills have candidates. */
export const MAX_SKILL_SHARE = 0.5;
/** No difficulty may fill more than this share of the drill when others have candidates. */
export const MAX_DIFFICULTY_SHARE = 0.7;

export interface SkillStanding {
  skillCode: string;
  skill: string;
  section: Section;
  answered: number;
  correct: number;
  /** Wilson lower bound of first-attempt accuracy: thin data cannot look strong or weak by luck. */
  lowerBound: number;
}

/**
 * Ranks skills by the Wilson lower bound of first-attempt accuracy. `attempts` must already be the
 * countable first attempts (finished, final, not retries; see drill/stats countableAttempts).
 * Only skills with answers can be ranked; sorted weakest first.
 */
export function rankWeakSkills(attempts: readonly StoredAttempt[], rows: ReadonlyMap<string, BrowseRow>, section: Section | 'both'): SkillStanding[] {
  const acc = new Map<string, SkillStanding>();
  for (const a of attempts) {
    const r = rows.get(a.questionId);
    if (!r || (section !== 'both' && r.section !== section)) continue;
    const s = acc.get(r.skillCode) ?? { skillCode: r.skillCode, skill: r.skill, section: r.section, answered: 0, correct: 0, lowerBound: 0 };
    s.answered++;
    if (a.correct) s.correct++;
    acc.set(r.skillCode, s);
  }
  return [...acc.values()]
    .filter((s) => s.answered >= MIN_SKILL_ANSWERS)
    .map((s) => ({ ...s, lowerBound: wilsonLowerBound(s.correct, s.answered) }))
    .sort((a, b) => a.lowerBound - b.lowerBound || b.answered - a.answered || a.skill.localeCompare(b.skill));
}

/** The difficulties that match a skill level, in preference order: the level first, one stretch up. */
export function difficultyPlan(lowerBound: number): Difficulty[] {
  if (lowerBound < 0.35) return ['E', 'M', 'H'];
  if (lowerBound < 0.65) return ['M', 'H', 'E'];
  return ['H', 'M', 'E'];
}

/**
 * Candidates: live questions in the weakest skills that exams have not consumed. Never-seen ones
 * first, then those seen but unanswered; within each, difficulty in the order of the skill's plan.
 * Capped at AI_MAX_CANDIDATES, spread across the skills.
 */
export function buildCandidates(rows: readonly BrowseRow[], skills: readonly SkillStanding[], bands: ReadonlyMap<string, number | null>, max = AI_MAX_CANDIDATES): Candidate[] {
  const chosen = skills.slice(0, WEAK_SKILL_COUNT);
  if (chosen.length === 0) return [];
  const perSkill = Math.max(1, Math.floor(max / chosen.length));
  const out: Candidate[] = [];
  for (const s of chosen) {
    const plan = difficultyPlan(s.lowerBound);
    const pool = rows
      .filter((r) => r.active && r.skillCode === s.skillCode && tierOf(r) !== 'consumed')
      .sort((a, b) => Number(tierOf(a) === 'soft') - Number(tierOf(b) === 'soft') || plan.indexOf(a.difficulty) - plan.indexOf(b.difficulty) || a.id.localeCompare(b.id));
    for (const r of pool.slice(0, perSkill)) {
      out.push({ id: r.id, section: r.section, domainCode: r.domainCode, domain: r.domain, skillCode: r.skillCode, skill: r.skill, difficulty: r.difficulty, scoreBand: bands.get(r.id) ?? null, seen: tierOf(r) === 'soft' });
    }
  }
  return out.slice(0, max);
}

const capFor = (size: number, share: number, kinds: number) => (kinds <= 1 ? size : Math.max(1, Math.ceil(size * share)));

/**
 * Applies the constraints to an ordered list: drops unknown ids and duplicates, keeps each skill and
 * each difficulty under its cap, then fills up to `size` from `fallbackOrder`. Returns how many of
 * the proposed ids survived, so a poor proposal can be rejected.
 */
export function enforceConstraints(
  proposed: readonly string[],
  candidates: readonly Candidate[],
  size: number,
  fallbackOrder: readonly string[],
): { ids: string[]; keptFromProposal: number; repaired: boolean } {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const skillCap = capFor(size, MAX_SKILL_SHARE, new Set(candidates.map((c) => c.skillCode)).size);
  const diffCap = capFor(size, MAX_DIFFICULTY_SHARE, new Set(candidates.map((c) => c.difficulty)).size);
  const ids: string[] = [];
  const perSkill = new Map<string, number>();
  const perDiff = new Map<string, number>();
  const tryAdd = (id: string): boolean => {
    const c = byId.get(id);
    if (!c || ids.includes(id) || ids.length >= size) return false;
    if ((perSkill.get(c.skillCode) ?? 0) >= skillCap || (perDiff.get(c.difficulty) ?? 0) >= diffCap) return false;
    ids.push(id);
    perSkill.set(c.skillCode, (perSkill.get(c.skillCode) ?? 0) + 1);
    perDiff.set(c.difficulty, (perDiff.get(c.difficulty) ?? 0) + 1);
    return true;
  };
  let kept = 0;
  for (const id of proposed) if (tryAdd(id)) kept++;
  const repaired = kept !== proposed.length || ids.length < Math.min(size, candidates.length);
  for (const id of fallbackOrder) tryAdd(id);
  // If the caps leave the drill short (few skills or difficulties), fill without them.
  for (const id of fallbackOrder) {
    if (ids.length >= size) break;
    if (!ids.includes(id) && byId.has(id)) ids.push(id);
  }
  return { ids, keptFromProposal: kept, repaired };
}

/** The rule-based pick: skills in turn, weakest first, each in its candidate order. */
export function ruleBasedOrder(candidates: readonly Candidate[]): string[] {
  const bySkill = new Map<string, Candidate[]>();
  for (const c of candidates) bySkill.set(c.skillCode, [...(bySkill.get(c.skillCode) ?? []), c]);
  const lists = [...bySkill.values()];
  const out: string[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const c = l[i];
      if (c) out.push(c.id);
    }
  }
  return out;
}

export function ruleBasedGroups(ids: readonly string[], candidates: readonly Candidate[], skills: readonly SkillStanding[]): WeakDrillGroup[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const groups = new Map<string, WeakDrillGroup>();
  for (const id of ids) {
    const c = byId.get(id);
    if (!c) continue;
    const s = skills.find((x) => x.skillCode === c.skillCode);
    const g = groups.get(c.skillCode) ?? {
      label: c.skill,
      reason: s ? `${s.correct} of ${s.answered} right so far on this skill` : 'one of your weaker skills',
      questionIds: [],
    };
    g.questionIds.push(id);
    groups.set(c.skillCode, g);
  }
  return [...groups.values()];
}

// ---- What goes to the model ----

export interface WeakDrillPromptInput {
  candidates: readonly Candidate[];
  skills: readonly SkillStanding[];
  /** Mistake reasons per skill (counts of tags in force). Never notes. */
  reasonsBySkill: ReadonlyMap<string, Partial<Record<MistakeReason, number>>>;
  /** Your median time on a skill relative to the pace target, e.g. 1.3 = 30% slower. */
  paceBySkill: ReadonlyMap<string, number>;
  /** Present only when the user allowed question text. */
  questions: ReadonlyMap<string, Question> | null;
  size: number;
}

export interface WeakDrillPrompt {
  system: string;
  user: string;
  /** Alias (sent) to real id (never sent). */
  aliases: Map<string, string>;
  usedText: boolean;
  approxTokens: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Plain text of a question, as allowed: passage, stem and choices. Never the rationale or the key. */
export function questionText(q: Question, max = AI_MAX_TEXT_CHARS): { passage: string; stem: string; choices: string[] } {
  return {
    passage: htmlToPlain(q.stimulusHtml, max),
    stem: htmlToPlain(q.stemHtml, max),
    choices: q.answer.kind === 'mcq' ? q.answer.choices.map((c) => htmlToPlain(c, 160)) : [],
  };
}

export function buildWeakDrillPrompt(input: WeakDrillPromptInput): WeakDrillPrompt {
  const aliases = new Map<string, string>();
  const items = input.candidates.map((c, i) => {
    const alias = `c${String(i + 1).padStart(2, '0')}`;
    aliases.set(alias, c.id);
    return { alias, c };
  });
  const skills = input.skills
    .filter((s) => input.candidates.some((c) => c.skillCode === s.skillCode))
    .map((s) => ({
      skill: s.skill,
      domain: input.candidates.find((c) => c.skillCode === s.skillCode)?.domain ?? '',
      answered: s.answered,
      correct: s.correct,
      accuracyLowerBound: round2(s.lowerBound),
      timeVsPaceTarget: input.paceBySkill.has(s.skillCode) ? round2(input.paceBySkill.get(s.skillCode) as number) : null,
      mistakeReasons: input.reasonsBySkill.get(s.skillCode) ?? {},
    }));
  const build = (withTextFor: number) =>
    items.map(({ alias, c }, i) => {
      const base = { alias, domain: c.domain, skill: c.skill, difficulty: c.difficulty, scoreBand: c.scoreBand, seenBefore: c.seen };
      const q = input.questions?.get(c.id);
      return q && i < withTextFor ? { ...base, ...questionText(q) } : base;
    });
  const system = [
    'You help a student build one practice set from a fixed list of candidate questions.',
    `Pick exactly ${input.size} different candidates by their alias (or all of them if there are fewer), order them easiest first within each group, and group them by the concept or slip they target.`,
    'Use only aliases from the list. Never invent aliases. Each group gets a short label and one short reason (under 15 words) based only on the statistics given.',
    'Prefer a mix of skills, never near-duplicate questions, and questions that target the mistake reasons listed.',
    'Answer with JSON only, matching the schema.',
  ].join(' ');
  let n = input.questions ? items.length : 0;
  let user = JSON.stringify({ size: input.size, skills, candidates: build(n) });
  // Stay under the free-tier token limit: drop text from the lowest-ranked candidates first.
  while (n > 0 && (system.length + user.length) / 4 > AI_TOKEN_BUDGET) {
    n = Math.max(0, n - 5);
    user = JSON.stringify({ size: input.size, skills, candidates: build(n) });
  }
  return { system, user, aliases, usedText: n > 0, approxTokens: Math.ceil((system.length + user.length) / 4) };
}

export const WEAK_DRILL_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['groups'],
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'reason', 'aliases'],
        properties: {
          label: { type: 'string' },
          reason: { type: 'string' },
          aliases: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const cleanText = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Reads the model's reply. Returns the groups with real ids, or null when the shape is wrong.
 * Unknown aliases and repeats are dropped here; the caller enforces the drill constraints.
 */
export function readWeakDrillReply(json: unknown, aliases: ReadonlyMap<string, string>): { groups: WeakDrillGroup[]; order: string[]; unknown: number; duplicates: number } | null {
  if (!isObj(json) || !Array.isArray(json.groups)) return null;
  const seen = new Set<string>();
  const groups: WeakDrillGroup[] = [];
  let unknown = 0;
  let duplicates = 0;
  for (const g of json.groups) {
    if (!isObj(g) || typeof g.label !== 'string' || typeof g.reason !== 'string' || !Array.isArray(g.aliases)) return null;
    const ids: string[] = [];
    for (const a of g.aliases) {
      const id = typeof a === 'string' ? aliases.get(a) : undefined;
      if (!id) {
        unknown++;
        continue;
      }
      if (seen.has(id)) {
        duplicates++;
        continue;
      }
      seen.add(id);
      ids.push(id);
    }
    if (ids.length > 0) groups.push({ label: cleanText(g.label, 60), reason: cleanText(g.reason, 120), questionIds: ids });
  }
  return { groups, order: groups.flatMap((g) => g.questionIds), unknown, duplicates };
}
