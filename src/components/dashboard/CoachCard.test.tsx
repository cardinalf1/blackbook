import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachAction, ReportLine } from '../../types/ai';
import type { CoachSection } from '../../types/dashboard';
import { CoachCard } from './CoachCard';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('CoachCard', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
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

  const dummyAction: CoachAction = {
    kind: 'open',
    label: 'Go to Drills',
    target: 'drill_setup',
  };

  const makeLine = (id: string, overrides: Partial<ReportLine> = {}): ReportLine => ({
    insightId: id,
    title: `Insight ${id}`,
    headline: `Headline ${id}`,
    sentence: `This is insight sentence ${id}.`,
    thin: false,
    sampleSize: 15,
    action: dummyAction,
    ...overrides,
  });

  async function renderCard(props: {
    coach: CoachSection;
    ai: { state: 'idle' | 'loading' | 'done' | 'failed'; lines: ReportLine[] | null };
    onAction: (a: CoachAction) => void;
  }) {
    if (!root) {
      root = createRoot(container);
    }
    await act(async () => {
      root?.render(<CoachCard {...props} />);
    });
  }

  it('renders unlock text (singular when 1) and button, calling onAction', async () => {
    const onAction = vi.fn();
    const coach: CoachSection = {
      lines: [],
      origin: 'rule',
      aiAvailable: false,
      unlock: {
        drillsNeeded: 1,
        action: { kind: 'open', label: 'Start 1st drill', target: 'drill_setup' },
      },
      emptyScope: null,
    };

    await renderCard({
      coach,
      ai: { state: 'idle', lines: null },
      onAction,
    });

    expect(container.textContent).toContain('Do 1 more drill to unlock this');
    const button = container.querySelector('button');
    expect(button?.textContent).toBe('Start 1st drill');

    await act(async () => {
      button?.click();
    });
    expect(onAction).toHaveBeenCalledWith(coach.unlock?.action);
  });

  it('renders unlock text with plural when drillsNeeded > 1', async () => {
    const coach: CoachSection = {
      lines: [],
      origin: 'rule',
      aiAvailable: false,
      unlock: {
        drillsNeeded: 3,
        action: dummyAction,
      },
      emptyScope: null,
    };

    await renderCard({
      coach,
      ai: { state: 'idle', lines: null },
      onAction: vi.fn(),
    });

    expect(container.textContent).toContain('Do 3 more drills to unlock this');
  });

  it('renders emptyScope message and button', async () => {
    const onAction = vi.fn();
    const coach: CoachSection = {
      lines: [],
      origin: 'rule',
      aiAvailable: false,
      unlock: null,
      emptyScope: {
        message: 'No sessions in this date range.',
        action: dummyAction,
      },
    };

    await renderCard({
      coach,
      ai: { state: 'idle', lines: null },
      onAction,
    });

    expect(container.textContent).toContain('No sessions in this date range.');
    const button = container.querySelector('button');
    expect(button?.textContent).toBe('Go to Drills');

    await act(async () => {
      button?.click();
    });
    expect(onAction).toHaveBeenCalledWith(dummyAction);
  });

  it('renders at most 3 lines even when coach has more', async () => {
    const coach: CoachSection = {
      lines: [
        makeLine('1'),
        makeLine('2'),
        makeLine('3'),
        makeLine('4'),
        makeLine('5'),
      ],
      origin: 'rule',
      aiAvailable: true,
      unlock: null,
      emptyScope: null,
    };

    await renderCard({
      coach,
      ai: { state: 'idle', lines: null },
      onAction: vi.fn(),
    });

    expect(container.textContent).toContain('This is insight sentence 1.');
    expect(container.textContent).toContain('This is insight sentence 2.');
    expect(container.textContent).toContain('This is insight sentence 3.');
    expect(container.textContent).not.toContain('This is insight sentence 4.');
    expect(container.textContent).not.toContain('This is insight sentence 5.');
  });

  it('renders thin data tag when line.thin is true', async () => {
    const coach: CoachSection = {
      lines: [
        makeLine('1', { thin: true }),
        makeLine('2', { thin: false }),
      ],
      origin: 'rule',
      aiAvailable: true,
      unlock: null,
      emptyScope: null,
    };

    await renderCard({
      coach,
      ai: { state: 'idle', lines: null },
      onAction: vi.fn(),
    });

    expect(container.textContent).toContain('thin data');
  });

  it('switches AI label between rule-based and AI-assisted, and shows asking AI... while loading', async () => {
    const coach: CoachSection = {
      lines: [makeLine('rule-1')],
      origin: 'rule',
      aiAvailable: true,
      unlock: null,
      emptyScope: null,
    };

    // 1. Idle state: rule-based
    await renderCard({
      coach,
      ai: { state: 'idle', lines: null },
      onAction: vi.fn(),
    });
    expect(container.textContent).toContain('rule-based');
    expect(container.textContent).not.toContain('AI-assisted');
    expect(container.textContent).not.toContain('asking AI...');

    // 2. Loading state: asking AI... with rule-based
    await renderCard({
      coach,
      ai: { state: 'loading', lines: null },
      onAction: vi.fn(),
    });
    expect(container.textContent).toContain('asking AI...');
    expect(container.textContent).toContain('rule-based');

    // 3. Done state with AI lines: AI-assisted
    const aiLines = [makeLine('ai-1', { sentence: 'AI generated wording.' })];
    await renderCard({
      coach,
      ai: { state: 'done', lines: aiLines },
      onAction: vi.fn(),
    });
    expect(container.textContent).toContain('AI-assisted');
    expect(container.textContent).not.toContain('rule-based');
    expect(container.textContent).not.toContain('asking AI...');
    expect(container.textContent).toContain('AI generated wording.');
  });
});
