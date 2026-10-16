import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigatorItem } from '../../types/exam';
import { ReviewScreen } from './ReviewScreen';

describe('ReviewScreen', () => {
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

  const mockItems: NavigatorItem[] = [
    { number: 1, answered: true, flagged: false },
    { number: 2, answered: false, flagged: true },
    { number: 3, answered: false, flagged: false },
    { number: 4, answered: true, flagged: true },
  ];

  it('renders heading, info line, counts and question grid', async () => {
    const onJump = vi.fn();
    await act(async () => {
      root?.render(
        <ReviewScreen
          title="Section 1: Reading and Writing"
          items={mockItems}
          onJump={onJump}
          onSubmit={vi.fn()}
          busy={false}
        />,
      );
    });

    expect(container.textContent).toContain('Check your work');
    expect(container.textContent?.toLowerCase()).toContain('unanswered and marked');
    expect(container.textContent).toContain('Unanswered: 2');
    expect(container.textContent).toContain('For Review: 2');

    // Click jump
    const btn3 = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '3',
    );
    expect(btn3).toBeDefined();

    await act(async () => {
      btn3?.click();
    });

    expect(onJump).toHaveBeenCalledWith(2);
  });

  it('submit needs confirm before calling onSubmit', async () => {
    const onSubmit = vi.fn();
    await act(async () => {
      root?.render(
        <ReviewScreen
          title="Section 1: Reading and Writing"
          items={mockItems}
          onJump={vi.fn()}
          onSubmit={onSubmit}
          busy={false}
        />,
      );
    });

    const submitModuleBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Submit module',
    );
    expect(submitModuleBtn).toBeDefined();

    // Confirm dialog should not be rendered yet
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();

    // Click "Submit module"
    await act(async () => {
      submitModuleBtn?.click();
    });

    // Now confirm dialog is shown
    const dialog = container.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Submit this module? You can't return to it after you submit.");
    expect(onSubmit).not.toHaveBeenCalled();

    // Click Cancel
    const cancelBtn = Array.from(dialog!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancel',
    );
    expect(cancelBtn).toBeDefined();

    await act(async () => {
      cancelBtn?.click();
    });

    // Dialog closed, onSubmit not called
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();

    // Open confirm dialog again and confirm Submit
    await act(async () => {
      submitModuleBtn?.click();
    });

    const confirmSubmitBtn = Array.from(
      container.querySelector('[role="alertdialog"]')!.querySelectorAll('button'),
    ).find((b) => b.textContent?.trim() === 'Submit');
    expect(confirmSubmitBtn).toBeDefined();

    await act(async () => {
      confirmSubmitBtn?.click();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('busy disables Submit buttons', async () => {
    await act(async () => {
      root?.render(
        <ReviewScreen
          title="Section 1: Reading and Writing"
          items={mockItems}
          onJump={vi.fn()}
          onSubmit={vi.fn()}
          busy={true}
        />,
      );
    });

    const submitModuleBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Submit module',
    );
    expect(submitModuleBtn?.disabled).toBe(true);
  });
});
