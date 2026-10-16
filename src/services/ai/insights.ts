// The AI-assisted report's raw material. Code computes every insight (headline number, facts,
// sample size); the model may only pick 5 to 7 of them, order them and write one sentence each
// using numbers from the facts. Any sentence with a number that is not in its facts is dropped.
// Pure.

import type { Insight, ReportLine, ReportPeriod } from '../../types/ai';
import { MISTAKE_REASON_LABEL, type MistakeReason } from '../../types/mistakes';
import type { Section } from '../../types/sat';

/** Answers on a skill below this share right count as "below target". A practice target, not a score claim. */
export const TARGET_ACCURACY = 0.8;
/** Insights resting on fewer answers than this are marked "thin data". */
export const THIN_SAMPLE = 20;
export const REPORT_MIN = 5;
export const REPORT_MAX = 7;

export interface InsightInputs {
  period: ReportPeriod;
  answered: number;
  correct: number;
  skills: { skillCode: string; skill: string; section: Section; answered: number; correct: number }[];
  /** Wrong answers given much faster than your own baseline, and answers much slower than it. */
  rushedWrong: number;
  stuck: number;
  reasons: Partial<Record<MistakeReason, number>>;
  /** Same counts for the period before, when there is one. */
  reasonsBefore: Partial<Record<MistakeReason, number>> | null;
  lastFive: { modules: number; reached: number; answeredInLastFive: number };
  changes: { correctToIncorrect: number; incorrectToCorrect: number; incorrectToIncorrect: number };
  retry: { answered: number; correct: number; due: number; queued: number };
  pool: { full: number; rw: number; math: number };
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0);
const sum = (r: Partial<Record<string, number>>) => Object.values(r).reduce<number>((s, x) => s + (x ?? 0), 0);

export function buildInsights(i: InsightInputs): Insight[] {
  const out: Insight[] = [];
  const add = (x: Omit<Insight, 'thin'>) => out.push({ ...x, thin: x.sampleSize < THIN_SAMPLE });

  const below = i.skills.filter((s) => s.answered > 0 && s.correct / s.answered < TARGET_ACCURACY).sort((a, b) => a.correct / a.answered - b.correct / b.answered);
  if (below.length > 0) {
    const w = below[0] as (typeof below)[number];
    add({
      id: 'skills_below_target',
      title: 'Skills below target',
      headline: `${below.length} skills under ${Math.round(TARGET_ACCURACY * 100)}% right; weakest is ${w.skill} at ${pct(w.correct, w.answered)}%`,
      facts: { skillsBelow: below.length, targetPercent: Math.round(TARGET_ACCURACY * 100), weakestPercent: pct(w.correct, w.answered), weakestAnswered: w.answered, weakestCorrect: w.correct },
      sampleSize: below.reduce((s, x) => s + x.answered, 0),
      priority: 90,
    });
  }

  const wrong = i.answered - i.correct;
  if (i.rushedWrong + i.stuck > 0) {
    add({
      id: 'fast_vs_slow',
      title: 'Rushed misses and stuck questions',
      headline: `${i.rushedWrong} rushed misses, ${i.stuck} stuck questions`,
      facts: { rushedWrong: i.rushedWrong, stuck: i.stuck, wrong },
      sampleSize: i.answered,
      priority: 70 + Math.min(20, i.rushedWrong),
    });
  }

  const tagged = sum(i.reasons);
  if (tagged > 0) {
    const top = (Object.entries(i.reasons) as [MistakeReason, number][]).sort((a, b) => b[1] - a[1])[0] as [MistakeReason, number];
    const before = i.reasonsBefore?.[top[0]] ?? null;
    add({
      id: 'mistake_reasons',
      title: 'Why you miss',
      headline: `${MISTAKE_REASON_LABEL[top[0]]}: ${top[1]} of ${tagged} tagged misses`,
      facts: { topCount: top[1], tagged, ...(before === null ? {} : { topCountBefore: before }) },
      sampleSize: tagged,
      priority: 80,
    });
  }

  if (i.lastFive.reached > 0) {
    add({
      id: 'last_five_minutes',
      title: 'Last five minutes',
      headline: `${i.lastFive.answeredInLastFive} questions answered in the last five minutes over ${i.lastFive.reached} modules`,
      facts: { answeredInLastFive: i.lastFive.answeredInLastFive, modulesReached: i.lastFive.reached, modules: i.lastFive.modules },
      sampleSize: i.lastFive.modules,
      priority: 60 + i.lastFive.answeredInLastFive,
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
    });
  }

  add({
    id: 'pool_health',
    title: 'Fresh questions left',
    headline: `About ${i.pool.full} full tests left (estimate)`,
    facts: { fullTests: i.pool.full, rwTests: i.pool.rw, mathTests: i.pool.math },
    sampleSize: THIN_SAMPLE,
    priority: i.pool.full < 3 ? 85 : 30,
  });

  if (i.answered > 0) {
    add({
      id: 'overall',
      title: 'Overall',
      headline: `${i.correct} of ${i.answered} right (${pct(i.correct, i.answered)}%)`,
      facts: { answered: i.answered, correct: i.correct, percent: pct(i.correct, i.answered) },
      sampleSize: i.answered,
      priority: 40,
    });
  }
  return out;
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
    .map((x) => ({ insightId: x.id, title: x.title, headline: x.headline, sentence: ruleSentence(x), thin: x.thin, sampleSize: x.sampleSize }));
}

/** What the model receives: ids, titles, headlines and facts. Never question ids, text or notes. */
export function reportPrompt(insights: readonly Insight[], period: ReportPeriod): { system: string; user: string } {
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
    lines.push({ insightId: x.id, title: x.title, headline: x.headline, sentence, thin: x.thin, sampleSize: x.sampleSize });
    if (lines.length >= REPORT_MAX) break;
  }
  const minimum = Math.min(REPORT_MIN, insights.length);
  if (lines.length < Math.min(3, minimum)) return null;
  const allFacts = insights.flatMap((x) => Object.values(x.facts));
  const next = json.nextWeek.replace(/\s+/g, ' ').trim().slice(0, 300);
  return { lines, nextWeek: next !== '' && numbersAllowed(next, allFacts) ? next : null, dropped };
}
