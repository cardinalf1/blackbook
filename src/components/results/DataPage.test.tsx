import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelemetryStats } from '../../types/session';
import { DataPage } from './DataPage';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('DataPage', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const mockStats: TelemetryStats = {
    sessions: 7,
    attempts: 42,
    events: 250,
    eventBytes: 2048, // formatBytes(2048) -> "2 KB"
  };

  it('renders stats with formatted bytes and copy sentence', async () => {
    const onBack = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={onBack}
        />,
      );
    });

    expect(container.textContent).toContain('Your data');
    expect(container.textContent).toContain('Everything Blackbook saves stays on this computer.');
    expect(container.textContent).toContain('7');
    expect(container.textContent).toContain('42');
    expect(container.textContent).toContain('250');
    expect(container.textContent).toContain('2 KB');

    const backBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Back'),
    );
    expect(backBtn).toBeDefined();

    await act(async () => {
      backBtn?.click();
    });

    expect(onBack).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders loading state when stats is null', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={null}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Loading...');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders statsError in red when provided', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={null}
          statsError="Failed to read database statistics"
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Failed to read database statistics');

    await act(async () => {
      root.unmount();
    });
  });

  it('confirm flow calls onDeleteTelemetry once, Cancel does not', async () => {
    const onDeleteTelemetry = vi.fn().mockResolvedValue(undefined);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={onDeleteTelemetry}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
        />,
      );
    });

    // Find trigger button for Delete telemetry
    const triggerButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.trim() === 'Delete telemetry',
    );
    expect(triggerButtons.length).toBe(1);

    // Click trigger to open confirmation
    await act(async () => {
      triggerButtons[0]?.click();
    });

    const alertdialog = container.querySelector('[role="alertdialog"]');
    expect(alertdialog).not.toBeNull();
    expect(alertdialog?.textContent).toContain(
      'Delete the event log (timings and clicks). Your answers, sessions and skills stay.',
    );

    // Click Cancel
    const cancelBtn = Array.from(alertdialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Cancel',
    );
    expect(cancelBtn).toBeDefined();

    await act(async () => {
      cancelBtn?.click();
    });

    // Dialog is closed and handler was not called
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onDeleteTelemetry).not.toHaveBeenCalled();

    // Reopen dialog
    const retrigger = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete telemetry',
    );
    await act(async () => {
      retrigger?.click();
    });

    const newDialog = container.querySelector('[role="alertdialog"]');
    expect(newDialog).not.toBeNull();

    // Confirm button inside alertdialog
    const confirmBtn = Array.from(newDialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Delete telemetry',
    );
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      confirmBtn?.click();
    });

    expect(onDeleteTelemetry).toHaveBeenCalledTimes(1);

    // On success, status line is shown
    const statusLine = container.querySelector('[role="status"]');
    expect(statusLine).not.toBeNull();
    expect(statusLine?.textContent).toContain('Telemetry deleted successfully.');

    await act(async () => {
      root.unmount();
    });
  });

  it('rejection shows the error message in red', async () => {
    const onDeleteTelemetry = vi.fn().mockRejectedValue(new Error('Permission denied on disk'));
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={onDeleteTelemetry}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
        />,
      );
    });

    const triggerBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete telemetry',
    );
    await act(async () => {
      triggerBtn?.click();
    });

    const confirmBtn = Array.from(
      container.querySelector('[role="alertdialog"]')?.querySelectorAll('button') ?? [],
    ).find((b) => b.textContent?.trim() === 'Delete telemetry');

    await act(async () => {
      confirmBtn?.click();
    });

    expect(onDeleteTelemetry).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Permission denied on disk');

    await act(async () => {
      root.unmount();
    });
  });

  it('runs onExport flow successfully', async () => {
    const onExport = vi.fn().mockResolvedValue(undefined);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={onExport}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
        />,
      );
    });

    const triggerBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Export my data',
    );
    await act(async () => {
      triggerBtn?.click();
    });

    const alertdialog = container.querySelector('[role="alertdialog"]');
    expect(alertdialog).not.toBeNull();
    expect(alertdialog?.textContent).toContain(
      'Save a JSON file with your sessions, answers and telemetry. It contains no question text.',
    );

    const exportBtn = Array.from(alertdialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Export',
    );

    await act(async () => {
      exportBtn?.click();
    });

    expect(onExport).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('runs onDeleteAll flow successfully', async () => {
    const onDeleteAll = vi.fn().mockResolvedValue(undefined);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={onDeleteAll}
          onBack={vi.fn()}
        />,
      );
    });

    const triggerBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete all progress',
    );
    await act(async () => {
      triggerBtn?.click();
    });

    const alertdialog = container.querySelector('[role="alertdialog"]');
    expect(alertdialog).not.toBeNull();
    expect(alertdialog?.textContent).toContain(
      'Delete every session, answer, flag and event. The question bank stays. This cannot be undone.',
    );

    const confirmBtn = Array.from(alertdialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Delete everything',
    );

    await act(async () => {
      confirmBtn?.click();
    });

    expect(onDeleteAll).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });
});
