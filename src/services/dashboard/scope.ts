// Dashboard scope: turns the segmented control, the section toggle and "More filters" into the
// analytics filter every part of the page uses, plus the previous equal period for changes. Pure.

import { DAY_MS } from '../../config/mistakeConfig';
import type { AnalyticsFilter } from '../../types/analytics';
import type { DashboardScope, ResolvedScope, ScopePreset } from '../../types/dashboard';
import { filterFromParams, filterToParams } from '../analytics/filter';

export interface ScopeContext {
  now: number;
  /** Finish times of your first and latest finished session (hidden ones excluded), or null with none. */
  firstAt: number | null;
  lastAt: number | null;
  /** The latest finished test (full or section run), or null. */
  lastTest: { startedAt: number; finishedAt: number } | null;
}

const shortDate = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Calendar days spanned by your data, 0 with none. */
export function dataDays(ctx: Pick<ScopeContext, 'firstAt' | 'lastAt'>): number {
  if (ctx.firstAt === null || ctx.lastAt === null) return 0;
  return Math.floor((ctx.lastAt - ctx.firstAt) / DAY_MS) + 1;
}

/**
 * The previous period of the same length, ending just before this one starts. Null for an
 * open-ended start (all time).
 */
export function previousPeriod(f: AnalyticsFilter, now: number = Date.now()): AnalyticsFilter | null {
  if (f.from === null) return null;
  const to = f.to ?? now;
  const len = to - f.from;
  if (len <= 0) return null;
  return { ...f, from: f.from - len - 1, to: f.from - 1 };
}

export function resolveScope(scope: DashboardScope, ctx: ScopeContext): ResolvedScope {
  const days = dataDays(ctx);
  const base: AnalyticsFilter = {
    from: null,
    to: null,
    kind: scope.kind,
    section: scope.section === 'both' ? null : scope.section,
    excludePaused: scope.excludePaused,
    excludeSingle: scope.excludeSingle,
    includeHidden: scope.includeHidden,
  };

  if (scope.from !== null || scope.to !== null) {
    const filter = { ...base, from: scope.from, to: scope.to };
    const label =
      scope.from !== null && scope.to !== null
        ? `${shortDate(scope.from)} to ${shortDate(scope.to)}`
        : scope.from !== null
          ? `Since ${shortDate(scope.from)}`
          : `Until ${shortDate(scope.to as number)}`;
    return { preset: 'custom', filter, previous: scope.from !== null && scope.to !== null ? previousPeriod(filter, ctx.now) : null, label, dataDays: days };
  }

  let preset: ScopePreset = scope.preset === 'auto' ? (days >= 30 ? '30d' : 'all') : scope.preset;
  if (preset === 'last_test') {
    if (ctx.lastTest) {
      const filter = { ...base, from: ctx.lastTest.startedAt, to: ctx.lastTest.finishedAt };
      return { preset, filter, previous: null, label: `Test of ${shortDate(ctx.lastTest.finishedAt)}`, dataDays: days };
    }
    preset = 'all';
    return { preset, filter: base, previous: null, label: 'All time (no finished test yet)', dataDays: days };
  }
  if (preset === 'all') return { preset, filter: base, previous: null, label: 'All time', dataDays: days };
  const n = preset === '7d' ? 7 : 30;
  const filter = { ...base, from: ctx.now - n * DAY_MS, to: null };
  return { preset, filter, previous: previousPeriod(filter, ctx.now), label: `Last ${n} days`, dataDays: days };
}

const PRESETS: readonly (ScopePreset | 'auto')[] = ['auto', 'last_test', '7d', '30d', 'all'];

/** The scope as a query string (the analytics filter fields plus preset and section). */
export function scopeToParams(s: DashboardScope): URLSearchParams {
  const p = filterToParams({ from: s.from, to: s.to, kind: s.kind, section: s.section === 'both' ? null : s.section, excludePaused: s.excludePaused, excludeSingle: s.excludeSingle, includeHidden: s.includeHidden });
  if (s.preset !== 'auto') p.set('preset', s.preset);
  return p;
}

export function scopeFromParams(p: URLSearchParams): DashboardScope {
  const f = filterFromParams(p);
  const preset = p.get('preset');
  return {
    preset: PRESETS.includes(preset as ScopePreset) ? (preset as ScopePreset) : 'auto',
    section: f.section ?? 'both',
    from: f.from,
    to: f.to,
    kind: f.kind,
    excludePaused: f.excludePaused,
    excludeSingle: f.excludeSingle,
    includeHidden: f.includeHidden,
  };
}
