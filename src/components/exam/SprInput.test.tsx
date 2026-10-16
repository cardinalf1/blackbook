import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SprInput } from './SprInput';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

  it('typing "0.6667" key by key leaves "0.666"', async () => {
    function Controlled() {
      const [value, setValue] = useState('');
      return <SprInput value={value} onChange={setValue} questionNumber={1} />;
    }

    await act(async () => {
      root?.render(<Controlled />);
    });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();

    // Type "0", "0.", "0.6", "0.66", "0.666", "0.6667"
    const sequence = ['0', '0.', '0.6', '0.66', '0.666', '0.6667'];
    for (const step of sequence) {
      await act(async () => {
        simulateInput(input, step);
      });
    }

    expect(input.value).toBe('0.666');
  });

  it('"-1/3" shows a stacked fraction with numerator 1 and denominator 3', async () => {
    await act(async () => {
      root?.render(<SprInput value="-1/3" onChange={vi.fn()} questionNumber={5} />);
    });

    const fraction = container.querySelector('[data-testid="spr-fraction"]');
    expect(fraction).not.toBeNull();

    const sign = container.querySelector('[data-slot="sign"]');
    expect(sign?.textContent).toBe('-');

    const numerator = container.querySelector('[data-slot="numerator"]');
    expect(numerator?.textContent?.trim()).toBe('1');

    const denominator = container.querySelector('[data-slot="denominator"]');
    expect(denominator?.textContent?.trim()).toBe('3');
  });

  it('empty shows no preview content', async () => {
    await act(async () => {
      root?.render(<SprInput value="" onChange={vi.fn()} questionNumber={2} />);
    });

    const previewContainer = container.querySelector('.flex.items-center.gap-2');
    expect(previewContainer).not.toBeNull();
    // Only "Answer Preview:" text should be present, nothing following it
    expect(previewContainer?.textContent?.trim()).toBe('Answer Preview:');
    expect(container.querySelector('[data-testid="spr-fraction"]')).toBeNull();
  });

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
});
