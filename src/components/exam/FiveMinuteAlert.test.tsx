import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FiveMinuteAlert } from './FiveMinuteAlert';

describe('FiveMinuteAlert', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders alertdialog with proper role, headings and text', async () => {
    const onDismiss = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<FiveMinuteAlert onDismiss={onDismiss} />);
    });

    const dialog = container.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(container.textContent).toContain('5 minutes left');
    expect(container.textContent).toContain(
      'You have 5 minutes left in this module. The timer is shown again.',
    );

    const okButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'OK',
    );
    expect(okButton).toBeDefined();
    expect(document.activeElement).toBe(okButton);

    await act(async () => {
      okButton?.click();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);

    root.unmount();
  });

  it('calls onDismiss when Escape key is pressed', async () => {
    const onDismiss = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<FiveMinuteAlert onDismiss={onDismiss} />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);

    root.unmount();
  });
});
