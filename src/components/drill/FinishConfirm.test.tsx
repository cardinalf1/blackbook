import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinishConfirm } from './FinishConfirm';

describe('FinishConfirm', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('lists numbers and calls onGoTo on number click', async () => {
    const onGoTo = vi.fn();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FinishConfirm
          unanswered={[1, 3]}
          flagged={[2]}
          onGoTo={onGoTo}
          onConfirm={onConfirm}
          onCancel={onCancel}
          busy={false}
        />,
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(container.textContent).toContain('Finish this drill?');
    expect(container.textContent).toContain('Unanswered:');
    expect(container.textContent).toContain('Flagged for review:');

    // Find button with text '3'
    const button3 = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '3',
    );
    expect(button3).toBeDefined();

    await act(async () => {
      button3?.click();
    });

    expect(onGoTo).toHaveBeenCalledTimes(1);
    expect(onGoTo).toHaveBeenCalledWith(3);

    root.unmount();
  });

  it('shows "Every question is answered." when empty', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FinishConfirm
          unanswered={[]}
          flagged={[]}
          onGoTo={vi.fn()}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          busy={false}
        />,
      );
    });

    expect(container.textContent).toContain('Every question is answered.');
    expect(container.textContent).not.toContain('Unanswered:');
    expect(container.textContent).not.toContain('Flagged for review:');

    root.unmount();
  });

  it('calls onCancel on Escape key and on "Keep working" click', async () => {
    const onCancel = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FinishConfirm
          unanswered={[1]}
          flagged={[]}
          onGoTo={vi.fn()}
          onConfirm={vi.fn()}
          onCancel={onCancel}
          busy={false}
        />,
      );
    });

    // Verify initial focus on "Keep working"
    const keepWorkingBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Keep working'),
    );
    expect(keepWorkingBtn).toBeDefined();
    expect(document.activeElement).toBe(keepWorkingBtn);

    // Escape key
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Click "Keep working"
    await act(async () => {
      keepWorkingBtn?.click();
    });
    expect(onCancel).toHaveBeenCalledTimes(2);

    root.unmount();
  });

  it('calls onConfirm on Finish click', async () => {
    const onConfirm = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FinishConfirm
          unanswered={[]}
          flagged={[]}
          onGoTo={vi.fn()}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
          busy={false}
        />,
      );
    });

    const finishBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Finish',
    );
    expect(finishBtn).toBeDefined();

    await act(async () => {
      finishBtn?.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    root.unmount();
  });

  it('disables buttons while busy and does not cancel on Escape', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const onGoTo = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FinishConfirm
          unanswered={[2]}
          flagged={[4]}
          onGoTo={onGoTo}
          onConfirm={onConfirm}
          onCancel={onCancel}
          busy={true}
        />,
      );
    });

    const keepWorkingBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Keep working'),
    );
    expect(keepWorkingBtn?.disabled).toBe(true);

    const finishBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Finishing...'),
    );
    expect(finishBtn).toBeDefined();
    expect(finishBtn?.disabled).toBe(true);

    const numberBtns = Array.from(container.querySelectorAll('button')).filter((b) =>
      ['2', '4'].includes(b.textContent?.trim() ?? ''),
    );
    for (const btn of numberBtns) {
      expect(btn.disabled).toBe(true);
    }

    // Escape should not trigger onCancel while busy
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).not.toHaveBeenCalled();

    root.unmount();
  });
});
