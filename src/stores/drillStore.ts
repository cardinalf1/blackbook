// Drill session state (Zustand). Feedback is deferred: the store holds the answers and grades
// them for storage, but nothing about correctness is exposed until the session is finished.
//
// Saving is strict. Every change is written to the local program through one serialized queue
// (newest state wins, nothing is reordered). A failed write keeps everything in memory, shows the
// error, and blocks navigation until a retry succeeds. Telemetry goes through the separate
// event logger and never blocks anything.

import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { RETRY_SESSION_MAX } from '../config/mistakeConfig';
import { isCorrect } from '../services/answers';
import { selectQuestionIds, type Rng } from '../services/drill/select';
import {
  abandon,
  addChange,
  answeredCount,
  attemptFor,
  createSession,
  currentQuestionId,
  enterIndex,
  leaveCurrent,
  finish,
  finishCheck,
  moveTo,
  progressOf,
  rate,
  recordActive,
  setAnnotations,
  setFlagged,
  setResponse,
  toggleStrike,
} from '../services/session/record';
import { isExpired, isPaused, pauseExam as pauseExamState, resumeExam as resumeExamState, startTimer } from '../services/exam/timer';
import { attemptStore, questionStore } from '../services/storage';
import type { AttemptStore } from '../services/storage/attemptTypes';
import type { QuestionStore } from '../services/storage/types';
import { telemetry } from '../services/telemetry';
import type { EventLogger } from '../services/telemetry/logger';
import type { DrillConfig, QuestionFacet } from '../types/drill';
import type { ExamModuleSpec, ExamState } from '../types/exam';
import type { ChoiceLetter, Question } from '../types/sat';
import type { Annotation, Confidence, EventPayloads, EventType, HideReason, InteractionKind, SessionRecord, StoredAttempt, ToolEventType } from '../types/session';

export interface DrillState {
  session: SessionRecord | null;
  /** Questions of the open session by id. Content is read from the bank, never copied to storage. */
  questions: Record<string, Question>;
  /** "Flag for later" across sessions. */
  flags: Record<string, true>;
  /** Unfinished drill sessions, newest first, found by init(). */
  inProgress: SessionRecord[];
  error: string | null;
  /** A write is queued or in flight. Navigation waits for it. */
  saving: boolean;
  /** Why the last write failed. Shown with Retry; navigation stays blocked while it is set. */
  saveError: string | null;
}

export interface DrillActions {
  /** Loads flags and the unfinished sessions. Call at startup and when returning home. */
  init(): Promise<void>;
  start(config: DrillConfig, facets: readonly QuestionFacet[]): Promise<void>;
  /**
   * Serves the given due questions in order as a drill session with source "retry": deferred feedback
   * and the usual report, but kept out of first-attempt statistics.
   */
  startRetry(questionIds: readonly string[], facets: readonly QuestionFacet[]): Promise<void>;
  /** Serves a weak-skill drill (AI-assisted or rule-based pick) in the given order, source "weak-skill". */
  startWeakSkill(questionIds: readonly string[], facets: readonly QuestionFacet[]): Promise<void>;
  /** Practice one question picked in Browse: a session of length 1 with source "browse". */
  startSingle(questionId: string): Promise<void>;
  resume(sessionId: string): Promise<void>;
  /** Marks an unfinished session abandoned. It is never deleted. */
  discard(sessionId: string): Promise<void>;
  /** The question at `index` is now on screen. Called by the screen when it renders it. */
  shown(): void;
  /** A choice letter, or the typed text ('' clears). */
  select(response: string): void;
  strike(letter: ChoiceLetter): void;
  toggleFlag(): void;
  rate(rating: Confidence): void;
  /** Total active time on the current question so far, so a reload keeps it. */
  saveElapsed(activeMs: number): void;
  /** Moves after saving. Resolves false (and stays) if saving failed. */
  go(kind: 'next' | 'back' | 'jump', index: number, activeMs: number): Promise<boolean>;
  finishClicked(): void;
  finishCancelled(): void;
  /** Finalizes every answer, grades, and closes the session. Resolves false if saving failed. */
  finish(activeMs: number): Promise<boolean>;
  retrySave(): Promise<void>;
  /** Leaves the session screen after saving. Resolves false while anything is unsaved. */
  exit(activeMs: number): Promise<boolean>;
  /** The page is closing: logs the hide and pushes the last state. */
  unloading(activeMs: number): void;
  /** Waits until every queued save is on disk. True when nothing is left unsaved. */
  whenSaved(): Promise<boolean>;
  /** Leaves a finished session's screen. */
  closeFinished(): void;

  // ---- exam modules (mode 'exam') ----
  /** Starts a timed module with already assembled questions. */
  startExam(spec: ExamModuleSpec, questionIds: readonly string[], durationMs: number, notes: readonly string[], testId?: string): Promise<void>;
  /** Leaves the current question for the review page. `activeMs` is its total active time. */
  openReview(activeMs: number): void;
  /** Back from the review page to a question (0-based). */
  closeReview(index: number): void;
  /** Submits the module. 'timer' skips the review page. Safe to call twice: the second call does nothing. */
  submitExam(by: 'user' | 'timer', activeMs: number): Promise<boolean>;
  pauseExam(reason: string, activeMs: number): void;
  resumeExam(): void;
  toggleTimer(): void;
  /** The five-minute alert was shown: it will not show again, and the timer is shown. */
  fiveMinuteAlertShown(): void;
  /** Exam screen events with no payload: reference sheet and navigator opened or closed. */
  note(type: 'reference_opened' | 'reference_closed' | 'navigator_opened' | 'navigator_closed'): void;
  /** A test-room tool event (Phase 9), logged against the question on screen. Ids, counts and times only. */
  toolEvent<T extends ToolEventType>(type: T, payload: EventPayloads[T], questionId?: string | null): void;
  /** Replaces the highlights and notes on the question on screen; saved with the session. */
  setAnnotations(annotations: readonly Annotation[]): void;
}

export type DrillStore = DrillState & DrillActions;

export interface DrillDeps {
  attempts: AttemptStore;
  bank: Pick<QuestionStore, 'get'>;
  telemetry?: Pick<EventLogger, 'log'>;
  now?: () => number;
  mono?: () => number;
  newId?: () => string;
  rng?: Rng;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/** Typing counts as one answer once it pauses this long (also when leaving the question). */
export const TYPING_SETTLE_MS = 800;

const EMPTY: DrillState = { session: null, questions: {}, flags: {}, inProgress: [], error: null, saving: false, saveError: null };

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function createDrillStore(deps: DrillDeps): StoreApi<DrillStore> {
  const now = deps.now ?? Date.now;
  const mono = deps.mono ?? (() => performance.now());
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  // ---- memory that is not part of the record ----
  /** Questions whose stored attempt is final (Next or Finish since the last change). */
  let finalized = new Set<string>();
  /** Active time at the start of the current visit, for question_hidden. */
  let visitBase = 0;
  let shownAt: number | null = null;
  let interacted = false;
  /** Last counted typed answer per question, and the pending settle timer. */
  const typedBase = new Map<string, string | null>();
  let typingTimer: unknown = null;
  let typingQuestion: string | null = null;
  /** A finish whose save failed, retried by retrySave. */
  let pendingFinish: { activeMs: number; by: 'user' | 'timer' } | null = null;
  /** True while a finish or submit is being saved, so a second one (timer and button together) does nothing. */
  let finishing = false;
  /** "Flag for later" writes that failed, retried by retrySave and by the next flag change. */
  const pendingFlags = new Map<string, boolean>();

  // ---- save queue ----
  let dirtyAttempts = new Map<string, StoredAttempt>();
  let dirtySession = false;
  let inFlight: Promise<void> | null = null;

  return createStore<DrillStore>()((set, get) => {
    const log = <T extends EventType>(type: T, questionId: string | null, payload: EventPayloads[T]) => {
      const s = get().session;
      if (s) deps.telemetry?.log(type, { sessionId: s.id, mode: s.mode, questionId }, payload);
    };

    const question = (id: string | null) => (id === null ? undefined : get().questions[id]);
    const grade = (id: string, response: string) => {
      const q = get().questions[id];
      return q !== undefined && isCorrect(q.answer, response);
    };
    const attempt = (s: SessionRecord, id: string, status: StoredAttempt['status']) =>
      attemptFor(s, id, progressOf(s, id).response !== null && grade(id, progressOf(s, id).response as string), status, now());

    const pump = () => {
      if (inFlight) return;
      inFlight = (async () => {
        while (dirtySession) {
          const session = get().session;
          if (!session) break;
          const batch = [...dirtyAttempts.values()];
          dirtyAttempts = new Map();
          dirtySession = false;
          try {
            await deps.attempts.saveSession(session, batch);
            set({ saveError: null });
          } catch (e) {
            for (const a of batch) if (!dirtyAttempts.has(a.id)) dirtyAttempts.set(a.id, a);
            dirtySession = true;
            set({ saveError: `Your answers are not saved yet: ${msg(e)}` });
            break;
          }
        }
        inFlight = null;
        set({ saving: dirtySession && get().saveError === null });
      })();
    };

    /** Applies a new record and queues its write (with any attempts that changed). */
    const commit = (session: SessionRecord, attempts: readonly StoredAttempt[] = []) => {
      for (const a of attempts) dirtyAttempts.set(a.id, a);
      dirtySession = true;
      set({ session, saving: true });
      pump();
    };

    /** Waits for the queue. True when everything is on disk. */
    const settle = async (): Promise<boolean> => {
      while (inFlight) await inFlight;
      return !dirtySession;
    };

    /** Answers and marks can change only while a question is on screen and the clock runs. */
    const answerable = (s: SessionRecord) => s.status === 'in_progress' && (!s.exam || (s.exam.phase === 'in_progress' && !isPaused(s.exam.timer)));

    const touch = (kind: InteractionKind) => {
      const s = get().session;
      const id = s ? currentQuestionId(s) : null;
      if (interacted || id === null) return;
      interacted = true;
      log('first_interaction', id, { sinceShownMs: shownAt === null ? 0 : Math.max(0, Math.round(mono() - shownAt)), kind });
    };

    /** Counts and logs a settled typed answer for the current question. */
    const settleTyping = () => {
      if (typingTimer !== null) clearTimer(typingTimer);
      typingTimer = null;
      const id = typingQuestion;
      typingQuestion = null;
      const s = get().session;
      if (!s || id === null) return;
      const cur = progressOf(s, id).response;
      const base = typedBase.has(id) ? (typedBase.get(id) as string | null) : null;
      if (cur === base) return;
      typedBase.set(id, cur);
      if (cur === null) log('spr_cleared', id, {});
      else log('spr_changed', id, { value: cur });
      if (base !== null) {
        const counted = addChange(s, id, now());
        commit(counted, [attempt(counted, id, finalized.has(id) ? 'final' : 'draft')]);
      }
    };

    /** Loads a session's questions. Unanswered questions missing from the bank are dropped. */
    const load = async (record: SessionRecord) => {
      const found = await Promise.all(record.queueIds.map((id) => deps.bank.get(id)));
      const questions: Record<string, Question> = {};
      const queueIds: string[] = [];
      let index = record.index;
      record.queueIds.forEach((id, i) => {
        const q = found[i];
        if (q) questions[id] = q;
        if (q || record.progress[id]?.response != null) queueIds.push(id);
        else if (i < record.index) index--;
      });
      const clamped = Math.min(Math.max(index, 0), Math.max(queueIds.length - 1, 0));
      const session = queueIds.length === record.queueIds.length ? record : { ...record, queueIds, index: clamped };
      return { session, questions };
    };

    const enter = (s: SessionRecord) => {
      const id = currentQuestionId(s);
      visitBase = id === null ? 0 : progressOf(s, id).activeMs;
      shownAt = null;
      interacted = false;
      if (id !== null && !typedBase.has(id)) typedBase.set(id, progressOf(s, id).response);
    };

    const leaveLog = (s: SessionRecord, reason: HideReason, activeMs: number) => {
      const id = currentQuestionId(s);
      if (id !== null) log('question_hidden', id, { index: s.index, visitActiveMs: Math.max(0, Math.round(activeMs - visitBase)), reason });
    };

    const resetMemory = () => {
      finalized = new Set();
      typedBase.clear();
      if (typingTimer !== null) clearTimer(typingTimer);
      typingTimer = null;
      typingQuestion = null;
      pendingFinish = null;
      dirtyAttempts = new Map();
      dirtySession = false;
    };

    const FLAG_ERROR = 'Could not save the flag for later: ';
    /** Sends every pending "flag for later" change; keeps the ones that fail. */
    const sendFlags = async () => {
      for (const [id, flagged] of [...pendingFlags]) {
        try {
          await deps.attempts.setFlag(id, flagged);
          if (pendingFlags.get(id) === flagged) pendingFlags.delete(id);
        } catch (e) {
          set({ error: `${FLAG_ERROR}${msg(e)}` });
          return;
        }
      }
      if (get().error?.startsWith(FLAG_ERROR)) set({ error: null });
    };

    /** Saves a new session and makes it the open one. Waits for any earlier writes first. */
    const begin = async (fresh: SessionRecord) => {
      if (!(await settle())) throw new Error('your last answers are not saved yet');
      const { session, questions } = await load(fresh);
      await deps.attempts.saveSession(session);
      resetMemory();
      set({ session, questions, error: null, saveError: null, saving: false });
      enter(session);
      log('session_started', null, { count: session.queueIds.length, askConfidence: session.askConfidence });
    };

    const finishNow = async (activeMs: number, by: 'user' | 'timer' = 'user'): Promise<boolean> => {
      if (finishing) return false;
      finishing = true;
      try {
        return await finishOnce(activeMs, by);
      } finally {
        finishing = false;
      }
    };

    const finishOnce = async (activeMs: number, by: 'user' | 'timer'): Promise<boolean> => {
      settleTyping();
      if (!(await settle())) {
        pendingFinish = { activeMs, by };
        return false;
      }
      const s = get().session;
      if (!s || s.status !== 'in_progress') return false;
      // From the review page the current question was already left: keep its stored time.
      const inReview = s.exam?.phase === 'review';
      const ms = inReview ? progressOf(s, currentQuestionId(s) ?? '').activeMs : activeMs;
      let done = finish(s, ms, grade, now());
      if (done.exam) done = { ...done, exam: { ...done.exam, phase: 'submitted', submittedBy: by } };
      const attempts = done.queueIds.filter((id) => progressOf(done, id).response !== null).map((id) => attempt(done, id, 'final'));
      try {
        await deps.attempts.saveSession(done, attempts);
      } catch (e) {
        pendingFinish = { activeMs, by };
        set({ saveError: `${s.mode === 'exam' ? 'Your module is not submitted yet' : 'Your drill is not finished yet'}: ${msg(e)}` });
        return false;
      }
      pendingFinish = null;
      if (!inReview) leaveLog(s, 'finish', ms);
      set({ session: done, saveError: null, saving: false });
      log('session_finished', null, { correct: done.score?.correct ?? 0, total: done.score?.total ?? 0, totalActiveMs: done.totalActiveMs });
      return true;
    };

    return {
      ...EMPTY,

      async init() {
        try {
          const [flags, inProgress] = await Promise.all([
            deps.attempts.listFlags(),
            deps.attempts.listSessions({ status: 'in_progress' }),
          ]);
          set({ flags: Object.fromEntries(flags.map((f) => [f.questionId, true as const])), inProgress, error: null });
        } catch (e) {
          set({ error: `Could not open your saved data: ${msg(e)}` });
        }
      },

      async start(config, facets) {
        try {
          const attempts = (await deps.attempts.listAttempts()).filter((a) => a.response !== '');
          const ids = selectQuestionIds(facets, config, attempts, deps.rng);
          if (ids.length === 0) {
            set({ error: 'No questions match that setup.' });
            return;
          }
          await begin(createSession(newId(), 'drill', { ...config, count: ids.length }, ids, now()));
        } catch (e) {
          set({ error: `Could not start the drill: ${msg(e)}` });
        }
      },

      async startRetry(questionIds, facets) {
        try {
          const known = new Map(facets.map((f) => [f.id, f]));
          const ids = [...new Set(questionIds)].filter((id) => known.has(id)).slice(0, RETRY_SESSION_MAX);
          const first = known.get(ids[0] ?? '');
          if (!first) {
            set({ error: 'None of the questions due for retry are in the bank any more.' });
            return;
          }
          const config: DrillConfig = { section: first.section, domainCode: 'all', skillCodes: [], difficulties: [], count: ids.length, liveOnly: false, questionIds: ids };
          await begin(createSession(newId(), 'drill', config, ids, now(), 'retry'));
        } catch (e) {
          set({ error: `Could not start the retry: ${msg(e)}` });
        }
      },

      async startWeakSkill(questionIds, facets) {
        try {
          const known = new Map(facets.map((f) => [f.id, f]));
          const ids = [...new Set(questionIds)].filter((id) => known.has(id));
          const first = known.get(ids[0] ?? '');
          if (!first) {
            set({ error: 'None of the picked questions are in the bank.' });
            return;
          }
          const config: DrillConfig = { section: first.section, domainCode: 'all', skillCodes: [], difficulties: [], count: ids.length, liveOnly: false, questionIds: ids };
          await begin(createSession(newId(), 'drill', config, ids, now(), 'weak-skill'));
        } catch (e) {
          set({ error: `Could not start the drill: ${msg(e)}` });
        }
      },

      async startSingle(questionId) {
        try {
          const q = await deps.bank.get(questionId);
          if (!q) {
            set({ error: 'That question is no longer in the bank.' });
            return;
          }
          const config: DrillConfig = {
            section: q.section,
            domainCode: q.domainCode,
            skillCodes: [q.skillCode],
            difficulties: [q.difficulty],
            count: 1,
            liveOnly: false,
          };
          await begin(createSession(newId(), 'drill', config, [q.id], now(), 'browse'));
        } catch (e) {
          set({ error: `Could not open the question: ${msg(e)}` });
        }
      },

      async resume(sessionId) {
        try {
          const record = get().inProgress.find((s) => s.id === sessionId) ?? (await deps.attempts.getSession(sessionId));
          if (!record || record.status !== 'in_progress') {
            set({ error: 'That drill is no longer unfinished.' });
            return;
          }
          const [{ session, questions }, attempts] = await Promise.all([load(record), deps.attempts.listAttempts(sessionId)]);
          resetMemory();
          finalized = new Set(attempts.filter((a) => a.status === 'final').map((a) => a.questionId));
          set({ session, questions, error: null, saveError: null, inProgress: get().inProgress.filter((s) => s.id !== sessionId) });
          enter(session);
          log('session_resumed', null, { index: session.index });
          if (session !== record) commit(session);
          // The deadline passed while the module was closed: submit it now, as the timer would have.
          if (session.exam && session.exam.phase !== 'submitted' && isExpired(session.exam.timer, now())) {
            await finishNow(progressOf(session, currentQuestionId(session) ?? '').activeMs, 'timer');
          }
        } catch (e) {
          set({ error: `Could not resume: ${msg(e)}` });
        }
      },

      async discard(sessionId) {
        try {
          const record = get().inProgress.find((s) => s.id === sessionId) ?? (await deps.attempts.getSession(sessionId));
          if (!record) return;
          const closed = abandon(record, now());
          await deps.attempts.saveSession(closed);
          deps.telemetry?.log('session_abandoned', { sessionId: closed.id, mode: closed.mode, questionId: null }, { answered: answeredCount(closed) });
          set({ inProgress: get().inProgress.filter((s) => s.id !== sessionId), error: null });
        } catch (e) {
          set({ error: `Could not discard that drill: ${msg(e)}` });
        }
      },

      shown() {
        const s = get().session;
        const id = s ? currentQuestionId(s) : null;
        // Once per visit: a second render of the same visit (React StrictMode) is not a new showing.
        if (!s || id === null || s.status !== 'in_progress' || shownAt !== null) return;
        shownAt = mono();
        interacted = false;
        log('question_shown', id, { index: s.index, visit: Math.max(1, progressOf(s, id).visits) });
      },

      select(response) {
        const s = get().session;
        const id = s ? currentQuestionId(s) : null;
        const q = question(id);
        if (!s || id === null || !q || !answerable(s)) return;
        const before = progressOf(s, id).response;
        const typed = q.answer.kind === 'spr';
        // A struck-out choice cannot be the answer.
        if (!typed && progressOf(s, id).struck.includes(response as ChoiceLetter)) return;
        const after = setResponse(s, id, response, now(), { countChange: !typed });
        if (after === s) return;
        finalized.delete(id);
        touch(typed ? 'type' : 'select');
        if (typed) {
          // Saved on every keystroke; counted and logged once typing settles.
          if (typingTimer !== null) clearTimer(typingTimer);
          typingQuestion = id;
          typingTimer = setTimer(settleTyping, TYPING_SETTLE_MS);
        } else {
          const to = progressOf(after, id).response as ChoiceLetter | null;
          if (to === null) log('choice_cleared', id, { from: before as ChoiceLetter });
          else if (before === null) log('choice_selected', id, { choice: to });
          else log('choice_changed', id, { from: before as ChoiceLetter, to });
        }
        commit(after, [attempt(after, id, 'draft')]);
      },

      strike(letter) {
        const s = get().session;
        const id = s ? currentQuestionId(s) : null;
        if (!s || id === null || !answerable(s)) return;
        const before = progressOf(s, id);
        const after = toggleStrike(s, id, letter, now());
        if (after === s) return;
        touch('strike');
        const struck = progressOf(after, id).struck.includes(letter);
        log(struck ? 'choice_struck' : 'strike_removed', id, { choice: letter });
        const cleared = before.response !== null && progressOf(after, id).response === null;
        if (cleared) {
          finalized.delete(id);
          log('choice_cleared', id, { from: before.response as ChoiceLetter });
        }
        commit(after, cleared ? [attempt(after, id, 'draft')] : []);
      },

      toggleFlag() {
        const s = get().session;
        const id = s ? currentQuestionId(s) : null;
        if (!s || id === null || !answerable(s)) return;
        const flagged = !progressOf(s, id).flagged;
        const after = setFlagged(s, id, flagged, now());
        if (after === s) return;
        touch('flag');
        log(flagged ? 'flag_set' : 'flag_removed', id, {});
        commit(after);
        const flags = { ...get().flags };
        if (flagged) flags[id] = true;
        else delete flags[id];
        set({ flags });
        pendingFlags.set(id, flagged);
        void sendFlags();
      },

      rate(rating) {
        const s = get().session;
        const id = s ? currentQuestionId(s) : null;
        if (!s || id === null) return;
        const after = rate(s, id, rating, now());
        if (after === s) return;
        touch('confidence');
        log('confidence_rated', id, { rating });
        commit(after, [attempt(after, id, finalized.has(id) ? 'final' : 'draft')]);
      },

      saveElapsed(activeMs) {
        const s = get().session;
        const id = s ? currentQuestionId(s) : null;
        if (!s || id === null) return;
        const after = recordActive(s, id, activeMs, now());
        if (after !== s) commit(after);
      },

      async go(kind, index, activeMs) {
        settleTyping();
        const s = get().session;
        if (!s || !answerable(s) || index < 0 || index >= s.queueIds.length) return false;
        if (kind === 'next') log('nav_next', currentQuestionId(s), { from: s.index });
        else if (kind === 'back') log('nav_back', currentQuestionId(s), { from: s.index });
        else log('nav_jump', currentQuestionId(s), { from: s.index, to: index });
        if (!(await settle())) return false;
        const cur = get().session as SessionRecord;
        const id = currentQuestionId(cur);
        const moved = moveTo(cur, index, activeMs, now());
        if (moved === cur) return true;
        const attempts: StoredAttempt[] = [];
        if (id !== null && kind === 'next' && progressOf(moved, id).response !== null) {
          finalized.add(id);
          attempts.push(attempt(moved, id, 'final'));
        }
        leaveLog(cur, kind, activeMs);
        commit(moved, attempts);
        enter(moved);
        return true;
      },

      finishClicked() {
        const s = get().session;
        if (!s) return;
        const c = finishCheck(s);
        log('finish_clicked', currentQuestionId(s), { unanswered: c.unanswered.length, flagged: c.flagged.length });
      },

      finishCancelled() {
        const s = get().session;
        if (s) log('finish_cancelled', currentQuestionId(s), {});
      },

      finish: (activeMs) => finishNow(activeMs, 'user'),

      async retrySave() {
        set({ saveError: null, saving: true });
        if (pendingFlags.size > 0) await sendFlags();
        if (dirtySession) pump();
        await settle();
        if (get().saveError === null && pendingFinish !== null) await finishNow(pendingFinish.activeMs, pendingFinish.by);
        set({ saving: false });
      },

      async exit(activeMs) {
        settleTyping();
        const s = get().session;
        if (!s) return true;
        if (s.status === 'in_progress') {
          const id = currentQuestionId(s);
          if (id !== null) {
            const after = recordActive(s, id, activeMs, now());
            if (after !== s) commit(after);
          }
        }
        if (!(await settle())) {
          set({ saveError: get().saveError ?? 'Your answers are not saved yet. Press Retry before leaving.' });
          return false;
        }
        if (s.status === 'in_progress') leaveLog(s, 'exit', activeMs);
        resetMemory();
        set({ session: null, questions: {}, saveError: null, saving: false });
        return true;
      },

      whenSaved() {
        return settle();
      },

      unloading(activeMs) {
        settleTyping();
        const s = get().session;
        if (!s || s.status !== 'in_progress') return;
        const id = currentQuestionId(s);
        if (id === null) return;
        leaveLog(s, 'unload', activeMs);
        const after = recordActive(s, id, activeMs, now());
        if (after !== s) commit(after);
      },

      closeFinished() {
        resetMemory();
        set({ session: null, questions: {}, saveError: null, saving: false });
      },

      async startExam(spec, questionIds, durationMs, notes, testId) {
        try {
          if (questionIds.length === 0) {
            set({ error: 'No live questions are available for this module.' });
            return;
          }
          const config: DrillConfig = { section: spec.section, domainCode: 'all', skillCodes: [], difficulties: [], count: questionIds.length, liveOnly: true };
          const at = now();
          const exam: ExamState = {
            module: spec,
            timer: startTimer(durationMs, at),
            pauses: [],
            phase: 'in_progress',
            submittedBy: null,
            timerHidden: false,
            fiveMinuteAlertShown: false,
            assemblyNotes: [...notes],
            ...(testId !== undefined ? { testId } : {}),
          };
          await begin({ ...createSession(newId(), 'exam', config, questionIds, at, 'exam'), exam });
        } catch (e) {
          set({ error: `Could not start the module: ${msg(e)}` });
        }
      },

      openReview(activeMs) {
        settleTyping();
        const s = get().session;
        if (!s?.exam || s.exam.phase !== 'in_progress' || s.status !== 'in_progress') return;
        leaveLog(s, 'review', activeMs);
        const left = leaveCurrent(s, activeMs, now());
        commit({ ...left, exam: { ...s.exam, phase: 'review' } });
      },

      closeReview(index) {
        const s = get().session;
        if (!s?.exam || s.exam.phase !== 'review' || s.status !== 'in_progress') return;
        log('nav_jump', currentQuestionId(s), { from: s.index, to: index });
        const back = enterIndex({ ...s, exam: { ...s.exam, phase: 'in_progress' } }, index, now());
        commit(back);
        enter(back);
      },

      submitExam(by, activeMs) {
        const s = get().session;
        if (!s?.exam || s.status !== 'in_progress') return Promise.resolve(false);
        return finishNow(activeMs, by);
      },

      pauseExam(reason, activeMs) {
        settleTyping();
        const s = get().session;
        if (!s?.exam || s.status !== 'in_progress' || isPaused(s.exam.timer)) return;
        const exam = pauseExamState(s.exam, reason, now());
        if (exam === s.exam) return;
        let after: SessionRecord = { ...s, exam };
        // The question is hidden while paused, so its active time stops too.
        if (s.exam.phase === 'in_progress') {
          leaveLog(s, 'pause', activeMs);
          const id = currentQuestionId(s);
          if (id !== null) after = recordActive(after, id, activeMs, now());
        }
        log('exam_paused', null, { reason });
        commit(after);
      },

      resumeExam() {
        const s = get().session;
        if (!s?.exam || s.status !== 'in_progress' || !isPaused(s.exam.timer)) return;
        const last = s.exam.pauses[s.exam.pauses.length - 1];
        const exam = resumeExamState(s.exam, now());
        const after = { ...s, exam };
        log('exam_resumed', null, { pausedMs: last ? Math.max(0, now() - last.at) : 0 });
        commit(after);
        enter(after);
      },

      toggleTimer() {
        const s = get().session;
        if (!s?.exam || s.status !== 'in_progress') return;
        const hidden = !s.exam.timerHidden;
        log(hidden ? 'timer_hidden' : 'timer_shown', null, {});
        commit({ ...s, exam: { ...s.exam, timerHidden: hidden } });
      },

      fiveMinuteAlertShown() {
        const s = get().session;
        if (!s?.exam || s.exam.fiveMinuteAlertShown) return;
        log('five_minute_alert_shown', null, {});
        commit({ ...s, exam: { ...s.exam, fiveMinuteAlertShown: true, timerHidden: false } });
      },

      note(type) {
        const s = get().session;
        if (s) log(type, currentQuestionId(s), {});
      },

      toolEvent(type, payload, questionId) {
        const s = get().session;
        if (s) log(type, questionId === undefined ? currentQuestionId(s) : questionId, payload);
      },

      setAnnotations(annotations) {
        const s = get().session;
        const id = s ? currentQuestionId(s) : null;
        if (!s || id === null || s.status !== 'in_progress') return;
        const after = setAnnotations(s, id, annotations, now());
        if (after !== s) commit(after);
      },
    };
  });
}

/** App-wide store wired to the local program and the event logger. */
export const drillStore = createDrillStore({ attempts: attemptStore, bank: questionStore, telemetry });

export function useDrill<T>(selector: (s: DrillStore) => T): T {
  return useStore(drillStore, selector);
}
