import { describe, expect, it } from 'vitest';
import { createTestRoomStore } from './testRoomStore';

function setup() {
  const events: { type: string; payload: unknown; q: string | null | undefined }[] = [];
  let t = 0;
  const store = createTestRoomStore({ emit: (type, payload, q) => events.push({ type, payload, q }), mono: () => t });
  return { store, events, tick: (ms: number) => (t += ms) };
}

describe('test-room tool store', () => {
  it('logs the calculator open, mode switch, per-question time and close', () => {
    const { store, events, tick } = setup();
    const a = store.getState();
    a.enterScope('m1');
    a.toggleCalculator('q1');
    tick(4000);
    a.leaveQuestion('q1');
    a.setCalculatorMode('scientific');
    tick(1000);
    a.toggleCalculator('q2');
    expect(events.map((e) => e.type)).toEqual(['calculator_opened', 'calculator_time', 'calculator_mode_switched', 'calculator_time', 'calculator_closed']);
    expect(events[1]).toMatchObject({ payload: { openMs: 4000 }, q: 'q1' });
    expect(events[3]).toMatchObject({ payload: { openMs: 1000 }, q: 'q2' });
  });

  it('does not log calculator time when it is closed', () => {
    const { store, events } = setup();
    store.getState().leaveQuestion('q1');
    expect(events).toEqual([]);
  });

  it('keeps calculator state inside a module and resets it in the next, keeping the zoom', () => {
    const { store } = setup();
    const a = store.getState();
    a.enterScope('m1');
    a.toggleCalculator('q1');
    a.saveCalculatorState('graphing', { x: 1 });
    a.setCalculatorRect({ x: 5, y: 6, width: 300, height: 400 });
    a.zoom(1);
    a.enterScope('m1');
    expect(store.getState().calculatorStates.graphing).toEqual({ x: 1 });
    a.enterScope('m2');
    const s = store.getState();
    expect(s.calculatorOpen).toBe(false);
    expect(s.calculatorStates).toEqual({});
    expect(s.calculatorRect.x).not.toBe(5);
    expect(s.zoomIndex).toBe(3);
  });

  it('clamps zoom and the split, and logs only real zoom changes', () => {
    const { store, events } = setup();
    const a = store.getState();
    for (let i = 0; i < 20; i++) a.zoom(1);
    expect(events.filter((e) => e.type === 'zoom_changed').at(-1)?.payload).toEqual({ percent: 200 });
    const n = events.length;
    a.zoom(1);
    expect(events.length).toBe(n);
    a.zoom(0);
    expect(events.at(-1)?.payload).toEqual({ percent: 100 });
    a.setSplit(0.99);
    expect(store.getState().splitFraction).toBe(0.8);
  });

  it('times an unscheduled break', () => {
    const { store, events, tick } = setup();
    store.getState().startBreak();
    tick(30_000);
    store.getState().endBreak();
    expect(events.map((e) => e.type)).toEqual(['unscheduled_break_started', 'unscheduled_break_ended']);
    expect(events[1]?.payload).toEqual({ breakMs: 30_000 });
  });

  it('logs toggles with their state', () => {
    const { store, events } = setup();
    const a = store.getState();
    a.toggleEliminator();
    a.toggleReference();
    a.toggleReferenceExpanded();
    a.toggleReference();
    a.toggleDirections();
    a.toggleMenu(true);
    a.toggleMenu(true);
    expect(events.map((e) => [e.type, e.payload])).toEqual([
      ['eliminator_toggled', { on: true }],
      ['reference_opened', {}],
      ['reference_expanded', { expanded: true }],
      ['reference_closed', {}],
      ['directions_opened', {}],
      ['navigator_opened', {}],
    ]);
  });
});
