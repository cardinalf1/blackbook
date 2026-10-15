import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestPreflight } from '../../types/test';
import { TestSetup } from './TestSetup';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('TestSetup', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const fullUnseenPreflight: TestPreflight = {
    sections: [
      { section: 'rw', unseenOk: true, softOk: true, anyOk: true, shortfalls: [] },
      { section: 'math', unseenOk: true, softOk: true, anyOk: true, shortfalls: [] },
    ],
    allUnseen: true,
    allSoft: true,
    allPossible: true,
  };

  it('renders kind selection buttons with aria-pressed and calls onKindChange', async () => {
    const onKindChange = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TestSetup
          kind="full"
          onKindChange={onKindChange}
          preflight={fullUnseenPreflight}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          busy={false}
          error={null}
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    const fullBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Full test'),
    );
    const rwBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reading and Writing only'),
    );
    const mathBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Math only'),
    );

    expect(fullBtn).toBeDefined();
    expect(rwBtn).toBeDefined();
    expect(mathBtn).toBeDefined();

    expect(fullBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(rwBtn?.getAttribute('aria-pressed')).toBe('false');
    expect(mathBtn?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      rwBtn?.click();
    });
    expect(onKindChange).toHaveBeenCalledWith('rw');

    await act(async () => {
      mathBtn?.click();
    });
    expect(onKindChange).toHaveBeenCalledWith('math');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders explanation copy covering modules, timing, routing, break, and estimated score range', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TestSetup
          kind="full"
          onKindChange={vi.fn()}
          preflight={fullUnseenPreflight}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          busy={false}
          error={null}
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Practice test setup');
    expect(text).toContain('four timed modules');
    expect(text).toContain('27 questions/32 min R&W');
    expect(text).toContain('22 questions/35 min Math');
    expect(text).toContain('Module 2 is easier or harder depending on Module 1');
    expect(text).toContain('10-minute break');
    expect(text).toContain('no going back to a submitted module');
    expect(text).toContain('estimated score range at the end is an approximation');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows checking status and disables Start when preflight is null', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TestSetup
          kind="full"
          onKindChange={vi.fn()}
          preflight={null}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          busy={false}
          error={null}
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Checking your questions...');
    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Start test',
    );
    expect(startBtn?.disabled).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it('shows enough unseen questions message and enables Start when allUnseen is true', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TestSetup
          kind="full"
          onKindChange={vi.fn()}
          preflight={fullUnseenPreflight}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          busy={false}
          error={null}
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Enough unseen questions for every module.');
    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Start test',
    );
    expect(startBtn?.disabled).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('lists shortfalls, shows includeSeen checkbox, and controls Start button when not allUnseen but allSoft', async () => {
    const onIncludeSeenChange = vi.fn();
    const partialPreflight: TestPreflight = {
      sections: [
        {
          section: 'rw',
          unseenOk: false,
          softOk: true,
          anyOk: true,
          shortfalls: ['Reading and Writing: need 5 more questions for Module 2'],
        },
        {
          section: 'math',
          unseenOk: true,
          softOk: true,
          anyOk: true,
          shortfalls: [],
        },
      ],
      allUnseen: false,
      allSoft: true,
      allPossible: true,
    };

    const root = createRoot(container);

    // includeSeen is false -> Start disabled
    await act(async () => {
      root.render(
        <TestSetup
          kind="full"
          onKindChange={vi.fn()}
          preflight={partialPreflight}
          includeSeen={false}
          onIncludeSeenChange={onIncludeSeenChange}
          busy={false}
          error={null}
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain(
      'Reading and Writing: need 5 more questions for Module 2',
    );
    expect(container.textContent).toContain('Include questions I have seen but not answered');
    expect(container.textContent).toContain('Otherwise the test will not start.');

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(false);

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Start test',
    );
    expect(startBtn?.disabled).toBe(true);

    await act(async () => {
      checkbox?.click();
    });
    expect(onIncludeSeenChange).toHaveBeenCalledWith(true);

    // Re-render with includeSeen true -> Start enabled
    await act(async () => {
      root.render(
        <TestSetup
          kind="full"
          onKindChange={vi.fn()}
          preflight={partialPreflight}
          includeSeen={true}
          onIncludeSeenChange={onIncludeSeenChange}
          busy={false}
          error={null}
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(startBtn?.disabled).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('lists shortfalls, shows allowRepeats checkbox, and controls Start button when not allSoft but allPossible', async () => {
    const onAllowRepeatsChange = vi.fn();
    const repeatsPreflight: TestPreflight = {
      sections: [
        {
          section: 'rw',
          unseenOk: false,
          softOk: false,
          anyOk: true,
          shortfalls: ['Reading and Writing: need 10 more questions'],
        },
        {
          section: 'math',
          unseenOk: true,
          softOk: true,
          anyOk: true,
          shortfalls: [],
        },
      ],
      allUnseen: false,
      allSoft: false,
      allPossible: true,
    };

    const root = createRoot(container);

    // allowRepeats is false -> Start disabled
    await act(async () => {
      root.render(
        <TestSetup
          kind="full"
          onKindChange={vi.fn()}
          preflight={repeatsPreflight}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          allowRepeats={false}
          onAllowRepeatsChange={onAllowRepeatsChange}
          busy={false}
          error={null}
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Allow repeats of questions I have already done');
    expect(container.textContent).toContain('Otherwise the test will not start.');

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(false);

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Start test',
    );
    expect(startBtn?.disabled).toBe(true);

    await act(async () => {
      checkbox?.click();
    });
    expect(onAllowRepeatsChange).toHaveBeenCalledWith(true);

    // Re-render with allowRepeats true -> Start enabled
    await act(async () => {
      root.render(
        <TestSetup
          kind="full"
          onKindChange={vi.fn()}
          preflight={repeatsPreflight}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          allowRepeats={true}
          onAllowRepeatsChange={onAllowRepeatsChange}
          busy={false}
          error={null}
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(startBtn?.disabled).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders pool health estimate for chosen test kind', async () => {
    const root = createRoot(container);
    const mockHealth = {
      rw: 50,
      math: 50,
      full: 50,
      capped: true,
    };

    await act(async () => {
      root.render(
        <TestSetup
          kind="full"
          onKindChange={vi.fn()}
          preflight={fullUnseenPreflight}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          poolHealth={mockHealth}
          busy={false}
          error={null}
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Full tests left: 50 or more (estimate)');

    await act(async () => {
      root.render(
        <TestSetup
          kind="rw"
          onKindChange={vi.fn()}
          preflight={fullUnseenPreflight}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          poolHealth={mockHealth}
          busy={false}
          error={null}
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Reading and Writing tests left: 50 or more (estimate)');

    await act(async () => {
      root.render(
        <TestSetup
          kind="math"
          onKindChange={vi.fn()}
          preflight={fullUnseenPreflight}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          poolHealth={{ rw: 8, math: 4, full: 4, capped: false }}
          busy={false}
          error={null}
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Math tests left: 4 (estimate)');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows plain error and disables Start when !allPossible', async () => {
    const impossiblePreflight: TestPreflight = {
      sections: [
        {
          section: 'math',
          unseenOk: false,
          softOk: false,
          anyOk: false,
          shortfalls: ['Math: bank lacks enough questions of any kind'],
        },
      ],
      allUnseen: false,
      allSoft: false,
      allPossible: false,
    };

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TestSetup
          kind="math"
          onKindChange={vi.fn()}
          preflight={impossiblePreflight}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          busy={false}
          error={null}
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('The question bank is too small to build this test.');
    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Start test',
    );
    expect(startBtn?.disabled).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it('disables Start when busy is true even if preflight is allUnseen', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TestSetup
          kind="full"
          onKindChange={vi.fn()}
          preflight={fullUnseenPreflight}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          busy={true}
          error={null}
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Start test',
    );
    expect(startBtn?.disabled).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onStart when enabled Start button is clicked', async () => {
    const onStart = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TestSetup
          kind="full"
          onKindChange={vi.fn()}
          preflight={fullUnseenPreflight}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          busy={false}
          error={null}
          onStart={onStart}
          onCancel={vi.fn()}
        />,
      );
    });

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Start test',
    );
    expect(startBtn?.disabled).toBe(false);

    await act(async () => {
      startBtn?.click();
    });
    expect(onStart).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders error banner when error prop is present', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TestSetup
          kind="full"
          onKindChange={vi.fn()}
          preflight={fullUnseenPreflight}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          busy={false}
          error="Failed to load question bank"
          onStart={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('Failed to load question bank');

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TestSetup
          kind="full"
          onKindChange={vi.fn()}
          preflight={fullUnseenPreflight}
          includeSeen={false}
          onIncludeSeenChange={vi.fn()}
          busy={false}
          error={null}
          onStart={vi.fn()}
          onCancel={onCancel}
        />,
      );
    });

    const cancelBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Cancel',
    );
    expect(cancelBtn).toBeDefined();

    await act(async () => {
      cancelBtn?.click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });
});
