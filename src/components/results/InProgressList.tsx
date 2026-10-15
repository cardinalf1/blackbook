import { useState } from 'react';
import type { InProgressListProps } from '../../types/session';
import { formatDuration } from '../../utils/formatDuration';

function formatRelativeTime(lastActivityAt: number): string {
  const diffMs = Math.max(0, Date.now() - lastActivityAt);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return 'just now';
  }
  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  return new Date(lastActivityAt).toLocaleDateString();
}

export function InProgressList({ rows, onResume, onDiscard }: InProgressListProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (rows.length === 0) {
    return null;
  }

  const handleStartDiscard = (id: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setConfirmingId(id);
  };

  const handleCancelDiscard = () => {
    setConfirmingId(null);
  };

  const handleConfirmDiscard = async (id: string) => {
    setBusyId(id);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      await onDiscard(id);
      setConfirmingId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrors((prev) => ({ ...prev, [id]: message }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-lg border border-amber-900/50 bg-[#121215] p-5 text-[#FAFAFA]">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm font-medium text-zinc-100">
          In progress ({rows.length})
        </h2>
      </div>

      <div className="mt-4 divide-y divide-[#27272A]">
        {rows.map((row) => {
          const isConfirming = confirmingId === row.id;
          const isBusy = busyId === row.id;
          const error = errors[row.id];

          return (
            <div key={row.id} className="py-3.5 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-medium text-zinc-100">{row.kindLabel}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-300">{row.sectionLabel}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400">{row.filtersLabel}</span>
                  <span className="text-zinc-600">·</span>
                  <span className="font-mono text-zinc-300">
                    {row.answered} of {row.total} answered
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="font-mono text-zinc-400">
                    {formatDuration(row.activeMs)}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400">
                    {formatRelativeTime(row.lastActivityAt)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onResume(row.id)}
                    aria-label={`Resume ${row.kindLabel}, ${row.answered} of ${row.total} answered`}
                    disabled={isBusy}
                    className="rounded-md bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                  >
                    Resume
                  </button>
                  {!isConfirming && (
                    <button
                      type="button"
                      onClick={() => handleStartDiscard(row.id)}
                      disabled={isBusy}
                      className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                    >
                      Discard
                    </button>
                  )}
                </div>
              </div>

              {isConfirming && (
                <div
                  role="alertdialog"
                  aria-label="Confirm discard"
                  className="mt-3 rounded-md border border-red-900/60 bg-[#0A0A0C] p-3.5 space-y-2"
                >
                  <p className="text-xs text-zinc-300">
                    Discard this unfinished session? It is kept as abandoned and will not count toward your skills.
                  </p>
                  {isBusy && (
                    <p className="text-xs font-medium text-zinc-400" role="status">
                      Discarding...
                    </p>
                  )}
                  {error && (
                    <p className="text-xs text-red-400" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelDiscard}
                      disabled={isBusy}
                      className="rounded-md border border-[#27272A] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConfirmDiscard(row.id)}
                      disabled={isBusy}
                      className="rounded-md border border-red-800 bg-red-950/80 px-3.5 py-1.5 font-mono text-xs font-semibold text-red-400 transition-colors hover:bg-red-900/60 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                    >
                      {isBusy ? 'Discarding...' : 'Discard'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
