// Study next: rank skills by how much they need work, using a method that accounts for sample size
// (the Wilson lower bound), and build the drill configs the buttons launch. Pure. Parameters are in
// src/config/analyticsConfig.ts and RANKING_EXPLANATION is shown beside the list.

import {
  COLD_START_PRIORITY,
  MIN_ATTEMPTS_TO_RANK,
  REVIEW_MISSES_COUNT,
  STUDY_DRILL_COUNT,
  STUDY_LIST_LENGTH,
  STUDY_TOP_SKILLS,
  UNSEEN_BONUS,
  UNSEEN_BONUS_RANKED,
} from '../../config/analyticsConfig';
import type { MissRow, SkillRow, StudyRecommendation } from '../../types/analytics';
import type { DrillConfig } from '../../types/drill';
import { SECTIONS, type Section } from '../../types/sat';
import { pooled, wilsonLowerBound } from './metrics';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** 0 (nothing waiting) to 1 (every live question unseen). */
const unseenShare = (r: Pick<SkillRow, 'unseenLive' | 'bankLive'>) => (r.bankLive > 0 ? r.unseenLive / r.bankLive : 0);

/** Why a skill is on the list, in plain words. Behavior and counts only; no claims about why. */
function reasonsFor(r: SkillRow, attempts: number, correct: number): string[] {
  const reasons: string[] = [];
  if (attempts === 0) reasons.push('not tried yet');
  else if (attempts < MIN_ATTEMPTS_TO_RANK) reasons.push(`few attempts so far (${attempts})`);
  else {
    const acc = correct / attempts;
    const lb = wilsonLowerBound(correct, attempts);
    if (acc < 0.7) reasons.push(`low accuracy (${pct(acc)}) over ${attempts} attempts`);
    else if (lb < 0.7) reasons.push(`${pct(acc)} over ${attempts} attempts, not yet proven strong`);
    else reasons.push(`${pct(acc)} over ${attempts} attempts, doing well`);
  }
  if (r.unseenLive >= 5 && unseenShare(r) >= 0.5) reasons.push(`${r.unseenLive} unseen questions left`);
  return reasons;
}

/**
 * Priority 0 to 1, higher first. A skill with enough answers scores 1 minus its Wilson lower
 * bound; a skill with too few scores COLD_START_PRIORITY. Both get a bonus for unseen questions.
 * Drill and exam answers are pooled here and nowhere else.
 */
export function rankSkills(rows: readonly SkillRow[], length: number = STUDY_LIST_LENGTH): StudyRecommendation[] {
  const out: StudyRecommendation[] = [];
  for (const r of rows) {
    if (r.bankLive === 0) continue;
    const { attempts, correct } = pooled(r.counts);
    const priority =
      attempts >= MIN_ATTEMPTS_TO_RANK
        ? Math.min(1, 1 - wilsonLowerBound(correct, attempts) + UNSEEN_BONUS_RANKED * unseenShare(r))
        : COLD_START_PRIORITY + UNSEEN_BONUS * unseenShare(r);
    out.push({
      skillCode: r.skillCode, skill: r.skill, domain: r.domain, section: r.section, priority, attempts, correct,
      unseenLive: r.unseenLive, bankLive: r.bankLive, reasons: reasonsFor(r, attempts, correct),
    });
  }
  out.sort((a, b) => b.priority - a.priority || a.attempts - b.attempts || a.skill.localeCompare(b.skill));
  return out.slice(0, length);
}

export interface TopSkillsDrill {
  section: Section;
  skills: StudyRecommendation[];
  config: DrillConfig;
}

/**
 * One drill config per section: the top-ranked skills of that section, any difficulty, live
 * questions. The drill picker already serves never-answered questions first, so this prefers
 * unseen questions. Sections with no recommendation are left out.
 */
export function topSkillsDrills(recs: readonly StudyRecommendation[]): TopSkillsDrill[] {
  const out: TopSkillsDrill[] = [];
  for (const section of SECTIONS) {
    const skills = recs.filter((r) => r.section === section).slice(0, STUDY_TOP_SKILLS);
    if (skills.length === 0) continue;
    out.push({
      section,
      skills,
      config: { section, domainCode: 'all', skillCodes: skills.map((s) => s.skillCode), difficulties: [], count: STUDY_DRILL_COUNT, liveOnly: true },
    });
  }
  return out;
}

export interface MissesDrill {
  section: Section;
  /** Missed questions available in this section. */
  available: number;
  config: DrillConfig;
}

/**
 * One review config per section that has misses: those questions, oldest miss first, served in
 * that order (`questionIds`). Misses may no longer be live, so liveOnly is off.
 */
export function missesDrills(misses: readonly MissRow[]): MissesDrill[] {
  const out: MissesDrill[] = [];
  for (const section of SECTIONS) {
    const rows = misses.filter((m) => m.section === section).sort((a, b) => a.missedAt - b.missedAt);
    if (rows.length === 0) continue;
    const ids = rows.map((m) => m.questionId);
    out.push({
      section,
      available: ids.length,
      config: { section, domainCode: 'all', skillCodes: [], difficulties: [], count: Math.min(REVIEW_MISSES_COUNT, ids.length), liveOnly: false, questionIds: ids },
    });
  }
  return out;
}
