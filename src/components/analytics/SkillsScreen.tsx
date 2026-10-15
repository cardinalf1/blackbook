import { useState, type ChangeEvent } from 'react';
import { averageMs, describeRate, pooled, rateView, wilsonLowerBound } from '../../services/analytics/metrics';
import type { AnalyticsKind, MissRow, SkillDetail, SkillRow, SkillSessionRow, SkillsScreenProps } from '../../types/analytics';
import type { Difficulty, Question } from '../../types/sat';
import { formatDuration } from '../../utils/formatDuration';
import { QuestionHtml } from '../QuestionHtml';
import { Sparkline } from './charts/Sparkline';

type SortKey = 'weakest' | 'name' | 'answers' | 'unseen';

function sortSkills(rows: SkillRow[], sortKey: SortKey): SkillRow[] {
  return [...rows].sort((a, b) => {
    if (sortKey === 'weakest') {
      const pA = pooled(a.counts);
      const pB = pooled(b.counts);
      if (pA.attempts === 0 && pB.attempts === 0) {
        return a.skill.localeCompare(b.skill);
      }
      if (pA.attempts === 0) return 1;
      if (pB.attempts === 0) return -1;
      const boundA = wilsonLowerBound(pA.correct, pA.attempts);
      const boundB = wilsonLowerBound(pB.correct, pB.attempts);
      if (boundA !== boundB) {
        return boundA - boundB;
      }
      return a.skill.localeCompare(b.skill);
    }
    if (sortKey === 'name') {
      return a.skill.localeCompare(b.skill);
    }
    if (sortKey === 'answers') {
      const attA = pooled(a.counts).attempts;
      const attB = pooled(b.counts).attempts;
      if (attB !== attA) return attB - attA;
      return a.skill.localeCompare(b.skill);
    }
    if (sortKey === 'unseen') {
      if (b.unseenLive !== a.unseenLive) return b.unseenLive - a.unseenLive;
      return a.skill.localeCompare(b.skill);
    }
    return 0;
  });
}

function formatSessionKind(kind: Exclude<AnalyticsKind, 'all'>): string {
  switch (kind) {
    case 'drill':
      return 'Drill';
    case 'single':
      return 'Single question';
    case 'module':
      return 'Practice module';
    case 'section':
      return 'Section run';
    case 'full':
      return 'Full test';
  }
}

function formatDifficulty(diff: Difficulty): string {
  switch (diff) {
    case 'E':
      return 'Easy';
    case 'M':
      return 'Medium';
    case 'H':
      return 'Hard';
  }
}

function formatCorrectAnswer(answer: Question['answer']): string {
  if (answer.kind === 'mcq') {
    return `Choice ${answer.correct}`;
  }
  return answer.accepted.join(', ');
}

interface QuestionLoadState {
  loading: boolean;
  question: Question | null;
  error: string | null;
}

export function SkillsScreen({ summary, loadDetail, loadQuestion }: SkillsScreenProps) {
  const [filterText, setFilterText] = useState('');
  const [onlyAnswered, setOnlyAnswered] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('weakest');

  const [selectedSkillCode, setSelectedSkillCode] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<SkillDetail | null>(null);
  const [questionsState, setQuestionsState] = useState<Record<string, QuestionLoadState>>({});

  const handleSelectSkill = (code: string) => {
    setSelectedSkillCode(code);
    setDetailLoading(true);
    setDetailError(null);
    setDetailData(null);
    setQuestionsState({});

    loadDetail(code)
      .then((data) => {
        setDetailData(data);
        setDetailLoading(false);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setDetailError(msg);
        setDetailLoading(false);
      });
  };

  const handleShowQuestion = async (questionId: string) => {
    setQuestionsState((prev) => ({
      ...prev,
      [questionId]: { loading: true, question: null, error: null },
    }));

    try {
      const q = await loadQuestion(questionId);
      setQuestionsState((prev) => ({
        ...prev,
        [questionId]: { loading: false, question: q, error: null },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setQuestionsState((prev) => ({
        ...prev,
        [questionId]: { loading: false, question: null, error: msg },
      }));
    }
  };

  const query = filterText.trim().toLowerCase();
  const filtered = summary.rows.filter((row) => {
    if (onlyAnswered && pooled(row.counts).attempts === 0) {
      return false;
    }
    if (query === '') return true;
    return row.skill.toLowerCase().includes(query) || row.domain.toLowerCase().includes(query);
  });

  const sortedRows = sortSkills(filtered, sortKey);

  const selectedSkill = summary.rows.find((r) => r.skillCode === selectedSkillCode);

  return (
    <div className="space-y-6 text-[#FAFAFA]">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-[#27272A] bg-[#121215] p-4 text-xs">
        <label className="flex flex-col gap-1 text-zinc-400">
          <span>Search</span>
          <input
            type="text"
            placeholder="Filter by skill or domain..."
            aria-label="Filter by skill or domain"
            value={filterText}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFilterText(e.target.value)}
            className="w-56 rounded border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-zinc-200 transition-colors focus:border-zinc-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-zinc-400">
          <span>Sort by</span>
          <select
            aria-label="Sort skills"
            value={sortKey}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSortKey(e.target.value as SortKey)}
            className="rounded border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-zinc-200 transition-colors focus:border-zinc-500 focus:outline-none"
          >
            <option value="weakest">Weakest first</option>
            <option value="name">Name</option>
            <option value="answers">Most answers</option>
            <option value="unseen">Most unseen</option>
          </select>
        </label>

        <label className="flex cursor-pointer items-center gap-2 py-2 text-zinc-300">
          <input
            type="checkbox"
            checked={onlyAnswered}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setOnlyAnswered(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-[#27272A] bg-[#0A0A0C] text-zinc-100 focus:ring-zinc-400 focus:ring-offset-0"
          />
          <span>Only skills with answers</span>
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#27272A] bg-[#121215]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#27272A] bg-[#0A0A0C]/60 font-mono text-zinc-400">
                <th className="px-3 py-2.5">Skill</th>
                <th className="px-3 py-2.5">Drill</th>
                <th className="px-3 py-2.5">Exam</th>
                <th className="px-3 py-2.5">Trend</th>
                <th className="px-3 py-2.5">Unseen</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-zinc-500">
                    No matching skills found.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => {
                  const drillRate = rateView(row.counts.drill.correct, row.counts.drill.attempts);
                  const drillAvg = averageMs(row.counts.drill);
                  const examRate = rateView(row.counts.exam.correct, row.counts.exam.attempts);
                  const examAvg = averageMs(row.counts.exam);
                  const trendValues = row.recent
                    .filter((p) => p.attempts > 0)
                    .map((p) => p.correct / p.attempts);

                  return (
                    <tr
                      key={row.skillCode}
                      onClick={() => handleSelectSkill(row.skillCode)}
                      className={`cursor-pointer border-b border-[#27272A] text-zinc-300 transition-colors hover:bg-zinc-800/40 ${
                        selectedSkillCode === row.skillCode ? 'bg-zinc-800/30' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSkill(row.skillCode);
                          }}
                          className="text-left font-medium text-zinc-200 hover:text-white focus:outline-none focus-visible:underline"
                          aria-expanded={selectedSkillCode === row.skillCode}
                        >
                          {row.skill}
                        </button>
                        <div className="text-[11px] text-zinc-400">
                          {row.domain} · {row.section === 'rw' ? 'Reading and Writing' : 'Math'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        <div>{describeRate(drillRate)}</div>
                        {row.counts.drill.attempts > 0 && (
                          <div className="text-[11px] text-zinc-400">
                            {formatDuration(drillAvg ?? 0)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        <div>{describeRate(examRate)}</div>
                        {row.counts.exam.attempts > 0 && (
                          <div className="text-[11px] text-zinc-400">
                            {formatDuration(examAvg ?? 0)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Sparkline
                          values={trendValues}
                          label={`Accuracy over the last ${row.recent.length} sessions`}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">
                        {`${row.unseenLive} of ${row.bankLive} live unseen`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSkillCode !== null && (
        <section className="space-y-5 rounded-lg border border-[#27272A] bg-[#121215] p-5">
          <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
            <div>
              <h3 className="font-mono text-sm font-medium text-zinc-100">
                {selectedSkill?.skill ?? 'Skill details'}
              </h3>
              <p className="text-xs text-zinc-400">
                {selectedSkill?.domain} · {selectedSkill?.section === 'rw' ? 'Reading and Writing' : 'Math'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSkillCode(null)}
              className="rounded border border-[#27272A] px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white focus:outline-none"
            >
              Close
            </button>
          </div>

          {detailLoading && (
            <p className="py-4 text-xs text-zinc-400">Loading skill details...</p>
          )}

          {detailError && (
            <div className="rounded border border-red-800/60 bg-red-950/40 p-3 text-xs text-red-300">
              {detailError}
            </div>
          )}

          {detailData && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="font-mono text-xs font-medium text-zinc-200">Sessions</h4>
                {detailData.sessions.length === 0 ? (
                  <p className="text-xs text-zinc-500">No sessions in this view.</p>
                ) : (
                  <div className="space-y-2">
                    {detailData.sessions.map((s: SkillSessionRow) => (
                      <div
                        key={s.sessionId}
                        className="flex items-center justify-between rounded border border-[#27272A] bg-[#0A0A0C] p-2.5 text-xs"
                      >
                        <div>
                          <div className="font-medium text-zinc-200">
                            {formatSessionKind(s.kind)} ({s.mode === 'drill' ? 'Drill' : 'Exam'})
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {new Date(s.finishedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="font-mono text-zinc-300">
                          {s.correct} of {s.attempts}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="font-mono text-xs font-medium text-zinc-200">Missed questions</h4>
                {detailData.misses.length === 0 ? (
                  <p className="text-xs text-zinc-500">No missed questions.</p>
                ) : (
                  <div className="space-y-2">
                    {[...detailData.misses]
                      .sort((a, b) => a.missedAt - b.missedAt)
                      .map((m: MissRow) => {
                        const qState = questionsState[m.questionId];

                        return (
                          <div
                            key={m.questionId}
                            className="space-y-2 rounded border border-[#27272A] bg-[#0A0A0C] p-3 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="font-medium text-zinc-300">
                                  {formatDifficulty(m.difficulty)}
                                </span>
                                <span className="mx-2 text-zinc-600">·</span>
                                <span className="text-zinc-500">
                                  {new Date(m.missedAt).toLocaleDateString()}
                                </span>
                                <span className="mx-2 text-zinc-600">·</span>
                                <span className="font-mono text-zinc-400">
                                  missed {m.misses} of {m.attempts}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleShowQuestion(m.questionId)}
                                className="rounded border border-[#27272A] px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white focus:outline-none"
                              >
                                Show question
                              </button>
                            </div>

                            {qState?.loading && (
                              <p className="text-xs text-zinc-500">Loading question...</p>
                            )}

                            {qState?.error && (
                              <p className="text-xs text-red-400">{qState.error}</p>
                            )}

                            {qState && !qState.loading && !qState.error && (
                              <div className="mt-3 border-t border-[#27272A] pt-3">
                                {qState.question === null ? (
                                  <p className="text-xs text-zinc-500">
                                    This question is no longer in the bank.
                                  </p>
                                ) : (
                                  <div className="space-y-3">
                                    {qState.question.stimulusHtml && (
                                      <QuestionHtml
                                        html={qState.question.stimulusHtml}
                                        className="text-zinc-300"
                                      />
                                    )}
                                    <QuestionHtml
                                      html={qState.question.stemHtml}
                                      className="text-zinc-200"
                                    />
                                    <div className="font-mono text-xs text-zinc-300">
                                      Correct answer: {formatCorrectAnswer(qState.question.answer)}
                                    </div>
                                    <div className="space-y-1">
                                      <div className="text-xs font-medium text-zinc-400">Rationale</div>
                                      <QuestionHtml
                                        html={qState.question.rationaleHtml}
                                        className="text-xs text-zinc-300"
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
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
