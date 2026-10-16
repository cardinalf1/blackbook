import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RulesNote, RulesNotesStore } from '../../types/ai';
import { RulesNoteBox } from './RulesNoteBox';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('RulesNoteBox', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  function createFakeStore(initialNotes: RulesNote[] = []): RulesNotesStore {
    const notes = [...initialNotes];
    return {
      listNotes: vi.fn(async () => [...notes]),
      setNote: vi.fn(async (skillCode: string, text: string) => {
        const idx = notes.findIndex((n) => n.skillCode === skillCode);
        if (idx >= 0) {
          if (text) {
            notes[idx] = { skillCode, text, updatedAt: Date.now() };
          } else {
            notes.splice(idx, 1);
          }
        } else if (text) {
          notes.push({ skillCode, text, updatedAt: Date.now() });
        }
      }),
    };
  }

  it('renders the reminder line and loads existing note', async () => {
    const fakeStore = createFakeStore([
      {
        skillCode: 'CAS.A.',
        text: 'Always check the contrast words.',
        updatedAt: 1000,
      },
    ]);

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <RulesNoteBox
          skillCode="CAS.A."
          skill="Words in Context"
          store={fakeStore}
        />,
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    // Reminder line check
    expect(container.textContent).toContain(
      'Write the rule in your own words. Do not paste question text. These notes stay on this computer and are never sent to AI.',
    );

    // Note content loaded
    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(textarea?.value).toBe('Always check the contrast words.');

    root.unmount();
  });

  it('saves via a fake store when save button is clicked', async () => {
    const fakeStore = createFakeStore();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <RulesNoteBox
          skillCode="CAS.B."
          skill="Text Structure"
          store={fakeStore}
        />,
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    const textarea = container.querySelector('textarea')!;
    expect(textarea.value).toBe('');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      setter?.call(textarea, 'Pay attention to transitional phrases.');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Save'),
    );
    expect(saveButton).toBeDefined();

    await act(async () => {
      saveButton?.click();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(fakeStore.setNote).toHaveBeenCalledWith(
      'CAS.B.',
      'Pay attention to transitional phrases.',
    );
    expect(container.textContent).toContain('Saved');

    root.unmount();
  });
});
