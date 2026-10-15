import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SprInput } from './SprInput';

describe('SprInput', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
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

  function simulateInput(input: HTMLInputElement, value: string) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('rejects "12a" and does not call onChange when value is "12"', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root?.render(<SprInput value="12" onChange={onChange} questionNumber={7} />);
    });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('12');

    await act(async () => {
      simulateInput(input, '12a');
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('12');
  });

  it('accepts "-12345" and calls onChange', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root?.render(<SprInput value="" onChange={onChange} questionNumber={7} />);
    });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();

    await act(async () => {
      simulateInput(input, '-12345');
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('-12345');
  });

  it('rejects "123456" and does not call onChange', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root?.render(<SprInput value="" onChange={onChange} questionNumber={7} />);
    });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();

    await act(async () => {
      simulateInput(input, '123456');
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('renders label, raw text preview, and hint', async () => {
    await act(async () => {
      root?.render(<SprInput value="3/4" onChange={vi.fn()} questionNumber={12} />);
    });

    expect(container.textContent).toContain('Answer for question 12');
    expect(container.textContent).toContain('Answer preview: 3/4');
    expect(container.textContent).toContain(
      'Up to 5 characters, or 6 with a minus sign. Use digits, . / and -.',
    );
  });
});
