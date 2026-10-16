import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSettings, AiStatus, AiStore } from '../../types/ai';
import { SettingsScreen } from './SettingsScreen';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface FakeAiStore extends AiStore {
  calls: {
    status: number;
    setKey: string[];
    removeKey: number;
    testConnection: number;
    updateSettings: Partial<AiSettings>[];
  };
  getStatus: () => AiStatus;
}

function createFakeAiStore(overrides: Partial<AiStatus> = {}): FakeAiStore {
  let currentStatus: AiStatus = {
    hasKey: false,
    settings: {
      enabled: true,
      includeText: false,
      textConfirmedAt: null,
      previewSeen: [],
    },
    model: 'llama-3.3-70b-versatile',
    policyLine: 'Groq does not train on API traffic or retain prompts past 30 days.',
    ...overrides,
  };

  const calls = {
    status: 0,
    setKey: [] as string[],
    removeKey: 0,
    testConnection: 0,
    updateSettings: [] as Partial<AiSettings>[],
  };

  return {
    calls,
    getStatus: () => currentStatus,
    async status() {
      calls.status++;
      return { ...currentStatus, settings: { ...currentStatus.settings } };
    },
    async setKey(key: string) {
      calls.setKey.push(key);
      currentStatus = { ...currentStatus, hasKey: true };
      return { ...currentStatus, settings: { ...currentStatus.settings } };
    },
    async removeKey() {
      calls.removeKey++;
      currentStatus = { ...currentStatus, hasKey: false };
      return { ...currentStatus, settings: { ...currentStatus.settings } };
    },
    async testConnection() {
      calls.testConnection++;
      return { ok: true, message: 'Connected to Groq successfully.' };
    },
    async updateSettings(patch: Partial<AiSettings>) {
      calls.updateSettings.push(patch);
      currentStatus = {
        ...currentStatus,
        settings: { ...currentStatus.settings, ...patch },
      };
      return { ...currentStatus, settings: { ...currentStatus.settings } };
    },
    async preview() {
      throw new Error('Not implemented');
    },
    async previewReport() {
      throw new Error('Not implemented');
    },
    async weakDrill() {
      throw new Error('Not implemented');
    },
    async report() {
      throw new Error('Not implemented');
    },
    async coach() {
      throw new Error('Not implemented');
    },
  };
}

function setInputValue(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('SettingsScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('saving clears the input and never renders the key text', async () => {
    const fakeStore = createFakeAiStore({ hasKey: false });
    const onBack = vi.fn();

    await act(async () => {
      root.render(<SettingsScreen onBack={onBack} store={fakeStore} />);
    });

    expect(container.textContent).toContain('No key saved');

    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    expect(passwordInput).not.toBeNull();

    const secretKey = 'gsk_secret_token_123456789';
    await act(async () => {
      setInputValue(passwordInput, secretKey);
    });

    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save key'),
    );
    expect(saveBtn).toBeDefined();

    await act(async () => {
      saveBtn?.click();
    });

    expect(fakeStore.calls.setKey).toEqual([secretKey]);
    expect(passwordInput.value).toBe('');
    expect(container.textContent).toContain('A key is saved');
    expect(container.textContent).not.toContain(secretKey);
    expect(container.innerHTML).not.toContain(secretKey);
  });

  it('remove needs confirm', async () => {
    const fakeStore = createFakeAiStore({ hasKey: true });
    const onBack = vi.fn();

    await act(async () => {
      root.render(<SettingsScreen onBack={onBack} store={fakeStore} />);
    });

    expect(container.textContent).toContain('A key is saved');

    const removeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Remove key'),
    );
    expect(removeBtn).toBeDefined();

    // Click Remove key - shows confirm prompt, does not call store yet
    await act(async () => {
      removeBtn?.click();
    });

    expect(fakeStore.calls.removeKey).toBe(0);
    expect(container.textContent).toContain('Remove saved key?');

    // Click Cancel
    const cancelBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancel'),
    );
    expect(cancelBtn).toBeDefined();

    await act(async () => {
      cancelBtn?.click();
    });

    expect(fakeStore.calls.removeKey).toBe(0);
    expect(container.textContent).toContain('A key is saved');

    // Click Remove key again
    const removeBtnAgain = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Remove key'),
    );
    await act(async () => {
      removeBtnAgain?.click();
    });

    const confirmRemoveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirm remove'),
    );
    expect(confirmRemoveBtn).toBeDefined();

    await act(async () => {
      confirmRemoveBtn?.click();
    });

    expect(fakeStore.calls.removeKey).toBe(1);
    expect(container.textContent).toContain('No key saved');
  });

  it('text toggle shows the confirmation once and passes textConfirmedAt', async () => {
    const fakeStore = createFakeAiStore({
      settings: {
        enabled: true,
        includeText: false,
        textConfirmedAt: null,
        previewSeen: [],
      },
    });
    const onBack = vi.fn();

    await act(async () => {
      root.render(<SettingsScreen onBack={onBack} store={fakeStore} />);
    });

    const textToggle = container.querySelector('#toggle-include-text') as HTMLInputElement;
    expect(textToggle).not.toBeNull();
    expect(textToggle.checked).toBe(false);

    // Toggle on for the first time
    await act(async () => {
      textToggle.click();
    });

    expect(container.textContent).toContain(
      "Question text (passage, question and answer choices) goes to Groq's servers. It is the source's content, and you are sending it for your own personal practice.",
    );
    expect(fakeStore.calls.updateSettings).toHaveLength(0);

    const understandBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('I understand, include text'),
    );
    expect(understandBtn).toBeDefined();

    const beforeTimestamp = Date.now();
    await act(async () => {
      understandBtn?.click();
    });
    const afterTimestamp = Date.now();

    expect(fakeStore.calls.updateSettings).toHaveLength(1);
    const firstCall = fakeStore.calls.updateSettings[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) throw new Error('Expected firstCall to be defined');
    expect(firstCall.includeText).toBe(true);
    expect(typeof firstCall.textConfirmedAt).toBe('number');
    expect(firstCall.textConfirmedAt).toBeGreaterThanOrEqual(beforeTimestamp);
    expect(firstCall.textConfirmedAt).toBeLessThanOrEqual(afterTimestamp);

    expect(textToggle.checked).toBe(true);

    // Toggle off
    await act(async () => {
      textToggle.click();
    });

    expect(fakeStore.calls.updateSettings).toHaveLength(2);
    expect(fakeStore.calls.updateSettings[1]).toEqual({ includeText: false });
    expect(textToggle.checked).toBe(false);

    // Toggle on for the second time - should NOT show confirmation dialog
    await act(async () => {
      textToggle.click();
    });

    expect(fakeStore.calls.updateSettings).toHaveLength(3);
    expect(fakeStore.calls.updateSettings[2]).toEqual({ includeText: true });
    expect(container.textContent).not.toContain('I understand, include text');
    expect(textToggle.checked).toBe(true);
  });

  it('cancel leaves it off', async () => {
    const fakeStore = createFakeAiStore({
      settings: {
        enabled: true,
        includeText: false,
        textConfirmedAt: null,
        previewSeen: [],
      },
    });
    const onBack = vi.fn();

    await act(async () => {
      root.render(<SettingsScreen onBack={onBack} store={fakeStore} />);
    });

    const textToggle = container.querySelector('#toggle-include-text') as HTMLInputElement;
    expect(textToggle.checked).toBe(false);

    // Toggle on for the first time
    await act(async () => {
      textToggle.click();
    });

    expect(container.textContent).toContain(
      "Question text (passage, question and answer choices) goes to Groq's servers. It is the source's content, and you are sending it for your own personal practice.",
    );

    const cancelBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancel'),
    );
    expect(cancelBtn).toBeDefined();

    await act(async () => {
      cancelBtn?.click();
    });

    expect(fakeStore.calls.updateSettings).toHaveLength(0);
    expect(textToggle.checked).toBe(false);
    expect(container.textContent).not.toContain('I understand, include text');
  });

  it('pressing Escape closes the text confirmation dialog and leaves toggle off', async () => {
    const fakeStore = createFakeAiStore({
      settings: {
        enabled: true,
        includeText: false,
        textConfirmedAt: null,
        previewSeen: [],
      },
    });
    const onBack = vi.fn();

    await act(async () => {
      root.render(<SettingsScreen onBack={onBack} store={fakeStore} />);
    });

    const textToggle = container.querySelector('#toggle-include-text') as HTMLInputElement;
    await act(async () => {
      textToggle.click();
    });

    expect(container.textContent).toContain('I understand, include text');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(container.textContent).not.toContain('I understand, include text');
    expect(fakeStore.calls.updateSettings).toHaveLength(0);
    expect(textToggle.checked).toBe(false);
  });

  it('toggles global Use AI features switch', async () => {
    const fakeStore = createFakeAiStore({
      settings: {
        enabled: true,
        includeText: false,
        textConfirmedAt: null,
        previewSeen: [],
      },
    });
    const onBack = vi.fn();

    await act(async () => {
      root.render(<SettingsScreen onBack={onBack} store={fakeStore} />);
    });

    const aiToggle = container.querySelector('#toggle-use-ai') as HTMLInputElement;
    expect(aiToggle.checked).toBe(true);
    expect(container.textContent).toContain(
      'when off or without a key, every feature runs its rule-based version.',
    );

    await act(async () => {
      aiToggle.click();
    });

    expect(fakeStore.calls.updateSettings).toEqual([{ enabled: false }]);
    expect(aiToggle.checked).toBe(false);
  });

  it('tests connection and displays message', async () => {
    const fakeStore = createFakeAiStore({ hasKey: true });
    const onBack = vi.fn();

    await act(async () => {
      root.render(<SettingsScreen onBack={onBack} store={fakeStore} />);
    });

    const testBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Test connection'),
    );
    expect(testBtn).toBeDefined();

    await act(async () => {
      testBtn?.click();
    });

    expect(fakeStore.calls.testConnection).toBe(1);
    expect(container.textContent).toContain('Connected to Groq successfully.');
  });

  it('displays model name and policy text', async () => {
    const fakeStore = createFakeAiStore({
      model: 'llama-3.3-70b-versatile',
      policyLine: 'Groq does not train on API traffic or retain prompts past 30 days.',
    });
    const onBack = vi.fn();

    await act(async () => {
      root.render(<SettingsScreen onBack={onBack} store={fakeStore} />);
    });

    expect(container.textContent).toContain('llama-3.3-70b-versatile');
    expect(container.textContent).toContain(
      'Groq does not train on API traffic or retain prompts past 30 days.',
    );
    expect(container.textContent).toContain('Your notes and mistake notes are never sent.');
  });

  it('displays errors in a plain red line', async () => {
    const fakeStore = createFakeAiStore();
    fakeStore.testConnection = vi.fn().mockRejectedValue(new Error('Network error: failed to connect'));
    const onBack = vi.fn();

    await act(async () => {
      root.render(<SettingsScreen onBack={onBack} store={fakeStore} />);
    });

    const testBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Test connection'),
    );
    await act(async () => {
      testBtn?.click();
    });

    const errorEl = container.querySelector('[role="alert"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toBe('Network error: failed to connect');
    expect(errorEl?.className).toContain('text-red-400');
  });

  it('displays error in plain red line when initial status load fails', async () => {
    const fakeStore = createFakeAiStore();
    fakeStore.status = vi.fn().mockRejectedValue(new Error('Failed to load status'));
    const onBack = vi.fn();

    await act(async () => {
      root.render(<SettingsScreen onBack={onBack} store={fakeStore} />);
    });

    const errorEl = container.querySelector('[role="alert"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toBe('Failed to load status');
    expect(errorEl?.className).toContain('text-red-400');
  });

  it('calls onBack when back button is clicked', async () => {
    const fakeStore = createFakeAiStore();
    const onBack = vi.fn();

    await act(async () => {
      root.render(<SettingsScreen onBack={onBack} store={fakeStore} />);
    });

    const backBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Back'),
    );
    await act(async () => {
      backBtn?.click();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
