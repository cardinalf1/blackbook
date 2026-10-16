// Sessions hidden from analytics, expanded to the modules of a hidden test. Pure.

import type { HiddenSession, SessionRecord } from '../../types/session';

export function hiddenSessionIds(sessions: readonly SessionRecord[], hidden: readonly HiddenSession[]): Set<string> {
  const ids = new Set(hidden.map((h) => h.sessionId));
  for (const s of sessions) if (s.exam?.testId && ids.has(s.exam.testId)) ids.add(s.id);
  return ids;
}
