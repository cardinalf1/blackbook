import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardScope, ResolvedScope } from '../../types/dashboard';
import { ScopeBar } from './ScopeBar';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ScopeBar', () => {
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

  const baseScope: DashboardScope = {
    preset: 'auto',
    section: 'both',
    from: null,
    to: null,
    kind: 'all',
    excludePaused: false,
    excludeSingle: false,
    includeHidden: false,
  };

  const baseResolved: ResolvedScope = {
    preset: '30d',
    filter: {
      from: null,
      to: null,
      kind: 'all',
      section: null,
      excludePaused: false,
      excludeSingle: false,
      includeHidden: false,
    },
    previous: null,
    label: 'Last 30 days',
    dataDays: 30,
  };

  async function renderComponent(props: {
    scope: DashboardScope;
    resolved: ResolvedScope;
    onChange: (s: DashboardScope) => void;
  }) {
    if (!root) {
      root = createRoot(container);
    }
    await act(async () => {
      root?.render(<ScopeBar {...props} />);
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

  it('renders presets and highlights resolved.preset when scope.preset is auto', async () => {
    await renderComponent({
      scope: baseScope,
      resolved: baseResolved,
      onChange: vi.fn(),
    });

    const preset30d = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '30 days',
    );
    expect(preset30d?.getAttribute('aria-pressed')).toBe('true');

    const preset7d = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '7 days',
    );
    expect(preset7d?.getAttribute('aria-pressed')).toBe('false');

    expect(container.textContent).toContain('Last 30 days');
  });

  it('preset click calls onChange with preset and cleared dates', async () => {
    const onChange = vi.fn();
    await renderComponent({
      scope: { ...baseScope, preset: '30d', from: 1728000000000, to: 1729000000000 },
      resolved: { ...baseResolved, preset: 'custom' },
      onChange,
    });

    const preset7d = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '7 days',
    );
    expect(preset7d).toBeDefined();

    await act(async () => {
      preset7d?.click();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      ...baseScope,
      preset: '7d',
      from: null,
      to: null,
    });
  });

  it('section toggle calls onChange with chosen section', async () => {
    const onChange = vi.fn();
    await renderComponent({
      scope: baseScope,
      resolved: baseResolved,
      onChange,
    });

    const mathButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Math',
    );
    expect(mathButton).toBeDefined();

    await act(async () => {
      mathButton?.click();
    });

    expect(onChange).toHaveBeenCalledWith({
      ...baseScope,
      section: 'math',
    });
  });

  it('date input sets from epoch ms at local midnight', async () => {
    const onChange = vi.fn();
    await renderComponent({
      scope: baseScope,
      resolved: baseResolved,
      onChange,
    });

    // Open More filters disclosure
    const moreFiltersButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'More filters',
    );
    await act(async () => {
      moreFiltersButton?.click();
    });

    const fromInput = container.querySelector<HTMLInputElement>('input[aria-label="From date"]');
    expect(fromInput).not.toBeNull();

    await act(async () => {
      if (fromInput) {
        simulateInput(fromInput, '2026-10-15');
      }
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const expectedFromMs = new Date(2026, 9, 15, 0, 0, 0, 0).getTime();
    expect(onChange).toHaveBeenCalledWith({
      ...baseScope,
      from: expectedFromMs,
    });
  });

  it('to date input sets end of day epoch ms and session kind changes kind', async () => {
    const onChange = vi.fn();
    await renderComponent({
      scope: baseScope,
      resolved: baseResolved,
      onChange,
    });

    // Open More filters disclosure
    const moreFiltersButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'More filters',
    );
    await act(async () => {
      moreFiltersButton?.click();
    });

    const toInput = container.querySelector<HTMLInputElement>('input[aria-label="To date"]');
    await act(async () => {
      if (toInput) {
        simulateInput(toInput, '2026-10-20');
      }
    });

    const expectedToMs = new Date(2026, 9, 20, 23, 59, 59, 999).getTime();
    expect(onChange).toHaveBeenCalledWith({
      ...baseScope,
      to: expectedToMs,
    });

    const kindSelect = container.querySelector<HTMLSelectElement>('select[aria-label="Session kind"]');
    await act(async () => {
      if (kindSelect) {
        kindSelect.value = 'drill';
        kindSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(onChange).toHaveBeenCalledWith({
      ...baseScope,
      kind: 'drill',
    });
  });

  it('toggles checkboxes for paused, single and hidden sessions', async () => {
    const onChange = vi.fn();
    await renderComponent({
      scope: baseScope,
      resolved: baseResolved,
      onChange,
    });

    const moreFiltersButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'More filters',
    );
    await act(async () => {
      moreFiltersButton?.click();
    });

    const pausedBox = container.querySelector<HTMLInputElement>(
      'input[aria-label="Exclude paused tests"]',
    );
    const singleBox = container.querySelector<HTMLInputElement>(
      'input[aria-label="Exclude single-question sessions"]',
    );
    const hiddenBox = container.querySelector<HTMLInputElement>(
      'input[aria-label="Show hidden sessions"]',
    );

    await act(async () => {
      pausedBox?.click();
    });
    expect(onChange).toHaveBeenCalledWith({
      ...baseScope,
      excludePaused: true,
    });

    await act(async () => {
      singleBox?.click();
    });
    expect(onChange).toHaveBeenCalledWith({
      ...baseScope,
      excludeSingle: true,
    });

    await act(async () => {
      hiddenBox?.click();
    });
    expect(onChange).toHaveBeenCalledWith({
      ...baseScope,
      includeHidden: true,
    });
  });
});
