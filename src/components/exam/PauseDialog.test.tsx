import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PauseDialog } from './PauseDialog';

describe('PauseDialog', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  describe('mode === "confirm"', () => {
    const reasons = [
      'Technical problem',
      'Interruption / bathroom',
      'Need to stop for today',
      'Other',
    ] as const;

    it('renders dialog elements and calls onConfirm with chosen reason on click', async () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      const onResume = vi.fn();

      const root = createRoot(container);
      await act(async () => {
        root.render(
          <PauseDialog
            mode="confirm"
            reasons={reasons}
            onConfirm={onConfirm}
            onCancel={onCancel}
            onResume={onResume}
            remainingMs={1500000}
          />,
        );
      });

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
      expect(container.textContent).toContain('Emergency pause');
      expect(container.textContent).toContain(
        'Pausing stops the clock and hides the questions. This result will be marked as paused and will not count as a clean timed run.',
      );
      expect(container.textContent).toContain('Why are you pausing?');

      const techReasonBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Technical problem',
      );
      expect(techReasonBtn).toBeDefined();

      await act(async () => {
        techReasonBtn?.click();
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith('Technical problem');

      root.unmount();
    });

    it('calls onCancel when "Keep working" is clicked', async () => {
      const onCancel = vi.fn();
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <PauseDialog
            mode="confirm"
            reasons={reasons}
            onConfirm={vi.fn()}
            onCancel={onCancel}
            onResume={vi.fn()}
            remainingMs={1500000}
          />,
        );
      });

      const keepWorkingBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Keep working',
      );
      expect(keepWorkingBtn).toBeDefined();
      expect(document.activeElement).toBe(keepWorkingBtn);

      await act(async () => {
        keepWorkingBtn?.click();
      });

      expect(onCancel).toHaveBeenCalledTimes(1);

      root.unmount();
    });

    it('calls onCancel on Escape key', async () => {
      const onCancel = vi.fn();
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <PauseDialog
            mode="confirm"
            reasons={reasons}
            onConfirm={vi.fn()}
            onCancel={onCancel}
            onResume={vi.fn()}
            remainingMs={1500000}
          />,
        );
      });

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(onCancel).toHaveBeenCalledTimes(1);

      root.unmount();
    });
  });

  describe('mode === "paused"', () => {
    it('shows stopped time, message and Resume button calling onResume', async () => {
      const onResume = vi.fn();
      const onCancel = vi.fn();
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <PauseDialog
            mode="paused"
            reasons={[]}
            onConfirm={vi.fn()}
            onCancel={onCancel}
            onResume={onResume}
            remainingMs={1919000} // 31:59
          />,
        );
      });

      expect(container.textContent).toContain('Paused');
      expect(container.textContent).toContain('Time left');
      expect(container.textContent).toContain('31:59');
      expect(container.textContent).toContain('This result is marked as paused.');

      const resumeBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Resume',
      );
      expect(resumeBtn).toBeDefined();
      expect(document.activeElement).toBe(resumeBtn);

      // Escape should have no effect in paused mode
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(onCancel).not.toHaveBeenCalled();
      expect(onResume).not.toHaveBeenCalled();

      // Click Resume
      await act(async () => {
        resumeBtn?.click();
      });
      expect(onResume).toHaveBeenCalledTimes(1);

      root.unmount();
    });
  });
});
