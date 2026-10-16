import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalculatorKeyStore } from '../../types/calculator';

vi.mock('../../services/storage', () => ({ calculatorKeyStore: { status: async () => ({ hasKey: false }) } }));
const { DesmosKeySection } = await import('./DesmosKeySection');

// Synthetic, key-shaped only at run time (see src/services/secrets.test.ts).
const KEY = 'cd34'.repeat(8);

function fakeStore(): CalculatorKeyStore & { saved: string | null } {
  const s = {
    saved: null as string | null,
    status: async () => ({ hasKey: s.saved !== null }),
    setKey: async (k: string) => {
      s.saved = k;
      return { hasKey: true };
    },
    removeKey: async () => {
      s.saved = null;
      return { hasKey: false };
    },
    test: async () => ({ ok: true, message: 'Desmos recognizes this key.' }),
  };
  return s;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const button = (name: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === name) as HTMLButtonElement;

describe('Desmos key in Settings', () => {
  it('saves, tests and removes the key without ever showing it', async () => {
    const store = fakeStore();
    await act(async () => root.render(<DesmosKeySection store={store} />));
    expect(container.textContent).toContain('No key saved');
    expect(button('Test').disabled).toBe(true);

    const input = container.querySelector('input[aria-label="Desmos API key"]') as HTMLInputElement;
    expect(input.type).toBe('password');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      set?.call(input, KEY);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => button('Save key').click());
    expect(store.saved).toBe(KEY);
    expect(input.value).toBe('');
    expect(container.textContent).toContain('A key is saved');
    expect(container.innerHTML).not.toContain(KEY);

    await act(async () => button('Test').click());
    expect(container.textContent).toContain('Desmos recognizes this key.');

    await act(async () => button('Remove key').click());
    await act(async () => button('Confirm remove').click());
    expect(store.saved).toBeNull();
    expect(container.textContent).toContain('No key saved');
  });
});
