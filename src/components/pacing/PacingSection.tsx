import { useState } from 'react';
import { reportPacing } from '../../services/pacing/pacing';
import type { Section } from '../../types/sat';
import type { SessionReport } from '../../types/session';
import { formatDuration } from '../../utils/formatDuration';

export interface PacingSectionProps {
  report: SessionReport;
  section: Section;
  timeLimitMs: number | null;
}

export function PacingSection({ report, section, timeLimitMs }: PacingSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pacing = reportPacing(report, section, timeLimitMs);

  const maxMs = Math.max(pacing.targetMs, ...pacing.questions.map((q) => q.activeMs), 1);
  const targetSeconds = Math.round(pacing.targetMs / 1000);

  return (
    <section className="overflow-hidden rounded-lg border border-[#27272A] bg-[#121215] text-[#FAFAFA]">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-zinc-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-300">
            Pacing
          </h3>
          {pacing.overTarget.length > 0 && (
            <span className="rounded bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
              {pacing.overTarget.length} over target
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-400">{isOpen ? 'Hide' : 'Show'}</span>
      </button>

      {isOpen && (
        <div className="border-t border-[#27272A] p-4 space-y-5">
          {/* Summary: target per question & total time vs budget */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3">
              <span className="block text-xs text-zinc-400">Target per question</span>
              <span className="mt-1 font-mono text-sm font-semibold text-zinc-100">
                {targetSeconds}s
              </span>
            </div>
            <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3">
              <span className="block text-xs text-zinc-400">Total time vs budget</span>
              <span className="mt-1 font-mono text-sm font-semibold text-zinc-100">
                {formatDuration(pacing.totalMs)} of {formatDuration(pacing.budgetMs)}
              </span>
            </div>
          </div>

          {/* Compact per-question bar row */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-mono uppercase tracking-wider text-[11px]">
                Time per question
              </span>
              <span className="text-[11px] text-zinc-500">
                Target: {targetSeconds}s (highlighted if over target)
              </span>
            </div>
            <div
              className="flex items-end gap-1 rounded-md border border-[#27272A] bg-[#0A0A0C] p-3 h-24"
              role="img"
              aria-label="Per-question active time bar chart"
            >
              {pacing.questions.map((q) => {
                const heightPercent = Math.min(
                  100,
                  Math.max(6, Math.round((q.activeMs / maxMs) * 100)),
                );
                return (
                  <div
                    key={q.questionId}
                    title={`Question ${q.index + 1} (#${q.displayId}): ${formatDuration(q.activeMs)} (${(q.ratio).toFixed(1)}x target)`}
                    className="group relative flex-1 flex flex-col items-center justify-end h-full"
                  >
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-sm transition-colors ${
                        q.over
                          ? 'bg-amber-400 hover:bg-amber-300'
                          : 'bg-zinc-600 hover:bg-zinc-500'
                      }`}
                    />
                    <span className="mt-1 font-mono text-[9px] text-zinc-500">
                      {q.index + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Over-target list */}
          <div className="space-y-2">
            <h4 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
              Over-target questions
            </h4>
            {pacing.overTarget.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No questions were over target pace.
              </p>
            ) : (
              <div className="divide-y divide-[#27272A] rounded-md border border-[#27272A] bg-[#0A0A0C]">
                {pacing.overTarget.map((q) => (
                  <div
                    key={q.questionId}
                    className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-zinc-200">
                        Question {q.index + 1}
                      </span>
                      <span className="font-mono text-zinc-500">
                        #{q.displayId}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-zinc-300">
                        {formatDuration(q.activeMs)}
                      </span>
                      <span className="rounded bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
                        {q.ratio.toFixed(1)}x target
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkpoints */}
          <div className="space-y-2">
            <h4 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
              Checkpoints
            </h4>
            <ul className="space-y-1 text-xs text-zinc-300 font-mono">
              {pacing.checkpoints.map((cp) => (
                <li key={cp.at} className="rounded border border-[#27272A] bg-[#0A0A0C] px-3 py-2">
                  At {Math.round(cp.at * 100)}% of the time: {cp.done} done, pace expects {cp.expected}
                </li>
              ))}
            </ul>
          </div>

          {/* Last five minutes */}
          {pacing.lastFive !== null && (
            <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3 text-xs font-mono text-zinc-300">
              Last five minutes: {pacing.lastFive.questions} questions, {pacing.lastFive.correct} right, {formatDuration(pacing.lastFive.timeMs)} time
            </div>
          )}

          {/* Approximate notice */}
          {pacing.approximate && (
            <p className="text-xs text-zinc-400 italic">
              Exam modules let you jump around, so the checkpoint figures assume you went in order.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
