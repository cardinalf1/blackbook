import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wilsonLowerBound } from '../../services/analytics/metrics';
import type { SkillDetail, SkillRow, SkillsSummary } from '../../types/analytics';
import type { Question } from '../../types/sat';
import { SkillsScreen } from './SkillsScreen';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SkillsScreen', () => {
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

  function simulateInput(input: HTMLInputElement, value: string) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const skillOneOfOne: SkillRow = {
    section: 'rw',
    domainCode: 'CAS',
    domain: 'Craft and Structure',
    skillCode: 'CAS.A',
    skill: 'Words in Context',
    bankTotal: 50,
    bankLive: 40,
    unseenLive: 39,
    counts: {
      drill: { attempts: 1, correct: 1, timeMs: 45000 },
      exam: { attempts: 0, correct: 0, timeMs: 0 },
    },
    recent: [{ sessionId: 's1', finishedAt: 1000, mode: 'drill', attempts: 1, correct: 1 }],
  };

  const skillEighteenOfTwenty: SkillRow = {
    section: 'rw',
    domainCode: 'CAS',
    domain: 'Craft and Structure',
    skillCode: 'CAS.B',
    skill: 'Text Structure and Purpose',
    bankTotal: 50,
    bankLive: 40,
    unseenLive: 20,
    counts: {
      drill: { attempts: 10, correct: 9, timeMs: 600000 },
      exam: { attempts: 10, correct: 9, timeMs: 600000 },
    },
    recent: [
      { sessionId: 's2', finishedAt: 2000, mode: 'drill', attempts: 10, correct: 9 },
      { sessionId: 's3', finishedAt: 3000, mode: 'exam', attempts: 10, correct: 9 },
    ],
  };

  const skillNoAnswers: SkillRow = {
    section: 'math',
    domainCode: 'ALG',
    domain: 'Algebra',
    skillCode: 'ALG.A',
    skill: 'Linear Equations',
    bankTotal: 60,
    bankLive: 50,
    unseenLive: 50,
    counts: {
      drill: { attempts: 0, correct: 0, timeMs: 0 },
      exam: { attempts: 0, correct: 0, timeMs: 0 },
    },
    recent: [],
  };

  const summary: SkillsSummary = {
    rows: [skillEighteenOfTwenty, skillOneOfOne, skillNoAnswers],
  };

  async function renderScreen(
    props: {
      summary?: SkillsSummary;
      loadDetail?: (code: string) => Promise<SkillDetail>;
      loadQuestion?: (id: string) => Promise<Question | null>;
    } = {},
  ) {
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <SkillsScreen
          summary={props.summary ?? summary}
          loadDetail={props.loadDetail ?? vi.fn().mockResolvedValue({ skillCode: 'CAS.A', sessions: [], misses: [] })}
          loadQuestion={props.loadQuestion ?? vi.fn().mockResolvedValue(null)}
        />,
      );
    });
  }

  it('sorts weakest-first so that 1-of-1 (bound ~0.5) sorts BEFORE 18-of-20 (bound ~0.78), with no-answers last', async () => {
    // Verify mathematical bounds first
    const bound1of1 = wilsonLowerBound(1, 1);
    const bound18of20 = wilsonLowerBound(18, 20);

    expect(bound1of1).toBeGreaterThan(0.35);
    expect(bound1of1).toBeLessThan(0.6);
    expect(bound18of20).toBeGreaterThan(0.7);
    expect(bound18of20).toBeLessThan(0.85);
    expect(bound1of1).toBeLessThan(bound18of20);

    await renderScreen();

    // Rows in table body
    const rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows.length).toBe(3);

    // Row 0 should be 1-of-1 (Words in Context)
    expect(rows[0]?.textContent).toContain('Words in Context');
    // Row 1 should be 18-of-20 (Text Structure and Purpose)
    expect(rows[1]?.textContent).toContain('Text Structure and Purpose');
    // Row 2 should be no answers (Linear Equations)
    expect(rows[2]?.textContent).toContain('Linear Equations');
  });

  it('filters rows by text matching skill name or domain', async () => {
    await renderScreen();

    const searchInput = container.querySelector<HTMLInputElement>('input[placeholder="Filter by skill or domain..."]');
    expect(searchInput).not.toBeNull();

    await act(async () => {
      if (searchInput) {
        simulateInput(searchInput, 'linear');
      }
    });

    const rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows.length).toBe(1);
    expect(rows[0]?.textContent).toContain('Linear Equations');
    expect(container.textContent).not.toContain('Words in Context');

    // Filter by domain
    await act(async () => {
      if (searchInput) {
        simulateInput(searchInput, 'craft and structure');
      }
    });

    const rowsDomain = Array.from(container.querySelectorAll('tbody tr'));
    expect(rowsDomain.length).toBe(2);
    expect(container.textContent).toContain('Words in Context');
    expect(container.textContent).toContain('Text Structure and Purpose');
    expect(container.textContent).not.toContain('Linear Equations');
  });

  it('filters rows when "Only skills with answers" is checked', async () => {
    await renderScreen();

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();

    await act(async () => {
      checkbox?.click();
    });

    const rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows.length).toBe(2);
    expect(container.textContent).not.toContain('Linear Equations');
  });

  it('sorts by other criteria (Name, Most answers, Most unseen)', async () => {
    await renderScreen();

    const sortSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Sort skills"]');
    expect(sortSelect).not.toBeNull();

    // Sort by name (alphabetical: Linear Equations, Text Structure and Purpose, Words in Context)
    await act(async () => {
      if (sortSelect) {
        sortSelect.value = 'name';
        sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    let rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows[0]?.textContent).toContain('Linear Equations');
    expect(rows[1]?.textContent).toContain('Text Structure and Purpose');
    expect(rows[2]?.textContent).toContain('Words in Context');

    // Sort by most answers (Text Structure: 20, Words in Context: 1, Linear Equations: 0)
    await act(async () => {
      if (sortSelect) {
        sortSelect.value = 'answers';
        sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows[0]?.textContent).toContain('Text Structure and Purpose');
    expect(rows[1]?.textContent).toContain('Words in Context');
    expect(rows[2]?.textContent).toContain('Linear Equations');

    // Sort by most unseen (Linear Equations: 50, Words in Context: 39, Text Structure: 20)
    await act(async () => {
      if (sortSelect) {
        sortSelect.value = 'unseen';
        sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows[0]?.textContent).toContain('Linear Equations');
    expect(rows[1]?.textContent).toContain('Words in Context');
    expect(rows[2]?.textContent).toContain('Text Structure and Purpose');
  });

  it('marks small answer samples with "low N" via describeRate', async () => {
    await renderScreen();

    // Words in Context has 1 of 1 attempt (< 10), so it should say "low N"
    expect(container.textContent).toContain('1 of 1 (100%), low N');

    // Text Structure has 10 of 10 in drill and 10 of 10 in exam (>= 10), so no "low N"
    expect(container.textContent).toContain('9 of 10 (90%)');
    expect(container.textContent).not.toContain('9 of 10 (90%), low N');
  });

  it('clicking a row calls loadDetail and shows sessions and missed questions that expand via loadQuestion', async () => {
    const mockDetail: SkillDetail = {
      skillCode: 'CAS.A',
      sessions: [
        {
          sessionId: 's-101',
          finishedAt: 1700000000000,
          mode: 'drill',
          kind: 'drill',
          attempts: 5,
          correct: 3,
          timeMs: 150000,
        },
      ],
      misses: [
        {
          questionId: 'q-synthetic-1',
          section: 'rw',
          domainCode: 'CAS',
          skillCode: 'CAS.A',
          difficulty: 'M',
          sessionId: 's-101',
          missedAt: 1700000001000,
          misses: 2,
          attempts: 3,
        },
      ],
    };

    const mockQuestion: Question = {
      id: 'q-synthetic-1',
      source: 'digital',
      displayId: 'syn001',
      section: 'rw',
      domainCode: 'CAS',
      domain: 'Craft and Structure',
      skillCode: 'CAS.A',
      skill: 'Words in Context',
      difficulty: 'M',
      scoreBand: 3,
      active: true,
      stimulusHtml: '<p>The ancient manuscript was remarkably legible.</p>',
      stemHtml: '<p>As used in the text, what does "legible" mean?</p>',
      answer: {
        kind: 'mcq',
        choices: ['fragile', 'readable', 'obscure', 'valuable'],
        correct: 'B',
        keyOrigin: 'structured',
      },
      rationaleHtml: '<p>Choice B is correct because legible means clear enough to read.</p>',
      updatedAt: 1700000000000,
    };

    const loadDetail = vi.fn().mockResolvedValue(mockDetail);
    const loadQuestion = vi.fn().mockResolvedValue(mockQuestion);

    await renderScreen({ loadDetail, loadQuestion });

    // Click the first row (Words in Context)
    const firstRowBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Words in Context'),
    );
    expect(firstRowBtn).toBeDefined();

    await act(async () => {
      firstRowBtn?.click();
    });

    expect(loadDetail).toHaveBeenCalledWith('CAS.A');

    // Detail panel should appear
    expect(container.textContent).toContain('Sessions');
    expect(container.textContent).toContain('Drill (Drill)');
    expect(container.textContent).toContain('3 of 5');

    expect(container.textContent).toContain('Missed questions');
    expect(container.textContent).toContain('Medium');
    expect(container.textContent).toContain('missed 2 of 3');

    // Click 'Show question'
    const showQuestionBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Show question'),
    );
    expect(showQuestionBtn).toBeDefined();

    await act(async () => {
      showQuestionBtn?.click();
    });

    expect(loadQuestion).toHaveBeenCalledWith('q-synthetic-1');

    // The question content, correct answer, and rationale should now be visible
    expect(container.textContent).toContain('The ancient manuscript was remarkably legible.');
    expect(container.textContent).toContain('As used in the text, what does "legible" mean?');
    expect(container.textContent).toContain('Correct answer: Choice B');
    expect(container.textContent).toContain('Choice B is correct because legible means clear enough to read.');

    // Test close button
    const closeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Close',
    );
    expect(closeBtn).toBeDefined();

    await act(async () => {
      closeBtn?.click();
    });

    expect(container.textContent).not.toContain('Sessions');
    expect(container.textContent).not.toContain('Missed questions');
  });

  it('shows "This question is no longer in the bank" when loadQuestion returns null', async () => {
    const mockDetail: SkillDetail = {
      skillCode: 'CAS.A',
      sessions: [],
      misses: [
        {
          questionId: 'q-deleted',
          section: 'rw',
          domainCode: 'CAS',
          skillCode: 'CAS.A',
          difficulty: 'H',
          sessionId: 's-old',
          missedAt: 1690000000000,
          misses: 1,
          attempts: 1,
        },
      ],
    };

    const loadDetail = vi.fn().mockResolvedValue(mockDetail);
    const loadQuestion = vi.fn().mockResolvedValue(null);

    await renderScreen({ loadDetail, loadQuestion });

    const rowBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Words in Context'),
    );
    await act(async () => {
      rowBtn?.click();
    });

    const showQuestionBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Show question'),
    );
    await act(async () => {
      showQuestionBtn?.click();
    });

    expect(container.textContent).toContain('This question is no longer in the bank.');
  });
});
