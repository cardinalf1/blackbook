import { LOW_CONFIDENCE_ATTEMPTS } from '../../config/analyticsConfig';
import type { StudyNextScreenProps } from '../../types/analytics';
import type { Section } from '../../types/sat';

const SECTION_LABEL: Record<Section, string> = {
  rw: 'Reading and Writing',
  math: 'Math',
};

export function StudyNextScreen({
  recommendations,
  methodNote,
  topDrills,
  missDrills,
  onLaunch,
}: StudyNextScreenProps) {
  return (
    <div className="space-y-6 text-[#FAFAFA]">
      <header className="space-y-1">
        <h2 className="font-mono text-base font-semibold text-zinc-100">Study next</h2>
        <p className="text-xs text-zinc-400">{methodNote}</p>
      </header>

      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        {topDrills.length > 0 && (
          <div className="space-y-3">
            {topDrills.map((drill) => (
              <div key={`top-${drill.section}`} className="space-y-1">
                <button
                  type="button"
                  onClick={() => onLaunch(drill.config)}
                  className="rounded-md border border-[#27272A] bg-zinc-800/60 px-3.5 py-1.5 font-mono text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  Drill top skills in {SECTION_LABEL[drill.section]}
                </button>
                <p className="text-xs text-zinc-400">
                  {drill.skills.map((s) => s.skill).join(', ')}
                </p>
                <p className="text-xs text-zinc-500">
                  prefers questions you have not answered yet
                </p>
              </div>
            ))}
          </div>
        )}

        {missDrills.length > 0 ? (
          <div className={`space-y-3 ${topDrills.length > 0 ? 'border-t border-[#27272A] pt-4' : ''}`}>
            {missDrills.map((drill) => (
              <div key={`miss-${drill.section}`} className="space-y-1">
                <button
                  type="button"
                  onClick={() => onLaunch(drill.config)}
                  className="rounded-md border border-[#27272A] bg-zinc-800/60 px-3.5 py-1.5 font-mono text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  Review my misses in {SECTION_LABEL[drill.section]}
                </button>
                <p className="text-xs text-zinc-400">
                  {drill.available} missed questions, oldest miss first (up to {drill.config.count} per drill)
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className={topDrills.length > 0 ? 'border-t border-[#27272A] pt-4' : ''}>
            <p className="text-xs text-zinc-400">No missed questions to review.</p>
          </div>
        )}
      </section>

      {recommendations.length === 0 ? (
        <section className="rounded-lg border border-[#27272A] bg-[#121215] p-8 text-center">
          <p className="text-sm text-zinc-400">
            Nothing to recommend yet. Finish a drill or an exam module first.
          </p>
        </section>
      ) : (
        <ol className="space-y-3">
          {recommendations.map((rec, index) => {
            const clampedPriority = Math.max(0, Math.min(1, rec.priority));
            const priorityPct = Math.round(clampedPriority * 100);
            const isLowConfidence = rec.attempts < LOW_CONFIDENCE_ATTEMPTS;

            return (
              <li
                key={rec.skillCode}
                className="rounded-lg border border-[#27272A] bg-[#121215] p-4 text-xs text-zinc-300 transition-colors"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-zinc-400">
                        #{index + 1}
                      </span>
                      <h3 className="text-sm font-medium text-zinc-100">{rec.skill}</h3>
                    </div>
                    <p className="text-xs text-zinc-400">
                      {rec.domain} · {SECTION_LABEL[rec.section]}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800"
                      role="progressbar"
                      aria-label={`priority for ${rec.skill}`}
                      aria-valuenow={priorityPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-zinc-300"
                        style={{ width: `${priorityPct}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-zinc-300">
                      priority {rec.priority.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#27272A] pt-3 font-mono text-xs text-zinc-300">
                  <div className="flex items-center gap-1.5">
                    <span>{rec.attempts} answers</span>
                    {isLowConfidence && (
                      <span className="rounded border border-amber-800/60 bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
                        low N
                      </span>
                    )}
                  </div>
                  <span>
                    {rec.correct} of {rec.attempts}
                  </span>
                  <span>
                    {rec.unseenLive} of {rec.bankLive} live questions unseen
                  </span>
                </div>

                {rec.reasons.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {rec.reasons.map((reason, i) => (
                      <span
                        key={`${reason}-${i}`}
                        className="inline-flex items-center rounded border border-[#27272A] bg-zinc-800/40 px-2 py-0.5 text-[11px] text-zinc-300"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
