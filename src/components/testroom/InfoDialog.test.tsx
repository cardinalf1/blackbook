import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InfoDialog } from './InfoDialog';

describe('InfoDialog', () => {
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

  it('renders title and children with dialog role', async () => {
    await act(async () => {
      root?.render(
        <InfoDialog title="Keyboard Shortcuts" onClose={vi.fn()}>
          <p>Shortcut content</p>
        </InfoDialog>,
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(container.textContent).toContain('Keyboard Shortcuts');
    expect(container.textContent).toContain('Shortcut content');
  });

  it('calls onClose when Close button is clicked', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root?.render(
        <InfoDialog title="Help" onClose={onClose}>
          <p>Help text</p>
        </InfoDialog>,
      );
    });

    const closeBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Close',
    );
    expect(closeBtn).toBeDefined();

    await act(async () => {
      closeBtn?.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root?.render(
        <InfoDialog title="Help" onClose={onClose}>
          <p>Help text</p>
        </InfoDialog>,
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
