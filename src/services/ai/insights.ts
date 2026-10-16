// The AI-assisted report's raw material. Code computes every insight (headline number, facts,
// sample size); the model may only pick 5 to 7 of them, order them and write one sentence each
// using numbers from the facts. Any sentence with a number that is not in its facts is dropped.
// Pure.

import { MIN_ATTEMPTS_TO_RANK, STUDY_DRILL_COUNT, STUDY_TOP_SKILLS } from '../../config/analyticsConfig';
import type { CoachAction, Insight, ReportLine, ReportPeriod } from '../../types/ai';
import type { MissRow, SkillRow } from '../../types/analytics';
import { MISTAKE_REASON_LABEL, type MistakeReason } from '../../types/mistakes';
import { pooled } from '../analytics/metrics';
import { missesDrills, rankSkills } from '../analytics/rank';

/** Answers on a skill below this share right count as "below target". A practice target, not a score claim. */
export const TARGET_ACCURACY = 0.8;
/** Insights resting on fewer answers than this are marked "thin data". */
export const THIN_SAMPLE = 20;
export const REPORT_MIN = 5;
export const REPORT_MAX = 7;
/** The dashboard coach shows at most this many insights. */
export const COACH_MAX = 3;

export interface InsightInputs {
  period: ReportPeriod | 'custom';
  answered: number;
  correct: number;
  /** The analytics skill rows for the period (first attempts: retries are not counted). */
  skills: readonly SkillRow[];
  /** Questions whose latest answer in the period was wrong, for the review-misses button. */
  misses: readonly MissRow[];
  /** Wrong answers given much faster than your own baseline, and answers much slower than it. */
  rushedWrong: number;
  stuck: number;
  reasons: Partial<Record<MistakeReason, number>>;
  /** Same counts for the period before, when there is one. */
  reasonsBefore: Partial<Record<MistakeReason, number>> | null;
  lastFive: { modules: number; reached: number; answeredInLastFive: number };
  changes: { correctToIncorrect: number; incorrectToCorrect: number; incorrectToIncorrect: number };
  retry: { answered: number; correct: number; due: number; queued: number };
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0);
const sum = (r: Partial<Record<string, number>>) => Object.values(r).reduce<number>((s, x) => s + (x ?? 0), 0);

/** The review-misses drill for the section with the most misses, or null with none. */
function reviewAction(misses: readonly MissRow[]): CoachAction | null {
  const best = [...missesDrills(misses)].sort((a, b) => b.available - a.available)[0];
  return best ? { kind: 'drill', label: `Review ${best.config.count} missed questions`, config: best.config } : null;
}

/**
 * Every insight code can back with numbers. Pool health is not one: it is shown on the test card and
 * the numbers row. A "weakest skill" needs at least MIN_ATTEMPTS_TO_RANK first attempts and is
 * picked by the same Wilson lower-bound ranking as Study next, so 0 of 2 can never be the headline.
 */
export function buildInsights(i: InsightInputs): Insight[] {
  const out: Insight[] = [];
  const add = (x: Omit<Insight, 'thin'>) => out.push({ ...x, thin: x.sampleSize < THIN_SAMPLE });
  const review = reviewAction(i.misses);

  const proven = i.skills.filter((r) => {
    const c = pooled(r.counts);
    return c.attempts >= MIN_ATTEMPTS_TO_RANK && c.correct / c.attempts < TARGET_ACCURACY;
  });
  const ranked = rankSkills(proven, proven.length);
  const w = ranked[0];
  if (w) {
    const top = ranked.filter((r) => r.section === w.section).slice(0, STUDY_TOP_SKILLS);
    add({
      id: 'skills_below_target',
      title: 'Skills below target',
      headline: `${ranked.length} ${ranked.length === 1 ? 'skill' : 'skills'} under ${Math.round(TARGET_ACCURACY * 100)}% right with ${MIN_ATTEMPTS_TO_RANK}+ answers; weakest is ${w.skill} at ${pct(w.correct, w.attempts)}% (${w.correct} of ${w.attempts})`,
      facts: { skillsBelow: ranked.length, targetPercent: Math.round(TARGET_ACCURACY * 100), minAnswers: MIN_ATTEMPTS_TO_RANK, weakestPercent: pct(w.correct, w.attempts), weakestAnswered: w.attempts, weakestCorrect: w.correct },
      sampleSize: ranked.reduce((s, x) => s + x.attempts, 0),
      priority: 90,
      action: {
        kind: 'drill',
        label: top.length === 1 ? `Drill ${w.skill}` : `Drill your ${top.length} weakest skills`,
        config: { section: w.section, domainCode: 'all', skillCodes: top.map((t) => t.skillCode), difficulties: [], count: STUDY_DRILL_COUNT, liveOnly: true },
      },
    });
  }

  const wrong = i.answered - i.correct;
  if (i.rushedWrong + i.stuck > 0) {
    add({
      id: 'fast_vs_slow',
      title: 'Rushed misses and stuck questions',
      headline: `${i.rushedWrong} rushed ${i.rushedWrong === 1 ? 'miss' : 'misses'}, ${i.stuck} stuck ${i.stuck === 1 ? 'question' : 'questions'}`,
      facts: { rushedWrong: i.rushedWrong, stuck: i.stuck, wrong },
      sampleSize: i.answered,
      priority: 70 + Math.min(20, i.rushedWrong),
      action: review,
    });
  }

  const tagged = sum(i.reasons);
  if (tagged > 0) {
    const top = (Object.entries(i.reasons) as [MistakeReason, number][]).sort((a, b) => b[1] - a[1])[0] as [MistakeReason, number];
    const before = i.reasonsBefore?.[top[0]] ?? null;
    add({
      id: 'mistake_reasons',
      title: 'Why you miss (your tags)',
      headline: `${MISTAKE_REASON_LABEL[top[0]]}: ${top[1]} of ${tagged} tagged misses`,
      facts: { topCount: top[1], tagged, ...(before === null ? {} : { topCountBefore: before }) },
      sampleSize: tagged,
      priority: 80,
      action: review ?? { kind: 'open', label: 'Open the mistake log', target: 'mistakes' },
    });
  }

  if (i.lastFive.reached > 0) {
    add({
      id: 'last_five_minutes',
      title: 'Last five minutes',
      headline: `${i.lastFive.answeredInLastFive} ${i.lastFive.answeredInLastFive === 1 ? 'question' : 'questions'} answered in the last five minutes over ${i.lastFive.reached} ${i.lastFive.reached === 1 ? 'module' : 'modules'}`,
      facts: { answeredInLastFive: i.lastFive.answeredInLastFive, modulesReached: i.lastFive.reached, modules: i.lastFive.modules },
      sampleSize: i.lastFive.modules,
      priority: 60 + i.lastFive.answeredInLastFive,
      action: { kind: 'open', label: 'Take a timed module', target: 'exam_setup' },
    });
  }

  const changed = i.changes.correctToIncorrect + i.changes.incorrectToCorrect + i.changes.incorrectToIncorrect;
  if (changed > 0) {
    add({
      id: 'answer_changes',
      title: 'Answer changes',
      headline: `${i.changes.incorrectToCorrect} changes helped, ${i.changes.correctToIncorrect} hurt`,
      facts: { helped: i.changes.incorrectToCorrect, hurt: i.changes.correctToIncorrect, neutral: i.changes.incorrectToIncorrect, changed },
      sampleSize: changed,
      priority: 50 + Math.abs(i.changes.correctToIncorrect - i.changes.incorrectToCorrect) * 5,
      action: review,
    });
  }

  if (i.retry.queued > 0 || i.retry.answered > 0) {
    add({
      id: 'retry_progress',
      title: 'Retry queue',
      headline: `${i.retry.due} due now, ${i.retry.correct} of ${i.retry.answered} retries right`,
      facts: { due: i.retry.due, queued: i.retry.queued, retryAnswered: i.retry.answered, retryCorrect: i.retry.correct, retryPercent: pct(i.retry.correct, i.retry.answered) },
      sampleSize: i.retry.answered,
      priority: 55 + i.retry.due * 2,
      action:
        i.retry.due > 0
          ? { kind: 'retry', label: `Retry ${i.retry.due} due ${i.retry.due === 1 ? 'question' : 'questions'}` }
          : { kind: 'open', label: 'Open the mistake log', target: 'mistakes' },
    });
  }

  if (i.answered > 0) {
    add({
      id: 'overall',
      title: 'Overall',
      headline: `${i.correct} of ${i.answered} right (${pct(i.correct, i.answered)}%)`,
      facts: { answered: i.answered, correct: i.correct, percent: pct(i.correct, i.answered) },
      sampleSize: i.answered,
      priority: 40,
      action: { kind: 'open', label: 'Start a drill', target: 'drill_setup' },
    });
  }
  return out;
}

/** The coach: at most COACH_MAX insights, most useful first (rule-based order). */
export function ruleCoach(insights: readonly Insight[]): ReportLine[] {
  return ruleReport(insights).slice(0, COACH_MAX);
}

/** Plain sentences code writes when AI is off or its reply is unusable. */
export function ruleSentence(x: Insight): string {
  return `${x.headline}.`;
}

export function ruleNextWeek(insights: readonly Insight[]): string {
  const ids = new Set(insights.map((x) => x.id));
  if (ids.has('skills_below_target')) return 'Drill your weakest skill in short sets and retry the misses when they come due.';
  if (ids.has('retry_progress')) return 'Clear the retry queue before starting new material.';
  return 'Keep a steady mix of drills and one timed module.';
}

export function ruleReport(insights: readonly Insight[]): ReportLine[] {
  return [...insights]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, REPORT_MAX)
    .map((x) => ({ insightId: x.id, title: x.title, headline: x.headline, sentence: ruleSentence(x), thin: x.thin, sampleSize: x.sampleSize, action: x.action }));
}

/** What the model receives: ids, titles, headlines and facts. Never question ids, text or notes. */
export function reportPrompt(insights: readonly Insight[], period: ReportPeriod | 'custom'): { system: string; user: string } {
  const system = [
    `Pick the ${REPORT_MIN} to ${REPORT_MAX} most useful insights for a student preparing for a test, by id, most useful first.`,
    'For each, write one plain sentence of advice or observation. Use only numbers that appear in that insight\'s facts; never compute new numbers.',
    'Then write one short "what to do next week" line, also using only numbers from the facts if any.',
    'Say "thin data" when an insight is marked thin. Answer with JSON only, matching the schema.',
  ].join(' ');
  const user = JSON.stringify({ period, insights: insights.map((x) => ({ id: x.id, title: x.title, headline: x.headline, facts: x.facts, sampleSize: x.sampleSize, thin: x.thin })) });
  return { system, user };
}

export const REPORT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['picks', 'nextWeek'],
  properties: {
    picks: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['id', 'sentence'], properties: { id: { type: 'string' }, sentence: { type: 'string' } } },
    },
    nextWeek: { type: 'string' },
  },
};

/** Every number written in `text`, e.g. "62%" gives 62 and "3.5" gives 3.5. */
export function numbersIn(text: string): number[] {
  return [...text.matchAll(/(?<![A-Za-z])\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
}

/** True when every number in `text` is one of `allowed`. */
export function numbersAllowed(text: string, allowed: readonly number[]): boolean {
  return numbersIn(text).every((n) => allowed.some((a) => Math.abs(a - n) < 1e-9));
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Checks the reply: known ids only, no repeats, sentences whose numbers are all in that insight's
 * facts. Failing sentences are dropped and counted. Null when the shape is wrong or too few survive.
 */
export function readReportReply(json: unknown, insights: readonly Insight[]): { lines: ReportLine[]; nextWeek: string | null; dropped: number } | null {
  if (!isObj(json) || !Array.isArray(json.picks) || typeof json.nextWeek !== 'string') return null;
  const byId = new Map(insights.map((x) => [x.id, x]));
  const used = new Set<string>();
  const lines: ReportLine[] = [];
  let dropped = 0;
  for (const p of json.picks) {
    if (!isObj(p) || typeof p.id !== 'string' || typeof p.sentence !== 'string') return null;
    const x = byId.get(p.id);
    if (!x || used.has(p.id)) {
      dropped++;
      continue;
    }
    const sentence = p.sentence.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (sentence === '' || !numbersAllowed(sentence, Object.values(x.facts))) {
      dropped++;
      continue;
    }
    used.add(p.id);
    lines.push({ insightId: x.id, title: x.title, headline: x.headline, sentence, thin: x.thin, sampleSize: x.sampleSize, action: x.action });
    if (lines.length >= REPORT_MAX) break;
  }
  const minimum = Math.min(REPORT_MIN, insights.length);
  if (lines.length < Math.min(3, minimum)) return null;
  const allFacts = insights.flatMap((x) => Object.values(x.facts));
  const next = json.nextWeek.replace(/\s+/g, ' ').trim().slice(0, 300);
  return { lines, nextWeek: next !== '' && numbersAllowed(next, allFacts) ? next : null, dropped };
}
