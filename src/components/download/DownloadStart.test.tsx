import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { estimateDownload } from '../../services/download/estimate';
import { DEFAULT_SCOPE } from '../../types/download';
import { DownloadStart } from './DownloadStart';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('DownloadStart', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  describe('when hasBank is false', () => {
    it('renders empty-bank state with default scope, estimate, and importSlot', async () => {
      const onChoose = vi.fn();
      const estimateSpy = vi.fn(estimateDownload);
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <DownloadStart
            hasBank={false}
            questionCount={0}
            estimate={estimateSpy}
            onChoose={onChoose}
            importSlot={<div data-testid="test-import-slot">Import Slot Content</div>}
          />,
        );
      });

      // Title and copy
      expect(container.textContent).toContain('Get your question bank');
      expect(container.textContent).toContain(
        'Blackbook downloads practice questions to this computer. It runs here, not on a website.',
      );

      // Section checkboxes
      const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      expect(checkboxes.length).toBe(2);
      const rwCheckbox = Array.from(checkboxes).find((cb) =>
        cb.closest('label')?.textContent?.includes('Reading and Writing'),
      );
      const mathCheckbox = Array.from(checkboxes).find((cb) =>
        cb.closest('label')?.textContent?.includes('Math'),
      );
      expect(rwCheckbox?.checked).toBe(true);
      expect(mathCheckbox?.checked).toBe(true);

      // Set choice radios
      const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
      expect(radios.length).toBe(2);
      const liveRadio = Array.from(radios).find((r) =>
        r.closest('label')?.textContent?.includes('Live set only (recommended)'),
      );
      const everythingRadio = Array.from(radios).find((r) =>
        r.closest('label')?.textContent?.includes('Everything'),
      );
      expect(liveRadio?.checked).toBe(true);
      expect(everythingRadio?.checked).toBe(false);

      // Estimate live under picker
      expect(estimateSpy).toHaveBeenCalledWith(DEFAULT_SCOPE);
      // DEFAULT_SCOPE gives 2,019 questions, 2,022 requests, 12 minutes
      expect(container.textContent).toContain(
        'About 2,019 questions, 2,022 requests, about 12 minutes.',
      );

      // Primary button
      const downloadBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Download questions'),
      );
      expect(downloadBtn).toBeDefined();
      expect(downloadBtn?.disabled).toBe(false);

      // Secondary import section
      expect(container.textContent).toContain('Or import a question bank file');
      expect(container.querySelector('[data-testid="test-import-slot"]')?.textContent).toBe(
        'Import Slot Content',
      );

      // Clicking download questions calls onChoose with default scope
      await act(async () => {
        downloadBtn?.click();
      });
      expect(onChoose).toHaveBeenCalledTimes(1);
      expect(onChoose).toHaveBeenCalledWith(DEFAULT_SCOPE);

      await act(async () => {
        root.unmount();
      });
    });

    it('updates estimate when toggling scope options and passes chosen scope to onChoose', async () => {
      const onChoose = vi.fn();
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <DownloadStart
            hasBank={false}
            questionCount={0}
            estimate={estimateDownload}
            onChoose={onChoose}
            importSlot={null}
          />,
        );
      });

      const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      const mathCheckbox = Array.from(checkboxes).find((cb) =>
        cb.closest('label')?.textContent?.includes('Math'),
      );
      expect(mathCheckbox).toBeDefined();

      // Uncheck Math
      await act(async () => {
        mathCheckbox?.click();
      });
      // RW live set only: 1,092 questions, 1,094 requests, 6 minutes
      expect(container.textContent).toContain(
        'About 1,092 questions, 1,094 requests, about 6 minutes.',
      );

      // Switch to Everything
      const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
      const everythingRadio = Array.from(radios).find((r) =>
        r.closest('label')?.textContent?.includes('Everything'),
      );
      await act(async () => {
        everythingRadio?.click();
      });
      // RW everything: 1,845 questions, 1,847 requests, 11 minutes
      expect(container.textContent).toContain(
        'About 1,845 questions, 1,847 requests, about 11 minutes.',
      );

      // Click Download
      const downloadBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Download questions'),
      );
      await act(async () => {
        downloadBtn?.click();
      });

      expect(onChoose).toHaveBeenCalledTimes(1);
      expect(onChoose).toHaveBeenCalledWith({
        sections: ['rw'],
        liveOnly: false,
      });

      await act(async () => {
        root.unmount();
      });
    });

    it('shows warning and disables download button when no sections are checked', async () => {
      const onChoose = vi.fn();
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <DownloadStart
            hasBank={false}
            questionCount={0}
            estimate={estimateDownload}
            onChoose={onChoose}
            importSlot={null}
          />,
        );
      });

      const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      const rwCheckbox = Array.from(checkboxes).find((cb) =>
        cb.closest('label')?.textContent?.includes('Reading and Writing'),
      );
      const mathCheckbox = Array.from(checkboxes).find((cb) =>
        cb.closest('label')?.textContent?.includes('Math'),
      );

      // Uncheck both
      await act(async () => {
        rwCheckbox?.click();
      });
      await act(async () => {
        mathCheckbox?.click();
      });

      expect(container.textContent).toContain('Pick at least one section.');

      const downloadBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Download questions'),
      );
      expect(downloadBtn?.disabled).toBe(true);

      // Attempt to click disabled button
      await act(async () => {
        downloadBtn?.click();
      });
      expect(onChoose).not.toHaveBeenCalled();

      // Check Math back on
      await act(async () => {
        mathCheckbox?.click();
      });

      expect(container.textContent).not.toContain('Pick at least one section.');
      expect(downloadBtn?.disabled).toBe(false);

      await act(async () => {
        root.unmount();
      });
    });
  });

  describe('when hasBank is true', () => {
    it('renders compact card without importSlot and reveals picker on Refresh questions click', async () => {
      const onChoose = vi.fn();
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <DownloadStart
            hasBank={true}
            questionCount={2019}
            estimate={estimateDownload}
            onChoose={onChoose}
            importSlot={<div data-testid="should-not-render">Slot</div>}
          />,
        );
      });

      // Compact card with formatted question count
      expect(container.textContent).toContain('2,019 questions on this computer');
      expect(container.querySelector('[data-testid="should-not-render"]')).toBeNull();
      expect(container.textContent).not.toContain('Or import a question bank file');

      // Scope picker not initially rendered
      expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(0);

      // Click "Refresh questions"
      const refreshQuestionsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Refresh questions'),
      );
      expect(refreshQuestionsBtn).toBeDefined();

      await act(async () => {
        refreshQuestionsBtn?.click();
      });

      // Now expanded: picker is visible
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(2);
      expect(container.textContent).toContain(
        'About 2,019 questions, 2,022 requests, about 12 minutes.',
      );
      expect(container.querySelector('[data-testid="should-not-render"]')).toBeNull();

      // Action buttons: Cancel and Refresh
      const cancelBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Cancel',
      );
      const refreshBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Refresh',
      );
      expect(cancelBtn).toBeDefined();
      expect(refreshBtn).toBeDefined();

      // Clicking Cancel collapses the picker
      await act(async () => {
        cancelBtn?.click();
      });

      expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(0);
      expect(container.textContent).toContain('2,019 questions on this computer');

      // Re-expand and click Refresh
      const reOpenBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Refresh questions'),
      );
      await act(async () => {
        reOpenBtn?.click();
      });

      const newRefreshBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Refresh',
      );
      await act(async () => {
        newRefreshBtn?.click();
      });

      expect(onChoose).toHaveBeenCalledTimes(1);
      expect(onChoose).toHaveBeenCalledWith(DEFAULT_SCOPE);

      await act(async () => {
        root.unmount();
      });
    });

    it('disables Refresh button when no section is checked in expanded state', async () => {
      const onChoose = vi.fn();
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <DownloadStart
            hasBank={true}
            questionCount={1500}
            estimate={estimateDownload}
            onChoose={onChoose}
            importSlot={null}
          />,
        );
      });

      // Expand
      const refreshQuestionsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Refresh questions'),
      );
      await act(async () => {
        refreshQuestionsBtn?.click();
      });

      const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      const rwCheckbox = Array.from(checkboxes).find((cb) =>
        cb.closest('label')?.textContent?.includes('Reading and Writing'),
      );
      const mathCheckbox = Array.from(checkboxes).find((cb) =>
        cb.closest('label')?.textContent?.includes('Math'),
      );

      // Uncheck both
      await act(async () => {
        rwCheckbox?.click();
      });
      await act(async () => {
        mathCheckbox?.click();
      });

      expect(container.textContent).toContain('Pick at least one section.');

      const refreshBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Refresh',
      );
      expect(refreshBtn?.disabled).toBe(true);

      await act(async () => {
        refreshBtn?.click();
      });
      expect(onChoose).not.toHaveBeenCalled();

      await act(async () => {
        root.unmount();
      });
    });
  });
});
