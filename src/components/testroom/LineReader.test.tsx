import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LineReader } from './LineReader';

describe('LineReader', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('ArrowDown on the handle moves the window down 28px (check style top)', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<LineReader lines={3} onClose={vi.fn()} />);
    });

    const handle = container.querySelector('[aria-label="Move line reader"]') as HTMLElement;
    const windowEl = container.querySelector('[data-testid="line-reader-window"]') as HTMLElement;

    expect(handle).not.toBeNull();
    expect(windowEl).not.toBeNull();

    const initialTop = parseInt(windowEl.style.top, 10);
    expect(Number.isNaN(initialTop)).toBe(false);

    await act(async () => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    expect(windowEl.style.top).toBe(`${initialTop + 28}px`);

    // ArrowUp moves it back up 28px
    await act(async () => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });

    expect(windowEl.style.top).toBe(`${initialTop}px`);

    await act(async () => {
      root.unmount();
    });
  });

  it('Escape and the close button call onClose', async () => {
    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<LineReader lines={3} onClose={onClose} />);
    });

    // Escape calls onClose
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Close button calls onClose
    const closeBtn = container.querySelector('button[aria-label="Close line reader"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn.click();
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders darkening divs and sets window height based on lines', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<LineReader lines={4} onClose={vi.fn()} />);
    });

    const windowEl = container.querySelector('[data-testid="line-reader-window"]') as HTMLElement;
    const aboveEl = container.querySelector('[data-testid="line-reader-above"]') as HTMLElement;
    const belowEl = container.querySelector('[data-testid="line-reader-below"]') as HTMLElement;

    expect(windowEl).not.toBeNull();
    expect(aboveEl).not.toBeNull();
    expect(belowEl).not.toBeNull();

    // 4 lines * 28px = 112px
    expect(windowEl.style.height).toBe('112px');
    expect(aboveEl.className).toContain('bg-black/70');
    expect(belowEl.className).toContain('bg-black/70');

    await act(async () => {
      root.unmount();
    });
  });

  it('supports dragging with pointer events', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<LineReader lines={3} onClose={vi.fn()} />);
    });

    const handle = container.querySelector('[aria-label="Move line reader"]') as HTMLElement;
    const windowEl = container.querySelector('[data-testid="line-reader-window"]') as HTMLElement;
    const initialTop = parseInt(windowEl.style.top, 10);

    await act(async () => {
      handle.dispatchEvent(new PointerEvent('pointerdown', { clientY: 100, button: 0, bubbles: true }));
    });

    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientY: 150 }));
    });

    expect(windowEl.style.top).toBe(`${initialTop + 50}px`);

    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointerup'));
    });

    await act(async () => {
      root.unmount();
    });
  });
});
