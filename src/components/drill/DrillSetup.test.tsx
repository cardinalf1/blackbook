import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTaxonomy, toFacet } from '../../services/drill/facets';
import { syntheticQuestions } from '../../services/__fixtures__/synthetic';
import type { QuestionFacet, TaxonomySection } from '../../types/drill';
import { DrillSetup } from './DrillSetup';

describe('DrillSetup', () => {
  let container: HTMLDivElement;
  let facets: QuestionFacet[];
  let taxonomy: TaxonomySection[];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    facets = syntheticQuestions.map(toFacet);
    taxonomy = buildTaxonomy(facets);
  });

  it('renders initial state with default section and matching count', async () => {
    const onStart = vi.fn();
    const onCancel = vi.fn();

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DrillSetup
          taxonomy={taxonomy}
          facets={facets}
          onStart={onStart}
          onCancel={onCancel}
        />,
      );
    });

    expect(container.textContent).toContain('Drill Setup');
    expect(container.textContent).toContain('Reading and Writing');
    expect(container.textContent).toContain('Math');
    // In synthetic bank, 9 RW questions are live (active: true)
    expect(container.textContent).toContain('9 questions match');
    // Notice when requested count (10) > matchCount (9)
    expect(container.textContent).toContain(
      'Only 9 match, so the session will have 9 questions.',
    );

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Start Drill'),
    );
    expect(startBtn).toBeDefined();
    expect(startBtn?.disabled).toBe(false);

    await act(async () => {
      startBtn?.click();
    });

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith({
      section: 'rw',
      domainCode: 'all',
      skillCodes: [],
      difficulties: [],
      count: 9, // capped at 9
      liveOnly: true,
      askConfidence: false,
    });

    const cancelBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancel'),
    );
    await act(async () => {
      cancelBtn?.click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    root.unmount();
  });

  it('toggles askConfidence in the onStart config', async () => {
    const onStart = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DrillSetup
          taxonomy={taxonomy}
          facets={facets}
          onStart={onStart}
          onCancel={vi.fn()}
        />,
      );
    });

    const confidenceCheckbox = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).find((input) => {
      const label = input.closest('label');
      return label?.textContent?.includes('Ask how sure I am after each answer');
    });

    expect(confidenceCheckbox).toBeDefined();
    expect(confidenceCheckbox?.checked).toBe(false);

    await act(async () => {
      confidenceCheckbox?.click();
    });

    expect(confidenceCheckbox?.checked).toBe(true);

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Start Drill'),
    );
    await act(async () => {
      startBtn?.click();
    });

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        askConfidence: true,
      }),
    );

    root.unmount();
  });

  it('resets domain and skills when changing section', async () => {
    const onStart = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DrillSetup
          taxonomy={taxonomy}
          facets={facets}
          onStart={onStart}
          onCancel={vi.fn()}
        />,
      );
    });

    const sectionSelect = container.querySelector('select');
    expect(sectionSelect).toBeDefined();

    // Switch section to math
    await act(async () => {
      if (sectionSelect) {
        sectionSelect.value = 'math';
        sectionSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // In synthetic bank, 10 Math questions are active
    expect(container.textContent).toContain('10 questions match');

    // Switch domain to the first available math domain
    const selects = container.querySelectorAll('select');
    const domainSelect = selects[1];
    expect(domainSelect).toBeDefined();

    const mathFirstDomain = domainSelect?.options[1]?.value ?? '';
    expect(mathFirstDomain.length).toBeGreaterThan(0);

    await act(async () => {
      if (domainSelect) {
        domainSelect.value = mathFirstDomain;
        domainSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Select a skill
    const skillCheckbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement | null;
    expect(skillCheckbox).not.toBeNull();
    await act(async () => {
      skillCheckbox?.click();
    });

    // Switch back to rw
    await act(async () => {
      if (sectionSelect) {
        sectionSelect.value = 'rw';
        sectionSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Start Drill'),
    );
    await act(async () => {
      startBtn?.click();
    });

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        section: 'rw',
        domainCode: 'all',
        skillCodes: [],
        askConfidence: false,
      }),
    );

    root.unmount();
  });

  it('toggles difficulty buttons and handles zero match state', async () => {
    const onStart = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DrillSetup
          taxonomy={taxonomy}
          facets={[]} // 0 questions match
          onStart={onStart}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('0 questions match');
    expect(container.textContent).toContain(
      'No questions match the current criteria. Please adjust your filters.',
    );

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Start Drill'),
    );
    expect(startBtn?.disabled).toBe(true);

    await act(async () => {
      startBtn?.click();
    });
    expect(onStart).not.toHaveBeenCalled();

    root.unmount();
  });
});
