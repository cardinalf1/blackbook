import { describe, expect, it } from 'vitest';
import { toFacet } from '../services/drill/facets';
import { computeSkillStats, countableAttempts } from '../services/drill/stats';
import { buildReport, kindLabel } from '../services/session/report';
import { MemoryAttemptStore } from '../services/storage/attemptsMemory';
import { MemoryQuestionStore } from '../services/storage/memory';
import type { BankMeta } from '../services/storage/types';
import type { EventLogger } from '../services/telemetry/logger';
import type { DrillConfig } from '../types/drill';
import type { Question } from '../types/sat';
import type { EventRecord, EventType, SessionRecord, StoredAttempt } from '../types/session';
import { createDrillStore, TYPING_SETTLE_MS } from './drillStore';

// Synthetic questions only (AGENTS.md rule 1).
function mcq(i: number, skill: string): Question {
  return {
    id: `q${i}`, source: 'digital', displayId: `d${i}`, section: 'math', domainCode: 'D', domain: 'Domain',
    skillCode: skill, skill: `Skill ${skill}`, difficulty: 'M', scoreBand: 3, active: true,
    stimulusHtml: null, stemHtml: `<p>Synthetic ${i}</p>`,
    answer: { kind: 'mcq', choices: ['a', 'b', 'c', 'd'], correct: 'A', keyOrigin: 'structured' },
    rationaleHtml: '<p>Because.</p>', updatedAt: 0,
  };
}
function spr(i: number): Question {
  return { ...mcq(i, 'S2'), answer: { kind: 'spr', accepted: ['.5', '1/2'] } };
}

const META: BankMeta = { fetchedAt: 'x', importedAt: 'y', count: 0, skippedCount: 0 };
const config: DrillConfig = { section: 'math', domainCode: 'all', skillCodes: [], difficulties: [], count: 3, liveOnly: true };

/** A store whose writes can be switched off, like the local program being stopped. */
class FlakyStore extends MemoryAttemptStore {
  down = false;
  writes = 0;
  override async saveSession(s: SessionRecord, a: readonly StoredAttempt[] = []): Promise<void> {
    if (this.down) throw new Error("Blackbook's local program is not responding.");
    this.writes++;
    return super.saveSession(s, a);
  }
}

function recorder() {
  const events: { type: EventType; questionId: string | null; payload: unknown }[] = [];
  const log: Pick<EventLogger, 'log'> = { log: (type, ctx, payload) => events.push({ type, questionId: ctx.questionId ?? null, payload }) };
  return { events, log, types: () => events.map((e) => e.type) };
}

async function setup(questions: Question[] = [mcq(0, 'S1'), mcq(1, 'S1'), spr(2), mcq(3, 'S1')]) {
  const bank = new MemoryQuestionStore();
  await bank.replaceAll(questions, { ...META, count: questions.length });
  const attempts = new FlakyStore();
  const rec = recorder();
  const timers: (() => void)[] = [];
  let n = 0;
  let t = 1000;
  let m = 0;
  const mk = () =>
    createDrillStore({
      attempts,
      bank,
      telemetry: rec.log,
      now: () => (t += 10),
      mono: () => (m += 100),
      newId: () => `sess${++n}`,
      rng: () => 0.5,
      setTimer: (fn) => timers.push(fn),
      clearTimer: () => undefined,
    });
  const fireTimers = () => {
    for (const fn of timers.splice(0)) fn();
  };
  return { bank, attempts, mk, questions, facets: questions.map(toFacet), rec, fireTimers };
}

type Store = ReturnType<Awaited<ReturnType<typeof setup>>['mk']>;
const cur = (s: Store) => s.getState().session as SessionRecord;
const curId = (s: Store) => cur(s).queueIds[cur(s).index] as string;
const answerFor = (s: Store, right: boolean) => {
  const q = s.getState().questions[curId(s)] as Question;
  if (q.answer.kind === 'spr') return right ? '1/2' : '7';
  return right ? 'A' : 'B';
};
const settled = () => new Promise((r) => setTimeout(r, 0));

describe('drill store: deferred feedback', () => {
  it('runs a whole drill with nothing graded on screen, then grades at Finish', async () => {
    const { attempts, mk, facets, fireTimers } = await setup();
    const store = mk();
    await store.getState().start(config, facets);
    for (let i = 0; i < 3; i++) {
      store.getState().shown();
      store.getState().select(answerFor(store, i !== 1));
      fireTimers();
      // Nothing about correctness is in the state the screen reads.
      expect(cur(store).score).toBeNull();
      expect(JSON.stringify(cur(store))).not.toContain('correct');
      if (i < 2) expect(await store.getState().go('next', i + 1, 1000 * (i + 1))).toBe(true);
    }
    expect(await store.getState().finish(3000)).toBe(true);
    const done = cur(store);
    expect(done.status).toBe('finished');
    expect(done.score).toEqual({ correct: 2, total: 3 });

    const saved = await attempts.listAttempts(done.id);
    expect(saved).toHaveLength(3);
    expect(saved.every((a) => a.status === 'final')).toBe(true);
    expect(saved.filter((a) => a.correct)).toHaveLength(2);
    expect((await attempts.getSession(done.id))?.status).toBe('finished');
  });

  it('Back and Next keep answers changeable until Finish, counting changes and visits', async () => {
    const { attempts, mk, facets } = await setup();
    const store = mk();
    await store.getState().start(config, facets);
    const first = curId(store);
    store.getState().select('B');
    store.getState().select('C');
    await store.getState().go('next', 1, 4000);
    expect((await attempts.listAttempts()).find((a) => a.questionId === first)?.status).toBe('final');

    await store.getState().go('back', 0, 2000);
    expect(cur(store).progress[first]).toMatchObject({ response: 'C', changes: 1, visits: 2, activeMs: 4000, firstVisitMs: 4000 });
    store.getState().select('A');
    await settled();
    // Changing an answer makes the stored attempt a draft again until Next or Finish.
    expect((await attempts.listAttempts()).find((a) => a.questionId === first)).toMatchObject({ status: 'draft', response: 'A', changes: 2 });
    await store.getState().go('next', 1, 5500);
    expect(cur(store).progress[first]).toMatchObject({ activeMs: 5500, firstVisitMs: 4000 });
  });

  it('a typed answer counts once when typing settles, not once per keystroke', async () => {
    const { mk, facets, fireTimers, rec } = await setup([spr(2)]);
    const store = mk();
    await store.getState().start({ ...config, count: 1 }, facets);
    const id = curId(store);
    for (const v of ['1', '1/', '1/2']) store.getState().select(v);
    expect(cur(store).progress[id]).toMatchObject({ response: '1/2', changes: 0 });
    fireTimers();
    expect(rec.events.filter((e) => e.type === 'spr_changed').map((e) => e.payload)).toEqual([{ value: '1/2' }]);
    store.getState().select('1/');
    store.getState().select('1/3');
    fireTimers();
    expect(cur(store).progress[id]?.changes).toBe(1);
    store.getState().select('');
    fireTimers();
    expect(cur(store).progress[id]).toMatchObject({ response: null, changes: 2 });
    expect(rec.types().filter((t) => t === 'spr_cleared')).toHaveLength(1);
  });

  it('strikes: striking the chosen answer clears it, and a struck choice cannot be picked', async () => {
    const { mk, facets, rec } = await setup();
    const store = mk();
    await store.getState().start(config, facets);
    const id = curId(store);
    store.getState().select('B');
    store.getState().strike('B');
    expect(cur(store).progress[id]).toMatchObject({ response: null, struck: ['B'], changes: 1 });
    store.getState().select('B');
    expect(cur(store).progress[id]?.response).toBeNull();
    expect(rec.types()).toContain('choice_cleared');
  });

  it('records confidence only when asked, and resets it when the answer changes', async () => {
    const { mk, facets, attempts } = await setup();
    const store = mk();
    await store.getState().start({ ...config, askConfidence: true }, facets);
    const id = curId(store);
    store.getState().rate('sure');
    expect(cur(store).progress[id]?.confidence).toBeNull(); // nothing to rate yet
    store.getState().select('A');
    store.getState().rate('unsure');
    await settled();
    expect((await attempts.listAttempts()).find((a) => a.questionId === id)?.confidence).toBe('unsure');
    store.getState().select('C');
    expect(cur(store).progress[id]?.confidence).toBeNull();

    const plain = mk();
    await plain.getState().start(config, facets);
    plain.getState().select('A');
    plain.getState().rate('sure');
    expect(cur(plain).progress[curId(plain)]?.confidence).toBeNull();
  });
});

describe('drill store: sessions and resume', () => {
  it('resumes after a closed tab with position, answers, strikes, flags, confidence and time', async () => {
    const { attempts, bank, mk, facets, rec } = await setup();
    const first = mk();
    await first.getState().start({ ...config, askConfidence: true }, facets);
    const a = curId(first);
    first.getState().select('B');
    first.getState().rate('guess');
    first.getState().toggleFlag();
    await first.getState().go('next', 1, 3000);
    const b = curId(first);
    first.getState().strike('D');
    first.getState().saveElapsed(1700);
    await settled();

    const reopened = createDrillStore({ attempts, bank, telemetry: rec.log });
    await reopened.getState().init();
    const pending = reopened.getState().inProgress;
    expect(pending).toHaveLength(1);
    await reopened.getState().resume((pending[0] as SessionRecord).id);
    const s = cur(reopened);
    expect(s.index).toBe(1);
    expect(s.progress[a]).toMatchObject({ response: 'B', confidence: 'guess', flagged: true, activeMs: 3000 });
    expect(s.progress[b]).toMatchObject({ struck: ['D'], activeMs: 1700 });
    expect(rec.types()).toContain('session_resumed');
  });

  it('keeps several unfinished drills, and Discard marks one abandoned without deleting it', async () => {
    const { attempts, bank, mk, facets } = await setup();
    const one = mk();
    await one.getState().start(config, facets);
    one.getState().select('A');
    const two = mk();
    await two.getState().start(config, facets);
    await settled();

    const home = createDrillStore({ attempts, bank });
    await home.getState().init();
    expect(home.getState().inProgress.map((s) => s.id)).toEqual(['sess2', 'sess1']);
    await home.getState().discard('sess1');
    expect(home.getState().inProgress.map((s) => s.id)).toEqual(['sess2']);
    expect((await attempts.getSession('sess1'))?.status).toBe('abandoned');
    expect(await attempts.listAttempts('sess1')).toHaveLength(1);
  });

  it('drops unanswered questions that left the bank when resuming', async () => {
    const { attempts, bank, mk, facets, questions } = await setup();
    const a = mk();
    await a.getState().start(config, facets);
    const ids = cur(a).queueIds;
    await settled();
    await bank.replaceAll(questions.filter((q) => q.id !== ids[1]), META);
    const b = createDrillStore({ attempts, bank });
    await b.getState().init();
    await b.getState().resume('sess1');
    expect(cur(b).queueIds).toEqual([ids[0], ids[2]]);
  });

  it('only finished drills count toward My skills', async () => {
    const { attempts, mk, facets } = await setup();
    const open = mk();
    await open.getState().start(config, facets);
    open.getState().select('A');
    await open.getState().go('next', 1, 100);
    const done = mk();
    await done.getState().start({ ...config, count: 1 }, facets);
    done.getState().select('A');
    await done.getState().finish(100);
    const counted = countableAttempts(await attempts.listAttempts(), await attempts.listSessions(), 'drill');
    expect(counted.map((a) => a.sessionId)).toEqual(['sess2']);
    expect(computeSkillStats(counted, facets).rows.reduce((s, r) => s + r.attempts, 0)).toBe(1);
  });

  it('the report matches the stored attempts', async () => {
    const { attempts, mk, facets, questions } = await setup();
    const store = mk();
    await store.getState().start(config, facets);
    store.getState().select('A');
    store.getState().toggleFlag();
    await store.getState().go('next', 1, 1000);
    await store.getState().go('next', 2, 2000); // left unanswered
    store.getState().select(answerFor(store, false));
    await store.getState().finish(3000);
    const s = cur(store);
    const report = buildReport(s, new Map(questions.map((q) => [q.id, q])), await attempts.listAttempts(s.id));
    expect(report.score).toEqual(s.score);
    expect(report.items.map((i) => i.response === null)).toEqual([false, true, false]);
    expect(report.items[0]).toMatchObject({ flagged: true, correct: true, activeMs: 1000 });
    for (const a of await attempts.listAttempts(s.id)) {
      expect(report.items.find((i) => i.questionId === a.questionId)?.correct).toBe(a.correct);
    }
  });
});

describe('drill store: never losing an answer', () => {
  it('a failed save keeps the answer, blocks navigation and exit, and Retry saves it once', async () => {
    const { attempts, mk, facets } = await setup();
    const store = mk();
    await store.getState().start(config, facets);
    const id = curId(store);
    attempts.down = true;
    store.getState().select('B');
    await settled();
    expect(store.getState().saveError).toMatch(/not saved/);
    expect(cur(store).progress[id]?.response).toBe('B');
    expect(await store.getState().go('next', 1, 500)).toBe(false);
    expect(cur(store).index).toBe(0);
    expect(await store.getState().exit(500)).toBe(false);
    expect(store.getState().session).not.toBeNull();

    // A second change while still down is kept too; the newest wins.
    store.getState().select('C');
    await settled();
    attempts.down = false;
    await store.getState().retrySave();
    expect(store.getState().saveError).toBeNull();
    const saved = (await attempts.listAttempts()).filter((a) => a.questionId === id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ response: 'C', status: 'draft' });
    expect(await store.getState().go('next', 1, 600)).toBe(true);
  });

  it('a "flag for later" that fails is retried by Retry', async () => {
    const { attempts, mk, facets } = await setup();
    const store = mk();
    await store.getState().start(config, facets);
    const id = curId(store);
    const realSetFlag = attempts.setFlag.bind(attempts);
    attempts.setFlag = async () => {
      throw new Error('down');
    };
    store.getState().toggleFlag();
    await settled();
    expect(store.getState().error).toMatch(/flag for later/);
    attempts.setFlag = realSetFlag;
    await store.getState().retrySave();
    expect(store.getState().error).toBeNull();
    expect((await attempts.listFlags()).map((f) => f.questionId)).toEqual([id]);
  });

  it('a Finish that cannot be saved leaves the drill open, and Retry finishes it', async () => {
    const { attempts, mk, facets } = await setup();
    const store = mk();
    await store.getState().start({ ...config, count: 1 }, facets);
    store.getState().select('A');
    await settled();
    attempts.down = true;
    expect(await store.getState().finish(900)).toBe(false);
    expect(cur(store).status).toBe('in_progress');
    expect((await attempts.getSession('sess1'))?.status).toBe('in_progress');
    attempts.down = false;
    await store.getState().retrySave();
    expect(cur(store).status).toBe('finished');
    expect((await attempts.getSession('sess1'))?.score).toEqual({ correct: 1, total: 1 });
  });

  it('a finished session cannot be changed afterwards', async () => {
    const { attempts, mk, facets } = await setup();
    const store = mk();
    await store.getState().start({ ...config, count: 1 }, facets);
    store.getState().select('A');
    await store.getState().finish(100);
    const done = cur(store);
    await expect(attempts.saveSession({ ...done, status: 'in_progress' })).rejects.toThrow(/cannot be changed/);
    await expect(attempts.saveSession(done)).resolves.toBeUndefined(); // an identical resend is fine
  });
});

describe('drill store: telemetry', () => {
  it('logs the session, each showing, the first interaction and every action', async () => {
    const { mk, facets, rec } = await setup();
    const store = mk();
    await store.getState().start({ ...config, count: 2 }, facets);
    store.getState().shown();
    store.getState().shown(); // a second render of the same visit is not logged again
    store.getState().select('B');
    store.getState().select('A');
    store.getState().toggleFlag();
    await store.getState().go('next', 1, 1200);
    store.getState().shown();
    store.getState().strike('C');
    store.getState().finishClicked();
    await store.getState().finish(800);
    expect(rec.types()).toEqual([
      'session_started',
      'question_shown',
      'first_interaction',
      'choice_selected',
      'choice_changed',
      'flag_set',
      'nav_next',
      'question_hidden',
      'question_shown',
      'first_interaction',
      'choice_struck',
      'finish_clicked',
      'question_hidden',
      'session_finished',
    ]);
    expect(rec.events.find((e) => e.type === 'question_hidden')?.payload).toMatchObject({ visitActiveMs: 1200, reason: 'next' });
    expect(rec.events.find((e) => e.type === 'first_interaction')?.payload).toMatchObject({ sinceShownMs: 100, kind: 'select' });
  });
});

describe('drill store: Phase 2d', () => {
  /** A logger that writes straight into the store's event log, so status can read the showings. */
  function liveLog(store: MemoryAttemptStore): Pick<EventLogger, 'log'> {
    let seq = 0;
    return {
      log: (type, ctx, payload) => {
        void store.appendEvents([
          { id: `ev${seq}`, sessionId: ctx.sessionId, mode: ctx.mode, questionId: ctx.questionId ?? null, type, ts: seq, monoMs: seq, pageId: 'p', seq: seq++, payload },
        ] as EventRecord[]);
      },
    };
  }

  it('practices one question from Browse as a session of length 1, labelled Single question', async () => {
    const { attempts, mk, facets } = await setup();
    const store = mk();
    await store.getState().startSingle('q3');
    const s = cur(store);
    expect(s).toMatchObject({ source: 'browse', mode: 'drill', queueIds: ['q3'], config: { count: 1, skillCodes: ['S1'] } });
    store.getState().select('A');
    expect(cur(store).score).toBeNull();
    expect(await store.getState().finish(700)).toBe(true);
    expect(cur(store).score).toEqual({ correct: 1, total: 1 });
    const done = (await attempts.listSessions({ status: 'finished' }))[0] as SessionRecord;
    expect(kindLabel(done)).toBe('Single question');
    // It counts toward My skills like any finished drill.
    expect(countableAttempts(await attempts.listAttempts(), await attempts.listSessions(), 'drill')).toHaveLength(1);
    expect(computeSkillStats(countableAttempts(await attempts.listAttempts(), await attempts.listSessions(), 'drill'), facets).rows[0]?.attempts).toBe(1);
  });

  it('resumes the same drill twice in a row, and leaving and coming back keeps it listed', async () => {
    const { attempts, bank, mk, facets } = await setup();
    const a = mk();
    await a.getState().start({ ...config, askConfidence: true }, facets);
    a.getState().select('B');
    a.getState().rate('sure');
    await a.getState().go('next', 1, 1500);
    a.getState().strike('C');
    expect(await a.getState().exit(900)).toBe(true);

    for (let round = 0; round < 2; round++) {
      const b = createDrillStore({ attempts, bank });
      await b.getState().init();
      expect(b.getState().inProgress.map((s) => s.id)).toEqual(['sess1']);
      await b.getState().resume('sess1');
      const s = cur(b);
      expect(s.index).toBe(1);
      expect(s.progress[s.queueIds[0] as string]).toMatchObject({ response: 'B', confidence: 'sure', activeMs: 1500 });
      expect(s.progress[s.queueIds[1] as string]).toMatchObject({ struck: ['C'], activeMs: 900 });
      expect(await b.getState().exit(900)).toBe(true);
    }
    expect(await attempts.listSessions()).toHaveLength(1);
  });

  it('status: an unanswered question in a finished drill is Seen but not Done; one never shown stays Unseen', async () => {
    const { attempts, bank, facets } = await setup();
    const store = createDrillStore({ attempts, bank, telemetry: liveLog(attempts), rng: () => 0.5, newId: () => 's1' });
    await store.getState().start(config, facets);
    const [q1, q2, q3] = cur(store).queueIds as [string, string, string];
    store.getState().shown();
    store.getState().select('A');
    await store.getState().go('next', 1, 100);
    store.getState().shown(); // q2 on screen, left unanswered
    await store.getState().finish(100); // q3 never shown
    const status = new Map((await attempts.questionStatus()).map((s) => [s.questionId, s]));
    expect(status.get(q1)).toMatchObject({ seen: true, done: true, attempts: 1, lastResult: 'correct' });
    expect(status.get(q2)).toMatchObject({ seen: true, done: false, lastResult: null });
    expect(status.get(q3)).toBeUndefined();
  });

  it('status: a question answered only in an unfinished drill shows no result', async () => {
    const { attempts, bank, facets } = await setup();
    const store = createDrillStore({ attempts, bank, telemetry: liveLog(attempts), rng: () => 0.5, newId: () => 's1' });
    await store.getState().start(config, facets);
    const q1 = curId(store);
    store.getState().shown();
    store.getState().select('B');
    await store.getState().go('next', 1, 100); // final, but the drill is not finished
    expect((await attempts.questionStatus()).find((s) => s.questionId === q1)).toMatchObject({ done: true, attempts: 1, lastResult: null });
  });
});
