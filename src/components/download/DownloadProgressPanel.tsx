import { useEffect, useId } from 'react';
import type { DownloadProgress, DownloadProgressPanelProps } from '../../types/download';
import { formatBytes } from '../../utils/formatBytes';
import { formatDuration } from '../../utils/formatDuration';

function formatEta(etaSeconds: number | null): string | null {
  if (etaSeconds === null || !Number.isFinite(etaSeconds) || etaSeconds < 0) {
    return null;
  }
  if (etaSeconds < 60) {
    return 'Less than a minute left';
  }
  const minutes = Math.max(1, Math.round(etaSeconds / 60));
  return `About ${minutes} min left`;
}

interface StageInfo {
  text: string;
  type: 'indeterminate' | 'progress';
  pct: number;
}

function getStageInfo(progress: DownloadProgress): StageInfo {
  switch (progress.stage) {
    case 'lists':
      return {
        text: 'Getting question lists',
        type: 'indeterminate',
        pct: 0,
      };
    case 'details': {
      if (progress.toFetch === 0) {
        return {
          text: 'Everything is already downloaded',
          type: 'progress',
          pct: 100,
        };
      }
      const fetched = progress.fetched;
      const toFetch = progress.toFetch;
      const pct = Math.min(100, Math.max(0, (fetched / toFetch) * 100));
      return {
        text: `Downloading questions ${fetched} of ${toFetch}`,
        type: 'progress',
        pct,
      };
    }
    case 'normalize': {
      const normalized = progress.normalized;
      const questions = progress.questions;
      const pct = questions > 0 ? Math.min(100, Math.max(0, (normalized / questions) * 100)) : 0;
      return {
        text: `Preparing questions ${normalized} of ${questions}`,
        type: 'progress',
        pct,
      };
    }
    case 'saving':
      return {
        text: 'Saving',
        type: 'indeterminate',
        pct: 0,
      };
    default:
      return {
        text: '',
        type: 'indeterminate',
        pct: 0,
      };
  }
}

export function DownloadProgressPanel({
  progress,
  onCancel,
  onRetry,
  onClose,
  onFreeCache,
}: DownloadProgressPanelProps) {
  const headingId = useId();

  useEffect(() => {
    if (progress.status === 'idle' || progress.status === 'running') {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [progress.status, onClose]);

  if (progress.status === 'idle') {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-6 text-[#FAFAFA] shadow-xl">
        {progress.status === 'running' && (
          <>
            <h2 id={headingId} className="font-mono text-sm font-medium text-zinc-100">
              Downloading questions
            </h2>

            {(() => {
              const stageInfo = getStageInfo(progress);
              const etaText = formatEta(progress.etaSeconds);
              return (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-zinc-200">{stageInfo.text}</span>
                      {etaText && <span className="font-mono text-zinc-400">{etaText}</span>}
                    </div>
                    {stageInfo.type === 'indeterminate' ? (
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div className="h-full w-full bg-zinc-400 animate-pulse" />
                      </div>
                    ) : (
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full bg-zinc-200 transition-all duration-300"
                          style={{ width: `${stageInfo.pct}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="font-mono text-xs text-zinc-400">
                    cached {progress.cached}, failed {progress.failed}, retries {progress.retries}
                  </div>

                  <p className="text-xs text-zinc-400">Keep Blackbook open until this finishes.</p>

                  <div className="flex items-center justify-end border-t border-[#27272A] pt-4">
                    <button
                      type="button"
                      onClick={onCancel}
                      className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {progress.status === 'succeeded' && (
          <>
            <h2 id={headingId} className="font-mono text-sm font-medium text-zinc-100">
              Download complete
            </h2>

            <div className="space-y-4">
              <p className="text-xs text-zinc-300">
                {progress.summary?.questions ?? progress.questions} questions saved (
                {progress.summary?.live ?? 0} in the live set)
              </p>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-2.5">
                  <span className="text-xs text-zinc-400">Reading and Writing</span>
                  <div className="mt-1 font-mono text-sm font-semibold text-zinc-100">
                    {progress.summary?.bySection.rw ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-2.5">
                  <span className="text-xs text-zinc-400">Math</span>
                  <div className="mt-1 font-mono text-sm font-semibold text-zinc-100">
                    {progress.summary?.bySection.math ?? 0}
                  </div>
                </div>
                <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-2.5">
                  <span className="text-xs text-zinc-400">Duration</span>
                  <div className="mt-1 font-mono text-sm font-semibold text-zinc-100">
                    {formatDuration(progress.summary?.durationMs ?? 0)}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 rounded-md border border-[#27272A] bg-[#0A0A0C] p-3 text-xs">
                <div className="font-mono text-xs uppercase tracking-wider text-zinc-400">Skipped</div>
                {!progress.summary?.skipped || progress.summary.skipped.length === 0 ? (
                  <p className="text-zinc-400">Nothing was skipped.</p>
                ) : (
                  <ul className="space-y-1 font-mono text-zinc-300">
                    {progress.summary.skipped.map((skip, idx) => (
                      <li key={idx}>
                        {skip.description}: {skip.count}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {progress.cache.files > 0 && (
                <div className="space-y-1.5 border-t border-[#27272A] pt-3">
                  <button
                    type="button"
                    onClick={onFreeCache}
                    className="rounded-md border border-[#27272A] px-3 py-1.5 font-mono text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  >
                    Free download cache ({formatBytes(progress.cache.bytes)})
                  </button>
                  <p className="text-xs text-zinc-400">Only needed to resume or refresh faster.</p>
                </div>
              )}

              <div className="flex items-center justify-end border-t border-[#27272A] pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  Done
                </button>
              </div>
            </div>
          </>
        )}

        {progress.status === 'failed' && (
          <>
            <h2 id={headingId} className="font-mono text-sm font-medium text-zinc-100">
              Download stopped
            </h2>

            <div className="space-y-4">
              {progress.error && (
                <div
                  role="alert"
                  className="space-y-1.5 rounded-md border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300"
                >
                  <p>{progress.error.message}</p>
                  {progress.error.lastRequest && (
                    <p className="font-mono text-[11px] text-red-400 break-all">
                      Last request: {progress.error.lastRequest}
                    </p>
                  )}
                </div>
              )}

              <p className="text-xs text-zinc-400">Your previous questions were not changed.</p>

              <div className="flex items-center justify-end gap-3 border-t border-[#27272A] pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  Retry
                </button>
              </div>
            </div>
          </>
        )}

        {progress.status === 'cancelled' && (
          <>
            <h2 id={headingId} className="font-mono text-sm font-medium text-zinc-100">
              Download cancelled
            </h2>

            <div className="space-y-4">
              <p className="text-xs text-zinc-400">
                Your previous questions were not changed. Downloaded parts are kept, so the next
                download resumes.
              </p>

              <div className="flex items-center justify-end gap-3 border-t border-[#27272A] pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  Retry
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
