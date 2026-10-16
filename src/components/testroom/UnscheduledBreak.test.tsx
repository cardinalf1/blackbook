import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnscheduledBreak } from './UnscheduledBreak';

describe('UnscheduledBreak', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
  });

  it('renders heading, warning line, countdown and resume button', async () => {
    const onResume = vi.fn();
    await act(async () => {
      root?.render(<UnscheduledBreak remainingMs={600000} onResume={onResume} />);
    });

    expect(container.textContent).toContain('Unscheduled break');
    expect(container.textContent).toContain('The clock keeps running.');
    expect(container.textContent).toContain('10:00');

    const resumeBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Resume testing',
    );
    expect(resumeBtn).toBeDefined();

    await act(async () => {
      resumeBtn?.click();
    });

    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
