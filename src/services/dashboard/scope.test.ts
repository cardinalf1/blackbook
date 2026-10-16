import { describe, expect, it } from 'vitest';
import { DEFAULT_DASHBOARD_SCOPE } from '../../types/dashboard';
import { previousPeriod, resolveScope, scopeFromParams, scopeToParams } from './scope';

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 16, 12);
const ctx = (days: number) => ({ now, firstAt: days ? now - (days - 1) * DAY : null, lastAt: days ? now : null, lastTest: null });

describe('dashboard scope', () => {
  it('defaults to 30 days, or all time with less than 30 days of data', () => {
    expect(resolveScope(DEFAULT_DASHBOARD_SCOPE, ctx(45)).preset).toBe('30d');
    expect(resolveScope(DEFAULT_DASHBOARD_SCOPE, ctx(2)).preset).toBe('all');
    expect(resolveScope(DEFAULT_DASHBOARD_SCOPE, ctx(0)).preset).toBe('all');
  });

  it('7 days has an equal previous period; all time has none', () => {
    const r = resolveScope({ ...DEFAULT_DASHBOARD_SCOPE, preset: '7d' }, ctx(40));
    expect(r.filter.from).toBe(now - 7 * DAY);
    expect(r.previous?.to).toBe(now - 7 * DAY - 1);
    expect((r.previous?.to ?? 0) - (r.previous?.from ?? 0)).toBe(7 * DAY);
    expect(resolveScope({ ...DEFAULT_DASHBOARD_SCOPE, preset: 'all' }, ctx(40)).previous).toBeNull();
  });

  it('last test uses the test window, or all time when there is no test', () => {
    const r = resolveScope({ ...DEFAULT_DASHBOARD_SCOPE, preset: 'last_test' }, { ...ctx(5), lastTest: { startedAt: 100, finishedAt: 200 } });
    expect(r.filter).toMatchObject({ from: 100, to: 200 });
    expect(resolveScope({ ...DEFAULT_DASHBOARD_SCOPE, preset: 'last_test' }, ctx(5)).preset).toBe('all');
  });

  it('a custom date range replaces the preset; section and filters pass through', () => {
    const r = resolveScope({ ...DEFAULT_DASHBOARD_SCOPE, preset: '7d', from: 1000, to: 5000, section: 'math', excludeSingle: true, includeHidden: true }, ctx(40));
    expect(r.preset).toBe('custom');
    expect(r.filter).toMatchObject({ from: 1000, to: 5000, section: 'math', excludeSingle: true, includeHidden: true });
    expect(previousPeriod(r.filter)).toMatchObject({ from: 1000 - 4000 - 1, to: 999 });
  });

  it('round-trips through the query string', () => {
    const s = { ...DEFAULT_DASHBOARD_SCOPE, preset: '7d' as const, section: 'rw' as const, kind: 'drill' as const, excludePaused: true, includeHidden: true };
    expect(scopeFromParams(scopeToParams(s))).toEqual(s);
    expect(scopeFromParams(scopeToParams(DEFAULT_DASHBOARD_SCOPE))).toEqual(DEFAULT_DASHBOARD_SCOPE);
  });
});
