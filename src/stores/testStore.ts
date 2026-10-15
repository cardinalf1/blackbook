// Orchestrates a full test or section run: the container record, routing, the break, the final
// estimate. Module sessions are ordinary exam sessions run by the drill store; this store only
// links them (exam.testId), decides what comes next and persists every transition.
//
// Everything that moves the test forward is done by `reconcile`, which reads the container and
// its module sessions from storage and applies whatever is missing. It is idempotent, so closing
// the browser at any moment (mid-module, right after a submit, mid-break) and calling it again on
// reopen lands in the right place. Break and module clocks derive from absolute deadlines.

import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { EXAM_MODULES } from '../config/examConfig';
import { loadRows } from '../services/browse/rows';
import { assembleModule, type Rng } from '../services/exam/assemble';
import { isPaused } from '../services/exam/timer';
import { abandon, createSession } from '../services/session/record';
import { buildReport } from '../services/session/report';
import { attemptStore, questionStore } from '../services/storage';
import type { AttemptStore } from '../services/storage/attemptTypes';
import type { QuestionStore } from '../services/storage/types';
import { telemetry } from '../services/telemetry';
import type { EventLogger } from '../services/telemetry/logger';
import { drillStore } from './drillStore';
import { advance, applyRouting, attachSession, breakRemainingMs, currentSlot, currentStep, endBreak, isOver, markPaused, moduleKey, newSlot, newTest, specFor } from '../services/test/flow';
import { breakDurationMs, moduleDurationMs } from '../services/test/devOverrides';
import { sectionsFor } from '../services/test/preflight';
import { buildTestReport, computeEstimate, routingItems, type ModuleData } from '../services/test/report';
import { decideRoute } from '../services/test/routing';
import type { BrowseRow } from '../types/browse';
import type { DrillConfig } from '../types/drill';
import type { ExamModuleSpec } from '../types/exam';
import type { Question, Section } from '../types/sat';
import type { EventPayloads, EventType, SessionRecord } from '../types/session';
import type { ModuleKey, TestKind, TestModuleSlot, TestReport } from '../types/test';

/** What the test store needs from the drill store, which runs the module on screen. */
export interface ModuleRunner {
  startExam(spec: ExamModuleSpec, questionIds: readonly string[], durationMs: number, notes: readonly string[], testId?: string): Promise<void>;
  resume(sessionId: string): Promise<void>;
  /** The id of the module session now open, or null. */
  openSessionId(): string | null;
  /** Error text from the runner, if the last call failed. */
  error(): string | null;
}

export interface TestDeps {
  attempts: AttemptStore;
  bank: Pick<QuestionStore, 'get'>;
  runner: ModuleRunner;
  loadRows: () => Promise<BrowseRow[]>;
  telemetry?: Pick<EventLogger, 'log'>;
  /** Module time in ms. The real limit, or a dev-only shortened one. */
  moduleDurationMs: (section: Section) => number;
  /** Break length in ms. The real length, or a dev-only shortened one. */
  breakMs: () => number;
  now?: () => number;
  newId?: () => string;
  rng?: Rng;
}

export interface TestState {
  /** The container record of the test on screen, or null. */
  record: SessionRecord | null;
  busy: boolean;
  error: string | null;
}

export interface TestActions {
  /** Builds module 1 of each section, writes the container and positions on the first module. */
  start(kind: TestKind, includeSeen: boolean): Promise<boolean>;
  /** Opens an unfinished or finished test and brings it up to date. */
  open(testId: string): Promise<void>;
  /** Starts the clock of the module the test is waiting on. */
  startModule(): Promise<void>;
  /** The drill store finished a module: bring the test up to date (routing, break, finish). */
  reconcile(): Promise<void>;
  endBreak(early: boolean): Promise<void>;
  /** Marks the test and its open module abandoned. Never deletes. */
  discard(testId: string): Promise<void>;
  /** The finished test's report. Null while it is not finished. */
  report(): Promise<TestReport | null>;
  close(): void;
}

export type TestStore = TestState & TestActions;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createTestStore(deps: TestDeps): StoreApi<TestStore> {
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const rng = deps.rng ?? Math.random;

  const log = <T extends EventType>(c: SessionRecord, type: T, payload: EventPayloads[T]) =>
    deps.telemetry?.log(type, { sessionId: c.id, mode: 'exam', questionId: null }, payload);

  return createStore<TestStore>()((set, get) => {
    let working: Promise<void> = Promise.resolve();
    /** Runs `fn` after any earlier call, so two transitions never interleave. */
    const serial = <T>(fn: () => Promise<T>): Promise<T> => {
      const next = working.then(fn, fn);
      working = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    };

    const save = async (c: SessionRecord): Promise<SessionRecord> => {
      const next = { ...c, lastActivityAt: now() };
      await deps.attempts.saveSession(next);
      set({ record: next });
      return next;
    };

    const moduleSessions = async (c: SessionRecord): Promise<SessionRecord[]> => {
      const t = c.test;
      if (!t) return [];
      const found = await deps.attempts.listSessions({ mode: 'exam' });
      return found.filter((s) => s.exam?.testId === c.id);
    };

    const loadQuestions = async (ids: readonly string[]): Promise<Map<string, Question>> => {
      const qs = new Map<string, Question>();
      for (const q of await Promise.all(ids.map((id) => deps.bank.get(id)))) if (q) qs.set(q.id, q);
      return qs;
    };

    const moduleData = async (sessions: readonly SessionRecord[], keyOf: (s: SessionRecord) => ModuleKey | null): Promise<ModuleData[]> => {
      const out: ModuleData[] = [];
      for (const session of sessions) {
        const key = keyOf(session);
        if (!key) continue;
        const [qs, attempts] = await Promise.all([loadQuestions(session.queueIds), deps.attempts.listAttempts(session.id)]);
        out.push({ key, session, report: buildReport(session, qs, attempts) });
      }
      return out;
    };

    const keyOfSession = (c: SessionRecord) => (s: SessionRecord): ModuleKey | null => {
      const slots = Object.values(c.test?.slots ?? {}) as TestModuleSlot[];
      return slots.find((slot) => slot.sessionId === s.id)?.key ?? (s.exam ? moduleKey(s.exam.module.section, s.exam.module.moduleNumber) : null);
    };

    /** Rows for assembling module 2: unseen only unless the user allowed seen questions. */
    const rowsFor = async (includeSeen: boolean): Promise<BrowseRow[]> => {
      const rows = await deps.loadRows();
      return includeSeen ? rows : rows.filter((r) => r.status === 'unseen');
    };

    /** One reconcile pass. Returns the updated container. */
    const reconcileOnce = async (start: SessionRecord): Promise<SessionRecord> => {
      let c = start;
      if (!c.test || c.status !== 'in_progress') return c;
      let sessions = await moduleSessions(c);
      for (let guard = 0; guard < 12; guard++) {
        const t = c.test;
        if (!t) return c;
        // Any pause in any module marks the whole test.
        const anyPause = sessions.some((s) => (s.exam?.pauses.length ?? 0) > 0 || (s.exam && isPaused(s.exam.timer)));
        if (anyPause && !t.paused) c = await save({ ...c, test: markPaused(t, true) });

        const test = c.test as NonNullable<SessionRecord['test']>;
        if (isOver(test)) {
          const modules = await moduleData(sessions.filter((s) => s.status === 'finished'), keyOfSession(c));
          const estimate = computeEstimate(test.routing, modules);
          c = await save({ ...c, status: 'finished', finishedAt: now(), test: { ...test, estimate } });
          log(c, 'test_finished', { kind: test.kind, paused: test.paused });
          return c;
        }

        const step = currentStep(test);
        if (step?.type === 'break') {
          const br = test.break;
          if (br && br.endedAt === null && breakRemainingMs(br, now()) <= 0) {
            // The break ran out (also while the browser was closed): move on, recorded as not early.
            c = await save({ ...c, test: endBreak(test, br.deadlineAt, false) });
            log(c, 'test_break_ended', { early: false, usedMs: br.durationMs });
            continue;
          }
          return c;
        }
        if (step?.type !== 'module') return c;

        const slot = test.slots[step.key];
        if (!slot) return c;
        // A session started but not yet linked (the browser closed in between): link it now.
        if (slot.sessionId === null) {
          const orphan = sessions.find((s) => s.exam && moduleKey(s.exam.module.section, s.exam.module.moduleNumber) === slot.key);
          if (!orphan) return c;
          c = await save({ ...c, test: attachSession(test, slot.key, orphan.id) });
          continue;
        }
        const session = sessions.find((s) => s.id === slot.sessionId) ?? (await deps.attempts.getSession(slot.sessionId));
        if (!session) return c;
        if (!sessions.some((s) => s.id === session.id)) sessions = [...sessions, session];
        if (session.status !== 'finished') return c;

        // The module is submitted. After module 1: route and assemble module 2. Then move on.
        let nextTest = test;
        if (slot.moduleNumber === 1) {
          const [m1] = await moduleData([session], () => slot.key);
          const decision = decideRoute(slot.section, m1 ? routingItems(m1.report) : [], now());
          log(c, 'test_routed', { section: slot.section, route: decision.route, weightedFraction: decision.weightedFraction, threshold: decision.threshold, configVersion: decision.configVersion });
          const used = new Set(Object.values(test.slots).flatMap((s) => (s ? s.questionIds : [])));
          const spec = specFor(slot.section, 2, decision.route);
          const built = assembleModule(await rowsFor(test.includeSeen), spec, rng, undefined, used);
          nextTest = applyRouting(test, decision, newSlot(spec, built.questionIds, built.notes));
        }
        log(c, 'test_module_submitted', { key: slot.key, by: session.exam?.submittedBy ?? 'user' });
        const at = session.finishedAt ?? now();
        const moved = advance(nextTest, at, deps.breakMs());
        if (moved.break && !test.break) log(c, 'test_break_started', { durationMs: moved.break.durationMs });
        c = await save({ ...c, test: moved });
      }
      return c;
    };

    const fail = (e: unknown, what: string) => set({ error: `${what}: ${msg(e)}`, busy: false });

    return {
      record: null,
      busy: false,
      error: null,

      start(kind, includeSeen) {
        return serial(async () => {
          set({ busy: true, error: null });
          try {
            const rows = await rowsFor(includeSeen);
            const slots: TestModuleSlot[] = [];
            const notes: string[] = [];
            for (const section of sectionsFor(kind)) {
              const spec = specFor(section, 1, 'routing');
              const built = assembleModule(rows, spec, rng);
              if (built.questionIds.length < EXAM_MODULES[section].questions) {
                notes.push(`Not enough questions for ${section === 'rw' ? 'Reading and Writing' : 'Math'} Module 1.`);
              }
              slots.push(newSlot(spec, built.questionIds, built.notes));
            }
            if (notes.length > 0) {
              set({ busy: false, error: `${notes.join(' ')} Allow seen questions or download more.` });
              return false;
            }
            const first = sectionsFor(kind)[0] as Section;
            const config: DrillConfig = { section: first, domainCode: 'all', skillCodes: [], difficulties: [], count: 0, liveOnly: true };
            const base = createSession(newId(), 'exam', config, [], now(), 'exam');
            const c = await save({ ...base, test: newTest(kind, includeSeen, slots) });
            log(c, 'test_started', { kind, includeSeen });
            set({ busy: false });
            return true;
          } catch (e) {
            fail(e, 'Could not start the test');
            return false;
          }
        });
      },

      open(testId) {
        return serial(async () => {
          set({ busy: true, error: null });
          try {
            const c = await deps.attempts.getSession(testId);
            if (!c?.test) throw new Error('that test was not found');
            set({ record: c });
            const after = await reconcileOnce(c);
            set({ record: after, busy: false });
          } catch (e) {
            fail(e, 'Could not open the test');
          }
        });
      },

      startModule() {
        return serial(async () => {
          const c = get().record;
          const test = c?.test;
          if (!c || !test || c.status !== 'in_progress') return;
          const slot = currentSlot(test);
          if (!slot) return;
          set({ busy: true, error: null });
          try {
            if (slot.sessionId !== null) {
              await deps.runner.resume(slot.sessionId);
            } else {
              const spec = specFor(slot.section, slot.moduleNumber, slot.tier);
              await deps.runner.startExam(spec, slot.questionIds, deps.moduleDurationMs(slot.section), slot.notes, c.id);
              const id = deps.runner.openSessionId();
              if (id === null) throw new Error(deps.runner.error() ?? 'the module did not open');
              const linked = await save({ ...c, test: attachSession(test, slot.key, id) });
              log(linked, 'test_module_started', { key: slot.key, tier: slot.tier });
            }
            set({ busy: false });
          } catch (e) {
            fail(e, 'Could not start the module');
          }
        });
      },

      reconcile() {
        return serial(async () => {
          const c = get().record;
          if (!c) return;
          try {
            const after = await reconcileOnce(c);
            set({ record: after });
          } catch (e) {
            fail(e, 'Could not update the test');
          }
        });
      },

      endBreak(early) {
        return serial(async () => {
          const c = get().record;
          const t = c?.test;
          if (!c || !t || currentStep(t)?.type !== 'break' || !t.break) return;
          try {
            const at = now();
            const next = endBreak(t, at, early);
            if (next === t) return;
            const saved = await save({ ...c, test: next });
            log(saved, 'test_break_ended', { early, usedMs: Math.max(0, at - t.break.startedAt) });
            set({ record: await reconcileOnce(saved) });
          } catch (e) {
            fail(e, 'Could not end the break');
          }
        });
      },

      discard(testId) {
        return serial(async () => {
          try {
            const c = get().record?.id === testId ? get().record : await deps.attempts.getSession(testId);
            if (!c?.test || c.status !== 'in_progress') return;
            for (const s of await moduleSessions(c)) {
              if (s.status === 'in_progress') await deps.attempts.saveSession(abandon(s, now()));
            }
            await deps.attempts.saveSession(abandon(c, now()));
            log(c, 'test_abandoned', {});
            if (get().record?.id === testId) set({ record: null });
          } catch (e) {
            fail(e, 'Could not discard the test');
            throw e;
          }
        });
      },

      async report() {
        const c = get().record;
        if (!c?.test || c.status !== 'finished') return null;
        const sessions = (await moduleSessions(c)).filter((s) => s.status === 'finished');
        return buildTestReport(c, await moduleData(sessions, keyOfSession(c)));
      },

      close() {
        set({ record: null, error: null, busy: false });
      },
    };
  });
}

/** App-wide store wired to the local program, the drill store and the event logger. */
export const testStore = createTestStore({
  attempts: attemptStore,
  bank: questionStore,
  runner: {
    startExam: (spec, ids, durationMs, notes, testId) => drillStore.getState().startExam(spec, ids, durationMs, notes, testId),
    resume: (id) => drillStore.getState().resume(id),
    openSessionId: () => drillStore.getState().session?.id ?? null,
    error: () => drillStore.getState().error,
  },
  loadRows,
  telemetry,
  moduleDurationMs,
  breakMs: breakDurationMs,
});

export function useTest<T>(selector: (s: TestStore) => T): T {
  return useStore(testStore, selector);
}
