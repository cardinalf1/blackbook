import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startTimer } from '../services/exam/timer';
import type { ExamState } from '../types/exam';
import { useExamClock } from './useExamClock';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 15, 9);

function exam(durationMs: number): ExamState {
  return {
    module: { section: 'math', moduleNumber: 1, tier: 'routing' },
    timer: startTimer(durationMs, T0),
    pauses: [],
    phase: 'in_progress',
    submittedBy: null,
    timerHidden: false,
    fiveMinuteAlertShown: false,
    assemblyNotes: [],
  };
}

let shown = -1;
function Probe(props: { e: ExamState; onExpire: () => void; onFive: () => void }) {
  shown = useExamClock(props.e, { onExpire: props.onExpire, onFiveMinutes: props.onFive });
  return null;
}

describe('useExamClock', () => {
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    container = document.createElement('div');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows deadline time, fires the alert once and expiry once', async () => {
    const onExpire = vi.fn();
    const onFive = vi.fn();
    const root = createRoot(container);
    await act(async () => root.render(<Probe e={exam(6 * MIN)} onExpire={onExpire} onFive={onFive} />));
    expect(shown).toBe(6 * MIN);
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    expect(onFive).toHaveBeenCalledTimes(1);
    expect(shown).toBeLessThanOrEqual(5 * MIN);
    await act(async () => {
      vi.advanceTimersByTime(5 * MIN);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(MIN);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(onFive).toHaveBeenCalledTimes(1);
    expect(shown).toBe(0);
    root.unmount();
  });

  it('after a long gap with no redraws (hidden tab or sleep), the next redraw shows the true time', async () => {
    const onExpire = vi.fn();
    const root = createRoot(container);
    await act(async () => root.render(<Probe e={exam(35 * MIN)} onExpire={onExpire} onFive={() => undefined} />));
    // The wall clock jumps 20 minutes without the interval running (setSystemTime does not fire timers).
    vi.setSystemTime(T0 + 20 * MIN);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(shown).toBe(15 * MIN);
    // A jump past the deadline expires at the next redraw.
    vi.setSystemTime(T0 + 40 * MIN);
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    root.unmount();
  });
});
