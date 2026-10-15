// The analytics filter as a query string, shared by the HTTP adapter (writes it) and the local
// server (reads it). Anything malformed falls back to the default for that field.

import { ANALYTICS_KINDS, DEFAULT_ANALYTICS_FILTER, type AnalyticsFilter, type AnalyticsKind } from '../../types/analytics';
import { SECTIONS, type Section } from '../../types/sat';

export function filterToParams(f: AnalyticsFilter, params = new URLSearchParams()): URLSearchParams {
  if (f.from !== null) params.set('from', String(f.from));
  if (f.to !== null) params.set('to', String(f.to));
  if (f.kind !== 'all') params.set('kind', f.kind);
  if (f.section !== null) params.set('section', f.section);
  if (f.excludePaused) params.set('excludePaused', '1');
  if (f.excludeSingle) params.set('excludeSingle', '1');
  return params;
}

function timestamp(v: string | null): number | null {
  if (v === null || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? Math.floor(x) : null;
}

export function filterFromParams(p: URLSearchParams): AnalyticsFilter {
  const kind = p.get('kind');
  const section = p.get('section');
  return {
    ...DEFAULT_ANALYTICS_FILTER,
    from: timestamp(p.get('from')),
    to: timestamp(p.get('to')),
    kind: ANALYTICS_KINDS.includes(kind as AnalyticsKind) ? (kind as AnalyticsKind) : 'all',
    section: SECTIONS.includes(section as Section) ? (section as Section) : null,
    excludePaused: p.get('excludePaused') === '1',
    excludeSingle: p.get('excludeSingle') === '1',
  };
}
