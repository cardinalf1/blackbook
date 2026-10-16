import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HighlightToolbar } from './HighlightToolbar';

describe('HighlightToolbar', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('clicking each swatch calls onStyle with yellow, blue, pink, and underline', async () => {
    const onStyle = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <HighlightToolbar
          anchor={{ x: 200, y: 300 }}
          current={null}
          onStyle={onStyle}
          onNote={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const yellowBtn = container.querySelector('button[aria-label="Yellow highlight"]') as HTMLButtonElement;
    const blueBtn = container.querySelector('button[aria-label="Blue highlight"]') as HTMLButtonElement;
    const pinkBtn = container.querySelector('button[aria-label="Pink highlight"]') as HTMLButtonElement;
    const underlineBtn = container.querySelector('button[aria-label="Underline"]') as HTMLButtonElement;

    expect(yellowBtn).not.toBeNull();
    expect(blueBtn).not.toBeNull();
    expect(pinkBtn).not.toBeNull();
    expect(underlineBtn).not.toBeNull();

    expect(yellowBtn.style.backgroundColor).toBe('rgba(250, 204, 21, 0.6)');
    expect(blueBtn.style.backgroundColor).toBe('rgba(56, 189, 248, 0.6)');
    expect(pinkBtn.style.backgroundColor).toBe('rgba(244, 114, 182, 0.6)');

    await act(async () => {
      yellowBtn.click();
    });
    expect(onStyle).toHaveBeenLastCalledWith('yellow');

    await act(async () => {
      blueBtn.click();
    });
    expect(onStyle).toHaveBeenLastCalledWith('blue');

    await act(async () => {
      pinkBtn.click();
    });
    expect(onStyle).toHaveBeenLastCalledWith('pink');

    await act(async () => {
      underlineBtn.click();
    });
    expect(onStyle).toHaveBeenLastCalledWith('underline');

    expect(onStyle).toHaveBeenCalledTimes(4);

    await act(async () => {
      root.unmount();
    });
  });

  it('no delete button without onDelete, and renders delete button when onDelete is provided', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <HighlightToolbar
          anchor={{ x: 200, y: 300 }}
          current={null}
          onStyle={vi.fn()}
          onNote={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('button[aria-label="Delete highlight"]')).toBeNull();

    const onDelete = vi.fn();
    await act(async () => {
      root.render(
        <HighlightToolbar
          anchor={{ x: 200, y: 300 }}
          current={null}
          onStyle={vi.fn()}
          onDelete={onDelete}
          onNote={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const deleteBtn = container.querySelector('button[aria-label="Delete highlight"]') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn.click();
    });
    expect(onDelete).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('clicking note button calls onNote', async () => {
    const onNote = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <HighlightToolbar
          anchor={{ x: 200, y: 300 }}
          current={null}
          onStyle={vi.fn()}
          onNote={onNote}
          onClose={vi.fn()}
        />,
      );
    });

    const noteBtn = container.querySelector('button[aria-label="Add or edit note"]') as HTMLButtonElement;
    expect(noteBtn).not.toBeNull();

    await act(async () => {
      noteBtn.click();
    });
    expect(onNote).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('current style is aria-pressed', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <HighlightToolbar
          anchor={{ x: 200, y: 300 }}
          current="yellow"
          onStyle={vi.fn()}
          onNote={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const yellowBtn = container.querySelector('button[aria-label="Yellow highlight"]');
    const blueBtn = container.querySelector('button[aria-label="Blue highlight"]');
    const underlineBtn = container.querySelector('button[aria-label="Underline"]');

    expect(yellowBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(blueBtn?.getAttribute('aria-pressed')).toBe('false');
    expect(underlineBtn?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      root.render(
        <HighlightToolbar
          anchor={{ x: 200, y: 300 }}
          current="underline"
          onStyle={vi.fn()}
          onNote={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    expect(yellowBtn?.getAttribute('aria-pressed')).toBe('false');
    expect(underlineBtn?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      root.unmount();
    });
  });

  it('Escape and an outside mousedown call onClose', async () => {
    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <HighlightToolbar
          anchor={{ x: 200, y: 300 }}
          current={null}
          onStyle={vi.fn()}
          onNote={vi.fn()}
          onClose={onClose}
        />,
      );
    });

    // Mousedown inside toolbar should NOT call onClose
    const toolbar = container.querySelector('div[role="toolbar"]') as HTMLElement;
    await act(async () => {
      toolbar.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();

    // Mousedown outside toolbar calls onClose
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape calls onClose
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('a mousedown on the toolbar is defaultPrevented', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <HighlightToolbar
          anchor={{ x: 200, y: 300 }}
          current={null}
          onStyle={vi.fn()}
          onNote={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const toolbar = container.querySelector('div[role="toolbar"]') as HTMLElement;
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    await act(async () => {
      toolbar.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it('places below when anchor.y is near top of viewport', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <HighlightToolbar
          anchor={{ x: 150, y: 20 }}
          current={null}
          onStyle={vi.fn()}
          onNote={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const toolbar = container.querySelector('div[role="toolbar"]') as HTMLElement;
    expect(toolbar.style.top).toBe('28px'); // 20 + 8
    expect(toolbar.style.left).toBe('150px');

    await act(async () => {
      root.unmount();
    });
  });
});
