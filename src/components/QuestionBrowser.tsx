import { useEffect, useMemo, useState } from 'react';
import { questionStore } from '../services/storage';
import type { Difficulty, Question, QuestionSource, Section } from '../types/sat';
import { QuestionView } from './QuestionView';

const PAGE_SIZE = 50;

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  E: 'Easy (E)',
  M: 'Medium (M)',
  H: 'Hard (H)',
};

const SECTION_LABELS: Record<Section, string> = {
  rw: 'Reading and Writing',
  math: 'Math',
};

const FORMAT_LABELS: Record<'mcq' | 'spr', string> = {
  mcq: 'Multiple Choice (MCQ)',
  spr: 'Student-Produced Response (SPR)',
};

const SOURCE_LABELS: Record<QuestionSource, string> = {
  digital: 'Digital',
  legacy: 'Legacy',
};

export function QuestionBrowser() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sectionFilter, setSectionFilter] = useState<Section | 'all'>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>('all');
  const [formatFilter, setFormatFilter] = useState<'mcq' | 'spr' | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<QuestionSource | 'all'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'yes' | 'no'>('all');

  const [page, setPage] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [c, qs] = await Promise.all([
          questionStore.count(),
          questionStore.query({}),
        ]);
        if (!active) return;
        setTotalCount(c);
        setQuestions(qs);
      } catch (err) {
        if (!active) return;
        setError(`Could not load questions: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const availableSections = useMemo(() => {
    const s = new Set<Section>();
    for (const q of questions) {
      s.add(q.section);
    }
    return Array.from(s).sort();
  }, [questions]);

  const availableDomains = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    for (const q of questions) {
      if (sectionFilter === 'all' || q.section === sectionFilter) {
        if (!map.has(q.domainCode)) {
          map.set(q.domainCode, { code: q.domainCode, name: q.domain });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [questions, sectionFilter]);

  const availableSkills = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    for (const q of questions) {
      const matchSection = sectionFilter === 'all' || q.section === sectionFilter;
      const matchDomain = domainFilter === 'all' || q.domainCode === domainFilter;
      if (matchSection && matchDomain) {
        if (!map.has(q.skillCode)) {
          map.set(q.skillCode, { code: q.skillCode, name: q.skill });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [questions, sectionFilter, domainFilter]);

  const availableDifficulties = useMemo(() => {
    const s = new Set<Difficulty>();
    for (const q of questions) {
      s.add(q.difficulty);
    }
    return Array.from(s).sort();
  }, [questions]);

  const availableFormats = useMemo(() => {
    const s = new Set<'mcq' | 'spr'>();
    for (const q of questions) {
      s.add(q.answer.kind);
    }
    return Array.from(s).sort();
  }, [questions]);

  const availableSources = useMemo(() => {
    const s = new Set<QuestionSource>();
    for (const q of questions) {
      s.add(q.source);
    }
    return Array.from(s).sort();
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (sectionFilter !== 'all' && q.section !== sectionFilter) return false;
      if (domainFilter !== 'all' && q.domainCode !== domainFilter) return false;
      if (skillFilter !== 'all' && q.skillCode !== skillFilter) return false;
      if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) return false;
      if (formatFilter !== 'all' && q.answer.kind !== formatFilter) return false;
      if (sourceFilter !== 'all' && q.source !== sourceFilter) return false;
      if (activeFilter === 'yes' && !q.active) return false;
      if (activeFilter === 'no' && q.active) return false;
      return true;
    });
  }, [questions, sectionFilter, domainFilter, skillFilter, difficultyFilter, formatFilter, sourceFilter, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedQuestions = useMemo(() => {
    return filteredQuestions.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  }, [filteredQuestions, currentPage]);

  const handleSectionChange = (val: string) => {
    setSectionFilter(val as Section | 'all');
    setDomainFilter('all');
    setSkillFilter('all');
    setPage(0);
  };

  const handleDomainChange = (val: string) => {
    setDomainFilter(val);
    setSkillFilter('all');
    setPage(0);
  };

  const handleSkillChange = (val: string) => {
    setSkillFilter(val);
    setPage(0);
  };

  const handleDifficultyChange = (val: string) => {
    setDifficultyFilter(val as Difficulty | 'all');
    setPage(0);
  };

  const handleFormatChange = (val: string) => {
    setFormatFilter(val as 'mcq' | 'spr' | 'all');
    setPage(0);
  };

  const handleSourceChange = (val: string) => {
    setSourceFilter(val as QuestionSource | 'all');
    setPage(0);
  };

  const handleActiveChange = (val: string) => {
    setActiveFilter(val as 'all' | 'yes' | 'no');
    setPage(0);
  };

  const resetFilters = () => {
    setSectionFilter('all');
    setDomainFilter('all');
    setSkillFilter('all');
    setDifficultyFilter('all');
    setFormatFilter('all');
    setSourceFilter('all');
    setActiveFilter('all');
    setPage(0);
  };

  const hasActiveFilters =
    sectionFilter !== 'all' ||
    domainFilter !== 'all' ||
    skillFilter !== 'all' ||
    difficultyFilter !== 'all' ||
    formatFilter !== 'all' ||
    sourceFilter !== 'all' ||
    activeFilter !== 'all';

  if (loading) {
    return (
      <div className="rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400">
        Loading questions from storage...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-[#121215] p-6 text-sm text-red-400" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#27272A] pb-3">
          <div>
            <h2 className="font-mono text-sm font-medium text-zinc-100">Browse Questions</h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {filteredQuestions.length} of {totalCount} questions
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md border border-[#27272A] px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
            >
              Reset filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Section</span>
            <select
              value={sectionFilter}
              onChange={(e) => handleSectionChange(e.target.value)}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus:outline-none"
            >
              <option value="all">All sections ({availableSections.length})</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  {SECTION_LABELS[sec]}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Domain</span>
            <select
              value={domainFilter}
              onChange={(e) => handleDomainChange(e.target.value)}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus:outline-none"
            >
              <option value="all">All domains ({availableDomains.length})</option>
              {availableDomains.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Skill</span>
            <select
              value={skillFilter}
              onChange={(e) => handleSkillChange(e.target.value)}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus:outline-none"
            >
              <option value="all">All skills ({availableSkills.length})</option>
              {availableSkills.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Difficulty</span>
            <select
              value={difficultyFilter}
              onChange={(e) => handleDifficultyChange(e.target.value)}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus:outline-none"
            >
              <option value="all">All difficulties ({availableDifficulties.length})</option>
              {availableDifficulties.map((diff) => (
                <option key={diff} value={diff}>
                  {DIFFICULTY_LABELS[diff]}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Format</span>
            <select
              value={formatFilter}
              onChange={(e) => handleFormatChange(e.target.value)}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus:outline-none"
            >
              <option value="all">All formats ({availableFormats.length})</option>
              {availableFormats.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {FORMAT_LABELS[fmt]}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Source</span>
            <select
              value={sourceFilter}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus:outline-none"
            >
              <option value="all">All sources ({availableSources.length})</option>
              {availableSources.map((src) => (
                <option key={src} value={src}>
                  {SOURCE_LABELS[src]}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Active</span>
            <select
              value={activeFilter}
              onChange={(e) => handleActiveChange(e.target.value)}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus:outline-none"
            >
              <option value="all">All (active & inactive)</option>
              <option value="yes">Active only</option>
              <option value="no">Inactive only</option>
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#27272A] bg-[#121215]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#27272A] bg-[#0A0A0C]/60 font-mono text-xs text-zinc-400">
                <th className="px-3 py-2.5">ID</th>
                <th className="px-3 py-2.5">Section</th>
                <th className="px-3 py-2.5">Domain</th>
                <th className="px-3 py-2.5">Skill</th>
                <th className="px-3 py-2.5">Difficulty</th>
                <th className="px-3 py-2.5">Format</th>
                <th className="px-3 py-2.5">Source</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedQuestions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-zinc-500">
                    No questions match the current filters.
                  </td>
                </tr>
              ) : (
                pagedQuestions.map((q) => {
                  const isSelected = selectedQuestion?.id === q.id;
                  return (
                    <tr
                      key={q.id}
                      onClick={() => setSelectedQuestion(isSelected ? null : q)}
                      className={`cursor-pointer border-b border-[#27272A] text-xs transition-colors hover:bg-zinc-800/40 ${
                        isSelected ? 'bg-zinc-800/80 text-zinc-100' : 'text-zinc-300'
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono text-zinc-200">#{q.displayId}</td>
                      <td className="px-3 py-2.5">{q.section === 'rw' ? 'RW' : 'Math'}</td>
                      <td className="max-w-[180px] truncate px-3 py-2.5" title={q.domain}>
                        {q.domain}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2.5" title={q.skill}>
                        {q.skill}
                      </td>
                      <td className="px-3 py-2.5 font-mono">{q.difficulty}</td>
                      <td className="px-3 py-2.5 font-mono uppercase">{q.answer.kind}</td>
                      <td className="px-3 py-2.5">
                        {q.source === 'legacy' ? (
                          <span className="rounded border border-amber-800/60 bg-amber-950/60 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                            Legacy
                          </span>
                        ) : (
                          <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                            Digital
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {q.active ? (
                          <span className="rounded border border-emerald-800/60 bg-emerald-950/60 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                            Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#27272A] px-4 py-3 text-xs">
          <span className="text-zinc-400">
            Page <span className="font-mono text-zinc-200">{currentPage + 1}</span> of{' '}
            <span className="font-mono text-zinc-200">{totalPages}</span> ({filteredQuestions.length} matching)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md border border-[#27272A] px-3 py-1 text-zinc-200 hover:border-zinc-500 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded-md border border-[#27272A] px-3 py-1 text-zinc-200 hover:border-zinc-500 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedQuestion && (
        <section className="space-y-3 border-t border-[#27272A] pt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
              Question Preview (#{selectedQuestion.displayId})
            </h3>
            <button
              type="button"
              onClick={() => setSelectedQuestion(null)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Close preview
            </button>
          </div>
          <QuestionView key={selectedQuestion.id} question={selectedQuestion} />
        </section>
      )}
    </div>
  );
}
