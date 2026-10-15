import { useMemo, type JSX } from 'react';
import { applyFilters, filterCounts } from '../services/browse/filter';
import {
  BROWSE_PAGE_SIZE,
  DEFAULT_BROWSE_FILTERS,
  type BrowseFilters,
  type BrowseRow,
  type BrowseViewState,
  type QuestionBrowserProps,
  type SeenStatus,
} from '../types/browse';
import type { Difficulty, QuestionSource, Section } from '../types/sat';

const SECTION_LABELS: Record<Section, string> = {
  rw: 'Reading and Writing',
  math: 'Math',
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  E: 'Easy',
  M: 'Medium',
  H: 'Hard',
};

function StatusBadge({ status }: { status: SeenStatus }) {
  switch (status) {
    case 'unseen':
      return (
        <span className="inline-flex items-center rounded border border-zinc-700 bg-transparent px-2 py-0.5 font-mono text-[11px] text-zinc-400">
          Unseen
        </span>
      );
    case 'seen':
      return (
        <span className="inline-flex items-center rounded border border-amber-800/60 bg-amber-950/40 px-2 py-0.5 font-mono text-[11px] text-amber-400">
          Seen
        </span>
      );
    case 'done':
      return (
        <span className="inline-flex items-center rounded border border-emerald-800/60 bg-emerald-950/40 px-2 py-0.5 font-mono text-[11px] text-emerald-400">
          Done
        </span>
      );
  }
}

const DEFAULT_STATE: BrowseViewState = {
  filters: DEFAULT_BROWSE_FILTERS,
  page: 0,
};

export function QuestionBrowser(props?: Partial<QuestionBrowserProps>): JSX.Element;
export function QuestionBrowser(props: QuestionBrowserProps): JSX.Element;
export function QuestionBrowser(props: Partial<QuestionBrowserProps> = {}): JSX.Element {
  const {
    rows = [],
    state = DEFAULT_STATE,
    onStateChange = () => {},
    onOpen = () => {},
    onRandom = () => {},
  } = props;

  const filteredRows = useMemo(() => applyFilters(rows, state.filters), [rows, state.filters]);
  const counts = useMemo(() => filterCounts(rows, state.filters), [rows, state.filters]);

  const availableSections = useMemo(() => {
    const s = new Set<Section>();
    for (const r of rows) s.add(r.section);
    return Array.from(s).sort();
  }, [rows]);

  const availableDomains = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    for (const r of rows) {
      if (state.filters.section === 'all' || r.section === state.filters.section) {
        if (!map.has(r.domainCode)) {
          map.set(r.domainCode, { code: r.domainCode, name: r.domain });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, state.filters.section]);

  const availableSkills = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    for (const r of rows) {
      const matchSection = state.filters.section === 'all' || r.section === state.filters.section;
      const matchDomain = state.filters.domainCode === 'all' || r.domainCode === state.filters.domainCode;
      if (matchSection && matchDomain) {
        if (!map.has(r.skillCode)) {
          map.set(r.skillCode, { code: r.skillCode, name: r.skill });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, state.filters.section, state.filters.domainCode]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / BROWSE_PAGE_SIZE));
  const currentPage = Math.min(Math.max(0, state.page), totalPages - 1);
  const pagedRows = useMemo(() => {
    return filteredRows.slice(currentPage * BROWSE_PAGE_SIZE, (currentPage + 1) * BROWSE_PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const hasActiveFilters = (Object.keys(DEFAULT_BROWSE_FILTERS) as (keyof BrowseFilters)[]).some(
    (k) => state.filters[k] !== DEFAULT_BROWSE_FILTERS[k],
  );

  const handleSectionChange = (section: Section | 'all') => {
    onStateChange({
      filters: {
        ...state.filters,
        section,
        domainCode: 'all',
        skillCode: 'all',
      },
      page: 0,
    });
  };

  const handleDomainChange = (domainCode: string) => {
    onStateChange({
      filters: {
        ...state.filters,
        domainCode,
        skillCode: 'all',
      },
      page: 0,
    });
  };

  const handleSkillChange = (skillCode: string) => {
    onStateChange({
      filters: {
        ...state.filters,
        skillCode,
      },
      page: 0,
    });
  };

  const handleFilterChange = <K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]) => {
    onStateChange({
      filters: {
        ...state.filters,
        [key]: value,
      },
      page: 0,
    });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] pb-3">
          <div>
            <h2 className="font-mono text-sm font-medium text-zinc-100">Browse Questions</h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {filteredRows.length} of {rows.length} questions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => onStateChange({ filters: DEFAULT_BROWSE_FILTERS, page: 0 })}
                className="rounded-md border border-[#27272A] px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
              >
                Reset filters
              </button>
            )}
            <button
              type="button"
              disabled={filteredRows.length === 0}
              onClick={onRandom}
              className="rounded-md border border-[#27272A] bg-zinc-800/60 px-3 py-1 text-xs text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
            >
              Random question
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Section</span>
            <select
              value={state.filters.section}
              onChange={(e) => handleSectionChange(e.target.value as Section | 'all')}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
            >
              <option value="all">All ({counts.section.all ?? 0})</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  {SECTION_LABELS[sec]} ({counts.section[sec] ?? 0})
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Domain</span>
            <select
              value={state.filters.domainCode}
              onChange={(e) => handleDomainChange(e.target.value)}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
            >
              <option value="all">All ({counts.domainCode.all ?? 0})</option>
              {availableDomains.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name} ({counts.domainCode[d.code] ?? 0})
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Skill</span>
            <select
              value={state.filters.skillCode}
              onChange={(e) => handleSkillChange(e.target.value)}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
            >
              <option value="all">All ({counts.skillCode.all ?? 0})</option>
              {availableSkills.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({counts.skillCode[s.code] ?? 0})
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Difficulty</span>
            <select
              value={state.filters.difficulty}
              onChange={(e) => handleFilterChange('difficulty', e.target.value as Difficulty | 'all')}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
            >
              <option value="all">All ({counts.difficulty.all ?? 0})</option>
              <option value="E">Easy ({counts.difficulty.E ?? 0})</option>
              <option value="M">Medium ({counts.difficulty.M ?? 0})</option>
              <option value="H">Hard ({counts.difficulty.H ?? 0})</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Format</span>
            <select
              value={state.filters.format}
              onChange={(e) => handleFilterChange('format', e.target.value as 'mcq' | 'spr' | 'all')}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
            >
              <option value="all">All ({counts.format.all ?? 0})</option>
              <option value="mcq">Multiple choice ({counts.format.mcq ?? 0})</option>
              <option value="spr">Student-produced response ({counts.format.spr ?? 0})</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Source</span>
            <select
              value={state.filters.source}
              onChange={(e) => handleFilterChange('source', e.target.value as QuestionSource | 'all')}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
            >
              <option value="all">All ({counts.source.all ?? 0})</option>
              <option value="digital">Digital ({counts.source.digital ?? 0})</option>
              <option value="legacy">Legacy ({counts.source.legacy ?? 0})</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Live set</span>
            <select
              value={state.filters.live}
              onChange={(e) => handleFilterChange('live', e.target.value as 'all' | 'yes' | 'no')}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
            >
              <option value="all">All ({counts.live.all ?? 0})</option>
              <option value="yes">Live only ({counts.live.yes ?? 0})</option>
              <option value="no">Not live ({counts.live.no ?? 0})</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Status</span>
            <select
              value={state.filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value as BrowseFilters['status'])}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
            >
              <option value="all">All ({counts.status.all ?? 0})</option>
              <option value="unseen">Unseen ({counts.status.unseen ?? 0})</option>
              <option value="seen">Seen ({counts.status.seen ?? 0})</option>
              <option value="done">Done ({counts.status.done ?? 0})</option>
              <option value="not_done">Not done ({counts.status.not_done ?? 0})</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Flagged</span>
            <select
              value={state.filters.flagged}
              onChange={(e) => handleFilterChange('flagged', e.target.value as 'all' | 'yes')}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
            >
              <option value="all">All ({counts.flagged.all ?? 0})</option>
              <option value="yes">Flagged for later ({counts.flagged.yes ?? 0})</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Last result</span>
            <select
              value={state.filters.lastResult}
              onChange={(e) => handleFilterChange('lastResult', e.target.value as 'all' | 'correct' | 'incorrect' | 'none')}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
            >
              <option value="all">All ({counts.lastResult.all ?? 0})</option>
              <option value="correct">Correct ({counts.lastResult.correct ?? 0})</option>
              <option value="incorrect">Incorrect ({counts.lastResult.incorrect ?? 0})</option>
              <option value="none">No result yet ({counts.lastResult.none ?? 0})</option>
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
                <th className="px-3 py-2.5">Domain</th>
                <th className="px-3 py-2.5">Skill</th>
                <th className="px-3 py-2.5">Difficulty</th>
                <th className="px-3 py-2.5">Format</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Attempts</th>
                <th className="px-3 py-2.5">Last Result</th>
                <th className="px-3 py-2.5 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs text-zinc-500">
                    No questions match these filters.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onOpen(row.id)}
                    className="cursor-pointer border-b border-[#27272A] text-xs text-zinc-300 transition-colors hover:bg-zinc-800/40"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-zinc-200">#{row.displayId}</span>
                        {row.flagged && (
                          <span className="rounded border border-amber-800/60 bg-amber-950/60 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                            Flagged
                          </span>
                        )}
                        {row.source === 'legacy' && (
                          <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                            Legacy
                          </span>
                        )}
                        {!row.active && (
                          <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                            Not live
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2.5" title={row.domain}>
                      {row.domain}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2.5" title={row.skill}>
                      {row.skill}
                    </td>
                    <td className="px-3 py-2.5">
                      {DIFFICULTY_LABELS[row.difficulty]}
                    </td>
                    <td className="px-3 py-2.5 font-mono uppercase">
                      {row.format}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2.5 font-mono">
                      {row.attempts > 0 ? row.attempts : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.lastResult === 'correct' && (
                        <span className="font-medium text-emerald-400">Correct</span>
                      )}
                      {row.lastResult === 'incorrect' && (
                        <span className="font-medium text-red-400">Incorrect</span>
                      )}
                      {row.lastResult === null && (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label={`Practice question ${row.displayId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(row.id);
                        }}
                        className="rounded border border-[#27272A] bg-zinc-800/40 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
                      >
                        Practice
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#27272A] px-4 py-3 text-xs">
          <span className="text-zinc-400">
            Page <span className="font-mono text-zinc-200">{currentPage + 1}</span> of{' '}
            <span className="font-mono text-zinc-200">{totalPages}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 0}
              onClick={() => onStateChange({ filters: state.filters, page: currentPage - 1 })}
              className="rounded-md border border-[#27272A] px-3 py-1 text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1}
              onClick={() => onStateChange({ filters: state.filters, page: currentPage + 1 })}
              className="rounded-md border border-[#27272A] px-3 py-1 text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-zinc-400 focus:outline-none"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
