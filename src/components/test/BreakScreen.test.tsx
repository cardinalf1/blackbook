import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BreakScreen } from './BreakScreen';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BreakScreen', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders heading, countdown, next title, and explanation statement', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <BreakScreen
          remainingMs={600000} // 10:00
          durationMs={600000}
          nextTitle="Section 2, Module 1: Math"
          onEnd={vi.fn()}
          busy={false}
        />,
      );
    });

    // Heading "Break"
    const heading = container.querySelector('h1');
    expect(heading?.textContent).toBe('Break');

    // Countdown timer in mm:ss format
    const timer = container.querySelector('[role="timer"]');
    expect(timer).not.toBeNull();
    expect(timer?.textContent).toBe('10:00');

    // Next title
    expect(container.textContent).toContain('Next: Section 2, Module 1: Math');

    // Statement that break ends by itself at zero and finished modules cannot be reopened
    expect(container.textContent).toContain(
      'The break ends by itself at zero. Finished modules cannot be reopened.',
    );

    // No back button exists
    const backBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /back/i.test(b.textContent ?? ''),
    );
    expect(backBtn).toBeUndefined();

    await act(async () => {
      root.unmount();
    });
  });

  it('renders countdown correctly for partial minutes', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <BreakScreen
          remainingMs={299000} // 4:59
          durationMs={600000}
          nextTitle="Module 2"
          onEnd={vi.fn()}
          busy={false}
        />,
      );
    });

    const timer = container.querySelector('[role="timer"]');
    expect(timer?.textContent).toBe('4:59');

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onEnd when "End break and continue" is clicked', async () => {
    const onEnd = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <BreakScreen
          remainingMs={300000}
          durationMs={600000}
          nextTitle="Section 2, Module 1: Math"
          onEnd={onEnd}
          busy={false}
        />,
      );
    });

    const endBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'End break and continue',
    );
    expect(endBtn).toBeDefined();
    expect(endBtn?.disabled).toBe(false);

    await act(async () => {
      endBtn?.click();
    });
    expect(onEnd).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('disables "End break and continue" button when busy is true', async () => {
    const onEnd = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <BreakScreen
          remainingMs={300000}
          durationMs={600000}
          nextTitle="Section 2, Module 1: Math"
          onEnd={onEnd}
          busy={true}
        />,
      );
    });

    const endBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'End break and continue',
    );
    expect(endBtn).toBeDefined();
    expect(endBtn?.disabled).toBe(true);

    await act(async () => {
      endBtn?.click();
    });
    expect(onEnd).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });
});
