import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FigureFrame } from './FigureFrame';

describe('FigureFrame', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('zooms in from 100 -> 125 and calls onZoom(125), and Reset returns to 100', async () => {
    const onZoom = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FigureFrame
          html="<figure><svg viewBox='0 0 10 10'></svg></figure>"
          onZoom={onZoom}
        />,
      );
    });

    expect(container.textContent).toContain('100%');

    const zoomInBtn = container.querySelector('button[aria-label="Zoom in"]') as HTMLButtonElement;
    expect(zoomInBtn).not.toBeNull();

    await act(async () => {
      zoomInBtn.click();
    });

    expect(container.textContent).toContain('125%');
    expect(onZoom).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledWith(125);

    const resetBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Reset',
    );
    expect(resetBtn).toBeDefined();

    await act(async () => {
      resetBtn?.click();
    });

    expect(container.textContent).toContain('100%');
    expect(onZoom).toHaveBeenCalledTimes(2);
    expect(onZoom).toHaveBeenCalledWith(100);

    await act(async () => {
      root.unmount();
    });
  });

  it('disables zoom out at the minimum zoom level (50%)', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FigureFrame
          html="<figure><svg viewBox='0 0 10 10'></svg></figure>"
        />,
      );
    });

    const zoomOutBtn = container.querySelector('button[aria-label="Zoom out"]') as HTMLButtonElement;
    expect(zoomOutBtn).not.toBeNull();
    expect(zoomOutBtn.disabled).toBe(false);

    // 100 -> 75
    await act(async () => {
      zoomOutBtn.click();
    });
    expect(container.textContent).toContain('75%');
    expect(zoomOutBtn.disabled).toBe(false);

    // 75 -> 50 (minimum)
    await act(async () => {
      zoomOutBtn.click();
    });
    expect(container.textContent).toContain('50%');
    expect(zoomOutBtn.disabled).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it('opens full screen and Escape key closes it', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FigureFrame
          html="<figure><svg viewBox='0 0 10 10'></svg></figure>"
        />,
      );
    });

    expect(document.querySelector('div[role="dialog"]')).toBeNull();

    const fullScreenBtn = container.querySelector('button[aria-label="Full screen"]') as HTMLButtonElement;
    expect(fullScreenBtn).not.toBeNull();

    await act(async () => {
      fullScreenBtn.click();
    });

    const dialog = document.querySelector('div[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-label')).toBe('Figure, full screen');

    // Escape closes modal
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(document.querySelector('div[role="dialog"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('closes full screen when clicking close button in modal', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FigureFrame
          html="<figure><svg viewBox='0 0 10 10'></svg></figure>"
        />,
      );
    });

    const fullScreenBtn = container.querySelector('button[aria-label="Full screen"]') as HTMLButtonElement;
    await act(async () => {
      fullScreenBtn.click();
    });

    const closeBtn = document.querySelector('div[role="dialog"] button[aria-label="Close"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn.click();
    });

    expect(document.querySelector('div[role="dialog"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
