import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MistakesSection } from '../../types/dashboard';
import type { DrillConfig } from '../../types/drill';
import { MistakesCard } from './MistakesCard';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container.remove();
});

async function show(node: React.ReactElement) {
  await act(async () => {
    root?.render(node);
  });
}

const mockDrillConfig: DrillConfig = {
  section: 'math',
  domainCode: 'all',
  skillCodes: [],
  difficulties: [],
  count: 5,
  liveOnly: true,
};

const mockMistakesTagged: MistakesSection = {
  reasons: {
    careless: 5,
    concept_gap: 4,
    misread: 2,
    ran_out_of_time: 1,
    guessed: 0,
    other: 0,
  },
  tagged: 12,
  misses: 30,
  reasonsTrend: [
    { week: '2026-W10', reason: 'careless', count: 3 },
    { week: '2026-W10', reason: 'concept_gap', count: 2 },
    { week: '2026-W11', reason: 'careless', count: 2 },
    { week: '2026-W11', reason: 'concept_gap', count: 2 },
  ],
  untaggedLast: {
    sessionId: 'session-123',
    untagged: 4,
    finishedAt: Date.now() - 3600_000,
  },
  retry: {
    due: 3,
    queued: 7,
    answered: 10,
    correct: 8,
  },
  slips800: [
    {
      preset: 'english800',
      title: '800 Mode · Reading & Writing',
      sets: 5,
      cleanSets: 3,
      cleanStreak: 2,
      slipsPerSet: 0.4,
      untagged: 1,
    },
  ],
  reviewDrills: [
    {
      section: 'math',
      available: 5,
      config: mockDrillConfig,
    },
  ],
};

describe('MistakesCard', () => {
  it('renders header note and calls onLink when clicking mistake log link', async () => {
    const onLink = vi.fn();
    await show(
      <MistakesCard
        mistakes={mockMistakesTagged}
        onAction={vi.fn()}
        onTagSession={vi.fn()}
        onLink={onLink}
      />,
    );

    expect(container.textContent).toContain('From your own tags.');

    const buttons = Array.from(container.querySelectorAll('button'));
    const linkButton = buttons.find((b) => b.textContent?.includes('Open the mistake log'));
    expect(linkButton).toBeDefined();

    await act(async () => {
      linkButton?.click();
    });

    expect(onLink).toHaveBeenCalledTimes(1);
    expect(onLink).toHaveBeenCalledWith({ to: 'mistakes' });
  });

  it('renders tag prompt and button calling onTagSession when tagged === 0 and untaggedLast is set', async () => {
    const onTagSession = vi.fn();
    const mistakesZeroTagged: MistakesSection = {
      ...mockMistakesTagged,
      tagged: 0,
      reasons: {},
    };

    await show(
      <MistakesCard
        mistakes={mistakesZeroTagged}
        onAction={vi.fn()}
        onTagSession={onTagSession}
        onLink={vi.fn()}
      />,
    );

    expect(container.textContent).toContain(
      'Tag the misses from your last session to see why you miss.',
    );
    expect(container.textContent).not.toContain('Reasons breakdown');

    const tagButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tag 4 misses from last session'),
    );
    expect(tagButton).toBeDefined();

    await act(async () => {
      tagButton?.click();
    });

    expect(onTagSession).toHaveBeenCalledTimes(1);
    expect(onTagSession).toHaveBeenCalledWith('session-123');
  });

  it('renders "No misses to tag yet." when tagged === 0 and untaggedLast is null', async () => {
    const mistakesNoUntagged: MistakesSection = {
      ...mockMistakesTagged,
      tagged: 0,
      untaggedLast: null,
      reasons: {},
    };

    await show(
      <MistakesCard
        mistakes={mistakesNoUntagged}
        onAction={vi.fn()}
        onTagSession={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('No misses to tag yet.');
  });

  it('renders reasons breakdown with N when tagged > 0', async () => {
    await show(
      <MistakesCard
        mistakes={mockMistakesTagged}
        onAction={vi.fn()}
        onTagSession={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('Reasons breakdown');
    expect(container.textContent).toContain('12 of 30 misses tagged');
    expect(container.textContent).toContain('Careless');
    expect(container.textContent).toContain('5 (N = 12)');
  });

  it('renders reasons trend table when 2+ weeks, but skips when fewer weeks', async () => {
    await show(
      <MistakesCard
        mistakes={mockMistakesTagged}
        onAction={vi.fn()}
        onTagSession={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('Reasons trend');
    expect(container.textContent).toContain('2026-W10');
    expect(container.textContent).toContain('2026-W11');

    // With only 1 week, it should skip
    const singleWeekMistakes: MistakesSection = {
      ...mockMistakesTagged,
      reasonsTrend: [{ week: '2026-W10', reason: 'careless', count: 3 }],
    };

    await show(
      <MistakesCard
        mistakes={singleWeekMistakes}
        onAction={vi.fn()}
        onTagSession={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    expect(container.textContent).not.toContain('Reasons trend');
  });

  it('renders retry button only when due > 0 and calls onAction', async () => {
    const onAction = vi.fn();
    await show(
      <MistakesCard
        mistakes={mockMistakesTagged}
        onAction={onAction}
        onTagSession={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    expect(container.textContent).toContain(
      '3 due now, 7 in the queue, 8 of 10 retries right',
    );

    const retryButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry due questions'),
    );
    expect(retryButton).toBeDefined();

    await act(async () => {
      retryButton?.click();
    });

    expect(onAction).toHaveBeenCalledWith({
      kind: 'retry',
      label: 'Retry due questions',
    });

    // When due is 0, no retry button should be present
    const zeroDueMistakes: MistakesSection = {
      ...mockMistakesTagged,
      retry: { due: 0, queued: 5, answered: 10, correct: 8 },
    };

    await show(
      <MistakesCard
        mistakes={zeroDueMistakes}
        onAction={vi.fn()}
        onTagSession={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    const retryButtonAfter = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Retry due questions'),
    );
    expect(retryButtonAfter).toBeUndefined();
  });

  it('renders slips in 800 modes and review drill buttons calling onAction', async () => {
    const onAction = vi.fn();
    await show(
      <MistakesCard
        mistakes={mockMistakesTagged}
        onAction={onAction}
        onTagSession={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('800 Mode · Reading & Writing');
    expect(container.textContent).toContain('5 sets');
    expect(container.textContent).toContain('3 clean');
    expect(container.textContent).toContain('0.4 slips/set');
    expect(container.textContent).toContain('1 untagged');

    const reviewButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Review 5 missed Math questions'),
    );
    expect(reviewButton).toBeDefined();

    await act(async () => {
      reviewButton?.click();
    });

    expect(onAction).toHaveBeenCalledWith({
      kind: 'drill',
      label: 'Review 5 missed Math questions',
      config: mockDrillConfig,
    });
  });

  it('renders "No 800 mode sets yet." when slips800 is empty', async () => {
    const emptySlips: MistakesSection = {
      ...mockMistakesTagged,
      slips800: [],
    };

    await show(
      <MistakesCard
        mistakes={emptySlips}
        onAction={vi.fn()}
        onTagSession={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('No 800 mode sets yet.');
  });
});
