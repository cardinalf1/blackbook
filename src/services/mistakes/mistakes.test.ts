import { describe, expect, it } from 'vitest';
import type { BrowseRow } from '../../types/browse';
import type { MistakeTag } from '../../types/mistakes';
import type { EventPayloads, SessionReport, StoredAttempt } from '../../types/session';
import { syntheticPool } from '../__fixtures__/pool';
import { MemoryAttemptStore } from '../storage/attemptsMemory';
import { buildMistakeItems, buildMistakeLog, latestTags, skillMedians, suggestReason, tagVersions } from './mistakes';
import { saveMistakeTag } from './tagging';

const tag = (id: string, q: string, reason: MistakeTag['reason'], at: number, session = 's1'): MistakeTag => ({ id, sessionId: session, questionId: q, reason, note: '', suggested: false, at });

const attempt = (q: string, timeMs: number): StoredAttempt => ({
  id: `s0:${q}`, sessionId: 's0', questionId: q, mode: 'drill', status: 'final', response: 'A', correct: true, timeMs, firstVisitMs: timeMs, changes: 0, confidence: null, at: 1,
});

function report(items: Partial<SessionReport['items'][number]>[]): SessionReport {
  return {
    sessionId: 's1', mode: 'drill', startedAt: 0, finishedAt: 1, score: { correct: 0, total: items.length }, totalActiveMs: 0, byDomain: [], bySkill: [],
    items: items.map((it, index) => ({
      index, questionId: `q${index}`, displayId: `d${index}`, section: 'rw', domain: 'D', skill: 'S', difficulty: 'M', response: 'A', correct: false, correctAnswer: 'B',
      activeMs: 30_000, firstVisitMs: 30_000, flagged: false, changes: 0, confidence: null, question: null, ...it,
    })),
  };
}

describe('tag history', () => {
  it('the latest tag wins and the history is kept', () => {
    const tags = [tag('a', 'q1', 'careless', 1), tag('b', 'q1', 'misread', 5), tag('c', 'q2', 'other', 3), tag('d', 'q1', 'guessed', 2)];
    expect(latestTags(tags).get('s1:q1')?.reason).toBe('misread');
    expect(tagVersions(tags).get('s1:q1')).toBe(3);
  });
});

describe('suggestions', () => {
  const base = { unanswered: false, confidence: null, timeMs: 10_000, skillMedianMs: 40_000, isExam: false } as const;
  it('wrong and much faster than your own median suggests careless', () => {
    expect(suggestReason(base)?.reason).toBe('careless');
    expect(suggestReason({ ...base, timeMs: 25_000 })).toBeNull();
    expect(suggestReason({ ...base, skillMedianMs: null })).toBeNull();
  });
  it('unanswered at the end of an exam module suggests ran out of time, but not in a drill', () => {
    expect(suggestReason({ ...base, unanswered: true, isExam: true })?.reason).toBe('ran_out_of_time');
    expect(suggestReason({ ...base, unanswered: true })).toBeNull();
  });
  it('a guess rating suggests guessed, ahead of timing', () => {
    expect(suggestReason({ ...base, confidence: 'guess' })?.reason).toBe('guessed');
  });
  it('medians need enough answers on the skill', () => {
    const few = [attempt('a', 1000), attempt('b', 2000)];
    expect(skillMedians(few, () => 'SK').size).toBe(0);
    const many = [1000, 2000, 3000, 4000, 5000].map((t, i) => attempt(`q${i}`, t));
    expect(skillMedians(many, () => 'SK').get('SK')).toBe(3000);
  });
});

describe('mistake items', () => {
  it('lists wrong and unanswered questions only, with suggestions for the untagged and the tag for the tagged', () => {
    const r = report([{ correct: true }, { activeMs: 5000 }, { response: null, activeMs: 0 }, { confidence: 'guess' }]);
    const items = buildMistakeItems(r, 'exam', [tag('t', 'q3', 'concept_gap', 9)], new Map([['S', 40_000]]), () => 'S');
    expect(items.map((i) => i.questionId)).toEqual(['q1', 'q2', 'q3']);
    expect(items[0]?.suggestion?.reason).toBe('careless');
    expect(items[1]).toMatchObject({ unanswered: true });
    expect(items[1]?.suggestion?.reason).toBe('ran_out_of_time');
    expect(items[2]?.tag?.reason).toBe('concept_gap');
    expect(items[2]?.suggestion).toBeNull();
  });
});

describe('mistake log', () => {
  it('has one row per tagged pair, newest first, leaving out questions that left the bank', () => {
    const rows = new Map(syntheticPool(1).map((x): [string, BrowseRow] => [x.id, x]));
    const ids = [...rows.keys()];
    const tags = [tag('a', ids[0] as string, 'careless', 1), tag('b', ids[0] as string, 'misread', 4), tag('c', ids[1] as string, 'other', 2), tag('d', 'gone', 'other', 9)];
    const log = buildMistakeLog(tags, rows);
    expect(log.map((l) => [l.tag.questionId, l.tag.reason, l.versions])).toEqual([[ids[0], 'misread', 2], [ids[1], 'other', 1]]);
  });
});

describe('saving a tag', () => {
  it('stores the note but logs only ids and the reason', async () => {
    const store = new MemoryAttemptStore();
    const logged: { type: string; payload: unknown }[] = [];
    const telemetry = { log: <T extends keyof EventPayloads>(type: T, _ctx: unknown, payload: EventPayloads[T]) => void logged.push({ type, payload }) };
    const first = await saveMistakeTag({ sessionId: 's1', questionId: 'q1', mode: 'drill', reason: 'careless', note: ' too fast ', suggested: true, previous: null }, { store, telemetry: telemetry as never });
    expect(first.note).toBe('too fast');
    await saveMistakeTag({ sessionId: 's1', questionId: 'q1', mode: 'drill', reason: 'misread', note: 'units', suggested: false, previous: first }, { store, telemetry: telemetry as never });
    // Only the note changed: stored, but no event.
    const third = await saveMistakeTag({ sessionId: 's1', questionId: 'q1', mode: 'drill', reason: 'misread', note: 'units again', suggested: false, previous: { ...first, reason: 'misread' } }, { store, telemetry: telemetry as never });
    expect(third.reason).toBe('misread');
    expect(logged).toEqual([
      { type: 'mistake_tag_set', payload: { reason: 'careless', suggested: true } },
      { type: 'mistake_tag_changed', payload: { from: 'careless', to: 'misread' } },
    ]);
    expect(JSON.stringify(logged)).not.toMatch(/too fast|units/);
    expect(await store.listTags()).toHaveLength(3);
  });
});
