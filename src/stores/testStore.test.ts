import { describe, expect, it } from 'vitest';
import { EXAM_MODULES } from '../config/examConfig';
import { BREAK_MS } from '../config/scoringConfig';
import { buildRows } from '../services/browse/filter';
import { MemoryAttemptStore } from '../services/storage/attemptsMemory';
import { MemoryQuestionStore } from '../services/storage/memory';
import { currentStep } from '../services/test/flow';
import type { EventLogger } from '../services/telemetry/logger';
import type { Difficulty, Question, Section } from '../types/sat';
import type { EventRecord } from '../types/session';
import { createDrillStore, type DrillStore } from './drillStore';
import { createTestStore, type TestStore } from './testStore';
import type { StoreApi } from 'zustand/vanilla';

// Synthetic questions only: every configured domain, two skills, three difficulties.
const BAND: Record<Difficulty, number> = { E: 2, M: 4, H: 6 };
function makeBank(perCell: number): Question[] {
  const out: Question[] = [];
  let n = 0;
  for (const section of ['rw', 'math'] as Section[]) {
    for (const d of EXAM_MODULES[section].domains) {
      for (const sk of ['a', 'b']) {
        for (const diff of ['E', 'M', 'H'] as Difficulty[]) {
          for (const fmt of section === 'math' ? (['mcq', 'spr'] as const) : (['mcq'] as const)) {
            for (let k = 0; k < perCell; k++) {
              const id = `${section}-${n++}`;
              out.push({
                id, source: 'digital', displayId: id, section, domainCode: d.code, domain: d.label, skillCode: `${d.code}.${sk}`, skill: `${d.label} ${sk}`,
                difficulty: diff, scoreBand: BAND[diff], active: true, stimulusHtml: null, stemHtml: `<p>Synthetic ${id}</p>`,
                answer: fmt === 'mcq' ? { kind: 'mcq', choices: ['a', 'b', 'c', 'd'], correct: 'A', keyOrigin: 'structured' } : { kind: 'spr', accepted: ['7'] },
                rationaleHtml: '<p>Because.</p>', updatedAt: 0,
              });
            }
          }
        }
      }
    }
  }
  return out;
}

const META = { fetchedAt: 'x', importedAt: 'y', count: 0, skippedCount: 0 };

async function world(perCell = 6) {
  const bank = new MemoryQuestionStore();
  const questions = makeBank(perCell);
  await bank.replaceAll(questions, { ...META, count: questions.length });
  const attempts = new MemoryAttemptStore();
  const clock = { t: Date.UTC(2026, 9, 15, 9) };
  const events: EventRecord[] = [];
  let seq = 0;
  const logger: Pick<EventLogger, 'log'> = {
    log: (type, ctx, payload) => {
      events.push({ id: `e${seq}`, sessionId: ctx.sessionId, mode: ctx.mode, questionId: ctx.questionId ?? null, type, ts: clock.t, monoMs: seq, pageId: 'p', seq: seq++, payload } as EventRecord);
    },
  };
  let idn = 0;
  /** One browser page: its own stores over the same disk. A new page after a reload has fresh memory. */
  const page = () => {
    const drill = createDrillStore({ attempts, bank, telemetry: logger, now: () => clock.t, newId: () => `s${idn++}` });
    const test = createTestStore({
      attempts,
      bank,
      runner: {
        startExam: (spec, ids, d, notes, testId) => drill.getState().startExam(spec, ids, d, notes, testId),
        resume: (id) => drill.getState().resume(id),
        openSessionId: () => drill.getState().session?.id ?? null,
        error: () => drill.getState().error,
      },
      loadRows: async () => buildRows(await bank.query({}), await attempts.questionStatus()),
      telemetry: logger,
      moduleDurationMs: (s) => EXAM_MODULES[s].durationMs,
      breakMs: () => BREAK_MS,
      now: () => clock.t,
      newId: () => `t${idn++}`,
      rng: (() => {
        let s = 7;
        return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
      })(),
    });
    return { drill, test };
  };
  return { attempts, bank, clock, events, page, questions };
}

type Drill = StoreApi<DrillStore>;
type Test = StoreApi<TestStore>;

/** Answers every question of the open module: right ones (A or 7) or wrong ones, then submits. */
async function playModule(drill: Drill, right: boolean, by: 'user' | 'timer' = 'user') {
  const s = drill.getState().session;
  if (!s) throw new Error('no module open');
  for (let i = 0; i < s.queueIds.length; i++) {
    const q = drill.getState().questions[s.queueIds[i] as string] as Question;
    drill.getState().shown();
    drill.getState().select(right ? (q.answer.kind === 'mcq' ? 'A' : '7') : q.answer.kind === 'mcq' ? 'B' : '9');
    if (i < s.queueIds.length - 1) await drill.getState().go('next', i + 1, 0);
  }
  await drill.getState().submitExam(by, 0);
  drill.getState().closeFinished();
}

const stepKey = (t: Test) => {
  const step = currentStep(t.getState().record?.test as NonNullable<ReturnType<Test['getState']>['record']>['test'] & object);
  return step === null ? 'over' : step.type === 'break' ? 'break' : step.key;
};

const difficultyMix = async (world_: Awaited<ReturnType<typeof world>>, ids: readonly string[]) => {
  const byId = new Map(world_.questions.map((q) => [q.id, q]));
  const c = { E: 0, M: 0, H: 0 };
  for (const id of ids) c[(byId.get(id) as Question).difficulty]++;
  return c;
};

describe('full test', () => {
  it('runs end to end and routes both directions; module 2 differs by route and shares nothing with module 1', async () => {
    const w = await world();
    const { drill, test } = w.page();
    expect(await test.getState().start('full', false)).toBe(true);
    expect(stepKey(test)).toBe('rw1');

    // Reading and Writing: all right -> harder. Math: all wrong -> easier.
    await test.getState().startModule();
    expect(drill.getState().session?.exam).toMatchObject({ testId: test.getState().record?.id, module: { section: 'rw', moduleNumber: 1, tier: 'routing' } });
    await playModule(drill, true);
    await test.getState().reconcile();
    expect(stepKey(test)).toBe('rw2');
    expect(test.getState().record?.test?.routing[0]).toMatchObject({ section: 'rw', route: 'harder' });

    await test.getState().startModule();
    await playModule(drill, true);
    await test.getState().reconcile();
    expect(stepKey(test)).toBe('break');
    expect(test.getState().record?.test?.break).toMatchObject({ deadlineAt: w.clock.t + BREAK_MS, endedAt: null });

    await test.getState().endBreak(true);
    expect(stepKey(test)).toBe('math1');
    expect(test.getState().record?.test?.break).toMatchObject({ endedEarly: true });

    await test.getState().startModule();
    await playModule(drill, false);
    await test.getState().reconcile();
    expect(test.getState().record?.test?.routing[1]).toMatchObject({ section: 'math', route: 'easier' });

    const slots = test.getState().record?.test?.slots ?? {};
    const rw2Mix = await difficultyMix(w, slots.rw2?.questionIds ?? []);
    const math2Mix = await difficultyMix(w, slots.math2?.questionIds ?? []);
    expect(rw2Mix.H).toBeGreaterThan(rw2Mix.E);
    expect(math2Mix.E).toBeGreaterThan(math2Mix.H);
    for (const [a, b] of [['rw1', 'rw2'], ['math1', 'math2']] as const) {
      const first = new Set(slots[a]?.questionIds);
      expect((slots[b]?.questionIds ?? []).some((id) => first.has(id))).toBe(false);
    }
    const all = Object.values(slots).flatMap((s) => s?.questionIds ?? []);
    expect(new Set(all).size).toBe(all.length);

    await test.getState().startModule();
    await playModule(drill, false);
    await test.getState().reconcile();
    const done = test.getState().record;
    expect(done?.status).toBe('finished');
    expect(done?.test?.estimate?.configVersion).toBeGreaterThan(0);
    expect(done?.test?.estimate?.sections.map((s) => [s.section, s.route])).toEqual([['rw', 'harder'], ['math', 'easier']]);
    expect(done?.test?.estimate?.total).not.toBeNull();

    const report = await test.getState().report();
    expect(report?.sections.map((s) => s.modules.length)).toEqual([2, 2]);
    expect(report?.sections[0]?.routing?.route).toBe('harder');
    expect(report?.estimate?.sections).toHaveLength(2);
    expect(report?.paused).toBe(false);
    // Module sessions never double as past drills: only the container is a test; sessions link by testId.
    const linked = (await w.attempts.listSessions({ mode: 'exam' })).filter((s) => s.exam?.testId === done?.id);
    expect(linked).toHaveLength(4);
    const types = w.events.map((e) => e.type);
    for (const t of ['test_started', 'test_module_started', 'test_routed', 'test_module_submitted', 'test_break_started', 'test_break_ended', 'test_finished'] as const) {
      expect(types).toContain(t);
    }
  });

  it('routes the other way too: Reading and Writing all wrong goes easier, Math all right goes harder', async () => {
    const w = await world();
    const { drill, test } = w.page();
    await test.getState().start('full', false);
    await test.getState().startModule();
    await playModule(drill, false);
    await test.getState().reconcile();
    expect(test.getState().record?.test?.routing[0]?.route).toBe('easier');
    expect(test.getState().record?.test?.slots.rw2?.tier).toBe('easier');
  });

  it('a reload right after a submit (before the test was updated) lands on module 2 with the route kept', async () => {
    const w = await world();
    const a = w.page();
    await a.test.getState().start('rw', false);
    const id = a.test.getState().record?.id as string;
    await a.test.getState().startModule();
    await playModule(a.drill, true);
    // The page dies here: reconcile never ran.
    const b = w.page();
    await b.test.getState().open(id);
    expect(stepKey(b.test)).toBe('rw2');
    expect(b.test.getState().record?.test?.routing).toHaveLength(1);
    expect(b.test.getState().record?.test?.slots.rw2?.tier).toBe('harder');
    // Opening again changes nothing (idempotent).
    await b.test.getState().open(id);
    expect(b.test.getState().record?.test?.routing).toHaveLength(1);
  });

  it('a reload mid-module resumes it with the same questions and the clock still running', async () => {
    const w = await world();
    const a = w.page();
    await a.test.getState().start('math', false);
    const id = a.test.getState().record?.id as string;
    await a.test.getState().startModule();
    const sid = a.drill.getState().session?.id;
    const deadline = a.drill.getState().session?.exam?.timer.deadlineAt;
    w.clock.t += 10 * 60_000;
    const b = w.page();
    await b.test.getState().open(id);
    expect(stepKey(b.test)).toBe('math1');
    await b.test.getState().startModule();
    expect(b.drill.getState().session?.id).toBe(sid);
    expect(b.drill.getState().session?.exam?.timer.deadlineAt).toBe(deadline);
  });

  it('closing the browser during the break resumes it with the right time left; it ends by itself at the deadline', async () => {
    const w = await world();
    const a = w.page();
    await a.test.getState().start('full', false);
    const id = a.test.getState().record?.id as string;
    for (let i = 0; i < 2; i++) {
      await a.test.getState().startModule();
      await playModule(a.drill, true);
      await a.test.getState().reconcile();
    }
    expect(stepKey(a.test)).toBe('break');
    const br = a.test.getState().record?.test?.break;
    w.clock.t += 4 * 60_000;
    const b = w.page();
    await b.test.getState().open(id);
    expect(stepKey(b.test)).toBe('break');
    expect(b.test.getState().record?.test?.break?.deadlineAt).toBe(br?.deadlineAt);
    expect((b.test.getState().record?.test?.break?.deadlineAt ?? 0) - w.clock.t).toBe(BREAK_MS - 4 * 60_000);
    // Past the deadline: the break is over when the page next looks.
    w.clock.t += BREAK_MS;
    const c = w.page();
    await c.test.getState().open(id);
    expect(stepKey(c.test)).toBe('math1');
    expect(c.test.getState().record?.test?.break).toMatchObject({ endedEarly: false, endedAt: br?.deadlineAt });
  });

  it('there is no way back: ending the break twice, or off the break step, does nothing', async () => {
    const w = await world();
    const { drill, test } = w.page();
    await test.getState().start('full', false);
    await test.getState().endBreak(true);
    expect(stepKey(test)).toBe('rw1');
    for (let i = 0; i < 2; i++) {
      await test.getState().startModule();
      await playModule(drill, true);
      await test.getState().reconcile();
    }
    await test.getState().endBreak(true);
    await test.getState().endBreak(false);
    expect(stepKey(test)).toBe('math1');
    expect(test.getState().record?.test?.break?.endedEarly).toBe(true);
  });

  it('Reading and Writing only and Math only runs: two modules, a section estimate, no total, no break', async () => {
    for (const kind of ['rw', 'math'] as const) {
      const w = await world();
      const { drill, test } = w.page();
      await test.getState().start(kind, false);
      for (let i = 0; i < 2; i++) {
        await test.getState().startModule();
        await playModule(drill, true);
        await test.getState().reconcile();
      }
      const t = test.getState().record;
      expect(t?.status).toBe('finished');
      expect(t?.test?.break).toBeNull();
      expect(t?.test?.estimate?.sections.map((s) => s.section)).toEqual([kind]);
      expect(t?.test?.estimate?.total).toBeNull();
    }
  });

  it('a pause in any module marks the whole test, permanently', async () => {
    const w = await world();
    const { drill, test } = w.page();
    await test.getState().start('rw', false);
    await test.getState().startModule();
    drill.getState().shown();
    drill.getState().pauseExam('bathroom', 0);
    w.clock.t += 60_000;
    drill.getState().resumeExam();
    await drill.getState().exit(0);
    await test.getState().open(test.getState().record?.id as string);
    expect(test.getState().record?.test?.paused).toBe(true);
    await test.getState().startModule();
    await playModule(drill, true);
    await test.getState().reconcile();
    await test.getState().startModule();
    await playModule(drill, true);
    await test.getState().reconcile();
    expect(test.getState().record?.test?.paused).toBe(true);
    expect((await test.getState().report())?.paused).toBe(true);
  });

  it('a thin pool refuses to start rather than repeating questions', async () => {
    const w = await world(1);
    const { test } = w.page();
    expect(await test.getState().start('full', false)).toBe(false);
    expect(test.getState().error).toMatch(/Not enough/);
    expect(await w.attempts.listSessions()).toHaveLength(0);
  });

  it('discard abandons the test and its open module, and never deletes', async () => {
    const w = await world();
    const { drill, test } = w.page();
    await test.getState().start('rw', false);
    const id = test.getState().record?.id as string;
    await test.getState().startModule();
    await drill.getState().exit(0);
    await test.getState().discard(id);
    const all = await w.attempts.listSessions();
    expect(all).toHaveLength(2);
    expect(all.every((s) => s.status === 'abandoned')).toBe(true);
  });
});
