import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SplitPanes } from './SplitPanes';

describe('SplitPanes', () => {
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

  it('no separator when left is null and right is centered alone', async () => {
    await act(async () => {
      root?.render(
        <SplitPanes
          left={null}
          right={<div data-testid="right-content">Right Question</div>}
          side={null}
          leftFraction={0.5}
          onResize={vi.fn()}
        />,
      );
    });

    const separator = container.querySelector('[role="separator"]');
    expect(separator).toBeNull();

    const rightContent = container.querySelector('[data-testid="right-content"]');
    expect(rightContent).not.toBeNull();
    // Centered wrapper max-w-[48rem]
    const centeredWrapper = container.querySelector('.max-w-\\[48rem\\]');
    expect(centeredWrapper).not.toBeNull();
  });

  it('renders separator when left is present, and ArrowRight calls onResize(+0.05)', async () => {
    const onResize = vi.fn();
    await act(async () => {
      root?.render(
        <SplitPanes
          left={<div data-testid="left-content">Passage</div>}
          right={<div data-testid="right-content">Questions</div>}
          side={null}
          leftFraction={0.5}
          onResize={onResize}
        />,
      );
    });

    const separator = container.querySelector('[role="separator"]') as HTMLDivElement | null;
    expect(separator).not.toBeNull();
    expect(separator?.getAttribute('aria-orientation')).toBe('vertical');
    expect(separator?.getAttribute('aria-valuenow')).toBe('50');

    await act(async () => {
      separator?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
    });

    expect(onResize).toHaveBeenCalledWith(0.55);
  });

  it('ArrowLeft calls onResize(-0.05) and clamps at SPLIT_MIN_FRACTION', async () => {
    const onResize = vi.fn();
    await act(async () => {
      root?.render(
        <SplitPanes
          left={<div>Passage</div>}
          right={<div>Questions</div>}
          side={null}
          leftFraction={0.22}
          onResize={onResize}
        />,
      );
    });

    const separator = container.querySelector('[role="separator"]') as HTMLDivElement | null;
    expect(separator).not.toBeNull();

    await act(async () => {
      separator?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
      );
    });

    // 0.22 - 0.05 = 0.17 -> clamped to 0.2
    expect(onResize).toHaveBeenCalledWith(0.2);
  });

  it('renders docked side panel when side is not null', async () => {
    await act(async () => {
      root?.render(
        <SplitPanes
          left={<div>Passage</div>}
          right={<div>Questions</div>}
          side={<div data-testid="side-sheet">Reference Sheet</div>}
          leftFraction={0.5}
          onResize={vi.fn()}
        />,
      );
    });

    const sidePanel = container.querySelector('[data-testid="side-sheet"]');
    expect(sidePanel).not.toBeNull();
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside?.className).toContain('shrink-0');
  });
});
