import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadProgress, DownloadProgressPanelProps } from '../../types/download';
import { DownloadProgressPanel } from './DownloadProgressPanel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('DownloadProgressPanel', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const baseProgress: DownloadProgress = {
    status: 'idle',
    scope: { sections: ['rw', 'math'], liveOnly: true },
    stage: null,
    questions: 100,
    cached: 10,
    toFetch: 90,
    fetched: 45,
    failed: 1,
    retries: 2,
    normalized: 0,
    startedAt: 1000,
    updatedAt: 2000,
    etaSeconds: null,
    error: null,
    summary: null,
    cache: { bytes: 1048576, files: 45 },
    dataFolder: 'data/question_bank.json',
  };

  const baseProps: DownloadProgressPanelProps = {
    progress: baseProgress,
    onCancel: vi.fn(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
    onFreeCache: vi.fn(),
  };

  it('renders nothing when status is idle', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(DownloadProgressPanel, { ...baseProps, progress: { ...baseProgress, status: 'idle' } }));
    });

    expect(container.innerHTML).toBe('');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders running status with stage text, progress bar, counts, eta, and cancel action', async () => {
    const onCancel = vi.fn();
    const onClose = vi.fn();
    const root = createRoot(container);

    const runningProgress: DownloadProgress = {
      ...baseProgress,
      status: 'running',
      stage: 'details',
      fetched: 50,
      toFetch: 100,
      etaSeconds: 90,
      cached: 15,
      failed: 2,
      retries: 3,
    };

    await act(async () => {
      root.render(createElement(DownloadProgressPanel, { ...baseProps, progress: runningProgress, onCancel, onClose }));
    });

    expect(container.textContent).toContain('Downloading questions');
    expect(container.textContent).toContain('Downloading questions 50 of 100');
    expect(container.textContent).toContain('About 2 min left');
    expect(container.textContent).toContain('cached 15, failed 2, retries 3');
    expect(container.textContent).toContain('Keep Blackbook open until this finishes.');

    // Cancel button
    const cancelBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cancel');
    expect(cancelBtn).toBeDefined();
    await act(async () => {
      cancelBtn?.click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Escape does not trigger onClose while running
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('handles details stage with toFetch 0 and eta < 60s', async () => {
    const root = createRoot(container);
    const progress: DownloadProgress = {
      ...baseProgress,
      status: 'running',
      stage: 'details',
      fetched: 0,
      toFetch: 0,
      etaSeconds: 30,
    };

    await act(async () => {
      root.render(createElement(DownloadProgressPanel, { ...baseProps, progress }));
    });

    expect(container.textContent).toContain('Everything is already downloaded');
    expect(container.textContent).toContain('Less than a minute left');

    await act(async () => {
      root.unmount();
    });
  });

  it('handles lists and saving stages with indeterminate indicator', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(DownloadProgressPanel, {
        ...baseProps,
        progress: { ...baseProgress, status: 'running', stage: 'lists' },
      }));
    });
    expect(container.textContent).toContain('Getting question lists');
    expect(container.querySelector('.animate-pulse')).not.toBeNull();

    await act(async () => {
      root.render(createElement(DownloadProgressPanel, {
        ...baseProps,
        progress: { ...baseProgress, status: 'running', stage: 'saving' },
      }));
    });
    expect(container.textContent).toContain('Saving');
    expect(container.querySelector('.animate-pulse')).not.toBeNull();

    await act(async () => {
      root.render(createElement(DownloadProgressPanel, {
        ...baseProps,
        progress: { ...baseProgress, status: 'running', stage: 'normalize', normalized: 40, questions: 80 },
      }));
    });
    expect(container.textContent).toContain('Preparing questions 40 of 80');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders succeeded state with summary, section counts, skipped list, cache button and close', async () => {
    const onClose = vi.fn();
    const onFreeCache = vi.fn();
    const root = createRoot(container);

    const succeededProgress: DownloadProgress = {
      ...baseProgress,
      status: 'succeeded',
      summary: {
        questions: 150,
        live: 120,
        bySection: { rw: 80, math: 70 },
        skipped: [
          { reason: 'unsupported_format', count: 3, description: 'Unsupported media' },
          { reason: 'corrupt', count: 1, description: 'Invalid schema' },
        ],
        durationMs: 75000,
      },
      cache: { bytes: 2097152, files: 150 }, // 2 MB
    };

    await act(async () => {
      root.render(createElement(DownloadProgressPanel, {
        ...baseProps,
        progress: succeededProgress,
        onClose,
        onFreeCache,
      }));
    });

    expect(container.textContent).toContain('Download complete');
    expect(container.textContent).toContain('150 questions saved (120 in the live set)');
    expect(container.textContent).toContain('Reading and Writing');
    expect(container.textContent).toContain('80');
    expect(container.textContent).toContain('Math');
    expect(container.textContent).toContain('70');
    expect(container.textContent).toContain('1:15'); // formatDuration(75000)
    expect(container.textContent).toContain('Unsupported media: 3');
    expect(container.textContent).toContain('Invalid schema: 1');
    expect(container.textContent).toContain('Free download cache (2 MB)');
    expect(container.textContent).toContain('Only needed to resume or refresh faster.');

    // Free cache button
    const freeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Free download cache'),
    );
    expect(freeBtn).toBeDefined();
    await act(async () => {
      freeBtn?.click();
    });
    expect(onFreeCache).toHaveBeenCalledTimes(1);

    // Done button
    const doneBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Done');
    expect(doneBtn).toBeDefined();
    await act(async () => {
      doneBtn?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape key
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders succeeded state with empty skipped list and no cache files', async () => {
    const root = createRoot(container);
    const progress: DownloadProgress = {
      ...baseProgress,
      status: 'succeeded',
      summary: {
        questions: 50,
        live: 50,
        bySection: { rw: 25, math: 25 },
        skipped: [],
        durationMs: 12000,
      },
      cache: { bytes: 0, files: 0 },
    };

    await act(async () => {
      root.render(createElement(DownloadProgressPanel, { ...baseProps, progress }));
    });

    expect(container.textContent).toContain('Nothing was skipped.');
    expect(container.textContent).not.toContain('Free download cache');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders failed state with error message, lastRequest, Retry, and Close', async () => {
    const onRetry = vi.fn();
    const onClose = vi.fn();
    const root = createRoot(container);

    const failedProgress: DownloadProgress = {
      ...baseProgress,
      status: 'failed',
      error: {
        reason: 'blocked',
        message: 'Request rate limit exceeded by remote host.',
        lastRequest: 'GET https://api.example.com/questions/12345',
      },
    };

    await act(async () => {
      root.render(createElement(DownloadProgressPanel, {
        ...baseProps,
        progress: failedProgress,
        onRetry,
        onClose,
      }));
    });

    expect(container.textContent).toContain('Download stopped');
    expect(container.textContent).toContain('Request rate limit exceeded by remote host.');
    expect(container.textContent).toContain('Last request: GET https://api.example.com/questions/12345');
    expect(container.textContent).toContain('Your previous questions were not changed.');

    const buttons = Array.from(container.querySelectorAll('button'));
    const retryBtn = buttons.find((b) => b.textContent?.trim() === 'Retry');
    const closeBtn = buttons.find((b) => b.textContent?.trim() === 'Close');

    expect(retryBtn).toBeDefined();
    expect(closeBtn).toBeDefined();

    await act(async () => {
      retryBtn?.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);

    await act(async () => {
      closeBtn?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape key
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders cancelled state with notice, Retry, Close, and handles Escape', async () => {
    const onRetry = vi.fn();
    const onClose = vi.fn();
    const root = createRoot(container);

    const cancelledProgress: DownloadProgress = {
      ...baseProgress,
      status: 'cancelled',
    };

    await act(async () => {
      root.render(createElement(DownloadProgressPanel, {
        ...baseProps,
        progress: cancelledProgress,
        onRetry,
        onClose,
      }));
    });

    expect(container.textContent).toContain('Download cancelled');
    expect(container.textContent).toContain(
      'Your previous questions were not changed. Downloaded parts are kept, so the next download resumes.',
    );

    const retryBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Retry');
    await act(async () => {
      retryBtn?.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });
});
