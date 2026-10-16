import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from './NoteEditor';

describe('NoteEditor', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('Save passes the text', async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NoteEditor
          initial="Important concept"
          maxLength={500}
          onSave={onSave}
          onCancel={onCancel}
        />,
      );
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Save',
    );
    expect(saveButton).toBeDefined();

    await act(async () => {
      saveButton?.click();
    });

    expect(onSave).toHaveBeenCalledWith('Important concept');
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('Ctrl+Enter saves the text', async () => {
    const onSave = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NoteEditor
          initial="Shortcut concept"
          maxLength={500}
          onSave={onSave}
          onCancel={vi.fn()}
        />,
      );
    });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();

    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
      );
    });

    expect(onSave).toHaveBeenCalledWith('Shortcut concept');

    await act(async () => {
      root.unmount();
    });
  });

  it('Escape cancels', async () => {
    const onCancel = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NoteEditor
          initial="Some note"
          maxLength={500}
          onSave={vi.fn()}
          onCancel={onCancel}
        />,
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);

    const cancelButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancel',
    );
    expect(cancelButton).toBeDefined();

    await act(async () => {
      cancelButton?.click();
    });

    expect(onCancel).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('counter shows character count and max', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NoteEditor
          initial="Hello"
          maxLength={200}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('5 / 200');

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('Hello');
    expect(textarea.maxLength).toBe(200);

    await act(async () => {
      root.unmount();
    });
  });
});
