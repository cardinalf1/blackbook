// Brute-force recomputation of every analytics headline number, straight from the raw sessions,
// attempts and events with plain loops. It shares no code with the SQL in server/analytics.ts, so
// agreement between the two is evidence that both follow the counting rules (see that file's header).
// It is also the in-memory implementation of AnalyticsStore, so tests and screens can use it.

import {
  MAX_FLAGGED_LISTED,
  MAX_MISSES,
  MIN_BASELINE_ATTEMPTS,
  RECENT_SESSIONS,
  RUSH_PERCENTILE,
  STUCK_PERCENTILE,
} from '../../config/analyticsConfig';
import type {
  AnalyticsFilter,
  AnalyticsStore,
  BehaviorCounts,
  BehaviorSummary,
  ByMode,
  FlaggedQuestion,
  MissRow,
  ModeCounts,
  ModulePacing,
  OverviewSummary,
  SkillDetail,
  SkillRow,
  SkillSessionRow,
  SkillsSummary,
  TestHistory,
  TimingBaseline,
  TimingSummary,
} from '../../types/analytics';
import type { Difficulty, Question, Section } from '../../types/sat';
import type { EventRecord, SessionMode, SessionRecord, StoredAttempt } from '../../types/session';

export interface RawData {
  sessions: readonly SessionRecord[];
  attempts: readonly StoredAttempt[];
  events: readonly EventRecord[];
  questions: readonly Question[];
}

type Kind = 'single' | 'module' | 'section' | 'full' | 'drill';

interface Sess {
  s: SessionRecord;
  ts: number;
  kind: Kind;
  paused: boolean;
  section: Section;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const zero = (): ModeCounts => ({ attempts: 0, correct: 0, timeMs: 0 });
const two = <T>(make: () => T): ByMode<T> => ({ drill: make(), exam: make() });
const sum = (xs: readonly number[]) => xs.reduce((t, x) => t + x, 0);

function dayOf(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

class Data {
  readonly byQuestion = new Map<string, Question>();
  readonly containers = new Map<string, SessionRecord>();

  constructor(readonly raw: RawData) {
    for (const q of raw.questions) this.byQuestion.set(q.id, q);
    for (const s of raw.sessions) if (s.test) this.containers.set(s.id, s);
  }

  /** Finished sessions that hold questions, with the figures the filter looks at. */
  sessions(f: AnalyticsFilter): Sess[] {
    const out: Sess[] = [];
    for (const s of this.raw.sessions) {
      if (s.status !== 'finished' || s.test || s.source === 'retry') continue;
      const container = s.exam?.testId ? this.containers.get(s.exam.testId) : undefined;
      let kind: Kind;
      if (s.source === 'browse') kind = 'single';
      else if (s.exam?.testId) kind = container?.test?.kind === 'full' ? 'full' : 'section';
      else if (s.mode === 'exam') kind = 'module';
      else kind = 'drill';
      const paused = s.exam !== undefined && s.exam.pauses.length > 0 ? true : container?.test?.paused === true;
      const section = (s.exam?.module.section ?? s.config.section) as Section;
      const ts = s.finishedAt ?? s.lastActivityAt;
      if (f.from !== null && ts < f.from) continue;
      if (f.to !== null && ts > f.to) continue;
      if (f.kind !== 'all' && kind !== f.kind) continue;
      if (f.section !== null && section !== f.section) continue;
      if (f.excludePaused && paused) continue;
      if (f.excludeSingle && kind === 'single') continue;
      out.push({ s, ts, kind, paused, section });
    }
    return out;
  }

  /** Answered final attempts of the given sessions whose question is in the bank. */
  answered(sessions: readonly Sess[]): { a: StoredAttempt; sess: Sess; q: Question }[] {
    const bySession = new Map(sessions.map((x) => [x.s.id, x]));
    const out: { a: StoredAttempt; sess: Sess; q: Question }[] = [];
    for (const a of this.raw.attempts) {
      if (a.status !== 'final' || a.response === '') continue;
      const sess = bySession.get(a.sessionId);
      const q = this.byQuestion.get(a.questionId);
      if (sess && q) out.push({ a, sess, q });
    }
    return out;
  }

  eventsFor(sessionId: string, questionId: string, type: string): EventRecord[] {
    return this.raw.events.filter((e) => e.sessionId === sessionId && e.questionId === questionId && e.type === type);
  }
}

function seenIds(d: Data): Set<string> {
  const seen = new Set<string>();
  for (const e of d.raw.events) if (e.type === 'question_shown' && e.questionId) seen.add(e.questionId);
  for (const a of d.raw.attempts) seen.add(a.questionId);
  return seen;
}

export function bruteOverview(raw: RawData, f: AnalyticsFilter): OverviewSummary {
  const d = new Data(raw);
  const sessions = d.sessions(f);
  const out: OverviewSummary = {
    sessions: two(() => 0), attempts: two(zero), activeMs: two(() => 0),
    bank: { total: 0, live: 0, seen: 0, seenLive: 0 }, daily: [], unattributed: 0,
  };
  for (const x of sessions) {
    out.sessions[x.s.mode]++;
    out.activeMs[x.s.mode] += x.s.totalActiveMs;
  }
  const rows = d.answered(sessions);
  const days = new Map<string, { day: string; mode: SessionMode; attempts: number; correct: number }>();
  for (const { a, sess } of rows) {
    const c = out.attempts[a.mode];
    c.attempts++;
    c.correct += a.correct ? 1 : 0;
    c.timeMs += a.timeMs;
    const day = dayOf(sess.ts);
    const key = `${day}|${a.mode}`;
    const r = days.get(key) ?? { day, mode: a.mode, attempts: 0, correct: 0 };
    r.attempts++;
    r.correct += a.correct ? 1 : 0;
    days.set(key, r);
  }
  out.daily = [...days.values()].sort((x, y) => cmp(x.day, y.day) || cmp(x.mode, y.mode));
  const seen = seenIds(d);
  for (const q of raw.questions) {
    out.bank.total++;
    if (q.active) out.bank.live++;
    if (seen.has(q.id)) {
      out.bank.seen++;
      if (q.active) out.bank.seenLive++;
    }
  }
  const inFilter = new Set(sessions.map((x) => x.s.id));
  for (const a of raw.attempts) {
    if (a.status === 'final' && a.response !== '' && inFilter.has(a.sessionId) && !d.byQuestion.has(a.questionId)) out.unattributed++;
  }
  return out;
}

export function bruteSkills(raw: RawData, f: AnalyticsFilter): SkillsSummary {
  const d = new Data(raw);
  const seen = seenIds(d);
  const rows = new Map<string, SkillRow>();
  const key = (q: { section: string; domainCode: string; skillCode: string }) => `${q.section}|${q.domainCode}|${q.skillCode}`;
  for (const q of raw.questions) {
    if (f.section !== null && q.section !== f.section) continue;
    let r = rows.get(key(q));
    if (!r) {
      r = { section: q.section, domainCode: q.domainCode, domain: q.domain, skillCode: q.skillCode, skill: q.skill, bankTotal: 0, bankLive: 0, unseenLive: 0, counts: two(zero), recent: [] };
      rows.set(key(q), r);
    }
    if (q.domain < r.domain) r.domain = q.domain;
    if (q.skill < r.skill) r.skill = q.skill;
    r.bankTotal++;
    if (q.active) {
      r.bankLive++;
      if (!seen.has(q.id)) r.unseenLive++;
    }
  }
  const perSession = new Map<string, Map<string, { sessionId: string; finishedAt: number; mode: SessionMode; attempts: number; correct: number }>>();
  for (const { a, sess, q } of d.answered(d.sessions(f))) {
    const r = rows.get(key(q));
    if (!r) continue;
    const c = r.counts[a.mode];
    c.attempts++;
    c.correct += a.correct ? 1 : 0;
    c.timeMs += a.timeMs;
    const m = perSession.get(key(q)) ?? new Map();
    const p = m.get(a.sessionId) ?? { sessionId: a.sessionId, finishedAt: sess.ts, mode: a.mode, attempts: 0, correct: 0 };
    p.attempts++;
    p.correct += a.correct ? 1 : 0;
    m.set(a.sessionId, p);
    perSession.set(key(q), m);
  }
  for (const [k, m] of perSession) {
    const newestFirst = [...m.values()].sort((x, y) => y.finishedAt - x.finishedAt || cmp(y.sessionId, x.sessionId)).slice(0, RECENT_SESSIONS);
    (rows.get(k) as SkillRow).recent = newestFirst.reverse();
  }
  return { rows: [...rows.values()].sort((x, y) => cmp(x.section, y.section) || cmp(x.domain, y.domain) || cmp(x.skill, y.skill) || cmp(x.skillCode, y.skillCode)) };
}

export function bruteMisses(raw: RawData, f: AnalyticsFilter, limit: { skillCodes?: readonly string[]; section?: Section } = {}): MissRow[] {
  const d = new Data(raw);
  const byQuestion = new Map<string, { a: StoredAttempt; q: Question }[]>();
  for (const { a, q } of d.answered(d.sessions(f))) byQuestion.set(a.questionId, [...(byQuestion.get(a.questionId) ?? []), { a, q }]);
  const out: MissRow[] = [];
  for (const list of byQuestion.values()) {
    const latest = list.reduce((best, x) => (x.a.at > best.a.at || (x.a.at === best.a.at && x.a.id > best.a.id) ? x : best));
    if (latest.a.correct) continue;
    const q = latest.q;
    if (limit.section && q.section !== limit.section) continue;
    if (limit.skillCodes && limit.skillCodes.length > 0 && !limit.skillCodes.includes(q.skillCode)) continue;
    out.push({
      questionId: q.id, section: q.section, domainCode: q.domainCode, skillCode: q.skillCode, difficulty: q.difficulty,
      sessionId: latest.a.sessionId, missedAt: latest.a.at, misses: list.filter((x) => !x.a.correct).length, attempts: list.length,
    });
  }
  const at = new Map(out.map((m) => [m.questionId, byQuestion.get(m.questionId)?.find((x) => x.a.sessionId === m.sessionId)?.a.id ?? '']));
  out.sort((x, y) => x.missedAt - y.missedAt || cmp(at.get(x.questionId) ?? '', at.get(y.questionId) ?? ''));
  return out.slice(0, MAX_MISSES);
}

export function bruteSkillDetail(raw: RawData, f: AnalyticsFilter, skillCode: string): SkillDetail {
  const d = new Data(raw);
  const per = new Map<string, SkillSessionRow>();
  for (const { a, sess, q } of d.answered(d.sessions(f))) {
    if (q.skillCode !== skillCode) continue;
    const r = per.get(a.sessionId) ?? { sessionId: a.sessionId, finishedAt: sess.ts, mode: a.mode, kind: sess.kind, attempts: 0, correct: 0, timeMs: 0 };
    r.attempts++;
    r.correct += a.correct ? 1 : 0;
    r.timeMs += a.timeMs;
    per.set(a.sessionId, r);
  }
  const sessions = [...per.values()].sort((x, y) => y.finishedAt - x.finishedAt || cmp(y.sessionId, x.sessionId));
  return { skillCode, sessions, misses: bruteMisses(raw, f, { skillCodes: [skillCode] }) };
}

/** Nearest-rank percentile of an ascending list: the value at rank ceil(p * n / 100). */
function nearestRank(sorted: readonly number[], p: number): number {
  return sorted[Math.max(1, Math.ceil((p * sorted.length) / 100)) - 1] as number;
}

export function bruteTiming(raw: RawData, f: AnalyticsFilter): TimingSummary {
  const d = new Data(raw);
  // Baselines use every finished session, whatever the filter says.
  const everything = d.sessions({ from: null, to: null, kind: 'all', section: null, excludePaused: false, excludeSingle: false });
  const groups = new Map<string, { mode: SessionMode; section: Section; difficulty: Difficulty; times: number[] }>();
  for (const { a, q } of d.answered(everything)) {
    const k = `${a.mode}|${q.section}|${q.difficulty}`;
    const g = groups.get(k) ?? { mode: a.mode, section: q.section, difficulty: q.difficulty, times: [] };
    g.times.push(a.timeMs);
    groups.set(k, g);
  }
  const baselines: TimingBaseline[] = [...groups.values()]
    .map((g) => {
      const t = [...g.times].sort((x, y) => x - y);
      return {
        mode: g.mode, section: g.section, difficulty: g.difficulty, n: t.length, medianMs: nearestRank(t, 50), rushMs: nearestRank(t, RUSH_PERCENTILE),
        stuckMs: nearestRank(t, STUCK_PERCENTILE), usable: t.length >= MIN_BASELINE_ATTEMPTS, timeMs: sum(t),
      };
    })
    .sort((x, y) => cmp(x.mode, y.mode) || cmp(x.section, y.section) || cmp(x.difficulty, y.difficulty));
  const base = new Map(baselines.map((b) => [`${b.mode}|${b.section}|${b.difficulty}`, b]));

  const sessions = d.sessions(f);
  const flaggedAll: (FlaggedQuestion & { attemptId: string })[] = [];
  for (const { a, sess, q } of d.answered(sessions)) {
    const b = base.get(`${a.mode}|${q.section}|${q.difficulty}`);
    if (!b || b.n < MIN_BASELINE_ATTEMPTS) continue;
    const rushed = !a.correct && a.timeMs < b.rushMs;
    const stuck = a.timeMs > b.stuckMs;
    if (!rushed && !stuck) continue;
    flaggedAll.push({
      questionId: a.questionId, sessionId: a.sessionId, mode: a.mode, section: q.section, skillCode: q.skillCode, difficulty: q.difficulty,
      flag: rushed ? 'rushed_wrong' : 'stuck', timeMs: a.timeMs, correct: a.correct, thresholdMs: rushed ? b.rushMs : b.stuckMs, at: sess.ts, attemptId: a.id,
    });
  }
  const flaggedCounts: TimingSummary['flaggedCounts'] = { rushedWrong: two(() => 0), stuck: two(() => 0) };
  for (const x of flaggedAll) (x.flag === 'rushed_wrong' ? flaggedCounts.rushedWrong : flaggedCounts.stuck)[x.mode]++;
  const flagged = flaggedAll
    .sort((x, y) => y.at - x.at || cmp(y.attemptId, x.attemptId))
    .slice(0, MAX_FLAGGED_LISTED)
    .map(({ attemptId: _id, ...rest }) => rest);

  const modules: ModulePacing[] = [];
  for (const x of sessions) {
    const exam = x.s.exam;
    if (!exam || x.s.mode !== 'exam' || (x.kind !== 'module' && x.kind !== 'section' && x.kind !== 'full')) continue;
    const alerts = raw.events.filter((e) => e.sessionId === x.s.id && e.type === 'five_minute_alert_shown').map((e) => e.ts);
    const alertAt = alerts.length > 0 ? Math.min(...alerts) : null;
    const firstAnswer = new Map<string, number>();
    for (const e of raw.events) {
      if (e.sessionId !== x.s.id || !e.questionId || (e.type !== 'choice_selected' && e.type !== 'spr_changed')) continue;
      firstAnswer.set(e.questionId, Math.min(firstAnswer.get(e.questionId) ?? Infinity, e.ts));
    }
    const t = exam.timer;
    modules.push({
      sessionId: x.s.id, finishedAt: x.ts, section: x.section, moduleNumber: exam.module.moduleNumber, tier: exam.module.tier, kind: x.kind,
      timeLimitMs: t.durationMs,
      timeLeftMs: t.pausedRemainingMs !== null ? Math.max(0, t.pausedRemainingMs) : t.deadlineAt === null ? 0 : Math.max(0, t.deadlineAt - x.ts),
      submittedBy: exam.submittedBy === 'timer' ? 'timer' : 'user', paused: x.paused, questions: x.s.queueIds.length,
      answered: raw.attempts.filter((a) => a.sessionId === x.s.id && a.status === 'final' && a.response !== '').length,
      reachedFiveMinutes: alertAt !== null,
      answeredInLastFive: alertAt === null ? 0 : [...firstAnswer.values()].filter((ts) => ts >= alertAt).length,
    });
  }
  modules.sort((x, y) => y.finishedAt - x.finishedAt || cmp(y.sessionId, x.sessionId));
  return { baselines, flaggedCounts, flagged, modules };
}

export function bruteBehavior(raw: RawData, f: AnalyticsFilter): BehaviorSummary {
  const d = new Data(raw);
  const counts = two<BehaviorCounts>(() => ({
    answered: 0, questionsWithChange: 0, changes: 0, correctToIncorrect: 0, incorrectToCorrect: 0, incorrectToIncorrect: 0, mcqAnswered: 0,
    questionsWithStrike: 0, strikeActions: 0, rated: 0, sureWrong: 0, sureRight: 0, unsureRight: 0, unsureWrong: 0, guessRight: 0, guessWrong: 0,
  }));
  for (const { a, q } of d.answered(d.sessions(f))) {
    const c = counts[a.mode];
    c.answered++;
    if (a.changes > 0) c.questionsWithChange++;
    c.changes += a.changes;
    if (a.confidence !== null) {
      c.rated++;
      const key = `${a.confidence}${a.correct ? 'Right' : 'Wrong'}` as 'sureRight' | 'sureWrong' | 'unsureRight' | 'unsureWrong' | 'guessRight' | 'guessWrong';
      c[key]++;
    }
    if (q.answer.kind !== 'mcq') continue;
    c.mcqAnswered++;
    const strikes = d.eventsFor(a.sessionId, a.questionId, 'choice_struck');
    if (strikes.length > 0) c.questionsWithStrike++;
    c.strikeActions += strikes.length;
    for (const e of d.eventsFor(a.sessionId, a.questionId, 'choice_changed')) {
      const p = e.payload as { from: string; to: string };
      const fromRight = p.from === q.answer.correct;
      const toRight = p.to === q.answer.correct;
      if (fromRight && !toRight) c.correctToIncorrect++;
      else if (!fromRight && toRight) c.incorrectToCorrect++;
      else if (!fromRight && !toRight) c.incorrectToIncorrect++;
    }
  }
  return { counts };
}

export function bruteTests(raw: RawData, f: AnalyticsFilter): TestHistory {
  const tests = raw.sessions
    .filter((s) => {
      if (s.status !== 'finished' || !s.test) return false;
      const ts = s.finishedAt ?? s.lastActivityAt;
      if (f.from !== null && ts < f.from) return false;
      if (f.to !== null && ts > f.to) return false;
      if (f.kind === 'full' && s.test.kind !== 'full') return false;
      if (f.kind === 'section' && s.test.kind === 'full') return false;
      if (f.kind !== 'all' && f.kind !== 'full' && f.kind !== 'section') return false;
      if (f.section !== null && s.test.kind !== 'full' && s.test.kind !== f.section) return false;
      if (f.excludePaused && s.test.paused) return false;
      return true;
    })
    .sort((x, y) => (x.finishedAt ?? x.lastActivityAt) - (y.finishedAt ?? y.lastActivityAt) || cmp(x.id, y.id))
    .map((s) => ({
      testId: s.id, kind: (s.test as NonNullable<SessionRecord['test']>).kind, finishedAt: s.finishedAt ?? s.lastActivityAt,
      paused: s.test?.paused === true, configVersion: s.test?.estimate?.configVersion ?? s.test?.configVersion ?? 0,
      estimate: s.test?.estimate ?? null, routing: s.test?.routing ?? [],
    }));
  return { tests };
}

/** The same questions as the SQL, over data held in memory. */
export class BruteAnalytics implements AnalyticsStore {
  constructor(private readonly data: () => RawData | Promise<RawData>) {}

  async overview(f: AnalyticsFilter) { return bruteOverview(await this.data(), f); }
  async skills(f: AnalyticsFilter) { return bruteSkills(await this.data(), f); }
  async skillDetail(f: AnalyticsFilter, skillCode: string) { return bruteSkillDetail(await this.data(), f, skillCode); }
  async misses(f: AnalyticsFilter, limit?: { skillCodes?: readonly string[]; section?: Section }) { return bruteMisses(await this.data(), f, limit); }
  async timing(f: AnalyticsFilter) { return bruteTiming(await this.data(), f); }
  async behavior(f: AnalyticsFilter) { return bruteBehavior(await this.data(), f); }
  async tests(f: AnalyticsFilter) { return bruteTests(await this.data(), f); }
}
