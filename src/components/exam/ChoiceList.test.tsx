import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChoiceList, type ChoiceListProps } from './ChoiceList';

describe('ChoiceList', () => {
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

  const defaultProps: ChoiceListProps = {
    choices: ['<p>Choice 1</p>', '<p>Choice 2</p>', '<p>Choice 3</p>', '<p>Choice 4</p>'],
    response: null,
    onSelect: vi.fn(),
    struck: [],
    onStrike: vi.fn(),
    eliminatorOn: false,
  };

  it('renders no strike buttons when eliminatorOn=false', async () => {
    await act(async () => {
      root?.render(<ChoiceList {...defaultProps} eliminatorOn={false} />);
    });

    const strikeButtons = container.querySelectorAll('button[aria-label*="choice"]');
    expect(strikeButtons.length).toBe(0);

    const buttons = container.querySelectorAll('button');
    // Only the 4 choice selection buttons
    expect(buttons.length).toBe(4);
  });

  it('renders strike buttons showing the letter with a line through it when eliminatorOn=true', async () => {
    const onStrike = vi.fn();
    await act(async () => {
      root?.render(<ChoiceList {...defaultProps} eliminatorOn={true} onStrike={onStrike} />);
    });

    const strikeButtons = container.querySelectorAll<HTMLButtonElement>('button[aria-label*="choice"]');
    expect(strikeButtons.length).toBe(4);
    expect(strikeButtons[0]?.getAttribute('aria-label')).toBe('Strike out choice A');
    expect(strikeButtons[0]?.querySelector('.line-through')?.textContent).toBe('A');

    await act(async () => {
      strikeButtons[0]?.click();
    });

    expect(onStrike).toHaveBeenCalledWith('A');
  });

  it('struck choices still render struck and disabled when eliminatorOn=false', async () => {
    await act(async () => {
      root?.render(
        <ChoiceList
          {...defaultProps}
          struck={['B']}
          eliminatorOn={false}
        />,
      );
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>('button');
    expect(buttons.length).toBe(4);
    // Button for B is disabled
    expect(buttons[1]?.disabled).toBe(true);
    expect(buttons[1]?.className).toContain('cursor-not-allowed');
  });
});
