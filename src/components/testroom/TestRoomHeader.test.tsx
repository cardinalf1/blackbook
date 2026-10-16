import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestRoomHeaderProps } from '../../types/testRoom';
import { TestRoomHeader } from './TestRoomHeader';

describe('TestRoomHeader', () => {
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

  const defaultProps: TestRoomHeaderProps = {
    sectionTitle: 'Section 1: Reading and Writing',
    section: 'rw',
    directionsOpen: false,
    onToggleDirections: vi.fn(),
    remainingMs: 1800000, // 30 min
    timerHidden: false,
    onToggleTimer: vi.fn(),
    paused: false,
    tools: [
      { id: 'highlights', label: 'Highlights', active: false, onClick: vi.fn() },
    ],
    moreOpen: false,
    onToggleMore: vi.fn(),
    moreItems: [
      { id: 'shortcuts', label: 'Keyboard Shortcuts', active: false, onSelect: vi.fn() },
      { id: 'contrast', label: 'High Contrast', active: true, onSelect: vi.fn() },
    ],
    zoomPercent: 100,
  };

  it('paused countdown renders "Paused"', async () => {
    await act(async () => {
      root?.render(<TestRoomHeader {...defaultProps} paused={true} />);
    });

    expect(container.textContent).toContain('Paused');
  });

  it('timerHidden renders clock icon + "Show"', async () => {
    await act(async () => {
      root?.render(<TestRoomHeader {...defaultProps} timerHidden={true} />);
    });

    const clockIcon = container.querySelector('[data-testid="timer-clock-icon"]');
    expect(clockIcon).not.toBeNull();
    expect(container.textContent).toContain('Show');
    // Digits should not be shown
    expect(container.textContent).not.toContain('30:00');
  });

  it('five-minute warning applies warning style at 300_000 ms', async () => {
    await act(async () => {
      root?.render(<TestRoomHeader {...defaultProps} remainingMs={300000} />);
    });

    expect(container.textContent).toContain('5:00');
    const timerElem = Array.from(container.querySelectorAll('div')).find(
      (d) => d.textContent === '5:00',
    );
    expect(timerElem).toBeDefined();
    expect(timerElem?.className).toContain('text-amber-400');
  });

  it('More menu opens/closes, shows items with "On" for active, and Escape closes More', async () => {
    const onToggleMore = vi.fn();
    const onSelectShortcuts = vi.fn();

    await act(async () => {
      root?.render(
        <TestRoomHeader
          {...defaultProps}
          moreOpen={true}
          onToggleMore={onToggleMore}
          moreItems={[
            { id: 'shortcuts', label: 'Keyboard Shortcuts', active: false, onSelect: onSelectShortcuts },
            { id: 'contrast', label: 'High Contrast', active: true, onSelect: vi.fn() },
          ]}
        />,
      );
    });

    const menu = container.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain('Keyboard Shortcuts');
    expect(menu?.textContent).toContain('High Contrast');
    expect(menu?.textContent).toContain('On'); // contrast is active

    // Select an item
    const shortcutBtn = Array.from(menu!.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Keyboard Shortcuts'),
    );
    expect(shortcutBtn).toBeDefined();

    await act(async () => {
      shortcutBtn?.click();
    });

    expect(onSelectShortcuts).toHaveBeenCalledTimes(1);

    // Escape closes More
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onToggleMore).toHaveBeenCalledTimes(1);
  });

  it('displays zoom percent in corner and handles tools with active state', async () => {
    await act(async () => {
      root?.render(
        <TestRoomHeader
          {...defaultProps}
          zoomPercent={125}
          tools={[
            { id: 'calculator', label: 'Calculator', active: true, onClick: vi.fn() },
          ]}
        />,
      );
    });

    expect(container.textContent).toContain('125%');
    const calcLabel = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === 'Calculator',
    );
    expect(calcLabel).toBeDefined();
    // active has underline border-b-2
    expect(calcLabel?.className).toContain('border-b-2');
  });
});
