import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as mistakeLoad from '../../services/mistakes/load';
import type { MistakeItem, MistakeTag } from '../../types/mistakes';
import type { SessionReport } from '../../types/session';
import { MistakeReviewPanel } from './MistakeReviewPanel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/mistakes/load', () => ({
  loadMistakeItems: vi.fn(),
  tagMistake: vi.fn(),
}));

describe('MistakeReviewPanel', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
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

  const mockReport: SessionReport = {
    sessionId: 'session-123',
    mode: 'drill',
    startedAt: 1000,
    finishedAt: 2000,
    score: { correct: 0, total: 2 },
    totalActiveMs: 10000,
    byDomain: [],
    bySkill: [],
    items: [
      {
        index: 0,
        questionId: 'q-1',
        displayId: '101',
        section: 'rw',
        domain: 'CAS',
        skill: 'Words in Context',
        difficulty: 'M',
        response: 'A',
        correct: false,
        correctAnswer: 'B',
        activeMs: 4000,
        firstVisitMs: 4000,
        flagged: false,
        changes: 0,
        confidence: 'guess',
        question: null,
      },
      {
        index: 1,
        questionId: 'q-2',
        displayId: '102',
        section: 'rw',
        domain: 'SEC',
        skill: 'Form, Structure, and Sense',
        difficulty: 'H',
        response: null,
        correct: false,
        correctAnswer: 'C',
        activeMs: 6000,
        firstVisitMs: 6000,
        flagged: false,
        changes: 0,
        confidence: null,
        question: null,
      },
    ],
  };

  const mockMistakeItems: MistakeItem[] = [
    {
      sessionId: 'session-123',
      questionId: 'q-1',
      index: 0,
      unanswered: false,
      timeMs: 4000,
      tag: null,
      suggestion: {
        reason: 'careless',
        why: 'You spent fast time and picked an adjacent option.',
      },
    },
    {
      sessionId: 'session-123',
      questionId: 'q-2',
      index: 1,
      unanswered: true,
      timeMs: 6000,
      tag: {
        id: 'tag-2',
        sessionId: 'session-123',
        questionId: 'q-2',
        reason: 'ran_out_of_time',
        note: 'Left blank at end',
        suggested: false,
        at: 1500,
      },
      suggestion: null,
    },
  ];

  it('is collapsed by default and expands on click', async () => {
    vi.mocked(mistakeLoad.loadMistakeItems).mockResolvedValueOnce(mockMistakeItems);

    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeReviewPanel report={mockReport} source="drill" />);
    });

    const headerBtn = container.querySelector('button[aria-expanded]') as HTMLButtonElement;
    expect(headerBtn).not.toBeNull();
    expect(headerBtn.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).toContain('Review mistakes');
    expect(container.textContent).not.toContain('Words in Context');

    // Click to expand
    await act(async () => {
      headerBtn.click();
    });

    expect(headerBtn.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('#101');
    expect(container.textContent).toContain('Words in Context');
    expect(container.textContent).toContain('Unanswered');
  });

  it('shows suggestion with why text and "This is only a suggestion."', async () => {
    vi.mocked(mistakeLoad.loadMistakeItems).mockResolvedValueOnce(mockMistakeItems);

    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeReviewPanel report={mockReport} source="drill" defaultExpanded />);
    });

    expect(container.textContent).toContain(
      'You spent fast time and picked an adjacent option.',
    );
    expect(container.textContent).toContain('This is only a suggestion.');
    expect(container.textContent).toContain('Use suggestion: Careless');
  });

  it('one-click accepts suggestion calling tagMistake with suggested: true and previous: null', async () => {
    vi.mocked(mistakeLoad.loadMistakeItems).mockResolvedValueOnce(mockMistakeItems);
    const savedTag: MistakeTag = {
      id: 'tag-1',
      sessionId: 'session-123',
      questionId: 'q-1',
      reason: 'careless',
      note: '',
      suggested: true,
      at: 2000,
    };
    vi.mocked(mistakeLoad.tagMistake).mockResolvedValueOnce(savedTag);

    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeReviewPanel report={mockReport} source="drill" defaultExpanded />);
    });

    const useSugBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Use suggestion: Careless'),
    );
    expect(useSugBtn).toBeDefined();

    await act(async () => {
      useSugBtn?.click();
    });

    expect(mistakeLoad.tagMistake).toHaveBeenCalledWith({
      sessionId: 'session-123',
      questionId: 'q-1',
      mode: 'drill',
      reason: 'careless',
      note: '',
      suggested: true,
      previous: null,
    });

    // Suggestion box is replaced with current tag display
    expect(container.textContent).toContain('Current tag:');
    expect(container.textContent).not.toContain('This is only a suggestion.');
  });

  it('allows manual tag change and note input calling tagMistake with previous tag and suggested: false', async () => {
    vi.mocked(mistakeLoad.loadMistakeItems).mockResolvedValueOnce(mockMistakeItems);
    const updatedTag: MistakeTag = {
      id: 'tag-2',
      sessionId: 'session-123',
      questionId: 'q-2',
      reason: 'concept_gap',
      note: 'Need to review verb forms',
      suggested: false,
      at: 2500,
    };
    vi.mocked(mistakeLoad.tagMistake).mockResolvedValueOnce(updatedTag);

    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeReviewPanel report={mockReport} source="drill" defaultExpanded />);
    });

    const item2Card = container.querySelector('[data-testid="mistake-item-q-2"]');
    expect(item2Card).not.toBeNull();

    const select = item2Card?.querySelector('select') as HTMLSelectElement;
    const input = item2Card?.querySelector('input[type="text"]') as HTMLInputElement;
    const saveBtn = Array.from(item2Card?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent === 'Update tag',
    );

    expect(select).toBeDefined();
    expect(input).toBeDefined();
    expect(saveBtn).toBeDefined();

    // Change select to concept_gap
    await act(async () => {
      select.value = 'concept_gap';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Change input note
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeSetter?.call(input, 'Need to review verb forms');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Click Update tag
    await act(async () => {
      saveBtn?.click();
    });

    expect(mistakeLoad.tagMistake).toHaveBeenCalledWith({
      sessionId: 'session-123',
      questionId: 'q-2',
      mode: 'drill',
      reason: 'concept_gap',
      note: 'Need to review verb forms',
      suggested: false,
      previous: mockMistakeItems[1]!.tag,
    });

    // Tag display updated
    expect(item2Card?.textContent).toContain('Concept gap');
    expect(item2Card?.textContent).toContain('Need to review verb forms');
  });

  it('renders plain message when no mistake items exist', async () => {
    vi.mocked(mistakeLoad.loadMistakeItems).mockResolvedValueOnce([]);

    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeReviewPanel report={mockReport} source="drill" defaultExpanded />);
    });

    expect(container.textContent).toContain('No missed or unanswered questions in this session.');
  });
});
