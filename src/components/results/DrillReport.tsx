import { useEffect, useRef, useState } from 'react';
import type { DrillReportProps } from '../../types/session';
import { formatDuration } from '../../utils/formatDuration';
import { QuestionHtml } from '../QuestionHtml';

const DIFFICULTY_LABELS: Record<string, string> = {
  E: 'Easy',
  M: 'Medium',
  H: 'Hard',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  guess: 'Guess',
  unsure: 'Unsure',
  sure: 'Sure',
};

export function DrillReport({
  report,
  onItemToggle,
  onBack,
  backLabel,
  onMySkills,
}: DrillReportProps) {
  const [filter, setFilter] = useState<'all' | 'missed' | 'flagged'>('all');
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const openRef = useRef(openIds);
  useEffect(() => {
    openRef.current = openIds;
  }, [openIds]);

  const onItemToggleRef = useRef(onItemToggle);
  useEffect(() => {
    onItemToggleRef.current = onItemToggle;
  }, [onItemToggle]);

  useEffect(() => {
    return () => {
      for (const id of openRef.current) {
        onItemToggleRef.current(id, false);
      }
    };
  }, []);

  const toggleRow = (questionId: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
        onItemToggle(questionId, false);
      } else {
        next.add(questionId);
        onItemToggle(questionId, true);
      }
      return next;
    });
  };

  const { correct, total } = report.score;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  const avgTimeMs = total > 0 ? Math.round(report.totalActiveMs / total) : 0;

  const filteredItems = report.items.filter((item) => {
    if (filter === 'missed') {
      return !item.correct;
    }
    if (filter === 'flagged') {
      return item.flagged;
    }
    return true;
  });

  const formattedDate = new Date(report.finishedAt ?? report.startedAt).toLocaleString();

  return (
    <div className="space-y-6 text-[#FAFAFA]">
      {/* Header card */}
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] pb-3 sm:pb-4">
          <div>
            <h2 className="font-mono text-sm font-medium text-zinc-100">Drill report</h2>
            <p className="mt-0.5 text-xs text-zinc-400">{formattedDate}</p>
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
              {backLabel}
            </button>
          </div>
        </div>

        {/* Stat tiles */}
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
            <span className="text-xs text-zinc-400">Total time</span>
            <div className="mt-1">
              <span className="font-mono text-xl font-semibold text-zinc-100">
                {formatDuration(report.totalActiveMs)}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3.5">
            <span className="text-xs text-zinc-400">Average time per question</span>
            <div className="mt-1">
              <span className="font-mono text-xl font-semibold text-zinc-100">
                {formatDuration(avgTimeMs)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Breakdown tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-[#27272A] bg-[#121215]">
          <div className="border-b border-[#27272A] px-5 py-3">
            <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400">By domain</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#27272A] bg-[#0A0A0C]/60 font-mono text-xs text-zinc-400">
                  <th className="px-3 py-2.5">Domain</th>
                  <th className="px-3 py-2.5">Score</th>
                  <th className="px-3 py-2.5">Accuracy</th>
                  <th className="px-3 py-2.5">Time</th>
                </tr>
              </thead>
              <tbody>
                {report.byDomain.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs text-zinc-500">
                      No domain data.
                    </td>
                  </tr>
                ) : (
                  report.byDomain.map((row) => {
                    const pct = row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0;
                    return (
                      <tr key={row.code} className="border-b border-[#27272A] text-xs text-zinc-300">
                        <td className="px-3 py-2.5 text-zinc-200">{row.label}</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-300">
                          {row.correct} / {row.total}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-zinc-300">{pct}%</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-400">
                          {formatDuration(row.activeMs)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[#27272A] bg-[#121215]">
          <div className="border-b border-[#27272A] px-5 py-3">
            <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400">By skill</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#27272A] bg-[#0A0A0C]/60 font-mono text-xs text-zinc-400">
                  <th className="px-3 py-2.5">Skill</th>
                  <th className="px-3 py-2.5">Score</th>
                  <th className="px-3 py-2.5">Accuracy</th>
                  <th className="px-3 py-2.5">Time</th>
                </tr>
              </thead>
              <tbody>
                {report.bySkill.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs text-zinc-500">
                      No skill data.
                    </td>
                  </tr>
                ) : (
                  report.bySkill.map((row) => {
                    const pct = row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0;
                    return (
                      <tr key={row.code} className="border-b border-[#27272A] text-xs text-zinc-300">
                        <td className="px-3 py-2.5 text-zinc-200">{row.label}</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-300">
                          {row.correct} / {row.total}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-zinc-300">{pct}%</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-400">
                          {formatDuration(row.activeMs)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Filter buttons and Questions list */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
            Questions ({filteredItems.length})
          </h3>
          <div className="flex items-center gap-2">
            {(['all', 'missed', 'flagged'] as const).map((mode) => {
              const label = mode === 'all' ? 'All' : mode === 'missed' ? 'Missed' : 'Flagged';
              const isActive = filter === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilter(mode)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                    isActive
                      ? 'border border-zinc-500 bg-zinc-800 text-zinc-100'
                      : 'border border-[#27272A] bg-[#121215] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-lg border border-[#27272A] bg-[#121215] p-8 text-center text-xs text-zinc-500">
            No questions match the current filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const isOpen = openIds.has(item.questionId);
              const difficultyLabel = DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty;
              const hasDiffFirstVisit =
                item.firstVisitMs !== null && item.firstVisitMs !== item.activeMs;

              return (
                <div
                  key={item.questionId}
                  className="rounded-lg border border-[#27272A] bg-[#121215] p-4 text-xs transition-colors"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold text-zinc-300">
                          {item.index + 1}
                        </span>
                        <span className="font-mono text-zinc-400">#{item.displayId}</span>
                        <span className="text-zinc-500">•</span>
                        <span className="text-zinc-200">{item.skill}</span>
                        <span className="text-zinc-500">•</span>
                        <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                          {difficultyLabel}
                        </span>
                        {item.correct ? (
                          <span className="rounded border border-emerald-800/60 bg-emerald-950/60 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                            Correct
                          </span>
                        ) : (
                          <span className="rounded border border-red-800/60 bg-red-950/60 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
                            Missed
                          </span>
                        )}
                        {item.flagged && (
                          <span className="rounded border border-amber-800/60 bg-amber-950/60 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">
                            Flagged
                          </span>
                        )}
                        {item.confidence !== null && (
                          <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                            {CONFIDENCE_LABELS[item.confidence] ?? item.confidence}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <span>Your answer:</span>
                          <span className="font-mono font-medium text-zinc-200">
                            {item.response ?? '—'}
                          </span>
                          {item.response === null && (
                            <span className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                              Unanswered
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>Correct answer:</span>
                          <span className="font-mono font-medium text-zinc-200">
                            {item.correctAnswer}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>Time:</span>
                          <span className="font-mono text-zinc-300">
                            {formatDuration(item.activeMs)}
                          </span>
                          {hasDiffFirstVisit && (
                            <span className="text-zinc-500">
                              (first visit {formatDuration(item.firstVisitMs as number)})
                            </span>
                          )}
                        </div>
                        {item.changes > 0 && (
                          <span className="text-zinc-400">changed {item.changes}×</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleRow(item.questionId)}
                      className="self-start rounded-md border border-[#27272A] px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 sm:self-auto"
                    >
                      {isOpen ? 'Hide explanation' : 'Show explanation'}
                    </button>
                  </div>

                  {/* Expanded explanation */}
                  {isOpen && (
                    <div className="mt-4 border-t border-[#27272A] pt-4">
                      {item.question === null ? (
                        <p className="text-zinc-400">
                          This question is no longer in your question bank.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {item.question.stimulusHtml && (
                            <QuestionHtml
                              html={item.question.stimulusHtml}
                              className="text-zinc-300"
                            />
                          )}
                          <QuestionHtml html={item.question.stemHtml} className="text-zinc-100" />

                          {item.question.answer.kind === 'mcq' && (
                            <div className="space-y-2">
                              {item.question.answer.choices.map((choice, i) => {
                                const letter =
                                  (['A', 'B', 'C', 'D'] as const)[i] ??
                                  String.fromCharCode(65 + i);
                                const isCorrect =
                                  item.question?.answer.kind === 'mcq' &&
                                  item.question.answer.correct === letter;
                                const isUserPick = item.response === letter;
                                const isWrongPick = isUserPick && !isCorrect;

                                let borderClass = 'border-[#27272A] bg-[#0A0A0C] text-zinc-300';
                                if (isCorrect) {
                                  borderClass =
                                    'border-emerald-600 bg-emerald-950/20 text-zinc-100';
                                } else if (isWrongPick) {
                                  borderClass = 'border-red-600 bg-red-950/20 text-zinc-100';
                                }

                                return (
                                  <div
                                    key={letter}
                                    className={`flex items-start gap-2.5 rounded-md border p-3 ${borderClass}`}
                                  >
                                    <span className="font-mono font-semibold text-zinc-400">
                                      {letter}.
                                    </span>
                                    <QuestionHtml html={choice} className="flex-1" />
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {item.question.answer.kind === 'spr' && (
                            <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3 text-zinc-300">
                              <span className="font-semibold text-zinc-200">
                                Accepted answers:{' '}
                              </span>
                              <span className="font-mono text-zinc-100">
                                {item.question.answer.accepted.join(', ')}
                              </span>
                            </div>
                          )}

                          <div className="border-t border-[#27272A] pt-3">
                            <h4 className="mb-2 font-mono text-xs uppercase tracking-wider text-zinc-400">
                              Explanation
                            </h4>
                            <QuestionHtml
                              html={item.question.rationaleHtml}
                              className="text-zinc-300"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
