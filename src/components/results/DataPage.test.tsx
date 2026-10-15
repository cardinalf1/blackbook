import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackupStore } from '../../types/backup';
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

  const createMockBackupStore = (overrides: Partial<BackupStore> = {}): BackupStore => ({
    list: vi.fn().mockResolvedValue({
      backups: [
        {
          name: 'blackbook-2026-10-16.json',
          at: 1776345600000,
          sizeBytes: 4096,
          kind: 'daily',
        },
        {
          name: 'blackbook-safety-2026-10-15.json',
          at: 1776259200000,
          sizeBytes: 8192,
          kind: 'before_restore',
        },
      ],
      lastBackupAt: 1776345600000,
    }),
    restoreSnapshot: vi.fn().mockResolvedValue({
      sessions: 3,
      attempts: 12,
      events: 45,
      mistakeTags: 2,
    }),
    restoreExport: vi.fn().mockResolvedValue({
      sessions: 1,
      attempts: 4,
      events: 10,
      mistakeTags: 0,
    }),
    ...overrides,
  });

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
          backupStore={createMockBackupStore()}
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
          backupStore={createMockBackupStore()}
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
          backupStore={createMockBackupStore()}
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
          backupStore={createMockBackupStore()}
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
          backupStore={createMockBackupStore()}
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
          backupStore={createMockBackupStore()}
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
          backupStore={createMockBackupStore()}
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
      'Delete every session, answer, flag, event and mistake tag. The question bank stays. This cannot be undone.',
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

  /* -------------------------------------------------------------------------
   * Backup and restore tests
   * ------------------------------------------------------------------------- */

  it('renders snapshot list, kind labels, sizes, date, Last backup time, and plain note', async () => {
    const mockStore = createMockBackupStore();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
          backupStore={mockStore}
        />,
      );
    });

    expect(mockStore.list).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Backups and restore');
    expect(container.textContent).toContain(
      `Last backup: ${new Date(1776345600000).toLocaleString()}`,
    );
    expect(container.textContent).toContain(
      'Backups hold your progress only, never the question bank; the app keeps the last 7 daily snapshots.',
    );

    // First snapshot
    expect(container.textContent).toContain('blackbook-2026-10-16.json');
    expect(container.textContent).toContain('Daily');
    expect(container.textContent).toContain('4 KB');

    // Second snapshot
    expect(container.textContent).toContain('blackbook-safety-2026-10-15.json');
    expect(container.textContent).toContain('Safety copy before a restore');
    expect(container.textContent).toContain('8 KB');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders "No backup yet" when there are no snapshots', async () => {
    const mockStore = createMockBackupStore({
      list: vi.fn().mockResolvedValue({ backups: [], lastBackupAt: null }),
    });
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
          backupStore={mockStore}
        />,
      );
    });

    expect(container.textContent).toContain('No backup yet');
    expect(container.textContent).toContain('No snapshots saved yet.');

    await act(async () => {
      root.unmount();
    });
  });

  it('confirm text: shows exact confirmation message for snapshot restore and file restore', async () => {
    const mockStore = createMockBackupStore();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
          backupStore={mockStore}
        />,
      );
    });

    // 1. Snapshot confirmation
    const snapshotRestoreBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Restore',
    );
    expect(snapshotRestoreBtn).toBeDefined();

    await act(async () => {
      snapshotRestoreBtn?.click();
    });

    const snapshotDialog = container.querySelector('[role="alertdialog"]');
    expect(snapshotDialog).not.toBeNull();
    expect(snapshotDialog?.textContent).toContain(
      'This replaces your current progress with the backup. A safety copy of your current progress is saved first.',
    );
    const cancelBtn = Array.from(snapshotDialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Cancel',
    );
    const confirmRestoreBtn = Array.from(snapshotDialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Restore',
    );
    expect(cancelBtn).toBeDefined();
    expect(confirmRestoreBtn).toBeDefined();

    // Close snapshot confirmation
    await act(async () => {
      cancelBtn?.click();
    });
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();

    // 2. File restore confirmation
    const fileInput = container.querySelector(
      'input[type="file"][aria-label="Restore from an export file"]',
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const testFile = new File(['{"sessions": []}'], 'blackbook-export.json', {
      type: 'application/json',
    });

    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        value: [testFile],
        writable: true,
        configurable: true,
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const fileDialog = container.querySelector('[role="alertdialog"]');
    expect(fileDialog).not.toBeNull();
    expect(fileDialog?.textContent).toContain(
      'This replaces your current progress with the backup. A safety copy of your current progress is saved first.',
    );
    expect(
      Array.from(fileDialog?.querySelectorAll('button') ?? []).some(
        (b) => b.textContent?.trim() === 'Cancel',
      ),
    ).toBe(true);
    expect(
      Array.from(fileDialog?.querySelectorAll('button') ?? []).some(
        (b) => b.textContent?.trim() === 'Restore',
      ),
    ).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it('cancel does nothing: closing confirmation leaves store untouched', async () => {
    const mockStore = createMockBackupStore();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
          backupStore={mockStore}
        />,
      );
    });

    // 1. Snapshot cancel
    const snapshotRestoreBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Restore',
    );
    await act(async () => {
      snapshotRestoreBtn?.click();
    });

    const snapshotDialog = container.querySelector('[role="alertdialog"]');
    const snapshotCancel = Array.from(snapshotDialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Cancel',
    );
    await act(async () => {
      snapshotCancel?.click();
    });

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(mockStore.restoreSnapshot).not.toHaveBeenCalled();

    // 2. File cancel
    const fileInput = container.querySelector(
      'input[type="file"][aria-label="Restore from an export file"]',
    ) as HTMLInputElement;
    const testFile = new File(['{"sessions": []}'], 'export.json', { type: 'application/json' });

    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        value: [testFile],
        writable: true,
        configurable: true,
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const fileDialog = container.querySelector('[role="alertdialog"]');
    const fileCancel = Array.from(fileDialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Cancel',
    );
    await act(async () => {
      fileCancel?.click();
    });

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(mockStore.restoreExport).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('restore calls the store once and shows result counts for snapshot', async () => {
    const mockStore = createMockBackupStore({
      restoreSnapshot: vi.fn().mockResolvedValue({
        sessions: 5,
        attempts: 18,
        events: 90,
        mistakeTags: 3,
      }),
    });
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
          backupStore={mockStore}
        />,
      );
    });

    const restoreBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Restore',
    );
    await act(async () => {
      restoreBtn?.click();
    });

    const dialog = container.querySelector('[role="alertdialog"]');
    const confirmBtn = Array.from(dialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Restore',
    );

    await act(async () => {
      confirmBtn?.click();
    });

    expect(mockStore.restoreSnapshot).toHaveBeenCalledTimes(1);
    expect(mockStore.restoreSnapshot).toHaveBeenCalledWith('blackbook-2026-10-16.json');

    // Confirm dialog closed
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();

    // Result counts displayed
    expect(container.textContent).toContain('5 sessions');
    expect(container.textContent).toContain('18 attempts');
    expect(container.textContent).toContain('90 events');
    expect(container.textContent).toContain('3 mistake tags');

    // backupStore.list was called to refresh snapshots
    expect(mockStore.list).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('restore calls the store once and shows result counts for file restore', async () => {
    const mockStore = createMockBackupStore({
      restoreExport: vi.fn().mockResolvedValue({
        sessions: 2,
        attempts: 6,
        events: 20,
        mistakeTags: 1,
      }),
    });
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
          backupStore={mockStore}
        />,
      );
    });

    const fileInput = container.querySelector(
      'input[type="file"][aria-label="Restore from an export file"]',
    ) as HTMLInputElement;
    const testFile = new File(['{"app":"blackbook","sessions":[]}'], 'my-backup.json', {
      type: 'application/json',
    });

    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        value: [testFile],
        writable: true,
        configurable: true,
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const dialog = container.querySelector('[role="alertdialog"]');
    const confirmBtn = Array.from(dialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Restore',
    );

    await act(async () => {
      confirmBtn?.click();
    });

    expect(mockStore.restoreExport).toHaveBeenCalledTimes(1);
    expect(mockStore.restoreExport).toHaveBeenCalledWith({
      app: 'blackbook',
      sessions: [],
    });

    expect(container.textContent).toContain('2 sessions');
    expect(container.textContent).toContain('6 attempts');
    expect(container.textContent).toContain('20 events');
    expect(container.textContent).toContain('1 mistake tags');

    await act(async () => {
      root.unmount();
    });
  });

  it('bad JSON shows an error and does not call restoreExport', async () => {
    const mockStore = createMockBackupStore();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
          backupStore={mockStore}
        />,
      );
    });

    const fileInput = container.querySelector(
      'input[type="file"][aria-label="Restore from an export file"]',
    ) as HTMLInputElement;
    const badFile = new File(['{ this is not valid json : 123'], 'bad.json', {
      type: 'application/json',
    });

    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        value: [badFile],
        writable: true,
        configurable: true,
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const dialog = container.querySelector('[role="alertdialog"]');
    const confirmBtn = Array.from(dialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Restore',
    );

    await act(async () => {
      confirmBtn?.click();
    });

    expect(mockStore.restoreExport).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Invalid JSON');

    await act(async () => {
      root.unmount();
    });
  });

  it('plain error message displayed when store rejects restore', async () => {
    const mockStore = createMockBackupStore({
      restoreSnapshot: vi.fn().mockRejectedValue(new Error('damaged or not a Blackbook file')),
    });
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
          backupStore={mockStore}
        />,
      );
    });

    const restoreBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Restore',
    );
    await act(async () => {
      restoreBtn?.click();
    });

    const dialog = container.querySelector('[role="alertdialog"]');
    const confirmBtn = Array.from(dialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Restore',
    );

    await act(async () => {
      confirmBtn?.click();
    });

    expect(mockStore.restoreSnapshot).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('damaged or not a Blackbook file');

    await act(async () => {
      root.unmount();
    });
  });

  it('disables buttons while busy during restore', async () => {
    let resolveRestore!: (res: {
      sessions: number;
      attempts: number;
      events: number;
      mistakeTags: number;
    }) => void;
    const restorePromise = new Promise<{
      sessions: number;
      attempts: number;
      events: number;
      mistakeTags: number;
    }>((resolve) => {
      resolveRestore = resolve;
    });

    const mockStore = createMockBackupStore({
      restoreSnapshot: vi.fn().mockReturnValue(restorePromise),
    });
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DataPage
          stats={mockStats}
          statsError={null}
          onExport={vi.fn().mockResolvedValue(undefined)}
          onDeleteTelemetry={vi.fn().mockResolvedValue(undefined)}
          onDeleteAll={vi.fn().mockResolvedValue(undefined)}
          onBack={vi.fn()}
          backupStore={mockStore}
        />,
      );
    });

    const restoreBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Restore',
    );
    await act(async () => {
      restoreBtn?.click();
    });

    const dialog = container.querySelector('[role="alertdialog"]');
    const confirmBtn = Array.from(dialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Restore',
    );

    // Trigger restore (which stays pending)
    let clickPromise: Promise<void>;
    act(() => {
      clickPromise = Promise.resolve(confirmBtn?.click());
    });

    // While busy:
    expect(container.textContent).toContain('Working...');
    const allButtons = Array.from(container.querySelectorAll('button'));
    expect(allButtons.every((b) => b.disabled)).toBe(true);

    // Complete restore
    await act(async () => {
      resolveRestore({ sessions: 1, attempts: 2, events: 3, mistakeTags: 4 });
      await clickPromise;
    });

    expect(container.textContent).not.toContain('Working...');
    expect(container.textContent).toContain('1 sessions');

    await act(async () => {
      root.unmount();
    });
  });
});
