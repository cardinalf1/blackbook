import { MIN_TRUSTED_ATTEMPTS, type MySkillsProps } from '../../types/drill';
import { formatDuration } from '../../utils/formatDuration';

export function MySkills({ rows, unattributed, onBack }: MySkillsProps) {
  return (
    <div className="space-y-6 text-[#FAFAFA]">
      <section className="rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-md border border-[#27272A] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
            >
              Back
            </button>
            <div>
              <h2 className="font-mono text-sm font-medium text-zinc-100">My Skills</h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                {rows.length === 0
                  ? 'No skill data available'
                  : `${rows.length} ${rows.length === 1 ? 'skill' : 'skills'} tracked, weakest first`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {rows.length === 0 ? (
        <section className="space-y-3 rounded-lg border border-[#27272A] bg-[#121215] p-8 text-center">
          <p className="text-sm text-zinc-400">No attempts yet. Finish a drill to see your skills.</p>
          {unattributed > 0 && (
            <p className="text-xs text-zinc-500">
              {`${unattributed} attempts are on questions no longer in the question bank and are not shown.`}
            </p>
          )}
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border border-[#27272A] bg-[#121215]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#27272A] bg-[#0A0A0C]/60 font-mono text-xs text-zinc-400">
                  <th className="px-3 py-2.5">Section</th>
                  <th className="px-3 py-2.5">Domain</th>
                  <th className="px-3 py-2.5">Skill</th>
                  <th className="px-3 py-2.5">Attempts</th>
                  <th className="px-3 py-2.5">Accuracy</th>
                  <th className="px-3 py-2.5">Average time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const pct = Math.round((row.accuracy ?? 0) * 100);
                  const clampedPct = Math.max(0, Math.min(100, pct));
                  return (
                    <tr
                      key={row.skillCode}
                      className="border-b border-[#27272A] text-xs transition-colors hover:bg-zinc-800/40 text-zinc-300"
                    >
                      <td className="px-3 py-2.5 font-mono text-zinc-200">
                        {row.section === 'rw' ? 'RW' : 'Math'}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2.5 text-zinc-300" title={row.domain}>
                        {row.domain}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-zinc-200">{row.skill}</div>
                        {row.lowData && (
                          <div className="mt-1 inline-flex items-center gap-1.5 rounded border border-amber-800/60 bg-amber-950/60 px-2 py-0.5 text-xs text-amber-300">
                            <span>
                              {`Only ${row.attempts} attempts, too few to trust (need at least ${MIN_TRUSTED_ATTEMPTS})`}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-200">{row.attempts}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="w-10 font-mono text-zinc-200">{clampedPct}%</span>
                          <div
                            className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800"
                            role="progressbar"
                            aria-label={`${row.skill} accuracy`}
                            aria-valuenow={clampedPct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              className={`h-full rounded-full ${
                                clampedPct >= 75
                                  ? 'bg-emerald-400'
                                  : clampedPct >= 50
                                    ? 'bg-amber-400'
                                    : 'bg-red-400'
                              }`}
                              style={{ width: `${clampedPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">
                        {formatDuration(row.avgTimeMs)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {unattributed > 0 && (
            <div className="border-t border-[#27272A] px-4 py-3 text-xs text-zinc-400">
              {`${unattributed} attempts are on questions no longer in the question bank and are not shown.`}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
