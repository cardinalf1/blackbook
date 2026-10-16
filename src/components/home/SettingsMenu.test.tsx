import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_MENU } from '../../services/home/routes';
import { SettingsMenu } from './SettingsMenu';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SettingsMenu', () => {
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

  it('renders trigger button and starts closed', async () => {
    const onNavigate = vi.fn();
    await act(async () => {
      root?.render(<SettingsMenu items={SETTINGS_MENU} onNavigate={onNavigate} />);
    });

    const button = container.querySelector('button[aria-label="Settings"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toContain('Settings');
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    const menu = container.querySelector('[role="menu"]');
    expect(menu).toBeNull();
  });

  it('opens menu on click and lists the 3 items with hints', async () => {
    const onNavigate = vi.fn();
    await act(async () => {
      root?.render(<SettingsMenu items={SETTINGS_MENU} onNavigate={onNavigate} />);
    });

    const button = container.querySelector('button[aria-label="Settings"]') as HTMLButtonElement;
    await act(async () => {
      button.click();
    });

    expect(button.getAttribute('aria-expanded')).toBe('true');
    const menu = container.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();

    const items = container.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBe(3);

    expect(items[0]?.textContent).toContain('Settings');
    expect(items[0]?.textContent).toContain('Groq key, AI and the Desmos calculator key');
    expect(items[1]?.textContent).toContain('Your data');
    expect(items[1]?.textContent).toContain('Backup, export, restore');
    expect(items[2]?.textContent).toContain('Question bank');
    expect(items[2]?.textContent).toContain('Refresh, import from file');
  });

  it('closes on Escape key press and restores focus', async () => {
    const onNavigate = vi.fn();
    await act(async () => {
      root?.render(<SettingsMenu items={SETTINGS_MENU} onNavigate={onNavigate} />);
    });

    const button = container.querySelector('button[aria-label="Settings"]') as HTMLButtonElement;
    await act(async () => {
      button.click();
    });
    expect(container.querySelector('[role="menu"]')).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('closes on click outside', async () => {
    const onNavigate = vi.fn();
    await act(async () => {
      root?.render(<SettingsMenu items={SETTINGS_MENU} onNavigate={onNavigate} />);
    });

    const button = container.querySelector('button[aria-label="Settings"]') as HTMLButtonElement;
    await act(async () => {
      button.click();
    });
    expect(container.querySelector('[role="menu"]')).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });

    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('calls onNavigate and closes menu when an item is clicked', async () => {
    const onNavigate = vi.fn();
    await act(async () => {
      root?.render(<SettingsMenu items={SETTINGS_MENU} onNavigate={onNavigate} />);
    });

    const button = container.querySelector('button[aria-label="Settings"]') as HTMLButtonElement;
    await act(async () => {
      button.click();
    });

    const items = container.querySelectorAll('[role="menuitem"]');
    const bankItem = Array.from(items).find((el) => el.textContent?.includes('Question bank')) as HTMLButtonElement;
    expect(bankItem).toBeDefined();

    await act(async () => {
      bankItem.click();
    });

    expect(onNavigate).toHaveBeenCalledWith('bank');
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });
});
