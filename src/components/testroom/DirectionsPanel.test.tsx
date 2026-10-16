import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectionsPanel } from './DirectionsPanel';

describe('DirectionsPanel', () => {
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

  it('renders Reading and Writing directions in own words', async () => {
    await act(async () => {
      root?.render(<DirectionsPanel section="rw" onClose={vi.fn()} />);
    });

    expect(container.textContent).toContain('Reading and Writing');
    expect(container.textContent).toContain('two timed modules');
    expect(container.textContent).toContain('short passages');
    expect(container.textContent).toContain('one best answer');
    expect(container.textContent).toContain('mark questions for review');
  });

  it('renders Math directions with calculator and figures information', async () => {
    await act(async () => {
      root?.render(<DirectionsPanel section="math" onClose={vi.fn()} />);
    });

    expect(container.textContent).toContain('Math Directions');
    expect(container.textContent).toContain('calculator');
    expect(container.textContent).toContain('formula reference');
    expect(container.textContent).toContain('drawn to scale');
    expect(container.textContent).toContain('variables represent real numbers');
  });

  it('calls onClose when clicking close button', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root?.render(<DirectionsPanel section="rw" onClose={onClose} />);
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
});
