import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadConsentProps } from '../../types/download';
import { DownloadConsent } from './DownloadConsent';

// Enable React act environment in jsdom
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('DownloadConsent', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const baseProps: DownloadConsentProps = {
    scope: { sections: ['rw', 'math'], liveOnly: true },
    estimate: { questions: 1250, requests: 1280, minutes: 12 },
    dataFolder: 'data/question_bank.json',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders modal dialog with aria attributes and heading', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(DownloadConsent, baseProps));
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');

    const heading = container.querySelector('h2');
    expect(heading?.textContent).toBe('Download questions to this computer');
    expect(dialog?.getAttribute('aria-labelledby')).toBe(heading?.id);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders exact approved body text with formatted scope and estimates', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(DownloadConsent, baseProps));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('1,250 practice questions (the live set, Reading and Writing and Math)');
    expect(text).toContain("College Board's public SAT Educator Question Bank");
    expect(text).toContain('data/question_bank.json');
    expect(text).toContain('about 1,280 requests, at most 2 at a time');
    expect(text).toContain('takes about 12 minutes (measured; your connection may differ)');
    expect(text).toContain('Keep Blackbook open until it finishes; if it stops, it resumes where it left off.');
    expect(text).toContain('Nothing is uploaded anywhere: Blackbook has no server and no accounts.');
    expect(text).toContain(
      "The questions belong to their owner and are for your personal practice; don't share or republish them.",
    );
    expect(text).toContain(
      'Blackbook is an independent practice tool, not affiliated with or endorsed by the source.',
    );
    expect(text).toContain(
      "If the source starts refusing requests, the download stops and won't retry on its own.",
    );

    const codeEl = container.querySelector('code');
    expect(codeEl?.textContent).toBe('data/question_bank.json');

    await act(async () => {
      root.unmount();
    });
  });

  it('formats scope labels for all questions and single sections', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(DownloadConsent, {
          ...baseProps,
          scope: { sections: ['rw'], liveOnly: false },
        }),
      );
    });
    expect(container.textContent).toContain('(all questions, Reading and Writing only)');

    await act(async () => {
      root.render(
        createElement(DownloadConsent, {
          ...baseProps,
          scope: { sections: ['math'], liveOnly: false },
        }),
      );
    });
    expect(container.textContent).toContain('(all questions, Math only)');

    await act(async () => {
      root.unmount();
    });
  });

  it('disables download button until checkbox is checked', async () => {
    const onConfirm = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(DownloadConsent, { ...baseProps, onConfirm }));
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const downloadBtn = buttons.find((b) => b.textContent?.trim() === 'Download');
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;

    expect(downloadBtn).toBeDefined();
    expect(checkbox).toBeDefined();
    expect(checkbox.checked).toBe(false);
    expect(downloadBtn?.disabled).toBe(true);

    await act(async () => {
      downloadBtn?.click();
    });
    expect(onConfirm).not.toHaveBeenCalled();

    // Check checkbox
    await act(async () => {
      checkbox.click();
    });
    expect(checkbox.checked).toBe(true);
    expect(downloadBtn?.disabled).toBe(false);

    // Now click download
    await act(async () => {
      downloadBtn?.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onCancel when Cancel button is clicked or Escape is pressed', async () => {
    const onCancel = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(DownloadConsent, { ...baseProps, onCancel }));
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const cancelBtn = buttons.find((b) => b.textContent?.trim() === 'Cancel');
    expect(cancelBtn).toBeDefined();

    await act(async () => {
      cancelBtn?.click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Test Escape key
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });
});
