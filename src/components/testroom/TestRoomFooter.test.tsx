import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestRoomFooter } from './TestRoomFooter';

describe('TestRoomFooter', () => {
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

  it('no Back on index 0', async () => {
    await act(async () => {
      root?.render(
        <TestRoomFooter
          label="Reading and Writing"
          index={0}
          total={27}
          menuOpen={false}
          onToggleMenu={vi.fn()}
          onBack={vi.fn()}
          onNext={vi.fn()}
          disabled={false}
        />,
      );
    });

    const backBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Back',
    );
    expect(backBtn).toBeUndefined();
  });

  it('Back rendered on index 2 and calls onBack', async () => {
    const onBack = vi.fn();
    await act(async () => {
      root?.render(
        <TestRoomFooter
          label="Reading and Writing"
          index={2}
          total={27}
          menuOpen={false}
          onToggleMenu={vi.fn()}
          onBack={onBack}
          onNext={vi.fn()}
          disabled={false}
        />,
      );
    });

    const backBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Back',
    );
    expect(backBtn).toBeDefined();

    await act(async () => {
      backBtn?.click();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Next label on last question (always "Next")', async () => {
    const onNext = vi.fn();
    await act(async () => {
      root?.render(
        <TestRoomFooter
          label="Math Module 1"
          index={21}
          total={22}
          menuOpen={false}
          onToggleMenu={vi.fn()}
          onBack={vi.fn()}
          onNext={onNext}
          disabled={false}
        />,
      );
    });

    const nextBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Next',
    );
    expect(nextBtn).toBeDefined();
    expect(nextBtn?.disabled).toBe(false);

    await act(async () => {
      nextBtn?.click();
    });

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('disabled disables Back and Next', async () => {
    await act(async () => {
      root?.render(
        <TestRoomFooter
          label="Reading and Writing"
          index={3}
          total={27}
          menuOpen={false}
          onToggleMenu={vi.fn()}
          onBack={vi.fn()}
          onNext={vi.fn()}
          disabled={true}
        />,
      );
    });

    const backBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Back',
    );
    const nextBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Next',
    );

    expect(backBtn?.disabled).toBe(true);
    expect(nextBtn?.disabled).toBe(true);
  });

  it('toggles menu and updates aria-expanded and chevron', async () => {
    const onToggleMenu = vi.fn();
    await act(async () => {
      root?.render(
        <TestRoomFooter
          label="Section 1"
          index={4}
          total={20}
          menuOpen={false}
          onToggleMenu={onToggleMenu}
          onBack={vi.fn()}
          onNext={vi.fn()}
          disabled={false}
        />,
      );
    });

    const menuBtn = container.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement | null;
    expect(menuBtn).not.toBeNull();
    expect(menuBtn?.getAttribute('aria-expanded')).toBe('false');
    expect(menuBtn?.textContent).toContain('Question 5 of 20');

    await act(async () => {
      menuBtn?.click();
    });

    expect(onToggleMenu).toHaveBeenCalledTimes(1);

    // Re-render open
    await act(async () => {
      root?.render(
        <TestRoomFooter
          label="Section 1"
          index={4}
          total={20}
          menuOpen={true}
          onToggleMenu={onToggleMenu}
          onBack={vi.fn()}
          onNext={vi.fn()}
          disabled={false}
        />,
      );
    });

    expect(menuBtn?.getAttribute('aria-expanded')).toBe('true');
  });
});
