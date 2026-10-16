import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { DateField } from './DateField';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('DateField', () => {
  const render = (value: string) => {
    const c = document.createElement('div');
    act(() => createRoot(c).render(<DateField label="From" value={value} onChange={vi.fn()} />));
    return c.querySelector('input') as HTMLInputElement;
  };
  it('shows a plain placeholder instead of the browser date mask when empty', () => {
    const input = render('');
    expect(input.type).toBe('text');
    expect(input.placeholder).toBe('Any date');
  });
  it('is a date input once it has a value', () => {
    expect(render('2026-10-01').type).toBe('date');
  });
});
