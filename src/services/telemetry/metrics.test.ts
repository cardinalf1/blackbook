import { describe, expect, it } from 'vitest';
import type { EventPayloads, EventRecord, EventType } from '../../types/session';
import { distribution, sessionMetrics, subtract } from './metrics';

// Synthetic event streams only. `at` is ms since the page loaded; wall time is 1e12 + at.

function stream(pageId: string, startWall = 1e12) {
  const events: EventRecord[] = [];
  let seq = 0;
  const add = <T extends EventType>(at: number, type: T, questionId: string | null, payload: EventPayloads[T]) => {
    events.push({ id: `${pageId}-${seq}`, sessionId: 's', mode: 'drill', questionId, type, ts: startWall + at, monoMs: at, pageId, seq: seq++, payload });
    return add;
  };
  return { events, add };
}

const grade = (_q: string, r: string) => r === 'B';

describe('sessionMetrics', () => {
  it('measures a plain visit: time, first interaction, answer', () => {
    const { events, add } = stream('p1');
    add(0, 'question_shown', 'q1', { index: 0, visit: 1 });
    add(4000, 'first_interaction', 'q1', { sinceShownMs: 4000, kind: 'select' });
    add(4000, 'choice_selected', 'q1', { choice: 'B' });
    add(9000, 'question_hidden', 'q1', { index: 0, visitActiveMs: 9000, reason: 'next' });
    const m = sessionMetrics('s', events, grade);
    const q = m.questions[0];
    expect(q).toMatchObject({ visits: 1, wallMs: 9000, activeMs: 9000, hiddenMs: 0, timeToFirstInteractionMs: 4000, finalResponse: 'B', changes: 0 });
  });

  it('rapid switching: every change, and both kinds of swap', () => {
    const { events, add } = stream('p1');
    add(0, 'question_shown', 'q1', { index: 0, visit: 1 });
    add(100, 'choice_selected', 'q1', { choice: 'A' });
    add(150, 'choice_changed', 'q1', { from: 'A', to: 'B' });
    add(200, 'choice_changed', 'q1', { from: 'B', to: 'C' });
    add(250, 'choice_changed', 'q1', { from: 'C', to: 'B' });
    add(300, 'choice_cleared', 'q1', { from: 'B' });
    add(350, 'choice_selected', 'q1', { choice: 'D' });
    add(400, 'question_hidden', 'q1', { index: 0, visitActiveMs: 400, reason: 'next' });
    const q = sessionMetrics('s', events, grade).questions[0];
    expect(q?.answerChain).toEqual(['A', 'B', 'C', 'B', '', 'D']);
    // A->B, B->C, C->B, B->cleared. The pick of D after a clear is not a change.
    expect(q?.changes).toBe(4);
    // Between answers: A->B (i->c), B->C (c->i), C->B (i->c), B->D across the clear (c->i).
    expect(q?.incorrectToCorrect).toBe(2);
    expect(q?.correctToIncorrect).toBe(2);
    expect(q?.finalResponse).toBe('D');
  });

  it('tab hidden mid-question: wall time keeps running, active time does not', () => {
    const { events, add } = stream('p1');
    add(0, 'question_shown', 'q1', { index: 0, visit: 1 });
    add(2000, 'tab_hidden', null, {});
    add(62000, 'tab_visible', null, {});
    add(65000, 'question_hidden', 'q1', { index: 0, visitActiveMs: 5000, reason: 'next' });
    const q = sessionMetrics('s', events).questions[0];
    expect(q).toMatchObject({ wallMs: 65000, hiddenMs: 60000, activeMs: 5000 });
  });

  it('counts idle time inside the visible part only', () => {
    const { events, add } = stream('p1');
    add(0, 'question_shown', 'q1', { index: 0, visit: 1 });
    add(31000, 'idle_start', null, { thresholdMs: 30000 }); // last input at 1000
    add(41000, 'idle_end', null, { idleMs: 40000 }); // idle 1000..41000
    add(50000, 'question_hidden', 'q1', { index: 0, visitActiveMs: 50000, reason: 'next' });
    const q = sessionMetrics('s', events).questions[0];
    expect(q?.idleMs).toBe(40000);
    expect(q?.activeMs).toBe(50000);
  });

  it('revisits add up, and first-interaction time comes from the first visit', () => {
    const { events, add } = stream('p1');
    add(0, 'question_shown', 'q1', { index: 0, visit: 1 });
    add(1000, 'question_hidden', 'q1', { index: 0, visitActiveMs: 1000, reason: 'next' });
    add(1000, 'question_shown', 'q2', { index: 1, visit: 1 });
    add(3000, 'question_hidden', 'q2', { index: 1, visitActiveMs: 2000, reason: 'back' });
    add(3000, 'question_shown', 'q1', { index: 0, visit: 2 });
    add(3500, 'choice_selected', 'q1', { choice: 'A' });
    add(4000, 'question_hidden', 'q1', { index: 0, visitActiveMs: 1000, reason: 'next' });
    const m = sessionMetrics('s', events);
    expect(m.questions.map((q) => q.questionId)).toEqual(['q1', 'q2']);
    expect(m.questions[0]).toMatchObject({ visits: 2, activeMs: 2000, timeToFirstInteractionMs: 3500 });
    expect(m.totals.activeMs).toBe(4000);
  });

  it('a reload closes the open visit at the last event of that page, and the resumed page adds on', () => {
    const a = stream('p1', 1e12);
    a.add(0, 'question_shown', 'q1', { index: 0, visit: 1 });
    a.add(5000, 'choice_selected', 'q1', { choice: 'A' });
    // The page dies with no question_hidden. Five minutes later a new page resumes.
    const b = stream('p2', 1e12 + 300_000);
    b.add(0, 'session_resumed', null, { index: 0 });
    b.add(10, 'question_shown', 'q1', { index: 0, visit: 1 });
    b.add(2010, 'choice_changed', 'q1', { from: 'A', to: 'B' });
    b.add(3010, 'question_hidden', 'q1', { index: 0, visitActiveMs: 8000, reason: 'next' });
    const m = sessionMetrics('s', [...b.events, ...a.events], grade);
    const q = m.questions[0];
    expect(m.totals.pageLoads).toBe(2);
    // 5000 on page 1 (to its last event) + 3000 on page 2. The 5 minutes away are not counted.
    expect(q).toMatchObject({ visits: 2, wallMs: 8000, activeMs: 8000, answerChain: ['A', 'B'], changes: 1, incorrectToCorrect: 1 });
  });

  it('tracks strikes, flags and confidence', () => {
    const { events, add } = stream('p1');
    add(0, 'question_shown', 'q1', { index: 0, visit: 1 });
    add(10, 'choice_struck', 'q1', { choice: 'A' });
    add(20, 'choice_struck', 'q1', { choice: 'C' });
    add(30, 'strike_removed', 'q1', { choice: 'A' });
    add(40, 'flag_set', 'q1', {});
    add(50, 'flag_removed', 'q1', {});
    add(60, 'choice_selected', 'q1', { choice: 'B' });
    add(70, 'confidence_rated', 'q1', { rating: 'unsure' });
    add(80, 'confidence_rated', 'q1', { rating: 'sure' });
    const q = sessionMetrics('s', events).questions[0];
    expect(q?.struck).toEqual(['C']);
    expect(q?.strikeActions).toBe(3);
    expect(q?.flagHistory.map((f) => f.flagged)).toEqual([true, false]);
    expect(q?.confidenceChain).toEqual(['unsure', 'sure']);
    expect(q?.timeToFirstInteractionMs).toBe(10);
    // The page ends at its last event: the open visit lasts 80 ms.
    expect(q?.wallMs).toBe(80);
  });

  it('ignores other sessions and handles an empty log', () => {
    const { events, add } = stream('p1');
    add(0, 'question_shown', 'q1', { index: 0, visit: 1 });
    const other = events.map((e) => ({ ...e, sessionId: 'other' }));
    const m = sessionMetrics('s', other);
    expect(m.questions).toEqual([]);
    expect(m.distributions.activeMs).toBeNull();
  });
});

describe('interval and distribution helpers', () => {
  it('subtracts intervals', () => {
    expect(subtract({ start: 0, end: 10 }, [{ start: 2, end: 4 }, { start: 8, end: 20 }])).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 8 },
    ]);
  });
  it('summarizes values', () => {
    expect(distribution([5, 1, 3])).toMatchObject({ count: 3, min: 1, median: 3, max: 5, mean: 3 });
  });
});
