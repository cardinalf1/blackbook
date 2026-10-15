import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyFilters } from '../services/browse/filter';
import {
  DEFAULT_BROWSE_FILTERS,
  type BrowseFilters,
  type BrowseRow,
  type BrowseViewState,
} from '../types/browse';
import { QuestionBrowser } from './QuestionBrowser';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createSyntheticRows(count = 30): BrowseRow[] {
  const rows: BrowseRow[] = [];
  const statuses = ['unseen', 'seen', 'done'] as const;
  const difficulties = ['E', 'M', 'H'] as const;

  for (let i = 0; i < count; i++) {
    const isRw = i % 2 === 0;
    const section = isRw ? 'rw' : 'math';
    const domainCode = isRw ? (i % 4 < 2 ? 'rw_d1' : 'rw_d2') : (i % 4 < 2 ? 'm_d1' : 'm_d2');
    const domain = isRw
      ? domainCode === 'rw_d1'
        ? 'RW Domain 1'
        : 'RW Domain 2'
      : domainCode === 'm_d1'
        ? 'Math Domain 1'
        : 'Math Domain 2';
    const skillCode = isRw
      ? domainCode === 'rw_d1'
        ? i % 2 === 0
          ? 'rw_s1'
          : 'rw_s2'
        : 'rw_s3'
      : domainCode === 'm_d1'
        ? i % 2 === 0
          ? 'm_s1'
          : 'm_s2'
        : 'm_s3';
    const skill = `Skill ${skillCode}`;
    const status = statuses[i % 3] as BrowseRow['status'];
    const difficulty = difficulties[i % 3] as BrowseRow['difficulty'];
    const format = i % 5 === 0 ? 'spr' : 'mcq';
    const source = i % 7 === 0 ? 'legacy' : 'digital';
    const active = i % 4 !== 0;
    const attempts = status === 'done' ? 1 + (i % 3) : 0;
    const lastResult =
      status === 'done'
        ? i % 2 === 0
          ? 'correct'
          : 'incorrect'
        : null;
    const flagged = i % 6 === 0;

    rows.push({
      id: `syn-${i + 1}`,
      displayId: `00${i + 1}`.slice(-3),
      section,
      domainCode,
      domain,
      skillCode,
      skill,
      difficulty,
      format,
      source,
      active,
      status,
      examShown: false,
      attempts,
      lastResult,
      flagged,
    });
  }
  return rows;
}

function getSelectByLabel(container: HTMLElement, labelText: string): HTMLSelectElement {
  const labels = Array.from(container.querySelectorAll('label'));
  const targetLabel = labels.find((l) => {
    const span = l.querySelector('span');
    return span?.textContent?.trim() === labelText;
  });
  if (!targetLabel) throw new Error(`Label with text "${labelText}" not found`);
  const select = targetLabel.querySelector('select');
  if (!select) throw new Error(`Select within label "${labelText}" not found`);
  return select;
}

describe('QuestionBrowser', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  const rows = createSyntheticRows(30);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
  });

  async function renderBrowser(
    customState?: Partial<BrowseViewState>,
    customRows: BrowseRow[] = rows,
    props?: {
      onStateChange?: (next: BrowseViewState) => void;
      onOpen?: (questionId: string) => void;
      onRandom?: () => void;
    },
  ) {
    const state: BrowseViewState = {
      filters: DEFAULT_BROWSE_FILTERS,
      page: 0,
      ...customState,
    };
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <QuestionBrowser
          rows={customRows}
          state={state}
          onStateChange={props?.onStateChange ?? vi.fn()}
          onOpen={props?.onOpen ?? vi.fn()}
          onRandom={props?.onRandom ?? vi.fn()}
        />,
      );
    });
  }

  it('renders header count matching filtered rows and total rows', async () => {
    await renderBrowser();
    expect(container.textContent).toContain('30 of 30 questions');

    // Re-render with a filter applied
    if (root) {
      await act(async () => {
        root?.render(
          <QuestionBrowser
            rows={rows}
            state={{ filters: { ...DEFAULT_BROWSE_FILTERS, status: 'done' }, page: 0 }}
            onStateChange={vi.fn()}
            onOpen={vi.fn()}
            onRandom={vi.fn()}
          />,
        );
      });
    }
    const doneRows = rows.filter((r) => r.status === 'done');
    expect(container.textContent).toContain(`${doneRows.length} of 30 questions`);
  });

  it('selecting Status=Done calls onStateChange with status "done" and page 0', async () => {
    const onStateChange = vi.fn();
    await renderBrowser({ page: 2 }, rows, { onStateChange });

    const statusSelect = getSelectByLabel(container, 'Status');
    await act(async () => {
      statusSelect.value = 'done';
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith({
      filters: {
        ...DEFAULT_BROWSE_FILTERS,
        status: 'done',
      },
      page: 0,
    });
  });

  it('option text includes counts that equal applyFilters lengths for that option', async () => {
    const filters: BrowseFilters = { ...DEFAULT_BROWSE_FILTERS, section: 'rw' };
    await renderBrowser({ filters });

    // Check difficulty options
    const difficultySelect = getSelectByLabel(container, 'Difficulty');
    const diffOptions = Array.from(difficultySelect.options);

    const easyOpt = diffOptions.find((o) => o.value === 'E');
    const easyCount = applyFilters(rows, { ...filters, difficulty: 'E' }).length;
    expect(easyOpt?.text).toBe(`Easy (${easyCount})`);

    const medOpt = diffOptions.find((o) => o.value === 'M');
    const medCount = applyFilters(rows, { ...filters, difficulty: 'M' }).length;
    expect(medOpt?.text).toBe(`Medium (${medCount})`);

    const hardOpt = diffOptions.find((o) => o.value === 'H');
    const hardCount = applyFilters(rows, { ...filters, difficulty: 'H' }).length;
    expect(hardOpt?.text).toBe(`Hard (${hardCount})`);

    // Check status options
    const statusSelect = getSelectByLabel(container, 'Status');
    const statusOptions = Array.from(statusSelect.options);

    const doneOpt = statusOptions.find((o) => o.value === 'done');
    const doneCount = applyFilters(rows, { ...filters, status: 'done' }).length;
    expect(doneOpt?.text).toBe(`Done (${doneCount})`);

    const unseenOpt = statusOptions.find((o) => o.value === 'unseen');
    const unseenCount = applyFilters(rows, { ...filters, status: 'unseen' }).length;
    expect(unseenOpt?.text).toBe(`Unseen (${unseenCount})`);
  });

  it('changing section resets domain and skill', async () => {
    const onStateChange = vi.fn();
    await renderBrowser(
      {
        filters: {
          ...DEFAULT_BROWSE_FILTERS,
          section: 'rw',
          domainCode: 'rw_d1',
          skillCode: 'rw_s1',
        },
        page: 3,
      },
      rows,
      { onStateChange },
    );

    const sectionSelect = getSelectByLabel(container, 'Section');
    await act(async () => {
      sectionSelect.value = 'math';
      sectionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith({
      filters: {
        ...DEFAULT_BROWSE_FILTERS,
        section: 'math',
        domainCode: 'all',
        skillCode: 'all',
      },
      page: 0,
    });
  });

  it('status badges show Unseen/Seen/Done text', async () => {
    await renderBrowser();

    const table = container.querySelector('table');
    expect(table).not.toBeNull();

    // Verify badges text
    const unseenBadges = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent?.trim() === 'Unseen',
    );
    const seenBadges = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent?.trim() === 'Seen',
    );
    const doneBadges = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent?.trim() === 'Done',
    );

    expect(unseenBadges.length).toBeGreaterThan(0);
    expect(seenBadges.length).toBeGreaterThan(0);
    expect(doneBadges.length).toBeGreaterThan(0);
  });

  it('a row with lastResult null shows "—" and no "Correct"/"Incorrect"', async () => {
    const testRows: BrowseRow[] = [
      {
        id: 'q-no-result',
        displayId: '999',
        section: 'rw',
        domainCode: 'd1',
        domain: 'Domain 1',
        skillCode: 's1',
        skill: 'Skill 1',
        difficulty: 'M',
        format: 'mcq',
        source: 'digital',
        active: true,
        status: 'unseen',
        examShown: false,
        attempts: 0,
        lastResult: null,
        flagged: false,
      },
    ];

    await renderBrowser({}, testRows);

    const tbody = container.querySelector('tbody');
    const tr = tbody?.querySelector('tr');
    expect(tr).not.toBeNull();

    const cells = Array.from(tr?.querySelectorAll('td') ?? []);
    // Last result is column index 7 (0: ID, 1: Domain, 2: Skill, 3: Difficulty, 4: Format, 5: Status, 6: Attempts, 7: Last result, 8: Practice)
    const lastResultCell = cells[7];
    expect(lastResultCell).toBeDefined();
    expect(lastResultCell?.textContent?.trim()).toBe('—');
    expect(lastResultCell?.textContent).not.toContain('Correct');
    expect(lastResultCell?.textContent).not.toContain('Incorrect');
  });

  it('clicking a row calls onOpen once with its id, and clicking its Practice button also calls onOpen exactly once', async () => {
    const onOpen = vi.fn();
    await renderBrowser({}, rows, { onOpen });

    const tbody = container.querySelector('tbody');
    const firstRow = tbody?.querySelector('tr');
    expect(firstRow).not.toBeNull();

    // 1. Click the row
    await act(async () => {
      firstRow?.click();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(rows[0]?.id);

    onOpen.mockClear();

    // 2. Click the Practice button
    const practiceBtn = firstRow?.querySelector('button');
    expect(practiceBtn).not.toBeNull();
    expect(practiceBtn?.getAttribute('aria-label')).toBe(`Practice question ${rows[0]?.displayId}`);

    await act(async () => {
      practiceBtn?.click();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(rows[0]?.id);
  });

  it('Random calls onRandom and is disabled when nothing matches', async () => {
    const onRandom = vi.fn();
    await renderBrowser({}, rows, { onRandom });

    const randomBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Random question'),
    );
    expect(randomBtn).toBeDefined();
    expect(randomBtn?.disabled).toBe(false);

    await act(async () => {
      randomBtn?.click();
    });
    expect(onRandom).toHaveBeenCalledTimes(1);

    // Empty list -> disabled
    if (root) {
      await act(async () => {
        root?.render(
          <QuestionBrowser
            rows={[]}
            state={{ filters: DEFAULT_BROWSE_FILTERS, page: 0 }}
            onStateChange={vi.fn()}
            onOpen={vi.fn()}
            onRandom={vi.fn()}
          />,
        );
      });
    }

    const disabledRandomBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Random question'),
    );
    expect(disabledRandomBtn?.disabled).toBe(true);
  });

  it('pagination Next calls onStateChange with page 1', async () => {
    const onStateChange = vi.fn();
    const sixtyRows = createSyntheticRows(60);

    await renderBrowser({ page: 0 }, sixtyRows, { onStateChange });

    expect(container.textContent).toContain('Page 1 of 2');

    const nextBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Next',
    );
    expect(nextBtn).toBeDefined();
    expect(nextBtn?.disabled).toBe(false);

    await act(async () => {
      nextBtn?.click();
    });

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith({
      filters: DEFAULT_BROWSE_FILTERS,
      page: 1,
    });
  });

  it('displays empty state text when nothing matches', async () => {
    await renderBrowser({}, []);

    expect(container.textContent).toContain('No questions match these filters.');
  });

  it('shows Reset filters button only when filters are active, and clicking it resets filters and page to 0', async () => {
    const onStateChange = vi.fn();
    await renderBrowser({ filters: DEFAULT_BROWSE_FILTERS, page: 0 }, rows, { onStateChange });

    let resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset filters'),
    );
    expect(resetBtn).toBeUndefined();

    // Re-render with active filters
    if (root) {
      await act(async () => {
        root?.render(
          <QuestionBrowser
            rows={rows}
            state={{
              filters: { ...DEFAULT_BROWSE_FILTERS, difficulty: 'H' },
              page: 2,
            }}
            onStateChange={onStateChange}
            onOpen={vi.fn()}
            onRandom={vi.fn()}
          />,
        );
      });
    }

    resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset filters'),
    );
    expect(resetBtn).toBeDefined();

    await act(async () => {
      resetBtn?.click();
    });

    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith({
      filters: DEFAULT_BROWSE_FILTERS,
      page: 0,
    });
  });
});
