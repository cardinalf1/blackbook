import type { ModuleReadyProps } from '../../types/test';

export function ModuleReady({
  title,
  questionCount,
  timeLimitMs,
  routeNote,
  resuming,
  notes,
  onStart,
  onLeave,
  busy,
}: ModuleReadyProps) {
  const minutes = Math.round(timeLimitMs / 60000);

  return (
    <section className="space-y-6 rounded-lg border border-[#27272A] bg-[#121215] p-6 text-[#FAFAFA] sm:p-8">
      <div>
        <h2 className="font-mono text-base font-medium text-zinc-100">{title}</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {questionCount} questions, {minutes} minutes
        </p>
      </div>

      {routeNote && (
        <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3 text-sm text-zinc-300">
          {routeNote}
        </div>
      )}

      {notes.length > 0 && (
        <ul
          className="space-y-1 rounded-md border border-amber-900/50 bg-amber-950/30 p-3 text-xs text-amber-200"
          role="status"
        >
          {notes.map((note, idx) => (
            <li key={idx}>{note}</li>
          ))}
        </ul>
      )}

      <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-4 text-sm text-zinc-300">
        {resuming ? (
          <p>The clock for this module is already running.</p>
        ) : (
          <p>The clock starts when you press Start.</p>
        )}
      </div>

      <div className="flex flex-col items-start gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={busy}
          onClick={onStart}
          className="rounded-md bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          {resuming ? 'Resume module' : 'Start module'}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={onLeave}
          className="text-xs text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Leave (a started module&apos;s clock keeps running)
        </button>
      </div>
    </section>
  );
}
