// Mistake tags: which misses to offer for tagging, the suggestion shown beside each, the tag in
// force, and the rows of the mistake log. Pure. A suggestion is only shown; nothing is saved
// until the user confirms it.

import { CARELESS_TIME_RATIO, MIN_ANSWERS_FOR_MEDIAN } from '../../config/mistakeConfig';
import type { BrowseRow } from '../../types/browse';
import type { MistakeItem, MistakeLogRow, MistakeSuggestion, MistakeTag } from '../../types/mistakes';
import type { SessionReport, SessionSource, StoredAttempt } from '../../types/session';

const pairKey = (sessionId: string, questionId: string) => `${sessionId}:${questionId}`;

/** The tag in force for each (session, question): the newest one. Ties go to the later id. */
export function latestTags(tags: readonly MistakeTag[]): Map<string, MistakeTag> {
  const out = new Map<string, MistakeTag>();
  for (const t of tags) {
    const k = pairKey(t.sessionId, t.questionId);
    const prev = out.get(k);
    if (!prev || t.at > prev.at || (t.at === prev.at && t.id > prev.id)) out.set(k, t);
  }
  return out;
}

export function tagVersions(tags: readonly MistakeTag[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of tags) {
    const k = pairKey(t.sessionId, t.questionId);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
};

/** Your own median answering time per skill, from all your answered final attempts. Skills with too few answers are left out. */
export function skillMedians(attempts: readonly StoredAttempt[], skillOf: (questionId: string) => string | undefined): Map<string, number> {
  const bySkill = new Map<string, number[]>();
  for (const a of attempts) {
    if (a.status !== 'final' || a.response === '') continue;
    const skill = skillOf(a.questionId);
    if (!skill) continue;
    const list = bySkill.get(skill) ?? [];
    list.push(a.timeMs);
    bySkill.set(skill, list);
  }
  const out = new Map<string, number>();
  for (const [skill, times] of bySkill) if (times.length >= MIN_ANSWERS_FOR_MEDIAN) out.set(skill, median(times));
  return out;
}

export interface SuggestInput {
  unanswered: boolean;
  /** Only for answered misses. */
  confidence: 'guess' | 'unsure' | 'sure' | null;
  timeMs: number;
  /** Your median on this skill, or null when you have too few answers on it. */
  skillMedianMs: number | null;
  /** The session was an exam module, where blanks at the end mean time ran out. */
  isExam: boolean;
}

/** One suggestion, or null. First rule that fits wins. */
export function suggestReason(i: SuggestInput): MistakeSuggestion | null {
  if (i.unanswered) {
    return i.isExam ? { reason: 'ran_out_of_time', why: 'It was still unanswered when the module ended.' } : null;
  }
  if (i.confidence === 'guess') return { reason: 'guessed', why: 'You rated this answer a guess.' };
  if (i.skillMedianMs !== null && i.timeMs < i.skillMedianMs * CARELESS_TIME_RATIO) {
    return { reason: 'careless', why: 'You answered much faster than your usual time on this skill, and got it wrong.' };
  }
  return null;
}

/**
 * The missed and unanswered questions of a finished session, each with the tag in force or, when
 * untagged, a suggestion. Misses are wrong answers and blanks, in the order asked.
 */
export function buildMistakeItems(
  report: SessionReport,
  source: SessionSource,
  tags: readonly MistakeTag[],
  medians: ReadonlyMap<string, number>,
  skillOf: (questionId: string) => string | undefined,
): MistakeItem[] {
  const inForce = latestTags(tags);
  const out: MistakeItem[] = [];
  for (const it of report.items) {
    if (it.correct) continue;
    const tag = inForce.get(pairKey(report.sessionId, it.questionId)) ?? null;
    const unanswered = it.response === null;
    const skill = skillOf(it.questionId);
    out.push({
      sessionId: report.sessionId,
      questionId: it.questionId,
      index: it.index,
      unanswered,
      timeMs: it.activeMs,
      tag,
      suggestion: tag
        ? null
        : suggestReason({ unanswered, confidence: it.confidence, timeMs: it.activeMs, skillMedianMs: skill ? (medians.get(skill) ?? null) : null, isExam: source === 'exam' }),
    });
  }
  return out;
}

/** Every pair with a tag, newest first, with the question facts the log filters on. Tags for questions no longer in the bank are left out of the list. */
export function buildMistakeLog(tags: readonly MistakeTag[], rows: ReadonlyMap<string, BrowseRow>): MistakeLogRow[] {
  const versions = tagVersions(tags);
  const out: MistakeLogRow[] = [];
  for (const tag of latestTags(tags).values()) {
    const r = rows.get(tag.questionId);
    if (!r) continue;
    out.push({
      tag,
      versions: versions.get(pairKey(tag.sessionId, tag.questionId)) ?? 1,
      section: r.section,
      domain: r.domain,
      skillCode: r.skillCode,
      skill: r.skill,
      difficulty: r.difficulty,
      displayId: r.displayId,
    });
  }
  return out.sort((a, b) => b.tag.at - a.tag.at || a.tag.id.localeCompare(b.tag.id));
}
