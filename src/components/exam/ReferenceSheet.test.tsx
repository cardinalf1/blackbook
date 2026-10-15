import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReferenceSheet } from './ReferenceSheet';

describe('ReferenceSheet', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
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

  it('renders modal dialog with title, formula "c² = a² + b²", and formulas list', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root?.render(<ReferenceSheet onClose={onClose} />);
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(container.textContent).toContain('Reference');
    expect(container.textContent).toContain('c² = a² + b²');
    expect(container.textContent).toContain('Area of a circle: A = πr²; circumference: C = 2πr');
    expect(container.textContent).toContain('The sum of the measures in degrees of the angles of a triangle is 180.');
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root?.render(<ReferenceSheet onClose={onClose} />);
    });

    const closeBtn = container.querySelector(
      'button[aria-label="Close reference"]',
    ) as HTMLButtonElement | null;
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn?.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root?.render(<ReferenceSheet onClose={onClose} />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root?.render(<ReferenceSheet onClose={onClose} />);
    });

    const backdrop = container.firstElementChild as HTMLElement;
    expect(backdrop).not.toBeNull();

    await act(async () => {
      backdrop.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
