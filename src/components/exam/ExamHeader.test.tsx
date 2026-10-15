import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExamHeader } from './ExamHeader';

describe('ExamHeader', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('shows "31:59" for 1919000 ms and title', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamHeader
          title="Section 1, Module 1: Reading and Writing"
          remainingMs={1919000}
          timerHidden={false}
          onToggleTimer={vi.fn()}
          paused={false}
          onPauseClick={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Section 1, Module 1: Reading and Writing');

    const timer = container.querySelector('[role="timer"]');
    expect(timer).not.toBeNull();
    expect(timer?.getAttribute('aria-live')).toBe('off');
    expect(timer?.textContent).toBe('31:59');
    expect(timer?.getAttribute('data-warning')).toBe('false');

    const toggleBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Hide',
    );
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn?.getAttribute('aria-pressed')).toBe('false');

    root.unmount();
  });

  it('hidden shows no digits and the button reads "Show"', async () => {
    const onToggleTimer = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamHeader
          title="Module 1"
          remainingMs={1919000}
          timerHidden={true}
          onToggleTimer={onToggleTimer}
          paused={false}
          onPauseClick={vi.fn()}
        />,
      );
    });

    const timer = container.querySelector('[role="timer"]');
    expect(timer).not.toBeNull();
    expect(timer?.textContent).not.toMatch(/\d+:\d+/);
    expect(timer?.textContent).toContain('Timer hidden');
    expect(timer?.getAttribute('data-warning')).toBe('false');

    const toggleBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Show',
    );
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      toggleBtn?.click();
    });
    expect(onToggleTimer).toHaveBeenCalledTimes(1);

    root.unmount();
  });

  it('paused shows "Paused" and disables Pause', async () => {
    const onPauseClick = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamHeader
          title="Module 1"
          remainingMs={1919000}
          timerHidden={false}
          onToggleTimer={vi.fn()}
          paused={true}
          onPauseClick={onPauseClick}
        />,
      );
    });

    const timer = container.querySelector('[role="timer"]');
    expect(timer).not.toBeNull();
    expect(timer?.textContent).toBe('Paused');

    const pauseBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Pause',
    );
    expect(pauseBtn).toBeDefined();
    expect(pauseBtn?.disabled).toBe(true);

    await act(async () => {
      pauseBtn?.click();
    });
    expect(onPauseClick).not.toHaveBeenCalled();

    root.unmount();
  });

  it('shows Reference button only when onOpenReference is given', async () => {
    const onOpenReference = vi.fn();
    const root = createRoot(container);

    // Case 1: onOpenReference is provided
    await act(async () => {
      root.render(
        <ExamHeader
          title="Math Module 1"
          remainingMs={1200000}
          timerHidden={false}
          onToggleTimer={vi.fn()}
          paused={false}
          onPauseClick={vi.fn()}
          onOpenReference={onOpenReference}
        />,
      );
    });

    let refBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Reference',
    );
    expect(refBtn).toBeDefined();

    await act(async () => {
      refBtn?.click();
    });
    expect(onOpenReference).toHaveBeenCalledTimes(1);

    // Case 2: onOpenReference omitted
    await act(async () => {
      root.render(
        <ExamHeader
          title="RW Module 1"
          remainingMs={1200000}
          timerHidden={false}
          onToggleTimer={vi.fn()}
          paused={false}
          onPauseClick={vi.fn()}
        />,
      );
    });

    refBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Reference',
    );
    expect(refBtn).toBeUndefined();

    root.unmount();
  });

  it('sets data-warning="true" when remainingMs <= 5 min and not hidden', async () => {
    const root = createRoot(container);

    // 5 minutes exactly = 300000 ms -> warning true
    await act(async () => {
      root.render(
        <ExamHeader
          title="Module 1"
          remainingMs={300000}
          timerHidden={false}
          onToggleTimer={vi.fn()}
          paused={false}
          onPauseClick={vi.fn()}
        />,
      );
    });

    let timer = container.querySelector('[role="timer"]');
    expect(timer?.getAttribute('data-warning')).toBe('true');
    expect(timer?.className).toContain('text-amber-400');

    // 4 minutes 59 seconds = 299000 ms -> warning true
    await act(async () => {
      root.render(
        <ExamHeader
          title="Module 1"
          remainingMs={299000}
          timerHidden={false}
          onToggleTimer={vi.fn()}
          paused={false}
          onPauseClick={vi.fn()}
        />,
      );
    });
    timer = container.querySelector('[role="timer"]');
    expect(timer?.getAttribute('data-warning')).toBe('true');

    // 5 minutes and 1 ms = 300001 ms -> warning false
    await act(async () => {
      root.render(
        <ExamHeader
          title="Module 1"
          remainingMs={300001}
          timerHidden={false}
          onToggleTimer={vi.fn()}
          paused={false}
          onPauseClick={vi.fn()}
        />,
      );
    });
    timer = container.querySelector('[role="timer"]');
    expect(timer?.getAttribute('data-warning')).toBe('false');

    // <= 5 min but timerHidden = true -> warning false
    await act(async () => {
      root.render(
        <ExamHeader
          title="Module 1"
          remainingMs={200000}
          timerHidden={true}
          onToggleTimer={vi.fn()}
          paused={false}
          onPauseClick={vi.fn()}
        />,
      );
    });
    timer = container.querySelector('[role="timer"]');
    expect(timer?.getAttribute('data-warning')).toBe('false');

    root.unmount();
  });
});
