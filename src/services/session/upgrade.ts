// Upgrades stored sessions to the current record. Version 1 is the Phase 2 shape (graded on
// submit); version 2 is Phase 2c (no `source`). Used by the database migrations, tested on its own.

import type { DrillConfig } from '../../types/drill';
import type { ChoiceLetter } from '../../types/sat';
import { SESSION_RECORD_VERSION, type QuestionProgress, type SessionRecord } from '../../types/session';

/** The Phase 2 session record, as it was written to disk. */
export interface SessionRecordV1 {
  id: string;
  config: DrillConfig;
  queueIds: string[];
  index: number;
  startedAt: number;
  status: 'active' | 'finished';
  answered: Record<string, { response: string; correct: boolean; timeMs: number; at: number }>;
  struck: Record<string, ChoiceLetter[]>;
  currentElapsedMs: number;
}

export function isSessionV1(v: unknown): v is SessionRecordV1 {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return r.version === undefined && typeof r.id === 'string' && Array.isArray(r.queueIds) && typeof r.answered === 'object';
}

export function upgradeSessionV1(v1: SessionRecordV1): SessionRecord {
  const progress: Record<string, QuestionProgress> = {};
  let lastAt = v1.startedAt;
  let correct = 0;
  v1.queueIds.forEach((id, i) => {
    const a = v1.answered[id];
    if (a) {
      lastAt = Math.max(lastAt, a.at);
      if (a.correct) correct++;
    }
    const current = i === v1.index && !a;
    progress[id] = {
      response: a ? a.response : null,
      changes: 0,
      activeMs: a ? a.timeMs : current ? Math.max(0, Math.round(v1.currentElapsedMs)) : 0,
      firstVisitMs: a ? a.timeMs : null,
      visits: a || i <= v1.index ? 1 : 0,
      struck: [...(v1.struck[id] ?? [])],
      flagged: false,
      confidence: null,
    };
  });
  const finished = v1.status === 'finished';
  return {
    version: SESSION_RECORD_VERSION,
    id: v1.id,
    mode: 'drill',
    source: 'drill',
    config: v1.config,
    queueIds: [...v1.queueIds],
    index: v1.index,
    status: finished ? 'finished' : 'in_progress',
    startedAt: v1.startedAt,
    finishedAt: finished ? lastAt : null,
    lastActivityAt: lastAt,
    progress,
    score: finished ? { correct, total: v1.queueIds.length } : null,
    totalActiveMs: Object.values(progress).reduce((s, p) => s + p.activeMs, 0),
    askConfidence: false,
  };
}

/** Version 2 (Phase 2c) had no `source`; every session then came from the drill setup. */
export function upgradeSessionV2(v2: Omit<SessionRecord, 'version' | 'source'> & { version: 2 }): SessionRecord {
  return { ...v2, version: SESSION_RECORD_VERSION, source: 'drill' };
}

/** Brings any stored session (version 1, 2 or current) to the current shape. */
export function upgradeSession(raw: unknown): SessionRecord {
  if (isSessionV1(raw)) return upgradeSessionV1(raw);
  const r = raw as { version?: number };
  if (r.version === 2) return upgradeSessionV2(raw as Omit<SessionRecord, 'version' | 'source'> & { version: 2 });
  return raw as SessionRecord;
}
