// Input checks for the user-data routes. The server only accepts well-formed records, so a bad
// client can never write something the app cannot read back.

import type { FlagRecord } from '../src/types/drill';
import { MISTAKE_NOTE_MAX, MISTAKE_REASONS, type MistakeReason, type MistakeTag } from '../src/types/mistakes';
import { CHOICE_LETTERS, type ChoiceLetter } from '../src/types/sat';
import {
  CONFIDENCE_LEVELS,
  SESSION_RECORD_VERSION,
  type Confidence,
  type EventRecord,
  type EventType,
  type SessionRecord,
  type StoredAttempt,
} from '../src/types/session';

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 500;
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isMs = (v: unknown): v is number => isNum(v) && v >= 0;
const isMode = (v: unknown) => v === 'drill' || v === 'exam';
const isConfidence = (v: unknown): v is Confidence | null => v === null || CONFIDENCE_LEVELS.includes(v as Confidence);
const isResponse = (v: unknown) => typeof v === 'string' && v.length <= 100;

/** Every event type the log accepts. Kept in sync with EventPayloads by the compiler. */
const EVENT_TYPES: Record<EventType, true> = {
  session_started: true,
  session_finished: true,
  session_abandoned: true,
  session_resumed: true,
  question_shown: true,
  question_hidden: true,
  first_interaction: true,
  choice_selected: true,
  choice_changed: true,
  choice_cleared: true,
  choice_struck: true,
  strike_removed: true,
  spr_changed: true,
  spr_cleared: true,
  flag_set: true,
  flag_removed: true,
  nav_back: true,
  nav_next: true,
  nav_jump: true,
  finish_clicked: true,
  finish_cancelled: true,
  tab_hidden: true,
  tab_visible: true,
  window_blur: true,
  window_focus: true,
  idle_start: true,
  idle_end: true,
  confidence_rated: true,
  report_opened: true,
  rationale_viewed: true,
  report_item_time: true,
  timer_hidden: true,
  timer_shown: true,
  five_minute_alert_shown: true,
  exam_paused: true,
  exam_resumed: true,
  reference_opened: true,
  reference_closed: true,
  navigator_opened: true,
  navigator_closed: true,
  test_started: true,
  test_module_started: true,
  test_module_submitted: true,
  test_routed: true,
  test_break_started: true,
  test_break_ended: true,
  test_finished: true,
  test_abandoned: true,
  mistake_tag_set: true,
  mistake_tag_changed: true,
};

function isExam(e: unknown): boolean {
  if (!isObj(e) || !isObj(e.module) || !isObj(e.timer) || !Array.isArray(e.pauses)) return false;
  const m = e.module;
  if ((m.section !== 'rw' && m.section !== 'math') || (m.moduleNumber !== 1 && m.moduleNumber !== 2)) return false;
  if (m.tier !== 'routing' && m.tier !== 'easier' && m.tier !== 'harder') return false;
  const t = e.timer;
  if (!isMs(t.durationMs) || !(t.deadlineAt === null || isNum(t.deadlineAt)) || !(t.pausedRemainingMs === null || isMs(t.pausedRemainingMs))) return false;
  if (e.phase !== 'in_progress' && e.phase !== 'review' && e.phase !== 'submitted') return false;
  if (e.submittedBy !== null && e.submittedBy !== 'user' && e.submittedBy !== 'timer') return false;
  if (typeof e.timerHidden !== 'boolean' || typeof e.fiveMinuteAlertShown !== 'boolean') return false;
  if (e.testId !== undefined && !isStr(e.testId)) return false;
  if (!Array.isArray(e.assemblyNotes) || !e.assemblyNotes.every((n) => typeof n === 'string' && n.length < 500)) return false;
  return e.pauses.every((p) => isObj(p) && isNum(p.at) && typeof p.reason === 'string' && p.reason.length < 100 && (p.resumedAt === null || isNum(p.resumedAt)));
}

const MODULE_KEYS = ['rw1', 'rw2', 'math1', 'math2'];

function isSlot(s: unknown): boolean {
  return (
    isObj(s) &&
    MODULE_KEYS.includes(s.key as string) &&
    (s.section === 'rw' || s.section === 'math') &&
    (s.moduleNumber === 1 || s.moduleNumber === 2) &&
    (s.tier === 'routing' || s.tier === 'easier' || s.tier === 'harder') &&
    Array.isArray(s.questionIds) &&
    s.questionIds.length <= 100 &&
    s.questionIds.every(isStr) &&
    Array.isArray(s.notes) &&
    s.notes.every((n) => typeof n === 'string' && n.length < 500) &&
    (s.sessionId === null || isStr(s.sessionId))
  );
}

function isEstimate(e: unknown): boolean {
  if (e === null) return true;
  if (!isObj(e) || !isNum(e.configVersion) || !Array.isArray(e.sections)) return false;
  const secOk = e.sections.every(
    (s) =>
      isObj(s) && (s.section === 'rw' || s.section === 'math') && (s.route === 'easier' || s.route === 'harder') &&
      isNum(s.low) && isNum(s.high) && isNum(s.mid) && isNum(s.weightedFraction) && typeof s.capped === 'boolean' && isMs(s.answered) && isMs(s.total),
  );
  return secOk && (e.total === null || (isObj(e.total) && isNum(e.total.low) && isNum(e.total.high) && isNum(e.total.mid)));
}

function isTest(t: unknown): boolean {
  if (!isObj(t) || (t.kind !== 'full' && t.kind !== 'rw' && t.kind !== 'math')) return false;
  if (!Array.isArray(t.steps) || t.steps.length > 10 || !isMs(t.stepIndex) || t.stepIndex > t.steps.length) return false;
  if (!t.steps.every((s) => isObj(s) && (s.type === 'break' || (s.type === 'module' && MODULE_KEYS.includes(s.key as string))))) return false;
  if (!isObj(t.slots) || !Object.entries(t.slots).every(([k, v]) => MODULE_KEYS.includes(k) && isSlot(v))) return false;
  if (!Array.isArray(t.routing) || t.routing.length > 2) return false;
  const routingOk = t.routing.every(
    (r) =>
      isObj(r) && (r.section === 'rw' || r.section === 'math') && (r.route === 'easier' || r.route === 'harder') &&
      isNum(r.weightedFraction) && isNum(r.threshold) && isMs(r.correct) && isMs(r.total) && isNum(r.configVersion) && isNum(r.at),
  );
  if (!routingOk) return false;
  const b = t.break;
  if (b !== null && !(isObj(b) && isNum(b.startedAt) && isMs(b.durationMs) && isNum(b.deadlineAt) && (b.endedAt === null || isNum(b.endedAt)) && typeof b.endedEarly === 'boolean')) return false;
  return typeof t.includeSeen === 'boolean' && typeof t.paused === 'boolean' && isNum(t.configVersion) && isEstimate(t.estimate);
}

export function parseSession(v: unknown): SessionRecord | null {
  if (!isObj(v) || v.version !== SESSION_RECORD_VERSION || !isStr(v.id) || !isMode(v.mode)) return null;
  if (v.source !== 'drill' && v.source !== 'browse' && v.source !== 'exam' && v.source !== 'retry') return null;
  if (v.status !== 'in_progress' && v.status !== 'finished' && v.status !== 'abandoned') return null;
  if (!isObj(v.config) || !Array.isArray(v.queueIds) || !v.queueIds.every(isStr) || v.queueIds.length > 500) return null;
  if (!isNum(v.index) || v.index < 0 || (v.queueIds.length > 0 && v.index >= v.queueIds.length)) return null;
  if (!isNum(v.startedAt) || !(v.finishedAt === null || isNum(v.finishedAt)) || !isNum(v.lastActivityAt)) return null;
  if (!isMs(v.totalActiveMs) || typeof v.askConfidence !== 'boolean') return null;
  if (!(v.score === null || (isObj(v.score) && isNum(v.score.correct) && isNum(v.score.total)))) return null;
  if (!isObj(v.progress)) return null;
  if (v.exam !== undefined && !isExam(v.exam)) return null;
  if (v.test !== undefined && (!isTest(v.test) || v.exam !== undefined || v.queueIds.length !== 0)) return null;
  if ((v.mode === 'exam') !== (v.exam !== undefined || v.test !== undefined)) return null;
  for (const id of v.queueIds as string[]) {
    const p = v.progress[id];
    if (!isObj(p)) return null;
    if (!(p.response === null || isResponse(p.response)) || !isMs(p.changes) || !isMs(p.activeMs) || !isMs(p.visits)) return null;
    if (!(p.firstVisitMs === null || isMs(p.firstVisitMs)) || typeof p.flagged !== 'boolean' || !isConfidence(p.confidence)) return null;
    if (!Array.isArray(p.struck) || !p.struck.every((l) => CHOICE_LETTERS.includes(l as ChoiceLetter))) return null;
  }
  return v as unknown as SessionRecord;
}

export function parseAttempt(v: unknown): StoredAttempt | null {
  if (!isObj(v)) return null;
  const { id, sessionId, questionId, mode, status, response, correct, timeMs, firstVisitMs, changes, confidence, at } = v;
  if (!isStr(id) || !isStr(sessionId) || !isStr(questionId) || id !== `${sessionId}:${questionId}` || !isMode(mode)) return null;
  if ((status !== 'draft' && status !== 'final') || !isResponse(response) || typeof correct !== 'boolean') return null;
  if (!isMs(timeMs) || !(firstVisitMs === null || isMs(firstVisitMs)) || !isMs(changes) || !isConfidence(confidence) || !isNum(at)) return null;
  return v as unknown as StoredAttempt;
}

export function parseEvent(v: unknown): EventRecord | null {
  if (!isObj(v)) return null;
  if (!isStr(v.id) || !isStr(v.sessionId) || !isMode(v.mode) || !(v.questionId === null || isStr(v.questionId))) return null;
  if (typeof v.type !== 'string' || !(v.type in EVENT_TYPES) || !isNum(v.ts) || !isNum(v.monoMs) || !isStr(v.pageId) || !isMs(v.seq)) return null;
  if (!isObj(v.payload) || JSON.stringify(v.payload).length > 2000) return null;
  return v as unknown as EventRecord;
}

export function parseTag(v: unknown): MistakeTag | null {
  if (!isObj(v)) return null;
  if (!isStr(v.id) || !isStr(v.sessionId) || !isStr(v.questionId) || !isNum(v.at) || typeof v.suggested !== 'boolean') return null;
  if (!MISTAKE_REASONS.includes(v.reason as MistakeReason)) return null;
  if (typeof v.note !== 'string' || v.note.length > MISTAKE_NOTE_MAX) return null;
  return v as unknown as MistakeTag;
}

/** The records of a backup or export, every one checked. Question content is never part of it. */
export interface ValidatedUserData {
  sessions: SessionRecord[];
  attempts: StoredAttempt[];
  events: EventRecord[];
  flags: FlagRecord[];
  mistakeTags: MistakeTag[];
}

const MAX_RESTORE_ROWS = 2_000_000;

/**
 * Checks a parsed export or snapshot. Returns the records, or a plain sentence saying what is wrong.
 * Exports from before Phase 6 have no tags or flags; those lists are then empty.
 */
export function parseUserData(v: unknown): ValidatedUserData | string {
  if (!isObj(v) || v.app !== 'blackbook') return 'That file is not a Blackbook export.';
  const list = (key: string): unknown[] | string => {
    const x = v[key];
    if (x === undefined) return [];
    return Array.isArray(x) && x.length <= MAX_RESTORE_ROWS ? x : `The ${key} in that file are not readable.`;
  };
  const lists = { sessions: list('sessions'), attempts: list('attempts'), events: list('events'), flags: list('flags'), mistakeTags: list('mistakeTags') };
  for (const [k, x] of Object.entries(lists)) if (typeof x === 'string') return x;
  const check = <T>(key: string, items: unknown, parse: (x: unknown) => T | null): T[] | string => {
    const out: T[] = [];
    for (const x of items as unknown[]) {
      const r = parse(x);
      if (r === null) return `A ${key} record in that file is damaged, so nothing was restored.`;
      out.push(r);
    }
    return out;
  };
  const sessions = check('session', lists.sessions, parseSession);
  const attempts = check('attempt', lists.attempts, parseAttempt);
  const events = check('event', lists.events, parseEvent);
  const mistakeTags = check('mistake tag', lists.mistakeTags, parseTag);
  const flags = check('flag', lists.flags, (x) => (isObj(x) && isStr(x.questionId) && isNum(x.at) ? ({ questionId: x.questionId, at: x.at } as FlagRecord) : null));
  for (const r of [sessions, attempts, events, mistakeTags, flags]) if (typeof r === 'string') return r;
  return {
    sessions: sessions as SessionRecord[],
    attempts: attempts as StoredAttempt[],
    events: events as EventRecord[],
    flags: flags as FlagRecord[],
    mistakeTags: mistakeTags as MistakeTag[],
  };
}
