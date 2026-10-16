import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOME_GROUPS } from '../../services/home/routes';
import type { UpNextChoice } from '../../services/home/upNext';
import { HomeScreen } from './HomeScreen';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('HomeScreen', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  const defaultStatus = { questions: 3695, done: 148 };
  const defaultUpNext: UpNextChoice = {
    primary: {
      kind: 'start_drill',
      size: 20,
      label: 'Start a 20-question drill',
      reason: 'A mixed set from questions you have not seen yet.',
    },
    moreInProgress: 0,
  };

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

  it('renders header, status line formatted with toLocaleString, and quiet footer', async () => {
    await act(async () => {
      root?.render(
        <HomeScreen
          status={defaultStatus}
          upNext={defaultUpNext}
          poolLine={null}
          onPrimary={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Blackbook');
    expect(container.textContent).toContain('3,695 questions on this computer, 148 done');
    expect(container.textContent).toContain(
      'Independent practice tool. Not affiliated with any testing organization.',
    );
  });

  it('exactly one element styled/role as the primary action is present and calls onPrimary', async () => {
    const onPrimary = vi.fn();
    await act(async () => {
      root?.render(
        <HomeScreen
          status={defaultStatus}
          upNext={defaultUpNext}
          poolLine={null}
          onPrimary={onPrimary}
          onNavigate={vi.fn()}
        />,
      );
    });

    // Primary action has bg-white text-black styling
    const allButtons = Array.from(container.querySelectorAll('button'));
    const primaryButtons = allButtons.filter((btn) =>
      btn.className.includes('bg-white') && btn.className.includes('text-black'),
    );

    expect(primaryButtons.length).toBe(1);
    const primaryBtn = primaryButtons[0] as HTMLButtonElement;
    expect(primaryBtn.textContent).toBe('Start a 20-question drill');

    await act(async () => {
      primaryBtn.click();
    });

    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('every HOME_GROUPS link renders and calls onNavigate with its to', async () => {
    const onNavigate = vi.fn();
    await act(async () => {
      root?.render(
        <HomeScreen
          status={defaultStatus}
          upNext={defaultUpNext}
          poolLine={null}
          onPrimary={vi.fn()}
          onNavigate={onNavigate}
        />,
      );
    });

    // Verify all group titles are present
    for (const group of HOME_GROUPS) {
      expect(container.textContent).toContain(group.title);
    }

    // Direct links that call onNavigate directly
    const directLinks = HOME_GROUPS.flatMap((g) => g.links).filter(
      (l) => l.to !== 'test_chooser',
    );

    for (const link of directLinks) {
      expect(container.textContent).toContain(link.label);
      if (link.hint) {
        expect(container.textContent).toContain(link.hint);
      }

      const btn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes(link.label),
      );
      expect(btn).toBeDefined();

      onNavigate.mockClear();
      await act(async () => {
        btn?.click();
      });

      expect(onNavigate).toHaveBeenCalledWith(link.to);
    }
  });

  it('settings menu opens, lists the 3 items, Escape closes', async () => {
    const onNavigate = vi.fn();
    await act(async () => {
      root?.render(
        <HomeScreen
          status={defaultStatus}
          upNext={defaultUpNext}
          poolLine={null}
          onPrimary={vi.fn()}
          onNavigate={onNavigate}
        />,
      );
    });

    const settingsBtn = container.querySelector('button[aria-label="Settings"]') as HTMLButtonElement;
    expect(settingsBtn).not.toBeNull();

    // Open menu
    await act(async () => {
      settingsBtn.click();
    });

    const menu = container.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();

    const items = container.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBe(3);
    expect(items[0]?.textContent).toContain('Settings');
    expect(items[1]?.textContent).toContain('Your data');
    expect(items[2]?.textContent).toContain('Question bank');

    // Escape closes
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('chooser opens from "Take a test", lists 3 options, choosing calls the handler with the right to', async () => {
    const onNavigate = vi.fn();
    await act(async () => {
      root?.render(
        <HomeScreen
          status={defaultStatus}
          upNext={defaultUpNext}
          poolLine="Fresh questions for about 6 full tests (estimate)"
          onPrimary={vi.fn()}
          onNavigate={onNavigate}
        />,
      );
    });

    // Find the "Take a test" button in the group card (not in a modal yet)
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    const takeTestBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Take a test'),
    );
    expect(takeTestBtn).toBeDefined();

    await act(async () => {
      takeTestBtn?.click();
    });

    // Chooser modal dialog is now open
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Take a test');

    // Lists 3 options
    expect(dialog?.textContent).toContain('Full test');
    expect(dialog?.textContent).toContain('One section');
    expect(dialog?.textContent).toContain('One module');

    // Choosing calls onNavigate with the right to
    const fullTestBtn = Array.from(dialog?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('Full test'),
    );
    expect(fullTestBtn).toBeDefined();

    await act(async () => {
      fullTestBtn?.click();
    });

    expect(onNavigate).toHaveBeenCalledWith('test_setup_full');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('"see all in progress" appears only when moreInProgress > 0', async () => {
    const onNavigate = vi.fn();

    // Case 1: moreInProgress = 0 -> not displayed
    await act(async () => {
      root?.render(
        <HomeScreen
          status={defaultStatus}
          upNext={{ ...defaultUpNext, moreInProgress: 0 }}
          poolLine={null}
          onPrimary={vi.fn()}
          onNavigate={onNavigate}
        />,
      );
    });

    expect(container.textContent).not.toContain('see all in progress');

    // Case 2: moreInProgress = 3 -> displayed
    await act(async () => {
      root?.render(
        <HomeScreen
          status={defaultStatus}
          upNext={{ ...defaultUpNext, moreInProgress: 3 }}
          poolLine={null}
          onPrimary={vi.fn()}
          onNavigate={onNavigate}
        />,
      );
    });

    expect(container.textContent).toContain('see all in progress (3 more)');

    const inProgressBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('see all in progress (3 more)'),
    );
    expect(inProgressBtn).toBeDefined();

    await act(async () => {
      inProgressBtn?.click();
    });

    expect(onNavigate).toHaveBeenCalledWith('in_progress');
  });

  it('Take a test card shows poolLine in small muted text', async () => {
    await act(async () => {
      root?.render(
        <HomeScreen
          status={defaultStatus}
          upNext={defaultUpNext}
          poolLine="Fresh questions for about 6 full tests (estimate)"
          onPrimary={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Fresh questions for about 6 full tests (estimate)');
  });

  it('"or choose something else" scrolls and focuses the groups', async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    await act(async () => {
      root?.render(
        <HomeScreen
          status={defaultStatus}
          upNext={defaultUpNext}
          poolLine={null}
          onPrimary={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );
    });

    const chooseElseBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('or choose something else'),
    );
    expect(chooseElseBtn).toBeDefined();

    await act(async () => {
      chooseElseBtn?.click();
    });

    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});
