import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ANALYTICS_FILTER, type AnalyticsFilter } from '../../types/analytics';
import { FilterBar } from './FilterBar';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('FilterBar', () => {
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

  async function renderComponent(props: {
    filter: AnalyticsFilter;
    onChange: (f: AnalyticsFilter) => void;
    showSection?: boolean;
  }) {
    root = createRoot(container);
    await act(async () => {
      root?.render(<FilterBar {...props} />);
    });
  }

  function simulateInput(input: HTMLInputElement, value: string) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('renders all controls with visible labels by default', async () => {
    const onChange = vi.fn();
    await renderComponent({
      filter: DEFAULT_ANALYTICS_FILTER,
      onChange,
    });

    expect(container.textContent).toContain('From');
    expect(container.textContent).toContain('To');
    expect(container.textContent).toContain('Kind');
    expect(container.textContent).toContain('Section');
    expect(container.textContent).toContain('Exclude paused tests');
    expect(container.textContent).toContain('Exclude single-question sessions');
  });

  it('hides the section select when showSection is false', async () => {
    await renderComponent({
      filter: DEFAULT_ANALYTICS_FILTER,
      onChange: vi.fn(),
      showSection: false,
    });

    expect(container.querySelector('select[aria-label="Section"]')).toBeNull();
    const hasSectionLabel = Array.from(container.querySelectorAll('label')).some(
      (l) => l.textContent?.trim() === 'Section',
    );
    expect(hasSectionLabel).toBe(false);
  });

  it('emits a complete filter with start of local day for from date', async () => {
    const onChange = vi.fn();
    await renderComponent({
      filter: DEFAULT_ANALYTICS_FILTER,
      onChange,
    });

    const fromInput = container.querySelector<HTMLInputElement>('input[aria-label="From date"]');
    expect(fromInput).not.toBeNull();

    await act(async () => {
      if (fromInput) {
        simulateInput(fromInput, '2026-10-15');
      }
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const calls = onChange.mock.calls as [AnalyticsFilter][];
    const emitted = calls[0]?.[0];
    const expectedMs = new Date(2026, 9, 15, 0, 0, 0, 0).getTime();
    expect(emitted).toEqual({
      ...DEFAULT_ANALYTICS_FILTER,
      from: expectedMs,
    });
  });

  it('emits from: null when from date is cleared', async () => {
    const onChange = vi.fn();
    const initialMs = new Date(2026, 9, 15, 0, 0, 0, 0).getTime();
    await renderComponent({
      filter: { ...DEFAULT_ANALYTICS_FILTER, from: initialMs },
      onChange,
    });

    const fromInput = container.querySelector<HTMLInputElement>('input[aria-label="From date"]');
    await act(async () => {
      if (fromInput) {
        simulateInput(fromInput, '');
      }
    });

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_ANALYTICS_FILTER,
      from: null,
    });
  });

  it('emits a complete filter with end of local day for to date', async () => {
    const onChange = vi.fn();
    await renderComponent({
      filter: DEFAULT_ANALYTICS_FILTER,
      onChange,
    });

    const toInput = container.querySelector<HTMLInputElement>('input[aria-label="To date"]');
    expect(toInput).not.toBeNull();

    await act(async () => {
      if (toInput) {
        simulateInput(toInput, '2026-10-20');
      }
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const calls = onChange.mock.calls as [AnalyticsFilter][];
    const emitted = calls[0]?.[0];
    const expectedMs = new Date(2026, 9, 20, 23, 59, 59, 999).getTime();
    expect(emitted).toEqual({
      ...DEFAULT_ANALYTICS_FILTER,
      to: expectedMs,
    });
  });

  it('emits a complete filter when kind is selected', async () => {
    const onChange = vi.fn();
    await renderComponent({
      filter: DEFAULT_ANALYTICS_FILTER,
      onChange,
    });

    const kindSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Session kind"]');
    expect(kindSelect).not.toBeNull();

    await act(async () => {
      if (kindSelect) {
        kindSelect.value = 'drill';
        kindSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_ANALYTICS_FILTER,
      kind: 'drill',
    });
  });

  it('emits a complete filter when section is selected or cleared to all', async () => {
    const onChange = vi.fn();
    await renderComponent({
      filter: DEFAULT_ANALYTICS_FILTER,
      onChange,
    });

    const sectionSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Section"]');
    expect(sectionSelect).not.toBeNull();

    await act(async () => {
      if (sectionSelect) {
        sectionSelect.value = 'rw';
        sectionSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_ANALYTICS_FILTER,
      section: 'rw',
    });

    await act(async () => {
      if (sectionSelect) {
        sectionSelect.value = 'all';
        sectionSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_ANALYTICS_FILTER,
      section: null,
    });
  });

  it('emits complete filters when checkboxes are toggled', async () => {
    const onChange = vi.fn();
    await renderComponent({
      filter: DEFAULT_ANALYTICS_FILTER,
      onChange,
    });

    const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const pausedCheckbox = checkboxes[0];
    const singleCheckbox = checkboxes[1];

    await act(async () => {
      pausedCheckbox?.click();
    });

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_ANALYTICS_FILTER,
      excludePaused: true,
    });

    await act(async () => {
      singleCheckbox?.click();
    });

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_ANALYTICS_FILTER,
      excludeSingle: true,
    });
  });
});
