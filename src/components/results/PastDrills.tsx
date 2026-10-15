import type { PastDrillsProps } from '../../types/session';
import { formatDuration } from '../../utils/formatDuration';

export function PastDrills({ rows, onOpen, onBack }: PastDrillsProps) {
  return (
    <div className="space-y-6 text-[#FAFAFA]">
      <section className="rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              Back
            </button>
            <div>
              <h2 className="font-mono text-sm font-medium text-zinc-100">Past drills</h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                {rows.length === 0
                  ? 'No past drills'
                  : `${rows.length} ${rows.length === 1 ? 'drill' : 'drills'} completed`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {rows.length === 0 ? (
        <section className="rounded-lg border border-[#27272A] bg-[#121215] p-8 text-center">
          <p className="text-sm text-zinc-400">No finished drills yet.</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border border-[#27272A] bg-[#121215]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#27272A] bg-[#0A0A0C]/60 font-mono text-xs text-zinc-400">
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Kind</th>
                  <th className="px-3 py-2.5">Section</th>
                  <th className="px-3 py-2.5">Filters</th>
                  <th className="px-3 py-2.5">Score</th>
                  <th className="px-3 py-2.5">Time</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const pct = row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onOpen(row.id)}
                      className="cursor-pointer border-b border-[#27272A] text-xs text-zinc-300 transition-colors hover:bg-zinc-800/30"
                    >
                      <td className="px-3 py-2.5 font-mono text-zinc-200">
                        {new Date(row.finishedAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-300">{row.kindLabel}</td>
                      <td className="px-3 py-2.5 text-zinc-300">{row.sectionLabel}</td>
                      <td className="px-3 py-2.5 text-zinc-300">{row.filtersLabel}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-200">
                        {row.correct} / {row.total} ({pct}%)
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-400">
                        {formatDuration(row.totalActiveMs)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(row.id);
                          }}
                          className="rounded-md border border-[#27272A] px-3 py-1 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
