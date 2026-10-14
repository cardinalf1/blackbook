// Size and duration of a fresh download, from measured numbers (docs/api-notes.md, 2026-10-14).
// These are estimates for the consent dialog, not promises; the progress panel shows live numbers.

import type { DownloadEstimate, DownloadScopeChoice, SkipLine } from '../../types/download';
import type { Section } from '../../types/sat';

/** Unique detail items per section in the source, and how many are in the live set. */
const ITEMS: Record<Section, { all: number; live: number }> = {
  rw: { all: 1845, live: 1092 },
  math: { all: 1922, live: 927 },
};

/** Measured at 2 in flight: about 3.9 detail requests per second. */
const REQUESTS_PER_SECOND = 3.9;
/** Measured: normalizing and sanitizing takes about 0.09 s per question on a laptop. */
const NORMALIZE_SECONDS_PER_ITEM = 0.09;

export function estimateDownload(scope: DownloadScopeChoice): DownloadEstimate {
  const questions = scope.sections.reduce((n, s) => n + (scope.liveOnly ? ITEMS[s].live : ITEMS[s].all), 0);
  // One lookup request and one list request per section, then one request per question.
  const requests = questions === 0 ? 0 : questions + 1 + scope.sections.length;
  const seconds = questions / REQUESTS_PER_SECOND + questions * NORMALIZE_SECONDS_PER_ITEM;
  return { questions, requests, minutes: questions === 0 ? 0 : Math.max(1, Math.round(seconds / 60)) };
}

const SKIP_TEXT: Record<string, string> = {
  'legacy-spr-no-key': 'Older fill-in questions published without an answer key',
  'legacy-mcq-no-key': 'Older multiple-choice questions with no clear answer key',
  'mcq-key-conflicts-rationale': 'Answer key disagrees with the explanation',
  'known-malformed': 'Published incomplete by the source',
  'detail-shape': 'Question data in an unexpected format',
  'empty-stem': 'Question has no text',
  'mcq-options': 'Answer choices missing or not four',
  'mcq-key-invalid': 'Answer key is not a valid choice',
  'mcq-key-mismatch': 'Answer key does not match the choices',
  'legacy-unknown-style': 'Older question in an unknown format',
  'spr-no-answer': 'Fill-in question with no accepted answer',
};

/** Plain-language lines for a skip report, largest first. Reasons may carry ": detail" suffixes. */
export function describeSkips(skipped: readonly { reason: string }[]): SkipLine[] {
  const counts = new Map<string, number>();
  for (const s of skipped) {
    const base = s.reason.startsWith('http ') || s.reason.startsWith('fetch failed') ? 'download-failed' : (s.reason.split(':')[0] ?? s.reason);
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  return [...counts]
    .map(([reason, count]) => ({
      reason,
      count,
      description: reason === 'download-failed' ? 'Could not be downloaded this time (refresh to retry)' : (SKIP_TEXT[reason] ?? reason),
    }))
    .sort((a, b) => b.count - a.count);
}
