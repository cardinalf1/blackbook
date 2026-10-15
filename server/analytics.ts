// Analytics summaries computed in SQL (Phase 5). The browser asks for summaries; it never receives
// raw events. Question facts (section, skill, difficulty, the correct choice) live in the bank file,
// not in the database, so they are copied into a TEMP table `qmeta` whenever the bank changes and
// joined like any other table.
//
// Counting rules, the same ones the brute-force checker in src/services/analytics/brute.ts follows:
//   - Only finished sessions count; full-test containers have no questions and are left out of the
//     question figures (they feed the test history).
//   - An answer counts when it is final and non-empty (an unanswered question is not an attempt).
//   - Drill and exam figures are separate fields throughout.
//   - A session counts by when it finished, in the filter's date range and section.

import {
  MAX_FLAGGED_LISTED,
  MAX_MISSES,
  MIN_BASELINE_ATTEMPTS,
  RECENT_SESSIONS,
  RUSH_PERCENTILE,
  STUCK_PERCENTILE,
} from '../src/config/analyticsConfig';
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
  SkillSessionPoint,
  SkillSessionRow,
  SkillsSummary,
  TestHistory,
  TestHistoryRow,
  TimingBaseline,
  TimingSummary,
} from '../src/types/analytics';
import type { Difficulty, Question, Section } from '../src/types/sat';
import type { SessionMode, SessionRecord } from '../src/types/session';
import type { SqlDb, SqlParam } from './sql';


/** The facts about a question that analytics needs. No content. */
export interface QuestionMetaRow {
  id: string;
  section: Section;
  domainCode: string;
  domain: string;
  skillCode: string;
  skill: string;
  difficulty: Difficulty;
  active: boolean;
  isMcq: boolean;
  /** The correct choice letter for multiple-choice questions. */
  correctChoice: string | null;
}

export function toMetaRow(q: Question): QuestionMetaRow {
  return {
    id: q.id,
    section: q.section,
    domainCode: q.domainCode,
    domain: q.domain,
    skillCode: q.skillCode,
    skill: q.skill,
    difficulty: q.difficulty,
    active: q.active,
    isMcq: q.answer.kind === 'mcq',
    correctChoice: q.answer.kind === 'mcq' ? q.answer.correct : null,
  };
}

/** Where question facts come from. `signature` changes whenever the bank does. */
export interface MetaSource {
  load(): Promise<{ signature: string; rows: QuestionMetaRow[] }>;
}

const zeroCounts = (): ModeCounts => ({ attempts: 0, correct: 0, timeMs: 0 });
const byMode = <T>(make: () => T): ByMode<T> => ({ drill: make(), exam: make() });
const n = (v: unknown): number => Number(v ?? 0);

/** SQL that selects the sessions inside the filter (`s`) and their answered final attempts (`a`). */
function scope(f: AnalyticsFilter): { sql: string; params: SqlParam[] } {
  const where: string[] = [];
  const params: SqlParam[] = [];
  if (f.from !== null) {
    where.push('ts >= ?');
    params.push(f.from);
  }
  if (f.to !== null) {
    where.push('ts <= ?');
    params.push(f.to);
  }
  if (f.kind !== 'all') {
    where.push('kind = ?');
    params.push(f.kind);
  }
  if (f.section !== null) {
    where.push('section = ?');
    params.push(f.section);
  }
  if (f.excludePaused) where.push('paused = 0');
  if (f.excludeSingle) where.push("kind <> 'single'");
  const sql = `
  s0 AS (
    SELECT x.id, x.mode, COALESCE(x.finished_at, x.last_activity_at) AS ts,
      CASE WHEN x.source = 'browse' THEN 'single'
           WHEN x.test_id IS NOT NULL THEN CASE WHEN c.test_kind = 'full' THEN 'full' ELSE 'section' END
           WHEN x.mode = 'exam' THEN 'module'
           ELSE 'drill' END AS kind,
      CASE WHEN x.exam_paused = 1 OR COALESCE(c.test_paused, 0) = 1 THEN 1 ELSE 0 END AS paused,
      COALESCE(json_extract(x.data, '$.exam.module.section'), json_extract(x.data, '$.config.section')) AS section,
      COALESCE(json_extract(x.data, '$.totalActiveMs'), 0) AS active_ms
    FROM sessions x LEFT JOIN sessions c ON c.id = x.test_id
    WHERE x.status = 'finished' AND x.test_kind IS NULL AND x.source <> 'retry'
  ),
  s AS (SELECT * FROM s0 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}),
  a AS (
    SELECT t.id, t.session_id, t.question_id, t.mode, t.correct, t.time_ms, t.changes, t.confidence, t.at,
           s.kind, s.ts AS sts, q.section, q.domain_code, q.skill_code, q.difficulty, q.is_mcq
    FROM attempts t JOIN s ON s.id = t.session_id JOIN qmeta q ON q.id = t.question_id
    WHERE t.status = 'final' AND t.response <> ''
  )`;
  return { sql, params };
}

/** Unfiltered baselines: your own timing per mode, section and difficulty over all finished answers. */
const BASELINE_SQL = `
  base AS (
    SELECT t.mode, q.section, q.difficulty, t.time_ms
    FROM attempts t JOIN sessions x ON x.id = t.session_id AND x.status = 'finished' AND x.test_kind IS NULL AND x.source <> 'retry'
         JOIN qmeta q ON q.id = t.question_id
    WHERE t.status = 'final' AND t.response <> ''
  ),
  ranked AS (
    SELECT mode, section, difficulty, time_ms,
           ROW_NUMBER() OVER (PARTITION BY mode, section, difficulty ORDER BY time_ms) AS rn,
           COUNT(*) OVER (PARTITION BY mode, section, difficulty) AS cnt,
           SUM(time_ms) OVER (PARTITION BY mode, section, difficulty) AS total
    FROM base
  ),
  bl AS (
    SELECT mode, section, difficulty, MAX(cnt) AS n, MAX(total) AS total,
           MIN(CASE WHEN rn >= (50 * cnt + 99) / 100 THEN time_ms END) AS median,
           MIN(CASE WHEN rn >= (${RUSH_PERCENTILE} * cnt + 99) / 100 THEN time_ms END) AS rush,
           MIN(CASE WHEN rn >= (${STUCK_PERCENTILE} * cnt + 99) / 100 THEN time_ms END) AS stuck
    FROM ranked GROUP BY mode, section, difficulty
  )`;

const FLAGGED_FROM = `
  FROM a JOIN bl ON bl.mode = a.mode AND bl.section = a.section AND bl.difficulty = a.difficulty
  WHERE bl.n >= ${MIN_BASELINE_ATTEMPTS} AND ((a.correct = 0 AND a.time_ms < bl.rush) OR a.time_ms > bl.stuck)`;

export class SqlAnalytics implements AnalyticsStore {
  private signature: string | null = null;

  constructor(
    private readonly db: SqlDb,
    private readonly meta: MetaSource,
  ) {}

  /** Copies question facts into `qmeta` when the bank has changed since the last request. */
  private async ready(): Promise<void> {
    const { signature, rows } = await this.meta.load();
    if (signature === this.signature) return;
    const db = this.db;
    db.exec('BEGIN');
    try {
      db.exec('DROP TABLE IF EXISTS temp.qmeta');
      db.exec(`CREATE TEMP TABLE qmeta (
        id TEXT PRIMARY KEY, section TEXT NOT NULL, domain_code TEXT NOT NULL, domain TEXT NOT NULL,
        skill_code TEXT NOT NULL, skill TEXT NOT NULL, difficulty TEXT NOT NULL, active INTEGER NOT NULL,
        is_mcq INTEGER NOT NULL, correct_choice TEXT)`);
      for (const r of rows) {
        db.run(
          'INSERT INTO temp.qmeta VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          r.id, r.section, r.domainCode, r.domain, r.skillCode, r.skill, r.difficulty, r.active ? 1 : 0, r.isMcq ? 1 : 0, r.correctChoice,
        );
      }
      db.exec('CREATE INDEX temp.qmeta_skill ON qmeta (section, domain_code, skill_code)');
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    this.signature = signature;
  }

  async overview(f: AnalyticsFilter): Promise<OverviewSummary> {
    await this.ready();
    const { sql, params } = scope(f);
    const out: OverviewSummary = {
      sessions: byMode(() => 0),
      attempts: byMode(zeroCounts),
      activeMs: byMode(() => 0),
      bank: { total: 0, live: 0, seen: 0, seenLive: 0 },
      daily: [],
      unattributed: 0,
    };
    for (const r of this.db.all<{ mode: SessionMode; c: number; ms: number }>(
      `WITH ${sql} SELECT mode, COUNT(*) AS c, SUM(active_ms) AS ms FROM s GROUP BY mode`, ...params,
    )) {
      out.sessions[r.mode] = n(r.c);
      out.activeMs[r.mode] = n(r.ms);
    }
    for (const r of this.db.all<{ mode: SessionMode; c: number; ok: number; ms: number }>(
      `WITH ${sql} SELECT mode, COUNT(*) AS c, SUM(correct) AS ok, SUM(time_ms) AS ms FROM a GROUP BY mode`, ...params,
    )) {
      out.attempts[r.mode] = { attempts: n(r.c), correct: n(r.ok), timeMs: n(r.ms) };
    }
    const seen = `SELECT question_id FROM events WHERE type = 'question_shown' AND question_id IS NOT NULL UNION SELECT question_id FROM attempts`;
    const bank = this.db.get<{ total: number; live: number; seen: number; seen_live: number }>(
      `WITH seen AS (${seen})
       SELECT COUNT(*) AS total, COALESCE(SUM(active), 0) AS live,
              COALESCE(SUM(id IN (SELECT question_id FROM seen)), 0) AS seen,
              COALESCE(SUM(active = 1 AND id IN (SELECT question_id FROM seen)), 0) AS seen_live
       FROM qmeta`,
    );
    out.bank = { total: n(bank?.total), live: n(bank?.live), seen: n(bank?.seen), seenLive: n(bank?.seen_live) };
    for (const r of this.db.all<{ day: string; mode: SessionMode; c: number; ok: number }>(
      `WITH ${sql}
       SELECT strftime('%Y-%m-%d', sts / 1000, 'unixepoch', 'localtime') AS day, mode, COUNT(*) AS c, SUM(correct) AS ok
       FROM a GROUP BY day, mode ORDER BY day, mode`, ...params,
    )) {
      out.daily.push({ day: r.day, mode: r.mode, attempts: n(r.c), correct: n(r.ok) });
    }
    out.unattributed = n(
      this.db.get<{ c: number }>(
        `WITH ${sql}
         SELECT COUNT(*) AS c FROM attempts t JOIN s ON s.id = t.session_id
         WHERE t.status = 'final' AND t.response <> '' AND NOT EXISTS (SELECT 1 FROM qmeta q WHERE q.id = t.question_id)`, ...params,
      )?.c,
    );
    return out;
  }

  async skills(f: AnalyticsFilter): Promise<SkillsSummary> {
    await this.ready();
    const { sql, params } = scope(f);
    const rows = new Map<string, SkillRow>();
    const key = (section: string, domainCode: string, skillCode: string) => `${section}|${domainCode}|${skillCode}`;
    const taxonomyParams: SqlParam[] = f.section === null ? [] : [f.section];
    for (const r of this.db.all<{
      section: Section; domain_code: string; domain: string; skill_code: string; skill: string; total: number; live: number; unseen: number;
    }>(
      `WITH seen AS (SELECT question_id FROM events WHERE type = 'question_shown' AND question_id IS NOT NULL UNION SELECT question_id FROM attempts)
       SELECT section, domain_code, MIN(domain) AS domain, skill_code, MIN(skill) AS skill, COUNT(*) AS total, SUM(active) AS live,
              SUM(active = 1 AND id NOT IN (SELECT question_id FROM seen)) AS unseen
       FROM qmeta ${f.section === null ? '' : 'WHERE section = ?'}
       GROUP BY section, domain_code, skill_code ORDER BY section, domain, skill, skill_code`, ...taxonomyParams,
    )) {
      rows.set(key(r.section, r.domain_code, r.skill_code), {
        section: r.section, domainCode: r.domain_code, domain: r.domain, skillCode: r.skill_code, skill: r.skill,
        bankTotal: n(r.total), bankLive: n(r.live), unseenLive: n(r.unseen),
        counts: byMode(zeroCounts), recent: [],
      });
    }
    for (const r of this.db.all<{ section: Section; domain_code: string; skill_code: string; mode: SessionMode; c: number; ok: number; ms: number }>(
      `WITH ${sql}
       SELECT section, domain_code, skill_code, mode, COUNT(*) AS c, SUM(correct) AS ok, SUM(time_ms) AS ms
       FROM a GROUP BY section, domain_code, skill_code, mode`, ...params,
    )) {
      const row = rows.get(key(r.section, r.domain_code, r.skill_code));
      if (row) row.counts[r.mode] = { attempts: n(r.c), correct: n(r.ok), timeMs: n(r.ms) };
    }
    for (const r of this.db.all<{ section: Section; domain_code: string; skill_code: string; session_id: string; sts: number; mode: SessionMode; c: number; ok: number }>(
      `WITH ${sql}
       SELECT section, domain_code, skill_code, session_id, sts, mode, c, ok FROM (
         SELECT section, domain_code, skill_code, session_id, sts, mode, COUNT(*) AS c, SUM(correct) AS ok,
                ROW_NUMBER() OVER (PARTITION BY section, domain_code, skill_code ORDER BY sts DESC, session_id DESC) AS rn
         FROM a GROUP BY section, domain_code, skill_code, session_id
       ) WHERE rn <= ${RECENT_SESSIONS} ORDER BY section, domain_code, skill_code, sts, session_id`, ...params,
    )) {
      const point: SkillSessionPoint = { sessionId: r.session_id, finishedAt: n(r.sts), mode: r.mode, attempts: n(r.c), correct: n(r.ok) };
      rows.get(key(r.section, r.domain_code, r.skill_code))?.recent.push(point);
    }
    return { rows: [...rows.values()] };
  }

  async misses(f: AnalyticsFilter, limit: { skillCodes?: readonly string[]; section?: Section } = {}): Promise<MissRow[]> {
    await this.ready();
    const { sql, params } = scope(f);
    const extra: string[] = [];
    const extraParams: SqlParam[] = [];
    if (limit.section) {
      extra.push('l.section = ?');
      extraParams.push(limit.section);
    }
    if (limit.skillCodes && limit.skillCodes.length > 0) {
      extra.push(`l.skill_code IN (${limit.skillCodes.map(() => '?').join(', ')})`);
      extraParams.push(...limit.skillCodes);
    }
    return this.db
      .all<{ question_id: string; section: Section; domain_code: string; skill_code: string; difficulty: Difficulty; session_id: string; at: number; misses: number; attempts: number }>(
        `WITH ${sql},
         l AS (
           SELECT *, ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY at DESC, id DESC) AS rn,
                  COUNT(*) OVER (PARTITION BY question_id) AS attempts,
                  SUM(1 - correct) OVER (PARTITION BY question_id) AS misses
           FROM a
         )
         SELECT l.question_id, l.section, l.domain_code, l.skill_code, l.difficulty, l.session_id, l.at, l.misses, l.attempts
         FROM l WHERE l.rn = 1 AND l.correct = 0 ${extra.length ? `AND ${extra.join(' AND ')}` : ''}
         ORDER BY l.at, l.id LIMIT ${MAX_MISSES}`,
        ...params, ...extraParams,
      )
      .map((r) => ({
        questionId: r.question_id, section: r.section, domainCode: r.domain_code, skillCode: r.skill_code, difficulty: r.difficulty,
        sessionId: r.session_id, missedAt: n(r.at), misses: n(r.misses), attempts: n(r.attempts),
      }));
  }

  async skillDetail(f: AnalyticsFilter, skillCode: string): Promise<SkillDetail> {
    await this.ready();
    const { sql, params } = scope(f);
    const sessions: SkillSessionRow[] = this.db
      .all<{ session_id: string; sts: number; mode: SessionMode; kind: SkillSessionRow['kind']; c: number; ok: number; ms: number }>(
        `WITH ${sql}
         SELECT session_id, sts, mode, kind, COUNT(*) AS c, SUM(correct) AS ok, SUM(time_ms) AS ms
         FROM a WHERE skill_code = ? GROUP BY session_id ORDER BY sts DESC, session_id DESC`, ...params, skillCode,
      )
      .map((r) => ({ sessionId: r.session_id, finishedAt: n(r.sts), mode: r.mode, kind: r.kind, attempts: n(r.c), correct: n(r.ok), timeMs: n(r.ms) }));
    return { skillCode, sessions, misses: await this.misses(f, { skillCodes: [skillCode] }) };
  }

  async timing(f: AnalyticsFilter): Promise<TimingSummary> {
    await this.ready();
    const { sql, params } = scope(f);
    const baselines: TimingBaseline[] = this.db
      .all<{ mode: SessionMode; section: Section; difficulty: Difficulty; n: number; total: number; median: number; rush: number; stuck: number }>(
        `WITH ${BASELINE_SQL} SELECT * FROM bl ORDER BY mode, section, difficulty`,
      )
      .map((r) => ({
        mode: r.mode, section: r.section, difficulty: r.difficulty, n: n(r.n), medianMs: n(r.median), rushMs: n(r.rush), stuckMs: n(r.stuck),
        usable: n(r.n) >= MIN_BASELINE_ATTEMPTS, timeMs: n(r.total),
      }));

    // The baselines were just computed; the two flagged queries reuse them as literal rows instead of recomputing.
    const usable = baselines.filter((b) => b.usable);
    const blSql = usable.length
      ? `bl(mode, section, difficulty, n, rush, stuck) AS (VALUES ${usable.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')})`
      : 'bl(mode, section, difficulty, n, rush, stuck) AS (SELECT NULL, NULL, NULL, 0, 0, 0 WHERE 0)';
    const blParams: SqlParam[] = usable.flatMap((b) => [b.mode, b.section, b.difficulty, b.n, b.rushMs, b.stuckMs]);

    const flaggedCounts: TimingSummary['flaggedCounts'] = { rushedWrong: byMode(() => 0), stuck: byMode(() => 0) };
    for (const r of this.db.all<{ mode: SessionMode; is_rush: number; c: number }>(
      `WITH ${blSql}, ${sql}
       SELECT a.mode AS mode, (a.correct = 0 AND a.time_ms < bl.rush) AS is_rush, COUNT(*) AS c ${FLAGGED_FROM} GROUP BY a.mode, is_rush`, ...blParams, ...params,
    )) {
      (n(r.is_rush) === 1 ? flaggedCounts.rushedWrong : flaggedCounts.stuck)[r.mode] += n(r.c);
    }
    const flagged: FlaggedQuestion[] = this.db
      .all<{ question_id: string; session_id: string; mode: SessionMode; section: Section; skill_code: string; difficulty: Difficulty; time_ms: number; correct: number; at: number; is_rush: number; rush_ms: number; stuck_ms: number }>(
        `WITH ${blSql}, ${sql}
         SELECT a.question_id, a.session_id, a.mode, a.section, a.skill_code, a.difficulty, a.time_ms, a.correct, a.sts AS at,
                (a.correct = 0 AND a.time_ms < bl.rush) AS is_rush, bl.rush AS rush_ms, bl.stuck AS stuck_ms
         ${FLAGGED_FROM} ORDER BY a.sts DESC, a.id DESC LIMIT ${MAX_FLAGGED_LISTED}`, ...blParams, ...params,
      )
      .map((r) => ({
        questionId: r.question_id, sessionId: r.session_id, mode: r.mode, section: r.section, skillCode: r.skill_code, difficulty: r.difficulty,
        flag: n(r.is_rush) === 1 ? 'rushed_wrong' : 'stuck', timeMs: n(r.time_ms), correct: n(r.correct) === 1,
        thresholdMs: n(r.is_rush) === 1 ? n(r.rush_ms) : n(r.stuck_ms), at: n(r.at),
      }));

    const modules: ModulePacing[] = this.db
      .all<{
        id: string; ts: number; kind: ModulePacing['kind']; section: Section; module_number: 1 | 2; tier: ModulePacing['tier'];
        limit_ms: number; deadline: number | null; paused_left: number | null; by: string | null; paused: number; questions: number;
        answered: number; alert: number | null; last_five: number;
      }>(
        `WITH ${sql},
         alert AS (SELECT session_id, MIN(ts) AS ts FROM events WHERE type = 'five_minute_alert_shown' GROUP BY session_id),
         firsts AS (
           SELECT session_id, question_id, MIN(ts) AS first_at FROM events
           WHERE type IN ('choice_selected', 'spr_changed') AND question_id IS NOT NULL GROUP BY session_id, question_id
         ),
         last_five AS (
           SELECT f.session_id, COUNT(*) AS c FROM firsts f JOIN alert al ON al.session_id = f.session_id WHERE f.first_at >= al.ts GROUP BY f.session_id
         ),
         ans AS (SELECT session_id, COUNT(*) AS c FROM attempts WHERE status = 'final' AND response <> '' GROUP BY session_id)
         SELECT s.id, s.ts, s.kind, s.section, json_extract(x.data, '$.exam.module.moduleNumber') AS module_number,
                json_extract(x.data, '$.exam.module.tier') AS tier, json_extract(x.data, '$.exam.timer.durationMs') AS limit_ms,
                json_extract(x.data, '$.exam.timer.deadlineAt') AS deadline, json_extract(x.data, '$.exam.timer.pausedRemainingMs') AS paused_left,
                json_extract(x.data, '$.exam.submittedBy') AS by, s.paused,
                json_array_length(json_extract(x.data, '$.queueIds')) AS questions,
                COALESCE(ans.c, 0) AS answered, al.ts AS alert, COALESCE(lf.c, 0) AS last_five
         FROM s JOIN sessions x ON x.id = s.id
              LEFT JOIN alert al ON al.session_id = s.id LEFT JOIN last_five lf ON lf.session_id = s.id LEFT JOIN ans ON ans.session_id = s.id
         WHERE s.kind IN ('module', 'section', 'full') AND x.mode = 'exam'
         ORDER BY s.ts DESC, s.id DESC`, ...params,
      )
      .map((r) => ({
        sessionId: r.id, finishedAt: n(r.ts), section: r.section, moduleNumber: n(r.module_number) as 1 | 2, tier: r.tier,
        kind: r.kind, timeLimitMs: n(r.limit_ms),
        timeLeftMs: r.paused_left !== null ? Math.max(0, n(r.paused_left)) : r.deadline === null ? 0 : Math.max(0, n(r.deadline) - n(r.ts)),
        submittedBy: r.by === 'timer' ? 'timer' : 'user', paused: n(r.paused) === 1, questions: n(r.questions), answered: n(r.answered),
        reachedFiveMinutes: r.alert !== null, answeredInLastFive: r.alert === null ? 0 : n(r.last_five),
      }));
    return { baselines, flaggedCounts, flagged, modules };
  }

  async behavior(f: AnalyticsFilter): Promise<BehaviorSummary> {
    await this.ready();
    const { sql, params } = scope(f);
    const counts = byMode<BehaviorCounts>(() => ({
      answered: 0, questionsWithChange: 0, changes: 0, correctToIncorrect: 0, incorrectToCorrect: 0, incorrectToIncorrect: 0,
      mcqAnswered: 0, questionsWithStrike: 0, strikeActions: 0, rated: 0, sureWrong: 0, sureRight: 0, unsureRight: 0, unsureWrong: 0,
      guessRight: 0, guessWrong: 0,
    }));
    for (const r of this.db.all<Record<string, number | string>>(
      `WITH ${sql}
       SELECT mode, COUNT(*) AS answered, SUM(changes > 0) AS qwc, SUM(changes) AS changes, SUM(is_mcq) AS mcq,
              SUM(confidence IS NOT NULL) AS rated,
              SUM(confidence = 'sure' AND correct = 0) AS sure_wrong, SUM(confidence = 'sure' AND correct = 1) AS sure_right,
              SUM(confidence = 'unsure' AND correct = 1) AS unsure_right, SUM(confidence = 'unsure' AND correct = 0) AS unsure_wrong,
              SUM(confidence = 'guess' AND correct = 1) AS guess_right, SUM(confidence = 'guess' AND correct = 0) AS guess_wrong
       FROM a GROUP BY mode`, ...params,
    )) {
      const c = counts[r.mode as SessionMode];
      c.answered = n(r.answered); c.questionsWithChange = n(r.qwc); c.changes = n(r.changes); c.mcqAnswered = n(r.mcq); c.rated = n(r.rated);
      c.sureWrong = n(r.sure_wrong); c.sureRight = n(r.sure_right); c.unsureRight = n(r.unsure_right); c.unsureWrong = n(r.unsure_wrong);
      c.guessRight = n(r.guess_right); c.guessWrong = n(r.guess_wrong);
    }
    for (const r of this.db.all<{ mode: SessionMode; qs: number; strikes: number }>(
      `WITH ${sql}
       SELECT a.mode AS mode, COUNT(DISTINCT a.id) AS qs, COUNT(*) AS strikes
       FROM a JOIN events e ON e.session_id = a.session_id AND e.question_id = a.question_id AND e.type = 'choice_struck'
       WHERE a.is_mcq = 1 GROUP BY a.mode`, ...params,
    )) {
      counts[r.mode].questionsWithStrike = n(r.qs);
      counts[r.mode].strikeActions = n(r.strikes);
    }
    for (const r of this.db.all<{ mode: SessionMode; c2i: number; i2c: number; i2i: number }>(
      `WITH ${sql}
       SELECT a.mode AS mode,
              SUM(json_extract(e.payload, '$.from') = m.correct_choice AND json_extract(e.payload, '$.to') <> m.correct_choice) AS c2i,
              SUM(json_extract(e.payload, '$.from') <> m.correct_choice AND json_extract(e.payload, '$.to') = m.correct_choice) AS i2c,
              SUM(json_extract(e.payload, '$.from') <> m.correct_choice AND json_extract(e.payload, '$.to') <> m.correct_choice) AS i2i
       FROM a JOIN events e ON e.session_id = a.session_id AND e.question_id = a.question_id AND e.type = 'choice_changed'
              JOIN qmeta m ON m.id = a.question_id
       WHERE m.is_mcq = 1 GROUP BY a.mode`, ...params,
    )) {
      counts[r.mode].correctToIncorrect = n(r.c2i);
      counts[r.mode].incorrectToCorrect = n(r.i2c);
      counts[r.mode].incorrectToIncorrect = n(r.i2i);
    }
    return { counts };
  }

  /** Finished full tests and section runs, oldest first. */
  async tests(f: AnalyticsFilter): Promise<TestHistory> {
    const where: string[] = ["x.status = 'finished'", 'x.test_kind IS NOT NULL'];
    const params: SqlParam[] = [];
    const ts = 'COALESCE(x.finished_at, x.last_activity_at)';
    if (f.from !== null) { where.push(`${ts} >= ?`); params.push(f.from); }
    if (f.to !== null) { where.push(`${ts} <= ?`); params.push(f.to); }
    if (f.kind === 'full') where.push("x.test_kind = 'full'");
    else if (f.kind === 'section') where.push("x.test_kind <> 'full'");
    else if (f.kind !== 'all') where.push('0');
    if (f.section !== null) { where.push("(x.test_kind = 'full' OR x.test_kind = ?)"); params.push(f.section); }
    if (f.excludePaused) where.push('x.test_paused = 0');
    const tests: TestHistoryRow[] = this.db
      .all<{ data: string }>(`SELECT x.data FROM sessions x WHERE ${where.join(' AND ')} ORDER BY ${ts}, x.id`, ...params)
      .map((r) => {
        const s = JSON.parse(r.data) as SessionRecord;
        const t = s.test;
        return {
          testId: s.id,
          kind: t?.kind ?? 'full',
          finishedAt: s.finishedAt ?? s.lastActivityAt,
          paused: t?.paused === true,
          configVersion: t?.estimate?.configVersion ?? t?.configVersion ?? 0,
          estimate: t?.estimate ?? null,
          routing: t?.routing ?? [],
        };
      });
    return { tests };
  }
}

