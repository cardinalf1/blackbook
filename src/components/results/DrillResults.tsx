import type { DrillResultsProps } from '../../types/drill';
import { formatDuration } from '../../utils/formatDuration';

export function DrillResults({ summary, onReview, onDone, onMySkills }: DrillResultsProps) {
  const { total, correct, totalTimeMs, items } = summary;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  const avgTimeMs = total > 0 ? Math.round(totalTimeMs / total) : 0;
  const missedItems = items.filter((item) => !item.correct);

  return (
    <div className="space-y-6 text-[#FAFAFA]">
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] pb-3 sm:pb-4">
          <div>
            <h2 className="font-mono text-sm font-medium text-zinc-100">Session Results</h2>
            <p className="mt-0.5 text-xs text-zinc-400">Drill complete</p>
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
              onClick={onDone}
              className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              Done
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3.5">
            <span className="text-xs text-zinc-400">Score</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl font-semibold text-zinc-100">
                {correct} / {total}
              </span>
              <span className="font-mono text-xs text-zinc-400">({percentage}%)</span>
            </div>
          </div>

          <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3.5">
            <span className="text-xs text-zinc-400">Total Time</span>
            <div className="mt-1">
              <span className="font-mono text-xl font-semibold text-zinc-100">
                {formatDuration(totalTimeMs)}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3.5">
            <span className="text-xs text-zinc-400">Average Time</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-xl font-semibold text-zinc-100">
                {formatDuration(avgTimeMs)}
              </span>
              <span className="text-xs text-zinc-400">/ question</span>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#27272A] bg-[#121215]">
        <div className="border-b border-[#27272A] px-5 py-3">
          <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
            Questions ({items.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#27272A] bg-[#0A0A0C]/60 font-mono text-xs text-zinc-400">
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">ID</th>
                <th className="px-3 py-2.5">Skill</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Time</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-zinc-500">
                    No questions in this session.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr
                    key={item.questionId}
                    className="border-b border-[#27272A] text-xs text-zinc-300 transition-colors hover:bg-zinc-800/30"
                  >
                    <td className="px-3 py-2.5 font-mono text-zinc-400">{index + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-zinc-200">#{item.displayId}</td>
                    <td className="px-3 py-2.5 text-zinc-300">{item.skill}</td>
                    <td className="px-3 py-2.5">
                      {item.correct ? (
                        <span className="rounded border border-emerald-800/60 bg-emerald-950/60 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                          Correct
                        </span>
                      ) : (
                        <span className="rounded border border-red-800/60 bg-red-950/60 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
                          Missed
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-zinc-300">
                      {formatDuration(item.timeMs)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="border-b border-[#27272A] pb-3">
          <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
            Missed Questions ({missedItems.length})
          </h3>
        </div>

        {missedItems.length === 0 ? (
          <p className="text-xs text-zinc-400">No missed questions.</p>
        ) : (
          <ul className="space-y-2">
            {missedItems.map((item) => (
              <li
                key={item.questionId}
                className="flex flex-col gap-2.5 rounded-md border border-[#27272A] bg-[#0A0A0C] p-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-zinc-200">#{item.displayId}</span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-zinc-300">{item.skill}</span>
                  <span className="text-zinc-500">•</span>
                  <span className="font-mono text-zinc-400">{formatDuration(item.timeMs)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onReview(item.questionId)}
                  className="self-start rounded-md border border-[#27272A] px-3 py-1 text-xs text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 sm:self-auto"
                >
                  Review explanation
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onMySkills}
          className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          My skills
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Done
        </button>
      </div>
    </div>
  );
}
