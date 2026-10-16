import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionBar } from './QuestionBar';

describe('QuestionBar', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  it('renders question number and bookmark toggle', async () => {
    const onToggleFlag = vi.fn();
    await act(async () => {
      root?.render(
        <QuestionBar
          number={4}
          flagged={false}
          onToggleFlag={onToggleFlag}
        />,
      );
    });

    expect(container.textContent).toContain('4');
    expect(container.textContent).toContain('Mark for Review');

    const flagBtn = container.querySelector('button[aria-pressed="false"]') as HTMLButtonElement | null;
    expect(flagBtn).not.toBeNull();

    await act(async () => {
      flagBtn?.click();
    });

    expect(onToggleFlag).toHaveBeenCalledTimes(1);
  });

  it('renders flagged state with aria-pressed="true"', async () => {
    await act(async () => {
      root?.render(
        <QuestionBar
          number={4}
          flagged={true}
          onToggleFlag={vi.fn()}
        />,
      );
    });

    const flagBtn = container.querySelector('button[aria-pressed="true"]');
    expect(flagBtn).not.toBeNull();
    expect(container.textContent).toContain('Marked for Review');
  });

  it('no eliminator toggle when prop absent', async () => {
    await act(async () => {
      root?.render(
        <QuestionBar
          number={4}
          flagged={false}
          onToggleFlag={vi.fn()}
        />,
      );
    });

    const eliminatorBtn = container.querySelector('button[aria-label="Cross out answer choices"]');
    expect(eliminatorBtn).toBeNull();
  });

  it('renders eliminator toggle when prop is present and responds to clicks', async () => {
    const onToggle = vi.fn();
    await act(async () => {
      root?.render(
        <QuestionBar
          number={4}
          flagged={false}
          onToggleFlag={vi.fn()}
          eliminator={{ on: true, onToggle }}
        />,
      );
    });

    const eliminatorBtn = container.querySelector('button[aria-label="Cross out answer choices"]') as HTMLButtonElement | null;
    expect(eliminatorBtn).not.toBeNull();
    expect(eliminatorBtn?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      eliminatorBtn?.click();
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
