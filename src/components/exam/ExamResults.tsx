import type { ExamResultsProps } from '../../types/exam';
import { formatDuration } from '../../utils/formatDuration';
import { DrillReport } from '../results/DrillReport';

export function ExamResults({
  title,
  report,
  submittedBy,
  pauses,
  timeUsedMs,
  timeLimitMs,
  onItemToggle,
  onBack,
  onMySkills,
}: ExamResultsProps) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 text-[#FAFAFA]">
      {/* Header card */}
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] pb-3 sm:pb-4">
          <div>
            <h1 className="font-mono text-base font-semibold text-zinc-100">Module results</h1>
            <p className="mt-0.5 font-mono text-xs text-zinc-400">{title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMySkills}
              className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              My skills
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              Done
            </button>
          </div>
        </div>

        {/* Status lines */}
        <div className="space-y-3">
          {submittedBy === 'timer' && (
            <div className="rounded-md border border-amber-800/60 bg-amber-950/40 p-3 text-xs text-amber-300">
              Time ran out. The module was submitted automatically.
            </div>
          )}

          {pauses.length > 0 && (
            <div className="space-y-2 rounded-md border border-amber-800/60 bg-amber-950/40 p-3.5 text-xs text-amber-300">
              <div className="font-semibold text-amber-200">
                Paused: this is not a clean timed run.
              </div>
              <ul className="space-y-1">
                {pauses.map((pause, idx) => {
                  const timeStr = new Date(pause.at).toLocaleTimeString();
                  const durationStr =
                    pause.resumedAt !== null
                      ? formatDuration(pause.resumedAt - pause.at)
                      : 'not resumed';
                  return (
                    <li key={idx} className="font-mono text-xs text-amber-300/90">
                      {timeStr} · {pause.reason} · {durationStr}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="font-mono text-zinc-300">
              Time used: {formatDuration(timeUsedMs)} of {formatDuration(timeLimitMs)}
            </div>
            <div className="text-zinc-400">
              Raw score only. Scaled scores and score ranges come later.
            </div>
          </div>
        </div>
      </section>

      {/* DrillReport */}
      <DrillReport
        report={report}
        onItemToggle={onItemToggle}
        onBack={onBack}
        backLabel="Done"
        onMySkills={onMySkills}
      />
    </div>
  );
}
