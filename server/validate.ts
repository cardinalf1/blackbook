// Input checks for the user-data routes. The server only accepts well-formed records, so a bad
// client can never write something the app cannot read back.

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
  if (!Array.isArray(e.assemblyNotes) || !e.assemblyNotes.every((n) => typeof n === 'string' && n.length < 500)) return false;
  return e.pauses.every((p) => isObj(p) && isNum(p.at) && typeof p.reason === 'string' && p.reason.length < 100 && (p.resumedAt === null || isNum(p.resumedAt)));
}

export function parseSession(v: unknown): SessionRecord | null {
  if (!isObj(v) || v.version !== SESSION_RECORD_VERSION || !isStr(v.id) || !isMode(v.mode)) return null;
  if (v.source !== 'drill' && v.source !== 'browse' && v.source !== 'exam') return null;
  if (v.status !== 'in_progress' && v.status !== 'finished' && v.status !== 'abandoned') return null;
  if (!isObj(v.config) || !Array.isArray(v.queueIds) || !v.queueIds.every(isStr) || v.queueIds.length > 500) return null;
  if (!isNum(v.index) || v.index < 0 || (v.queueIds.length > 0 && v.index >= v.queueIds.length)) return null;
  if (!isNum(v.startedAt) || !(v.finishedAt === null || isNum(v.finishedAt)) || !isNum(v.lastActivityAt)) return null;
  if (!isMs(v.totalActiveMs) || typeof v.askConfidence !== 'boolean') return null;
  if (!(v.score === null || (isObj(v.score) && isNum(v.score.correct) && isNum(v.score.total)))) return null;
  if (!isObj(v.progress)) return null;
  if (v.exam !== undefined && !isExam(v.exam)) return null;
  if ((v.mode === 'exam') !== (v.exam !== undefined)) return null;
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
