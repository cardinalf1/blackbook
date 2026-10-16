// Builds the whole Dashboard page from the existing analytics summaries and user records. Pure: the
// local program passes SQL summaries (server/dashboard.ts); the cross-check passes brute-force ones
// and must get the same page. No metric is reimplemented here: rates come from the summaries, the
// ranking from Study next (rank.ts), insights from the Phase 7 builder, 800 stats from presets.ts.

import {
  COACH_MIN_SESSIONS,
  DASHBOARD_LIMITS,
  DOMAIN_WEIGHTS,
  HABITS_THIN_BELOW,
  KPI_MIN_ATTEMPTS,
  RANKING_EXPLANATION,
  TREND_HOLLOW_BELOW,
  TREND_TABLE_BELOW_POINTS,
} from '../../config/analyticsConfig';
import { PACE_TARGET_MS } from '../../config/paceConfig';
import type { ReportLine } from '../../types/ai';
import type { BehaviorSummary, MissRow, OverviewSummary, SkillsSummary, TestHistory, TestHistoryRow, TimingSummary } from '../../types/analytics';
import type { DashboardData, DomainMapRow, MistakesSection, NumbersRow, ResolvedScope, SkillMapRow } from '../../types/dashboard';
import type { PresetId } from '../../types/drill';
import { MISTAKE_REASONS, type MistakeReason, type MistakeTag } from '../../types/mistakes';
import { SECTIONS, type Section } from '../../types/sat';
import type { SessionRecord, StoredAttempt } from '../../types/session';
import { pooled, wilsonLowerBound, wilsonUpperBound } from '../analytics/metrics';
import { missesDrills, rankSkills, topSkillsDrills } from '../analytics/rank';
import { latestTags } from '../mistakes/mistakes';
import { cleanSetStats, PRESETS } from '../modes/presets';

const DAY = 86_400_000;

export interface DashboardParts {
  scope: ResolvedScope;
  now: number;
  overview: OverviewSummary;
  /** The same summary for the previous equal period, or null. */
  previousOverview: OverviewSummary | null;
  skills: SkillsSummary;
  timing: TimingSummary;
  behavior: BehaviorSummary;
  /** Tests in scope, oldest first (as the analytics store returns them). */
  tests: TestHistory;
  /** All finished tests, ignoring scope except hidden, oldest first: the estimate uses the latest full one. */
  allTests: TestHistory;
  misses: readonly MissRow[];
  /** Every session and attempt, and every tag action. */
  sessions: readonly SessionRecord[];
  attempts: readonly StoredAttempt[];
  tags: readonly MistakeTag[];
  /** Hidden session ids, already expanded to the modules of hidden tests. Empty when the scope counts hidden sessions. */
  hidden: ReadonlySet<string>;
  /** Section of each question in the bank, for tag filtering by section. */
  sectionOf: ReadonlyMap<string, Section>;
  retry: { due: number; queued: number; answered: number; correct: number };
  /** Bank questions answered at least once (question status), hidden sessions included. */
  bankDone: number;
  pool: { full: number; rw: number; math: number; capped: boolean } | null;
  /** Rule-based coach lines for this scope (insights.ts ruleCoach). */
  coachLines: ReportLine[];
  aiAvailable: boolean;
}

const sumModes = (x: { drill: { attempts: number; correct: number }; exam: { attempts: number; correct: number } }) => ({
  attempts: x.drill.attempts + x.exam.attempts,
  correct: x.drill.correct + x.exam.correct,
});

/** Standalone finished sessions that analytics counts (not test containers, not retries, not hidden). */
function countable(p: DashboardParts): SessionRecord[] {
  return p.sessions.filter((s) => s.status === 'finished' && !s.test && s.source !== 'retry' && !p.hidden.has(s.id));
}

function mondayOf(ms: number): string {
  const d = new Date(ms);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function numbers(p: DashboardParts): NumbersRow {
  const cur = sumModes(p.overview.attempts);
  const prev = p.previousOverview ? sumModes(p.previousOverview.attempts) : null;
  const enough = prev !== null && prev.attempts >= KPI_MIN_ATTEMPTS && cur.attempts >= KPI_MIN_ATTEMPTS;

  const fullWithEstimate = [...p.allTests.tests].reverse().find((t) => t.kind === 'full' && t.estimate?.total);
  const estimate =
    fullWithEstimate && fullWithEstimate.estimate?.total
      ? { testId: fullWithEstimate.testId, finishedAt: fullWithEstimate.finishedAt, low: fullWithEstimate.estimate.total.low, high: fullWithEstimate.estimate.total.high, configVersion: fullWithEstimate.estimate.configVersion }
      : null;

  const week = { activeMs: 0, previousMs: 0, sessions: 0, before: 0 };
  for (const s of countable(p)) {
    const t = s.finishedAt ?? s.lastActivityAt;
    if (t > p.now - 7 * DAY && t <= p.now) {
      week.activeMs += s.totalActiveMs;
      week.sessions++;
    } else if (t > p.now - 14 * DAY && t <= p.now - 7 * DAY) {
      week.previousMs += s.totalActiveMs;
      week.before++;
    }
  }

  const paceOf = (o: OverviewSummary | null, section: Section) => {
    if (!o) return null;
    const rows = o.dailyPace.filter((r) => r.section === section);
    return { attempts: rows.reduce((t, r) => t + r.attempts, 0), timeMs: rows.reduce((t, r) => t + r.timeMs, 0) };
  };
  const sections = p.scope.filter.section ? [p.scope.filter.section] : [...SECTIONS];
  const pace = sections.map((section) => {
    const c = paceOf(p.overview, section) ?? { attempts: 0, timeMs: 0 };
    const b = paceOf(p.previousOverview, section);
    return {
      section,
      attempts: c.attempts,
      timeMs: c.timeMs,
      targetMs: PACE_TARGET_MS[section],
      previous: b && b.attempts >= KPI_MIN_ATTEMPTS && c.attempts >= KPI_MIN_ATTEMPTS ? b : null,
    };
  });

  return {
    estimate,
    firstAttempt: { correct: cur.correct, attempts: cur.attempts, previous: enough && prev ? prev : null },
    questionsDone: { done: p.bankDone, seen: p.overview.bank.seen, total: p.overview.bank.total, live: p.overview.bank.live },
    freshTests: p.pool,
    studyWeek: { activeMs: week.activeMs, previousMs: week.before > 0 ? week.previousMs : null, sessions: week.sessions },
    pace,
  };
}

function skillsMap(p: DashboardParts): DashboardData['skills'] {
  const ranked = rankSkills(p.skills.rows, p.skills.rows.length);
  const priority = new Map(ranked.map((r) => [r.skillCode, r.priority]));
  const domains = new Map<string, DomainMapRow>();
  for (const r of p.skills.rows) {
    const key = `${r.section}|${r.domainCode}`;
    const d =
      domains.get(key) ??
      { section: r.section, domainCode: r.domainCode, domain: r.domain, officialWeight: DOMAIN_WEIGHTS[r.domainCode] ?? null, practiceShare: null, timeMs: 0, attempts: 0, correct: 0, skills: [] };
    const c = pooled(r.counts);
    const row: SkillMapRow = {
      skillCode: r.skillCode,
      skill: r.skill,
      attempts: c.attempts,
      correct: c.correct,
      low: wilsonLowerBound(c.correct, c.attempts),
      high: wilsonUpperBound(c.correct, c.attempts),
      priority: priority.get(r.skillCode) ?? 0,
      counts: r.counts,
      unseenLive: r.unseenLive,
      bankLive: r.bankLive,
    };
    d.skills.push(row);
    d.timeMs += c.timeMs;
    d.attempts += c.attempts;
    d.correct += c.correct;
    domains.set(key, d);
  }
  const list = [...domains.values()];
  for (const section of SECTIONS) {
    const inSection = list.filter((d) => d.section === section);
    const total = inSection.reduce((t, d) => t + d.timeMs, 0);
    for (const d of inSection) d.practiceShare = total > 0 ? d.timeMs / total : null;
  }
  for (const d of list) d.skills.sort((a, b) => b.priority - a.priority || a.skill.localeCompare(b.skill));
  list.sort((a, b) => a.section.localeCompare(b.section) * -1 || (b.skills[0]?.priority ?? 0) - (a.skills[0]?.priority ?? 0) || a.domain.localeCompare(b.domain));
  const topDrills = topSkillsDrills(ranked).map((t) => ({ section: t.section, skillCodes: t.skills.map((s) => s.skillCode), config: t.config }));
  return { domains: list, methodNote: RANKING_EXPLANATION, topDrills };
}

function mistakes(p: DashboardParts): MistakesSection {
  const f = p.scope.filter;
  const inScope = (t: MistakeTag) =>
    (f.from === null || t.at >= f.from) &&
    (f.to === null || t.at <= f.to) &&
    !p.hidden.has(t.sessionId) &&
    (f.section === null || p.sectionOf.get(t.questionId) === f.section) &&
    p.sectionOf.has(t.questionId);
  const inForce = latestTags(p.tags);
  const reasons: Partial<Record<MistakeReason, number>> = {};
  const trend = new Map<string, { week: string; reason: MistakeReason; count: number }>();
  let tagged = 0;
  for (const t of inForce.values()) {
    if (!inScope(t)) continue;
    reasons[t.reason] = (reasons[t.reason] ?? 0) + 1;
    tagged++;
    const week = mondayOf(t.at);
    const k = `${week}|${t.reason}`;
    const r = trend.get(k) ?? { week, reason: t.reason, count: 0 };
    r.count++;
    trend.set(k, r);
  }
  const order = (r: MistakeReason) => MISTAKE_REASONS.indexOf(r);
  const reasonsTrend = [...trend.values()].sort((a, b) => a.week.localeCompare(b.week) || order(a.reason) - order(b.reason));

  // The latest drill or lone module with wrong answers that carry no tag.
  let untaggedLast: MistakesSection['untaggedLast'] = null;
  const wrongBySession = new Map<string, string[]>();
  for (const a of p.attempts) {
    if (a.status !== 'final' || a.response === '' || a.correct) continue;
    const list = wrongBySession.get(a.sessionId) ?? [];
    list.push(a.questionId);
    wrongBySession.set(a.sessionId, list);
  }
  const candidates = countable(p)
    .filter((s) => !s.exam?.testId)
    .sort((a, b) => (b.finishedAt ?? b.lastActivityAt) - (a.finishedAt ?? a.lastActivityAt) || a.id.localeCompare(b.id));
  for (const s of candidates) {
    const untagged = (wrongBySession.get(s.id) ?? []).filter((q) => !inForce.has(`${s.id}:${q}`)).length;
    if (untagged > 0) {
      untaggedLast = { sessionId: s.id, untagged, finishedAt: s.finishedAt ?? s.lastActivityAt };
      break;
    }
  }

  const visible = p.sessions.filter((s) => !p.hidden.has(s.id));
  const slips800 = (Object.keys(PRESETS) as PresetId[])
    .map((id) => ({ id, stats: cleanSetStats(id, visible, p.attempts, p.tags) }))
    .filter((x) => x.stats.sets > 0)
    .map(({ id, stats }) => ({ preset: id, title: PRESETS[id].title, sets: stats.sets, cleanSets: stats.cleanSets, cleanStreak: stats.cleanStreak, slipsPerSet: stats.slipsPerSet, untagged: stats.untagged }));

  const cur = sumModes(p.overview.attempts);
  return {
    reasons,
    tagged,
    misses: cur.attempts - cur.correct,
    reasonsTrend,
    untaggedLast,
    retry: p.retry,
    slips800,
    reviewDrills: missesDrills(p.misses).map((m) => ({ section: m.section, available: m.available, config: m.config })),
  };
}

function coach(p: DashboardParts): DashboardData['coach'] {
  const done = countable(p).length;
  const drillSetup = { kind: 'open', label: 'Start a drill', target: 'drill_setup' } as const;
  if (done < COACH_MIN_SESSIONS) {
    return { lines: [], origin: 'rule', aiAvailable: p.aiAvailable, unlock: { drillsNeeded: COACH_MIN_SESSIONS - done, action: drillSetup }, emptyScope: null };
  }
  if (p.coachLines.length === 0) {
    return { lines: [], origin: 'rule', aiAvailable: p.aiAvailable, unlock: null, emptyScope: { message: `Nothing finished in ${p.scope.label.toLowerCase()} yet.`, action: drillSetup } };
  }
  return { lines: p.coachLines, origin: 'rule', aiAvailable: p.aiAvailable, unlock: null, emptyScope: null };
}

export function buildDashboard(p: DashboardParts): Omit<DashboardData, 'buildMs'> {
  const reached = p.timing.modules.filter((m) => m.reachedFiveMinutes);
  const tests: TestHistoryRow[] = [...p.tests.tests].reverse();
  return {
    scope: p.scope,
    coach: coach(p),
    numbers: numbers(p),
    trends: { accuracy: p.overview.daily, pace: p.overview.dailyPace, targetMs: { ...PACE_TARGET_MS }, hollowBelow: TREND_HOLLOW_BELOW, tableBelowPoints: TREND_TABLE_BELOW_POINTS },
    skills: skillsMap(p),
    mistakes: mistakes(p),
    habits: {
      behavior: p.behavior.counts,
      flagged: p.timing.flaggedCounts,
      answered: { drill: p.overview.attempts.drill.attempts, exam: p.overview.attempts.exam.attempts },
      lastFive: {
        modules: p.timing.modules.length,
        reached: reached.length,
        answeredInLastFive: reached.reduce((t, m) => t + m.answeredInLastFive, 0),
        questions: reached.reduce((t, m) => t + m.questions, 0),
      },
      modules: p.timing.modules,
      thinBelow: HABITS_THIN_BELOW,
    },
    tests,
    limits: DASHBOARD_LIMITS,
  };
}
