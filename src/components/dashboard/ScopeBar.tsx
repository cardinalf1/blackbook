import { useState, type ChangeEvent } from 'react';
import { ANALYTICS_KINDS, type AnalyticsKind } from '../../types/analytics';
import {
  SCOPE_PRESETS,
  SCOPE_SECTIONS,
  type ScopeBarProps,
  type ScopePreset,
  type ScopeSection,
} from '../../types/dashboard';
import { T } from '../ui/tokens';

const KIND_LABELS: Record<AnalyticsKind, string> = {
  all: 'All sessions',
  drill: 'Drills',
  single: 'Single questions',
  module: 'Practice modules',
  section: 'Section runs',
  full: 'Full tests',
};

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

export function ScopeBar({ scope, resolved, onChange }: ScopeBarProps) {
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const activePreset =
    scope.from !== null || scope.to !== null
      ? null
      : scope.preset === 'auto'
        ? resolved.preset
        : scope.preset;

  const handlePresetClick = (presetId: ScopePreset) => {
    onChange({
      ...scope,
      preset: presetId,
      from: null,
      to: null,
    });
  };

  const handleSectionClick = (sectionId: ScopeSection) => {
    onChange({
      ...scope,
      section: sectionId,
    });
  };

  const handleFromChange = (e: ChangeEvent<HTMLInputElement>) => {
    const fromMs = parseDateInput(e.target.value, false);
    onChange({
      ...scope,
      from: fromMs,
    });
  };

  const handleToChange = (e: ChangeEvent<HTMLInputElement>) => {
    const toMs = parseDateInput(e.target.value, true);
    onChange({
      ...scope,
      to: toMs,
    });
  };

  const handleKindChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...scope,
      kind: e.target.value as AnalyticsKind,
    });
  };

  const handleExcludePausedChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...scope,
      excludePaused: e.target.checked,
    });
  };

  const handleExcludeSingleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...scope,
      excludeSingle: e.target.checked,
    });
  };

  const handleIncludeHiddenChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...scope,
      includeHidden: e.target.checked,
    });
  };

  return (
    <div className={`${T.card} ${T.cardPad} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex overflow-hidden rounded-[2px] border border-[#27272A] bg-black"
            role="group"
            aria-label="Scope presets"
          >
            {SCOPE_PRESETS.map((p) => {
              const isPressed = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={isPressed}
                  onClick={() => handlePresetClick(p.id)}
                  className={`${T.segment} ${isPressed ? T.segmentOn : T.segmentOff}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div
            className="inline-flex overflow-hidden rounded-[2px] border border-[#27272A] bg-black"
            role="group"
            aria-label="Scope sections"
          >
            {SCOPE_SECTIONS.map((s) => {
              const isPressed = scope.section === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={isPressed}
                  onClick={() => handleSectionClick(s.id)}
                  className={`${T.segment} ${isPressed ? T.segmentOn : T.segmentOff}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <span className={T.muted}>{resolved.label}</span>
        </div>

        <button
          type="button"
          aria-expanded={moreFiltersOpen}
          onClick={() => setMoreFiltersOpen((v) => !v)}
          className={T.secondary}
        >
          More filters
        </button>
      </div>

      {moreFiltersOpen && (
        <div className="border-t border-[#27272A] pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              <span>From</span>
              <input
                type="date"
                aria-label="From date"
                value={toDateInputValue(scope.from)}
                onChange={handleFromChange}
                className={T.input}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              <span>To</span>
              <input
                type="date"
                aria-label="To date"
                value={toDateInputValue(scope.to)}
                onChange={handleToChange}
                className={T.input}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              <span>Kind</span>
              <select
                aria-label="Session kind"
                value={scope.kind}
                onChange={handleKindChange}
                className={T.input}
              >
                {ANALYTICS_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-4 py-1.5">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  aria-label="Exclude paused tests"
                  checked={scope.excludePaused}
                  onChange={handleExcludePausedChange}
                  className="h-4 w-4 rounded-[2px] accent-white"
                />
                <span>Exclude paused tests</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  aria-label="Exclude single-question sessions"
                  checked={scope.excludeSingle}
                  onChange={handleExcludeSingleChange}
                  className="h-4 w-4 rounded-[2px] accent-white"
                />
                <span>Exclude single-question sessions</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  aria-label="Show hidden sessions"
                  checked={scope.includeHidden}
                  onChange={handleIncludeHiddenChange}
                  className="h-4 w-4 rounded-[2px] accent-white"
                />
                <span>Show hidden sessions</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
