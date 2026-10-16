import { useState } from 'react';
import type { PastDrillsProps, PastHidingProps } from '../../types/session';
import { formatDuration } from '../../utils/formatDuration';

const btn =
  'rounded-md border border-[#27272A] px-3 py-1 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400';

/** "Show hidden" and "Hide all sessions before..." with a confirmation step. */
function HidingBar({ hiding, hiddenCount }: { hiding: PastHidingProps; hiddenCount: number }) {
  const [asking, setAsking] = useState(false);
  const [day, setDay] = useState('');
  const before = day ? new Date(`${day}T00:00:00`).getTime() : null;
  return (
    <div className="mt-4 space-y-3 border-t border-[#27272A] pt-4 text-xs text-zinc-300">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hiding.showHidden} onChange={(e) => hiding.onShowHidden(e.target.checked)} />
          Show hidden sessions ({hiddenCount})
        </label>
        {!asking && (
          <button type="button" className={btn} onClick={() => setAsking(true)}>
            Hide all sessions before...
          </button>
        )}
      </div>
      {asking && (
        <div className="space-y-2 rounded-md border border-[#27272A] p-3" role="group" aria-label="Hide all sessions before a date">
          <label className="flex items-center gap-2">
            Before
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="rounded-md border border-[#27272A] bg-black px-2 py-1 text-xs text-zinc-100 [color-scheme:dark]" />
          </label>
          {before !== null && (
            <p>
              Hide every finished session before {new Date(before).toLocaleDateString()} from the dashboard and analytics? They still count as seen for tests, the
              retry queue and fresh-question counts. You can show them again here.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className={btn}
              disabled={before === null}
              onClick={() => {
                if (before === null) return;
                hiding.onHideBefore(before);
                setAsking(false);
                setDay('');
              }}
            >
              Hide them
            </button>
            <button type="button" className={btn} onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PastDrills({ rows: allRows, inProgressSlot, onOpen, onBack, hiding }: PastDrillsProps) {
  const rows = hiding && !hiding.showHidden ? allRows.filter((r) => !hiding.hidden.has(r.id)) : allRows;
  const hiddenCount = hiding ? allRows.filter((r) => hiding.hidden.has(r.id)).length : 0;
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
        {hiding && <HidingBar hiding={hiding} hiddenCount={hiddenCount} />}
      </section>

      {inProgressSlot}

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
                      <td className="px-3 py-2.5 text-zinc-300">
                        {row.kindLabel}
                        {hiding?.hidden.has(row.id) && <span className="ml-2 rounded border border-zinc-600 px-1 font-mono text-[10px] uppercase text-zinc-400">Hidden</span>}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-300">{row.sectionLabel}</td>
                      <td className="px-3 py-2.5 text-zinc-300">{row.filtersLabel}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-200">
                        {row.correct} / {row.total} ({pct}%)
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-400">
                        {formatDuration(row.totalActiveMs)}
                      </td>
                      <td className="space-x-2 whitespace-nowrap px-3 py-2.5 text-right">
                        {hiding && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              hiding.onSetHidden(row.id, !hiding.hidden.has(row.id));
                            }}
                            className={btn}
                            title="Hidden sessions leave the dashboard and analytics but still count as seen"
                          >
                            {hiding.hidden.has(row.id) ? 'Show in analytics' : 'Hide from analytics'}
                          </button>
                        )}
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
