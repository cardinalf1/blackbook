import { useCallback, useEffect, useState } from 'react';
import { backupStore as defaultBackupStore } from '../../services/storage';
import type { BackupList, BackupStore, RestoreResult } from '../../types/backup';
import type { DataPageProps as BaseDataPageProps } from '../../types/session';
import { formatBytes } from '../../utils/formatBytes';

export interface DataPageProps extends BaseDataPageProps {
  backupStore?: BackupStore;
}

type ActionType = 'export' | 'deleteTelemetry' | 'deleteAll';

type RestoreTarget =
  | { type: 'snapshot'; name: string }
  | { type: 'file'; file: File };

async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

/** The word to type before "Delete all progress" runs. */
export const DELETE_ALL_WORD = 'DELETE';

export function DataPage({
  stats,
  statsError,
  onExport,
  onDeleteTelemetry,
  onDeleteAll,
  onBack,
  backupStore = defaultBackupStore,
}: DataPageProps) {
  const [confirming, setConfirming] = useState<ActionType | null>(null);
  /** What the user typed to confirm "Delete all progress". */
  const [deleteWord, setDeleteWord] = useState('');
  const [busyAction, setBusyAction] = useState<ActionType | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ action: ActionType; text: string } | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<{ action: ActionType; text: string } | null>(
    null,
  );

  // Backup and restore state
  const [backupList, setBackupList] = useState<BackupList | null>(null);
  const [backupListLoading, setBackupListLoading] = useState<boolean>(true);
  const [backupListError, setBackupListError] = useState<string | null>(null);
  const [confirmingRestore, setConfirmingRestore] = useState<RestoreTarget | null>(null);
  const [restoreBusy, setRestoreBusy] = useState<boolean>(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const isBusy = busyAction !== null || restoreBusy;

  const loadBackups = useCallback(async () => {
    setBackupListLoading(true);
    setBackupListError(null);
    try {
      const list = await backupStore.list();
      setBackupList(list);
    } catch (err) {
      setBackupListError(err instanceof Error ? err.message : String(err));
    } finally {
      setBackupListLoading(false);
    }
  }, [backupStore]);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  const handleOpenConfirm = (action: ActionType) => {
    setConfirming(action);
    setDeleteWord('');
    setErrorMessage(null);
  };

  const handleCancel = () => {
    setConfirming(null);
    setDeleteWord('');
    setErrorMessage(null);
  };

  const handleRunAction = async (action: ActionType) => {
    setBusyAction(action);
    setErrorMessage(null);
    try {
      if (action === 'export') {
        await onExport();
        setStatusMessage({ action: 'export', text: 'Data exported successfully.' });
      } else if (action === 'deleteTelemetry') {
        await onDeleteTelemetry();
        setStatusMessage({ action: 'deleteTelemetry', text: 'Telemetry deleted. Anything there was to lose is in a safety copy under Backups and restore.' });
        void loadBackups();
      } else if (action === 'deleteAll') {
        await onDeleteAll();
        setStatusMessage({ action: 'deleteAll', text: 'All progress deleted. Anything there was to lose is in a safety copy under Backups and restore.' });
        void loadBackups();
      }
      setConfirming(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage({ action, text: msg });
    } finally {
      setBusyAction(null);
    }
  };

  const handleStartSnapshotRestore = (name: string) => {
    setRestoreError(null);
    setRestoreStatus(null);
    setConfirmingRestore({ type: 'snapshot', name });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreError(null);
      setRestoreStatus(null);
      setConfirmingRestore({ type: 'file', file });
    }
    e.target.value = '';
  };

  const handleCancelRestore = () => {
    setConfirmingRestore(null);
    setRestoreError(null);
  };

  const handleConfirmRestore = async () => {
    if (!confirmingRestore) return;
    setRestoreBusy(true);
    setRestoreError(null);
    setRestoreStatus(null);
    try {
      let result: RestoreResult;
      if (confirmingRestore.type === 'snapshot') {
        result = await backupStore.restoreSnapshot(confirmingRestore.name);
      } else {
        let text = '';
        try {
          text = await readFileAsText(confirmingRestore.file);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not read file.';
          setRestoreError(msg);
          setRestoreBusy(false);
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          setRestoreError('Invalid JSON: could not parse file.');
          setRestoreBusy(false);
          return;
        }

        result = await backupStore.restoreExport(parsed);
      }

      setRestoreStatus(
        `Restored: ${result.sessions} sessions, ${result.attempts} attempts, ${result.events} events, ${result.mistakeTags} mistake tags.`,
      );
      setConfirmingRestore(null);
      await loadBackups();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRestoreError(msg);
    } finally {
      setRestoreBusy(false);
    }
  };

  return (
    <div className="space-y-6 text-[#FAFAFA]">
      {/* Header section */}
      <section className="rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={isBusy}
              className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
            >
              Back
            </button>
            <div>
              <h2 className="font-mono text-sm font-medium text-zinc-100">Your data</h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Everything Blackbook saves stays on this computer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats card */}
      <section className="rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <h3 className="mb-4 font-mono text-xs uppercase tracking-wider text-zinc-400">
          Storage overview
        </h3>
        {statsError ? (
          <p className="text-xs text-red-400">{statsError}</p>
        ) : stats === null ? (
          <p className="text-xs text-zinc-400">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3.5">
              <span className="text-xs text-zinc-400">Sessions</span>
              <div className="mt-1 font-mono text-xl font-semibold text-zinc-100">
                {stats.sessions}
              </div>
            </div>

            <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3.5">
              <span className="text-xs text-zinc-400">Attempts</span>
              <div className="mt-1 font-mono text-xl font-semibold text-zinc-100">
                {stats.attempts}
              </div>
            </div>

            <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3.5">
              <span className="text-xs text-zinc-400">Telemetry events</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-xl font-semibold text-zinc-100">
                  {stats.events}
                </span>
                <span className="font-mono text-xs text-zinc-400">
                  ({formatBytes(stats.eventBytes)})
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Backups and restore */}
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#27272A] pb-3">
          <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
            Backups and restore
          </h3>
          <span className="font-mono text-xs text-zinc-400">
            {backupList?.lastBackupAt
              ? `Last backup: ${new Date(backupList.lastBackupAt).toLocaleString()}`
              : 'No backup yet'}
          </span>
        </div>

        <p className="text-xs text-zinc-400">
          Backups hold your progress only, never the question bank; the app keeps the last 7 daily snapshots.
        </p>

        {restoreStatus && (
          <p role="status" className="rounded-md border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-400">
            {restoreStatus}
          </p>
        )}

        {/* Snapshot list */}
        <div className="space-y-3">
          <h4 className="font-mono text-xs text-zinc-300">Snapshots</h4>

          {backupListLoading ? (
            <p className="text-xs text-zinc-400">Loading backups...</p>
          ) : backupListError ? (
            <p className="text-xs text-red-400">{backupListError}</p>
          ) : backupList?.backups.length === 0 ? (
            <p className="text-xs text-zinc-400">No snapshots saved yet.</p>
          ) : (
            backupList?.backups.map((backup) => {
              const isConfirmingThis =
                confirmingRestore?.type === 'snapshot' && confirmingRestore.name === backup.name;
              return (
                <div
                  key={backup.name}
                  className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3.5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-zinc-200">
                          {backup.name}
                        </span>
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                          {backup.kind === 'daily' ? 'Daily' : backup.kind === 'before_restore' ? 'Safety copy before a restore' : 'Safety copy before a delete'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span>{new Date(backup.at).toLocaleString()}</span>
                        <span>•</span>
                        <span>{formatBytes(backup.sizeBytes)}</span>
                      </div>
                    </div>

                    {!isConfirmingThis && (
                      <button
                        type="button"
                        onClick={() => handleStartSnapshotRestore(backup.name)}
                        disabled={isBusy}
                        className="self-start rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50 sm:self-auto"
                      >
                        Restore
                      </button>
                    )}
                  </div>

                  {isConfirmingThis && (
                    <div
                      role="alertdialog"
                      aria-label="Confirm restore"
                      className="mt-3 rounded-md border border-amber-900/60 bg-[#121215] p-3.5"
                    >
                      <p className="text-xs text-zinc-300">
                        This replaces your current progress with the backup. A safety copy of your current progress is saved first.
                      </p>
                      {restoreBusy && (
                        <p className="mt-2 text-xs font-medium text-zinc-400">Working...</p>
                      )}
                      {restoreError && (
                        <p className="mt-2 text-xs text-red-400">{restoreError}</p>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCancelRestore}
                          disabled={isBusy}
                          className="rounded-md border border-[#27272A] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmRestore}
                          disabled={isBusy}
                          className="rounded-md border border-amber-800 bg-amber-950/80 px-3.5 py-1.5 font-mono text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-900/60 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Restore from export file picker */}
        <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-xs font-semibold text-zinc-200">Restore from an export file</h4>
              <p className="mt-0.5 text-xs text-zinc-400">
                Upload a JSON export file to restore your sessions, attempts and telemetry.
              </p>
            </div>
            <label
              className={`self-start rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-within:ring-2 focus-within:ring-zinc-400 sm:self-auto cursor-pointer ${
                isBusy ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <span>Restore from an export file</span>
              <input
                type="file"
                accept=".json,application/json"
                aria-label="Restore from an export file"
                disabled={isBusy}
                className="sr-only"
                onChange={handleFileSelect}
              />
            </label>
          </div>

          {confirmingRestore?.type === 'file' && (
            <div
              role="alertdialog"
              aria-label="Confirm restore"
              className="mt-4 rounded-md border border-amber-900/60 bg-[#121215] p-3.5"
            >
              <p className="text-xs text-zinc-300">
                This replaces your current progress with the backup. A safety copy of your current progress is saved first.
              </p>
              {restoreBusy && (
                <p className="mt-2 text-xs font-medium text-zinc-400">Working...</p>
              )}
              {restoreError && (
                <p className="mt-2 text-xs text-red-400">{restoreError}</p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelRestore}
                  disabled={isBusy}
                  className="rounded-md border border-[#27272A] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={isBusy}
                  className="rounded-md border border-amber-800 bg-amber-950/80 px-3.5 py-1.5 font-mono text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-900/60 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                >
                  Restore
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Actions */}
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <h3 className="border-b border-[#27272A] pb-3 font-mono text-xs uppercase tracking-wider text-zinc-400">
          Data actions
        </h3>

        <div className="space-y-4">
          {/* Action 1: Export my data */}
          <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-xs font-semibold text-zinc-200">Export my data</h4>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Save a JSON file with your sessions, answers and telemetry.
                </p>
              </div>
              {confirming !== 'export' && (
                <button
                  type="button"
                  onClick={() => handleOpenConfirm('export')}
                  disabled={isBusy}
                  className="self-start rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50 sm:self-auto"
                >
                  Export my data
                </button>
              )}
            </div>

            {confirming === 'export' && (
              <div
                role="alertdialog"
                aria-label="Confirm export my data"
                className="mt-4 rounded-md border border-zinc-700 bg-[#121215] p-3.5"
              >
                <p className="text-xs text-zinc-300">
                  Save a JSON file with your sessions, answers and telemetry. It contains no question text.
                </p>
                {busyAction === 'export' && (
                  <p className="mt-2 text-xs font-medium text-zinc-400">Working...</p>
                )}
                {errorMessage?.action === 'export' && (
                  <p className="mt-2 text-xs text-red-400">{errorMessage.text}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isBusy}
                    className="rounded-md border border-[#27272A] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunAction('export')}
                    disabled={isBusy}
                    className="rounded-md bg-zinc-100 px-3.5 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                  >
                    Export
                  </button>
                </div>
              </div>
            )}

            {statusMessage?.action === 'export' && (
              <p role="status" className="mt-2 text-xs text-emerald-400">
                {statusMessage.text}
              </p>
            )}
          </div>

          {/* Action 2: Delete telemetry */}
          <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-xs font-semibold text-zinc-200">Delete telemetry</h4>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Delete the event log (timings and clicks). Your answers, sessions and skills stay.
                </p>
              </div>
              {confirming !== 'deleteTelemetry' && (
                <button
                  type="button"
                  onClick={() => handleOpenConfirm('deleteTelemetry')}
                  disabled={isBusy}
                  className="self-start rounded-md border border-red-900/60 bg-red-950/20 px-3.5 py-1.5 text-xs font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/40 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50 sm:self-auto"
                >
                  Delete telemetry
                </button>
              )}
            </div>

            {confirming === 'deleteTelemetry' && (
              <div
                role="alertdialog"
                aria-label="Confirm delete telemetry"
                className="mt-4 rounded-md border border-red-900/60 bg-[#121215] p-3.5"
              >
                <p className="text-xs text-zinc-300">
                  Delete the event log (timings and clicks). Your answers, sessions and skills stay.
                </p>
                {busyAction === 'deleteTelemetry' && (
                  <p className="mt-2 text-xs font-medium text-zinc-400">Working...</p>
                )}
                {errorMessage?.action === 'deleteTelemetry' && (
                  <p className="mt-2 text-xs text-red-400">{errorMessage.text}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isBusy}
                    className="rounded-md border border-[#27272A] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunAction('deleteTelemetry')}
                    disabled={isBusy}
                    className="rounded-md border border-red-800 bg-red-950/80 px-3.5 py-1.5 font-mono text-xs font-semibold text-red-400 transition-colors hover:bg-red-900/60 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                  >
                    Delete telemetry
                  </button>
                </div>
              </div>
            )}

            {statusMessage?.action === 'deleteTelemetry' && (
              <p role="status" className="mt-2 text-xs text-emerald-400">
                {statusMessage.text}
              </p>
            )}
          </div>

          {/* Action 3: Delete all progress */}
          <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-xs font-semibold text-zinc-200">Delete all progress</h4>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Delete every session, answer, flag, event and mistake tag.
                </p>
              </div>
              {confirming !== 'deleteAll' && (
                <button
                  type="button"
                  onClick={() => handleOpenConfirm('deleteAll')}
                  disabled={isBusy}
                  className="self-start rounded-md border border-red-900/60 bg-red-950/20 px-3.5 py-1.5 text-xs font-medium text-red-400 transition-colors hover:border-red-700 hover:bg-red-950/40 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50 sm:self-auto"
                >
                  Delete all progress
                </button>
              )}
            </div>

            {confirming === 'deleteAll' && (
              <div
                role="alertdialog"
                aria-label="Confirm delete all progress"
                className="mt-4 rounded-md border border-red-900/60 bg-[#121215] p-3.5"
              >
                <p className="text-xs text-zinc-300">
                  Delete every session, answer, flag, event and mistake tag. The question bank stays. A safety copy is saved first and listed under
                  Backups and restore, so you can bring it back from there.
                </p>
                <label className="mt-3 block text-xs text-zinc-400">
                  Type <span className="font-mono font-semibold text-zinc-200">{DELETE_ALL_WORD}</span> to confirm
                  <input
                    type="text"
                    value={deleteWord}
                    onChange={(e) => setDeleteWord(e.target.value)}
                    aria-label={`Type ${DELETE_ALL_WORD} to confirm`}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={isBusy}
                    className="mt-1 block w-40 rounded-md border border-[#27272A] bg-[#0A0A0C] px-2 py-1.5 font-mono text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none disabled:opacity-50"
                  />
                </label>
                {busyAction === 'deleteAll' && (
                  <p className="mt-2 text-xs font-medium text-zinc-400">Working...</p>
                )}
                {errorMessage?.action === 'deleteAll' && (
                  <p className="mt-2 text-xs text-red-400">{errorMessage.text}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isBusy}
                    className="rounded-md border border-[#27272A] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunAction('deleteAll')}
                    disabled={isBusy || deleteWord.trim() !== DELETE_ALL_WORD}
                    className="rounded-md border border-red-800 bg-red-950/80 px-3.5 py-1.5 font-mono text-xs font-semibold text-red-400 transition-colors hover:bg-red-900/60 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                  >
                    Delete everything
                  </button>
                </div>
              </div>
            )}

            {statusMessage?.action === 'deleteAll' && (
              <p role="status" className="mt-2 text-xs text-emerald-400">
                {statusMessage.text}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
