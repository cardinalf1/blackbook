import { describe, expect, it } from 'vitest';
import { toFacet } from '../services/drill/facets';
import { computeSkillStats } from '../services/drill/stats';
import { MemoryAttemptStore } from '../services/storage/attemptsMemory';
import { MemoryQuestionStore } from '../services/storage/memory';
import type { BankMeta } from '../services/storage/types';
import type { DrillConfig } from '../types/drill';
import type { Question } from '../types/sat';
import { createDrillStore } from './drillStore';

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

async function setup() {
  const bank = new MemoryQuestionStore();
  const questions = [mcq(0, 'S1'), mcq(1, 'S1'), spr(2), mcq(3, 'S1')];
  await bank.replaceAll(questions, { ...META, count: questions.length });
  const attempts = new MemoryAttemptStore();
  let n = 0;
  let t = 1000;
  const mk = () => createDrillStore({ attempts, bank, now: () => (t += 10), newId: () => `sess${++n}`, rng: () => 0.5 });
  return { bank, attempts, mk, questions, facets: questions.map(toFacet) };
}

describe('drill store', () => {
  it('runs a whole session: grades, stores attempts, finishes', async () => {
    const { attempts, mk, facets } = await setup();
    const store = mk();
    await store.getState().start(config, facets);
    const { session } = store.getState();
    expect(session?.queueIds).toHaveLength(3);

    for (let i = 0; i < 3; i++) {
      const s = store.getState().session;
      const q = store.getState().questions[s?.queueIds[s.index] as string] as Question;
      await store.getState().submit(q.answer.kind === 'spr' ? '1/2' : i === 0 ? 'B' : 'A', 2000);
      await store.getState().submit('A', 99999); // second submit is ignored
      await store.getState().next();
    }
    expect(store.getState().session?.status).toBe('finished');
    const stored = await attempts.attemptsForSession('sess1');
    expect(stored).toHaveLength(3);
    expect(stored.every((a) => a.timeMs === 2000)).toBe(true);
    expect(stored.filter((a) => a.correct)).toHaveLength(2);
    expect(await attempts.getActiveSession()).toBeNull();
  });

  it('resumes an unfinished session after a "closed tab", keeping answers, strikes and elapsed time', async () => {
    const { mk, facets } = await setup();
    const first = mk();
    await first.getState().start(config, facets);
    const ids = first.getState().session?.queueIds ?? [];
    await first.getState().submit('A', 1500);
    await first.getState().next();
    await first.getState().strike('C');
    await first.getState().saveElapsed(4200);

    const reopened = mk(); // new store, same storage
    await reopened.getState().init();
    expect(reopened.getState().session).toBeNull();
    expect(reopened.getState().resumable?.id).toBe('sess1');
    await reopened.getState().resume();
    const s = reopened.getState().session;
    expect(s?.queueIds).toEqual(ids);
    expect(s?.index).toBe(1);
    expect(s?.answered[ids[0] as string]?.timeMs).toBe(1500);
    expect(s?.struck[ids[1] as string]).toEqual(['C']);
    expect(s?.currentElapsedMs).toBe(4200);
    expect(Object.keys(reopened.getState().questions)).toHaveLength(3);
  });

  it('discarding a resumable session removes it', async () => {
    const { attempts, mk, facets } = await setup();
    const a = mk();
    await a.getState().start(config, facets);
    const b = mk();
    await b.getState().init();
    await b.getState().discardResumable();
    expect(b.getState().resumable).toBeNull();
    expect(await attempts.getActiveSession()).toBeNull();
  });

  it('starting a new drill replaces an abandoned one', async () => {
    const { attempts, mk, facets } = await setup();
    await mk().getState().start(config, facets);
    const b = mk();
    await b.getState().init();
    await b.getState().start(config, facets);
    expect((await attempts.getActiveSession())?.id).toBe('sess2');
  });

  it('persists flags across stores', async () => {
    const { mk } = await setup();
    const a = mk();
    await a.getState().toggleFlag('q1');
    await a.getState().toggleFlag('q2');
    await a.getState().toggleFlag('q2');
    const b = mk();
    await b.getState().init();
    expect(Object.keys(b.getState().flags)).toEqual(['q1']);
  });

  it('keeps attempts when the question bank is replaced', async () => {
    const { bank, attempts, mk, facets, questions } = await setup();
    const store = mk();
    await store.getState().start(config, facets);
    await store.getState().submit('A', 1000);
    const before = await attempts.listAttempts();
    expect(before).toHaveLength(1);

    await bank.replaceAll(questions.slice(0, 2), { ...META, count: 2 });
    expect(await attempts.listAttempts()).toEqual(before);
    const stats = computeSkillStats(await attempts.listAttempts(), (await bank.query({})).map(toFacet));
    expect(stats.rows.reduce((s, r) => s + r.attempts, 0) + stats.unattributed).toBe(1);
  });

  it('drops unanswered questions that vanished from the bank when resuming', async () => {
    const { bank, mk, facets, questions } = await setup();
    const a = mk();
    await a.getState().start(config, facets);
    const ids = a.getState().session?.queueIds ?? [];
    await bank.replaceAll(questions.filter((q) => q.id !== ids[2]), { ...META, count: 3 });
    const b = mk();
    await b.getState().init();
    await b.getState().resume();
    expect(b.getState().session?.queueIds).toEqual(ids.slice(0, 2));
  });

  it('refuses to start when nothing matches', async () => {
    const { mk, facets } = await setup();
    const store = mk();
    await store.getState().start({ ...config, skillCodes: ['none'] }, facets);
    expect(store.getState().session).toBeNull();
    expect(store.getState().error).not.toBeNull();
  });
});
