// GET /api/dashboard: the whole Dashboard page in one request, built from the existing analytics
// summaries (SqlAnalytics) and user records by the pure builder in src/services/dashboard/build.ts.
// Nothing here computes a metric of its own.

import { buildInsights, ruleCoach } from '../src/services/ai/insights';
import { insightInputsFrom, retryFigures } from '../src/services/ai/insightInputs';
import { hiddenSessionIds } from '../src/services/analytics/hidden';
import { buildRows } from '../src/services/browse/filter';
import { buildDashboard, type DashboardParts } from '../src/services/dashboard/build';
import { resolveScope } from '../src/services/dashboard/scope';
import { STRICT_POLICY } from '../src/services/eligibility/eligibility';
import { poolHealth } from '../src/services/test/pool';
import { DEFAULT_ANALYTICS_FILTER, type AnalyticsStore } from '../src/types/analytics';
import type { DashboardData, DashboardScope } from '../src/types/dashboard';
import type { Question, Section } from '../src/types/sat';
import type { SqliteUserStore } from './userDb';

export interface DashboardDeps {
  analytics: AnalyticsStore;
  users: Pick<SqliteUserStore, 'listSessions' | 'listAttempts' | 'listTags' | 'listHidden' | 'questionStatus'>;
  bank: { query(q: Record<string, never>): Promise<Question[]> };
  /** True when a key is set and AI is on. */
  aiAvailable?: () => Promise<boolean>;
  now?: () => number;
}

export class DashboardService {
  constructor(private readonly d: DashboardDeps) {}

  async load(scope: DashboardScope): Promise<DashboardData> {
    const started = performance.now();
    const now = this.d.now?.() ?? Date.now();
    const [sessions, attempts, tags, hiddenRows, status, questions, aiAvailable] = await Promise.all([
      this.d.users.listSessions(),
      this.d.users.listAttempts(),
      this.d.users.listTags(),
      this.d.users.listHidden(),
      this.d.users.questionStatus(),
      this.d.bank.query({}),
      this.d.aiAvailable ? this.d.aiAvailable().catch(() => false) : Promise.resolve(false),
    ]);
    const allHidden = hiddenSessionIds(sessions, hiddenRows);
    const hidden = scope.includeHidden ? new Set<string>() : allHidden;

    const visible = sessions.filter((s) => s.status === 'finished' && s.source !== 'retry' && !hidden.has(s.id));
    const times = visible.filter((s) => !s.test).map((s) => s.finishedAt ?? s.lastActivityAt);
    const lastTest = visible.filter((s) => s.test).sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))[0];
    const resolved = resolveScope(scope, {
      now,
      firstAt: times.length ? Math.min(...times) : null,
      lastAt: times.length ? Math.max(...times) : null,
      lastTest: lastTest ? { startedAt: lastTest.startedAt, finishedAt: lastTest.finishedAt ?? lastTest.lastActivityAt } : null,
    });
    const f = resolved.filter;
    const a = this.d.analytics;
    const [overview, previousOverview, skills, timing, behavior, tests, allTests, misses] = await Promise.all([
      a.overview(f),
      resolved.previous ? a.overview(resolved.previous) : Promise.resolve(null),
      a.skills(f),
      a.timing(f),
      a.behavior(f),
      a.tests(f),
      a.tests({ ...DEFAULT_ANALYTICS_FILTER, includeHidden: f.includeHidden }),
      a.misses(f),
    ]);

    const sectionOf = new Map<string, Section>(questions.map((q) => [q.id, q.section]));
    const rows = buildRows(questions, status);
    let pool: DashboardParts['pool'] = null;
    try {
      pool = poolHealth(rows, STRICT_POLICY);
    } catch {
      pool = null;
    }
    const inputs = insightInputsFrom({
      filter: f, before: resolved.previous, period: 'custom', overview, skills, timing, behavior, misses, tags, hidden,
      inBank: (id) => sectionOf.has(id), attempts, sessions, now,
    });
    const page = buildDashboard({
      scope: resolved, now, overview, previousOverview, skills, timing, behavior, tests, allTests, misses,
      sessions, attempts, tags, hidden, sectionOf,
      retry: retryFigures(attempts, sessions, now),
      bankDone: rows.filter((r) => r.status === 'done').length,
      pool,
      coachLines: ruleCoach(buildInsights(inputs)),
      aiAvailable,
    });
    return { ...page, buildMs: Math.round(performance.now() - started) };
  }
}
