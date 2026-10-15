import type { ChangeEvent } from 'react';
import type { AnalyticsFilter, AnalyticsFilterBarProps, AnalyticsKind } from '../../types/analytics';
import type { Section } from '../../types/sat';

const KIND_OPTIONS: readonly { value: AnalyticsKind; label: string }[] = [
  { value: 'all', label: 'All sessions' },
  { value: 'drill', label: 'Drills' },
  { value: 'single', label: 'Single questions' },
  { value: 'module', label: 'Practice modules' },
  { value: 'section', label: 'Section runs' },
  { value: 'full', label: 'Full tests' },
];

function toDateInputValue(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

export function FilterBar({ filter, onChange, showSection = true }: AnalyticsFilterBarProps) {
  const handleFromChange = (e: ChangeEvent<HTMLInputElement>) => {
    const fromMs = parseDateInput(e.target.value, false);
    onChange({ ...filter, from: fromMs });
  };

  const handleToChange = (e: ChangeEvent<HTMLInputElement>) => {
    const toMs = parseDateInput(e.target.value, true);
    onChange({ ...filter, to: toMs });
  };

  const handleKindChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filter, kind: e.target.value as AnalyticsKind });
  };

  const handleSectionChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onChange({ ...filter, section: val === 'all' ? null : (val as Section) });
  };

  const handleExcludePausedChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filter, excludePaused: e.target.checked });
  };

  const handleExcludeSingleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filter, excludeSingle: e.target.checked });
  };

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-[#27272A] bg-[#121215] p-4 text-[#FAFAFA]">
      <label className="flex flex-col gap-1 text-xs text-zinc-400">
        <span>From</span>
        <input
          type="date"
          aria-label="From date"
          value={toDateInputValue(filter.from)}
          onChange={handleFromChange}
          className="rounded border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 font-mono text-xs text-zinc-200 transition-colors focus:border-zinc-500 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-zinc-400">
        <span>To</span>
        <input
          type="date"
          aria-label="To date"
          value={toDateInputValue(filter.to)}
          onChange={handleToChange}
          className="rounded border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 font-mono text-xs text-zinc-200 transition-colors focus:border-zinc-500 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-zinc-400">
        <span>Kind</span>
        <select
          aria-label="Session kind"
          value={filter.kind}
          onChange={handleKindChange}
          className="rounded border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-zinc-200 transition-colors focus:border-zinc-500 focus:outline-none"
        >
          {KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {showSection && (
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          <span>Section</span>
          <select
            aria-label="Section"
            value={filter.section ?? 'all'}
            onChange={handleSectionChange}
            className="rounded border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-zinc-200 transition-colors focus:border-zinc-500 focus:outline-none"
          >
            <option value="all">All sections</option>
            <option value="rw">Reading and Writing</option>
            <option value="math">Math</option>
          </select>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-4 py-1">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={filter.excludePaused}
            onChange={handleExcludePausedChange}
            className="h-3.5 w-3.5 rounded border-[#27272A] bg-[#0A0A0C] text-zinc-100 focus:ring-zinc-400 focus:ring-offset-0"
          />
          <span>Exclude paused tests</span>
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={filter.excludeSingle}
            onChange={handleExcludeSingleChange}
            className="h-3.5 w-3.5 rounded border-[#27272A] bg-[#0A0A0C] text-zinc-100 focus:ring-zinc-400 focus:ring-offset-0"
          />
          <span>Exclude single-question sessions</span>
        </label>
      </div>
    </div>
  );
}
