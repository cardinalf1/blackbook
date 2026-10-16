import { useEffect, useMemo, useState } from 'react';
import { loadMistakeLog } from '../../services/mistakes/load';
import {
  MISTAKE_REASONS,
  MISTAKE_REASON_LABEL,
  type MistakeLogRow,
  type MistakeReason,
} from '../../types/mistakes';
import { RulesNoteBox } from '../notes/RulesNoteBox';

export interface MistakeLogScreenProps {
  onBack: () => void;
  onOpenReport: (sessionId: string) => void;
}

const DIFFICULTY_LABELS: Record<'E' | 'M' | 'H', string> = {
  E: 'Easy',
  M: 'Medium',
  H: 'Hard',
};

function parseDateInput(value: string, endOfDay: boolean): number | null {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return null;
  const [year, month, day] = parts as [number, number, number];
  if (endOfDay) {
    return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  }
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

export function MistakeLogScreen({ onBack, onOpenReport }: MistakeLogScreenProps) {
  const [rows, setRows] = useState<MistakeLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [reasonFilter, setReasonFilter] = useState<'all' | MistakeReason>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'E' | 'M' | 'H'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadMistakeLog()
      .then((res) => {
        if (active) {
          setRows(res.rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const reasonCounts = useMemo(() => {
    const counts: Record<MistakeReason, number> = {
      careless: 0,
      concept_gap: 0,
      misread: 0,
      ran_out_of_time: 0,
      guessed: 0,
      other: 0,
    };
    for (const r of rows) {
      counts[r.tag.reason] = (counts[r.tag.reason] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  const skillOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      map.set(r.skillCode, r.skill);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const selectedSkillOption = skillOptions.find(([code]) => code === skillFilter);
  const selectedSkillName = selectedSkillOption ? selectedSkillOption[1] : skillFilter;

  const filteredRows = useMemo(() => {
    const fromMs = parseDateInput(fromDate, false);
    const toMs = parseDateInput(toDate, true);

    return rows.filter((row) => {
      if (reasonFilter !== 'all' && row.tag.reason !== reasonFilter) {
        return false;
      }
      if (skillFilter !== 'all' && row.skillCode !== skillFilter && row.skill !== skillFilter) {
        return false;
      }
      if (difficultyFilter !== 'all' && row.difficulty !== difficultyFilter) {
        return false;
      }
      if (fromMs !== null && row.tag.at < fromMs) {
        return false;
      }
      if (toMs !== null && row.tag.at > toMs) {
        return false;
      }
      return true;
    });
  }, [rows, reasonFilter, skillFilter, difficultyFilter, fromDate, toDate]);

  const hasActiveFilters =
    reasonFilter !== 'all' ||
    skillFilter !== 'all' ||
    difficultyFilter !== 'all' ||
    fromDate !== '' ||
    toDate !== '';

  const handleClearFilters = () => {
    setReasonFilter('all');
    setSkillFilter('all');
    setDifficultyFilter('all');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 text-[#FAFAFA]">
      {/* Header */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div>
          <h1 className="font-mono text-base font-semibold text-zinc-100">Mistake log</h1>
          <p className="mt-0.5 text-xs text-zinc-400">
            {rows.length} tagged {rows.length === 1 ? 'mistake' : 'mistakes'} recorded
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Back
        </button>
      </section>

      {/* Counts per reason */}
      <section className="rounded-lg border border-[#27272A] bg-[#121215] p-5 space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
          Mistakes by reason
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {MISTAKE_REASONS.map((reason) => {
            const count = reasonCounts[reason];
            const isSelected = reasonFilter === reason;
            return (
              <button
                key={reason}
                type="button"
                onClick={() => setReasonFilter(isSelected ? 'all' : reason)}
                className={`flex flex-col rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                  isSelected
                    ? 'border-zinc-300 bg-zinc-800'
                    : 'border-[#27272A] bg-[#0A0A0C] hover:border-zinc-500'
                }`}
              >
                <span className="text-xs text-zinc-400">{MISTAKE_REASON_LABEL[reason]}</span>
                <span className="mt-1 font-mono text-xl font-semibold text-zinc-100">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filter bar */}
      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-[#27272A] bg-[#121215] p-4 text-xs">
        <label className="flex flex-col gap-1 text-zinc-400">
          <span>Reason</span>
          <select
            aria-label="Filter by reason"
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value as 'all' | MistakeReason)}
            className="rounded border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 font-mono text-xs text-zinc-200 transition-colors focus:border-zinc-500 focus:outline-none"
          >
            <option value="all">All reasons</option>
            {MISTAKE_REASONS.map((r) => (
              <option key={r} value={r}>
                {MISTAKE_REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-zinc-400">
          <span>Skill</span>
          <select
            aria-label="Filter by skill"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="max-w-[200px] rounded border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-zinc-200 transition-colors focus:border-zinc-500 focus:outline-none"
          >
            <option value="all">All skills</option>
            {skillOptions.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-zinc-400">
          <span>Difficulty</span>
          <select
            aria-label="Filter by difficulty"
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value as 'all' | 'E' | 'M' | 'H')}
            className="rounded border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 font-mono text-xs text-zinc-200 transition-colors focus:border-zinc-500 focus:outline-none"
          >
            <option value="all">All difficulties</option>
            <option value="E">Easy</option>
            <option value="M">Medium</option>
            <option value="H">Hard</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-zinc-400">
          <span>From</span>
          <input
            type="date"
            aria-label="From date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 font-mono text-xs text-zinc-200 transition-colors focus:border-zinc-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-zinc-400">
          <span>To</span>
          <input
            type="date"
            aria-label="To date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 font-mono text-xs text-zinc-200 transition-colors focus:border-zinc-500 focus:outline-none"
          />
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="rounded border border-[#27272A] bg-[#0A0A0C] px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Clear filters
          </button>
        )}
      </section>

      {/* Rules note box for selected skill */}
      {skillFilter !== 'all' && (
        <section>
          <RulesNoteBox skillCode={skillFilter} skill={selectedSkillName} />
        </section>
      )}

      {/* Tagged mistakes list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
            Tagged mistakes ({filteredRows.length})
          </h2>
        </div>

        {loading ? (
          <div className="rounded-lg border border-[#27272A] bg-[#121215] p-8 text-center text-xs text-zinc-500">
            Loading mistake log...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-[#27272A] bg-[#121215] p-8 text-center text-xs text-zinc-500">
            No mistake tags recorded yet.
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-lg border border-[#27272A] bg-[#121215] p-8 text-center text-xs text-zinc-500">
            No mistake tags match the selected filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((row) => {
              const diffLabel = DIFFICULTY_LABELS[row.difficulty] ?? row.difficulty;
              const formattedDate = new Date(row.tag.at).toLocaleDateString();

              return (
                <div
                  key={row.tag.id}
                  data-testid={`mistake-row-${row.tag.id}`}
                  className="rounded-lg border border-[#27272A] bg-[#121215] p-4 text-xs transition-colors"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-medium text-zinc-400">
                          #{row.displayId}
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-200">{row.skill}</span>
                        <span className="text-zinc-600">•</span>
                        <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                          {diffLabel}
                        </span>
                        <span className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-200">
                          {MISTAKE_REASON_LABEL[row.tag.reason]}
                        </span>
                        {row.versions > 1 && (
                          <span className="font-mono text-zinc-500">
                            (changed {row.versions} times)
                          </span>
                        )}
                      </div>

                      {row.tag.note && (
                        <p className="text-zinc-400 italic">"{row.tag.note}"</p>
                      )}

                      <div className="text-[11px] text-zinc-500 font-mono">
                        Tagged on {formattedDate}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenReport(row.tag.sessionId)}
                      className="self-start rounded-md border border-[#27272A] px-3 py-1.5 font-mono text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 sm:self-auto"
                    >
                      Open report
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
