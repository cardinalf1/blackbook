import { useId, useMemo, useState } from 'react';
import { capCount, matchingCount } from '../../services/drill/facets';
import type { DrillConfig, DrillSetupProps } from '../../types/drill';
import type { Difficulty, Section } from '../../types/sat';

const SECTION_OPTIONS: readonly { value: Section; label: string }[] = [
  { value: 'rw', label: 'Reading and Writing' },
  { value: 'math', label: 'Math' },
];

const DIFFICULTY_OPTIONS: readonly { diff: Difficulty; label: string }[] = [
  { diff: 'E', label: 'Easy' },
  { diff: 'M', label: 'Medium' },
  { diff: 'H', label: 'Hard' },
];

export function DrillSetup({ taxonomy, facets, onStart, onCancel }: DrillSetupProps) {
  const sectionSelectId = useId();
  const domainSelectId = useId();
  const countInputId = useId();
  const liveOnlyId = useId();

  // Pick initial section from taxonomy if available, otherwise default to 'rw'.
  const initialSection: Section = useMemo(() => {
    if (taxonomy.some((t) => t.section === 'rw')) return 'rw';
    return taxonomy[0]?.section ?? 'rw';
  }, [taxonomy]);

  const [section, setSection] = useState<Section>(initialSection);
  const [domainCode, setDomainCode] = useState<string | 'all'>('all');
  const [skillCodes, setSkillCodes] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [countInput, setCountInput] = useState<string>('10');
  const [liveOnly, setLiveOnly] = useState<boolean>(true);

  // Domains & skills for the selected section
  const currentSectionTaxonomy = useMemo(() => {
    return taxonomy.find((t) => t.section === section);
  }, [taxonomy, section]);

  const availableDomains = useMemo(() => {
    return currentSectionTaxonomy?.domains ?? [];
  }, [currentSectionTaxonomy]);

  const availableSkills = useMemo(() => {
    if (!currentSectionTaxonomy) return [];
    if (domainCode === 'all') {
      return currentSectionTaxonomy.domains.flatMap((d) => d.skills);
    }
    const domain = currentSectionTaxonomy.domains.find((d) => d.domainCode === domainCode);
    return domain?.skills ?? [];
  }, [currentSectionTaxonomy, domainCode]);

  // Derived sanitized count: minimum 1
  const count = useMemo(() => {
    const parsed = parseInt(countInput, 10);
    return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
  }, [countInput]);

  // Current drill configuration
  const currentConfig: DrillConfig = useMemo(
    () => ({
      section,
      domainCode,
      skillCodes,
      difficulties,
      count,
      liveOnly,
    }),
    [section, domainCode, skillCodes, difficulties, count, liveOnly],
  );

  // Live match count calculated using matchingCount from facets service
  const matchCount = useMemo(() => {
    return matchingCount(facets, currentConfig);
  }, [facets, currentConfig]);

  // Handlers
  const handleSectionChange = (newSection: Section) => {
    setSection(newSection);
    setDomainCode('all');
    setSkillCodes([]);
  };

  const handleDomainChange = (newDomain: string) => {
    setDomainCode(newDomain);
    setSkillCodes([]);
  };

  const handleSkillToggle = (code: string) => {
    setSkillCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleDifficultyToggle = (diff: Difficulty) => {
    setDifficulties((prev) =>
      prev.includes(diff) ? prev.filter((d) => d !== diff) : [...prev, diff],
    );
  };

  const handleStart = () => {
    if (matchCount === 0) return;
    const capped = capCount(facets, currentConfig);
    onStart(capped);
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <section className="space-y-5 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#27272A] pb-3">
          <div>
            <h2 className="font-mono text-sm font-medium text-zinc-100">Drill Setup</h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Configure question filters and set size for your practice session.
            </p>
          </div>
          <div className="font-mono text-xs text-zinc-300">
            <span className="font-semibold text-zinc-100">{matchCount}</span>{' '}
            {matchCount === 1 ? 'question matches' : 'questions match'}
          </div>
        </div>

        {/* Section & Domain selection */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label htmlFor={sectionSelectId} className="block space-y-1">
            <span className="text-xs text-zinc-400">Section</span>
            <select
              id={sectionSelectId}
              value={section}
              onChange={(e) => handleSectionChange(e.target.value as Section)}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] transition-colors focus:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              {SECTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor={domainSelectId} className="block space-y-1">
            <span className="text-xs text-zinc-400">Domain</span>
            <select
              id={domainSelectId}
              value={domainCode}
              onChange={(e) => handleDomainChange(e.target.value)}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] transition-colors focus:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <option value="all">All domains ({availableDomains.length})</option>
              {availableDomains.map((d) => (
                <option key={d.domainCode} value={d.domainCode}>
                  {d.domain}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Skills list */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">
              Skills{' '}
              <span className="text-zinc-500">
                (none checked = all {availableSkills.length} skills in domain)
              </span>
            </span>
            {skillCodes.length > 0 && (
              <button
                type="button"
                onClick={() => setSkillCodes([])}
                className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                Clear selection ({skillCodes.length})
              </button>
            )}
          </div>

          {availableSkills.length === 0 ? (
            <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3 text-center text-xs text-zinc-500">
              No skills found for this selection.
            </div>
          ) : (
            <div className="grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border border-[#27272A] bg-[#0A0A0C] p-2.5 sm:grid-cols-2">
              {availableSkills.map((s) => {
                const isChecked = skillCodes.includes(s.skillCode);
                const skillInputId = `skill-${s.skillCode}`;
                return (
                  <label
                    key={s.skillCode}
                    htmlFor={skillInputId}
                    className={`flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-xs transition-colors ${
                      isChecked
                        ? 'bg-zinc-800/80 text-zinc-100'
                        : 'text-zinc-300 hover:bg-zinc-900/60'
                    }`}
                  >
                    <input
                      id={skillInputId}
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleSkillToggle(s.skillCode)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border border-[#27272A] bg-[#121215] text-zinc-100 accent-zinc-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    />
                    <span className="flex-1 leading-snug">
                      <span className="mr-1.5 font-mono text-[10px] text-zinc-400">
                        [{s.skillCode}]
                      </span>
                      {s.skill}
                      {s.total > 0 && (
                        <span className="ml-1.5 font-mono text-[10px] text-zinc-500">
                          ({s.total})
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Difficulty */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">
              Difficulty <span className="text-zinc-500">(none selected = any)</span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_OPTIONS.map(({ diff, label }) => {
              const isSelected = difficulties.includes(diff);
              return (
                <button
                  key={diff}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleDifficultyToggle(diff)}
                  className={`rounded-md border px-2 py-1.5 sm:px-3 font-mono text-xs text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                    isSelected
                      ? 'border-zinc-400 bg-zinc-800 text-[#FAFAFA]'
                      : 'border-[#27272A] bg-[#0A0A0C] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {label} ({diff})
                </button>
              );
            })}
          </div>
        </div>

        {/* Question count and Live set only */}
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
          <label htmlFor={countInputId} className="block space-y-1">
            <span className="text-xs text-zinc-400">Question count</span>
            <input
              id={countInputId}
              type="number"
              min={1}
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
              onBlur={() => setCountInput(String(count))}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 font-mono text-xs text-[#FAFAFA] transition-colors focus:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
          </label>

          <label
            htmlFor={liveOnlyId}
            className="flex cursor-pointer items-center gap-2 pb-2 text-xs text-zinc-300"
          >
            <input
              id={liveOnlyId}
              type="checkbox"
              checked={liveOnly}
              onChange={(e) => setLiveOnly(e.target.checked)}
              className="h-4 w-4 rounded border border-[#27272A] bg-[#0A0A0C] text-zinc-100 accent-zinc-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
            <span>Live set only</span>
          </label>
        </div>

        {/* Notices */}
        {matchCount === 0 ? (
          <div
            role="alert"
            className="rounded-md border border-amber-900/50 bg-amber-950/40 p-3 text-xs text-amber-300"
          >
            No questions match the current criteria. Please adjust your filters.
          </div>
        ) : count > matchCount ? (
          <div
            role="status"
            className="rounded-md border border-amber-900/50 bg-amber-950/40 p-3 text-xs text-amber-300"
          >
            Only {matchCount} match, so the session will have {matchCount} questions.
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-[#27272A] pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={matchCount === 0}
            onClick={handleStart}
            className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Start Drill
          </button>
        </div>
      </section>
    </div>
  );
}
