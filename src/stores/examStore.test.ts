import { describe, expect, it } from 'vitest';
import { countableAttempts } from '../services/drill/stats';
import { remainingMs } from '../services/exam/timer';
import { MemoryAttemptStore } from '../services/storage/attemptsMemory';
import { MemoryQuestionStore } from '../services/storage/memory';
import type { BankMeta } from '../services/storage/types';
import type { EventLogger } from '../services/telemetry/logger';
import type { Question } from '../types/sat';
import type { EventRecord, SessionRecord, StoredAttempt } from '../types/session';
import { createDrillStore } from './drillStore';

// Synthetic questions only.
function mcq(i: number): Question {
  return {
    id: `q${i}`, source: 'digital', displayId: `d${i}`, section: 'math', domainCode: 'H', domain: 'Algebra',
    skillCode: 'H.A.', skill: 'Skill', difficulty: 'M', scoreBand: 3, active: true, stimulusHtml: null, stemHtml: `<p>Synthetic ${i}</p>`,
    answer: { kind: 'mcq', choices: ['a', 'b', 'c', 'd'], correct: 'A', keyOrigin: 'structured' }, rationaleHtml: '<p>Because.</p>', updatedAt: 0,
  };
}

const META: BankMeta = { fetchedAt: 'x', importedAt: 'y', count: 0, skippedCount: 0 };
const MIN = 60_000;
const SPEC = { section: 'math' as const, moduleNumber: 1 as const, tier: 'routing' as const };

class FlakyStore extends MemoryAttemptStore {
  down = false;
  finishedWrites = 0;
  override async saveSession(s: SessionRecord, a: readonly StoredAttempt[] = []): Promise<void> {
    if (this.down) throw new Error('local program not responding');
    if (s.status === 'finished') this.finishedWrites++;
    return super.saveSession(s, a);
  }
}

async function setup() {
  const bank = new MemoryQuestionStore();
  const questions = [0, 1, 2, 3].map(mcq);
  await bank.replaceAll(questions, { ...META, count: questions.length });
  const attempts = new FlakyStore();
  const clock = { t: Date.UTC(2026, 9, 15, 9) };
  let seq = 0;
  const log: Pick<EventLogger, 'log'> = {
    log: (type, ctx, payload) => {
      void attempts.appendEvents([
        { id: `e${seq}`, sessionId: ctx.sessionId, mode: ctx.mode, questionId: ctx.questionId ?? null, type, ts: clock.t, monoMs: seq, pageId: 'p', seq: seq++, payload },
      ] as EventRecord[]);
    },
  };
  const mk = () => createDrillStore({ attempts, bank, telemetry: log, now: () => clock.t, newId: () => 'x1' });
  return { attempts, bank, clock, mk };
}

type Store = ReturnType<Awaited<ReturnType<typeof setup>>['mk']>;
const cur = (s: Store) => s.getState().session as SessionRecord;

describe('exam module in the store', () => {
  it('starts a timed module, stores attempts as exam, and submits through review', async () => {
    const { attempts, mk, clock } = await setup();
    const store = mk();
    await store.getState().startExam(SPEC, ['q0', 'q1', 'q2'], 35 * MIN, []);
    const s = cur(store);
    expect(s).toMatchObject({ mode: 'exam', source: 'exam', askConfidence: false, exam: { phase: 'in_progress', timer: { deadlineAt: clock.t + 35 * MIN } } });
    store.getState().shown();
    store.getState().select('A');
    clock.t += 30_000;
    await store.getState().go('next', 1, 30_000);
    store.getState().shown();
    store.getState().select('B');
    store.getState().toggleFlag();
    store.getState().openReview(20_000);
    expect(cur(store).exam?.phase).toBe('review');
    // Nothing can change on the review page.
    store.getState().select('C');
    expect(cur(store).progress.q1?.response).toBe('B');
    expect(await store.getState().go('next', 2, 0)).toBe(false);
    store.getState().closeReview(0);
    expect(cur(store)).toMatchObject({ index: 0, exam: { phase: 'in_progress' } });
    expect(cur(store).progress.q0?.visits).toBe(2);
    store.getState().openReview(31_000);
    expect(await store.getState().submitExam('user', 0)).toBe(true);
    const done = cur(store);
    expect(done).toMatchObject({ status: 'finished', score: { correct: 1, total: 3 }, exam: { phase: 'submitted', submittedBy: 'user' } });
    expect(done.progress.q0?.activeMs).toBe(31_000);
    const saved = await attempts.listAttempts('x1');
    expect(saved.every((a) => a.mode === 'exam' && a.status === 'final')).toBe(true);
    // Exam and drill stats stay apart.
    const sessions = await attempts.listSessions();
    expect(countableAttempts(saved, sessions, 'drill')).toHaveLength(0);
    expect(countableAttempts(saved, sessions, 'exam')).toHaveLength(2);
  });

  it('submits once even when the timer and the button fire together', async () => {
    const { attempts, mk } = await setup();
    const store = mk();
    await store.getState().startExam(SPEC, ['q0', 'q1'], 35 * MIN, []);
    store.getState().select('A');
    const [a, b] = await Promise.all([store.getState().submitExam('timer', 1000), store.getState().submitExam('user', 1000)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(attempts.finishedWrites).toBe(1);
    expect(await store.getState().submitExam('user', 1000)).toBe(false);
    expect(cur(store).exam?.submittedBy).toBe('timer');
  });

  it('auto-submits on reopen when the deadline passed while the tab was closed', async () => {
    const { attempts, bank, mk, clock } = await setup();
    const first = mk();
    await first.getState().startExam(SPEC, ['q0', 'q1'], 35 * MIN, []);
    first.getState().select('A');
    await new Promise((r) => setTimeout(r, 0));
    clock.t += 50 * MIN; // closed for 50 minutes
    const reopened = createDrillStore({ attempts, bank, now: () => clock.t });
    await reopened.getState().init();
    expect(reopened.getState().inProgress.map((s) => s.id)).toEqual(['x1']);
    await reopened.getState().resume('x1');
    const s = reopened.getState().session as SessionRecord;
    expect(s).toMatchObject({ status: 'finished', exam: { phase: 'submitted', submittedBy: 'timer' }, score: { correct: 1, total: 2 } });
    expect((await attempts.getSession('x1'))?.status).toBe('finished');
  });

  it('resumes with the right time left after a reload', async () => {
    const { attempts, bank, mk, clock } = await setup();
    const first = mk();
    const t0 = clock.t;
    await first.getState().startExam(SPEC, ['q0', 'q1'], 35 * MIN, []);
    await new Promise((r) => setTimeout(r, 0));
    clock.t = t0 + 12 * MIN;
    const reopened = createDrillStore({ attempts, bank, now: () => clock.t });
    await reopened.getState().init();
    await reopened.getState().resume('x1');
    const s = reopened.getState().session as SessionRecord;
    expect(s.status).toBe('in_progress');
    expect(remainingMs((s.exam as NonNullable<SessionRecord['exam']>).timer, clock.t)).toBe(23 * MIN);
  });

  it('pause stops the clock and answering, is logged, and marks the result for good', async () => {
    const { attempts, mk, clock } = await setup();
    const store = mk();
    await store.getState().startExam(SPEC, ['q0', 'q1'], 35 * MIN, []);
    store.getState().shown();
    clock.t += 5 * MIN;
    store.getState().pauseExam('Technical problem', 4000);
    expect(cur(store).progress.q0?.activeMs).toBe(4000);
    store.getState().select('A');
    expect(cur(store).progress.q0?.response).toBeNull();
    clock.t += 60 * MIN;
    expect(remainingMs((cur(store).exam as NonNullable<SessionRecord['exam']>).timer, clock.t)).toBe(30 * MIN);
    store.getState().resumeExam();
    store.getState().select('A');
    expect(cur(store).progress.q0?.response).toBe('A');
    await store.getState().submitExam('user', 5000);
    const done = (await attempts.getSession('x1')) as SessionRecord;
    expect(done.exam?.pauses).toEqual([{ at: Date.UTC(2026, 9, 15, 9) + 5 * MIN, reason: 'Technical problem', resumedAt: Date.UTC(2026, 9, 15, 9) + 65 * MIN }]);
    const types = (await attempts.listEvents('x1')).map((e) => e.type);
    expect(types).toContain('exam_paused');
    expect(types).toContain('exam_resumed');
    expect((await attempts.listEvents('x1')).every((e) => e.mode === 'exam')).toBe(true);
  });

  it('timer hide, show and the five-minute alert are saved and logged', async () => {
    const { attempts, mk } = await setup();
    const store = mk();
    await store.getState().startExam(SPEC, ['q0'], 35 * MIN, []);
    store.getState().toggleTimer();
    expect(cur(store).exam?.timerHidden).toBe(true);
    store.getState().fiveMinuteAlertShown();
    expect(cur(store).exam).toMatchObject({ timerHidden: false, fiveMinuteAlertShown: true });
    store.getState().fiveMinuteAlertShown();
    store.getState().note('reference_opened');
    const types = (await attempts.listEvents('x1')).map((e) => e.type);
    expect(types.filter((t) => t === 'five_minute_alert_shown')).toHaveLength(1);
    expect(types).toEqual(expect.arrayContaining(['timer_hidden', 'five_minute_alert_shown', 'reference_opened']));
  });

  it('seen status: a question never navigated to stays unseen; an unfinished exam shows no results', async () => {
    const { attempts, mk } = await setup();
    const store = mk();
    await store.getState().startExam(SPEC, ['q0', 'q1', 'q2'], 35 * MIN, []);
    store.getState().shown();
    store.getState().select('A');
    await store.getState().go('next', 1, 100);
    let status = new Map((await attempts.questionStatus()).map((s) => [s.questionId, s]));
    expect(status.get('q0')).toMatchObject({ done: true, lastResult: null });
    // Time runs out on question 2 before question 3 was ever shown.
    store.getState().shown();
    await store.getState().submitExam('timer', 100);
    status = new Map((await attempts.questionStatus()).map((s) => [s.questionId, s]));
    expect(status.get('q0')).toMatchObject({ seen: true, done: true, lastResult: 'correct' });
    expect(status.get('q1')).toMatchObject({ seen: true, done: false });
    expect(status.get('q2')).toBeUndefined();
  });

  it('a failed save blocks submitting, and Retry submits', async () => {
    const { attempts, mk } = await setup();
    const store = mk();
    await store.getState().startExam(SPEC, ['q0'], 35 * MIN, []);
    store.getState().select('A');
    await new Promise((r) => setTimeout(r, 0));
    attempts.down = true;
    expect(await store.getState().submitExam('timer', 100)).toBe(false);
    expect(store.getState().saveError).toMatch(/not submitted yet/);
    attempts.down = false;
    await store.getState().retrySave();
    expect(cur(store)).toMatchObject({ status: 'finished', exam: { submittedBy: 'timer' } });
  });
});
