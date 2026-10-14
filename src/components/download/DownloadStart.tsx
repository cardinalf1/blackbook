import { useId, useMemo, useState } from 'react';
import type { DownloadEstimate, DownloadScopeChoice, DownloadStartProps } from '../../types/download';
import { DEFAULT_SCOPE } from '../../types/download';
import type { Section } from '../../types/sat';

interface ScopePickerProps {
  scope: DownloadScopeChoice;
  onChange: (scope: DownloadScopeChoice) => void;
  estimate: (scope: DownloadScopeChoice) => DownloadEstimate;
}

function ScopePicker({ scope, onChange, estimate }: ScopePickerProps) {
  const rwId = useId();
  const mathId = useId();
  const liveId = useId();
  const everythingId = useId();
  const setChoiceRadioName = useId();

  const est = useMemo(() => estimate(scope), [estimate, scope]);

  const handleSectionToggle = (section: Section) => {
    const nextSections = scope.sections.includes(section)
      ? scope.sections.filter((s) => s !== section)
      : [...scope.sections, section];

    const ordered: Section[] = (['rw', 'math'] as const).filter((s) =>
      nextSections.includes(s),
    );

    onChange({
      ...scope,
      sections: ordered,
    });
  };

  const handleLiveOnlyChange = (liveOnly: boolean) => {
    onChange({
      ...scope,
      liveOnly,
    });
  };

  return (
    <div className="space-y-4">
      {/* Sections */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-zinc-400">Sections</span>
        <div className="flex flex-wrap gap-4">
          <label
            htmlFor={rwId}
            className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300"
          >
            <input
              id={rwId}
              type="checkbox"
              checked={scope.sections.includes('rw')}
              onChange={() => handleSectionToggle('rw')}
              className="h-4 w-4 rounded border border-[#27272A] bg-[#0A0A0C] text-zinc-100 accent-zinc-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
            <span>Reading and Writing</span>
          </label>

          <label
            htmlFor={mathId}
            className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300"
          >
            <input
              id={mathId}
              type="checkbox"
              checked={scope.sections.includes('math')}
              onChange={() => handleSectionToggle('math')}
              className="h-4 w-4 rounded border border-[#27272A] bg-[#0A0A0C] text-zinc-100 accent-zinc-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
            <span>Math</span>
          </label>
        </div>
      </div>

      {/* Scope Choice */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-zinc-400">Questions</span>
        <div className="flex flex-wrap gap-4">
          <label
            htmlFor={liveId}
            className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300"
          >
            <input
              id={liveId}
              type="radio"
              name={setChoiceRadioName}
              value="live"
              checked={scope.liveOnly}
              onChange={() => handleLiveOnlyChange(true)}
              className="h-4 w-4 border border-[#27272A] bg-[#0A0A0C] text-zinc-100 accent-zinc-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
            <span>Live set only (recommended)</span>
          </label>

          <label
            htmlFor={everythingId}
            className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300"
          >
            <input
              id={everythingId}
              type="radio"
              name={setChoiceRadioName}
              value="everything"
              checked={!scope.liveOnly}
              onChange={() => handleLiveOnlyChange(false)}
              className="h-4 w-4 border border-[#27272A] bg-[#0A0A0C] text-zinc-100 accent-zinc-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
            <span>Everything</span>
          </label>
        </div>
      </div>

      {/* Live Estimate or Warning */}
      <div className="pt-1">
        {scope.sections.length === 0 ? (
          <div
            role="alert"
            className="rounded-md border border-amber-900/50 bg-amber-950/40 p-2.5 text-xs text-amber-300"
          >
            Pick at least one section.
          </div>
        ) : (
          <p className="font-mono text-xs text-zinc-400">
            About {est.questions.toLocaleString('en-US')} questions, {est.requests.toLocaleString('en-US')} requests, about {est.minutes.toLocaleString('en-US')} minutes.
          </p>
        )}
      </div>
    </div>
  );
}

export function DownloadStart({
  hasBank,
  questionCount,
  estimate,
  onChoose,
  importSlot,
}: DownloadStartProps) {
  const [scope, setScope] = useState<DownloadScopeChoice>(() => ({
    sections: [...DEFAULT_SCOPE.sections],
    liveOnly: DEFAULT_SCOPE.liveOnly,
  }));
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const canSubmit = scope.sections.length > 0;

  const handleChoose = () => {
    if (!canSubmit) return;
    onChoose(scope);
  };

  const handleCancel = () => {
    setIsExpanded(false);
    setScope({
      sections: [...DEFAULT_SCOPE.sections],
      liveOnly: DEFAULT_SCOPE.liveOnly,
    });
  };

  if (hasBank) {
    if (!isExpanded) {
      return (
        <div className="mx-auto w-full max-w-2xl">
          <section className="rounded-lg border border-[#27272A] bg-[#121215] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-xs text-zinc-300">
                {questionCount.toLocaleString('en-US')} questions on this computer
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                Refresh questions
              </button>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <section className="space-y-5 rounded-lg border border-[#27272A] bg-[#121215] p-5">
          <div className="border-b border-[#27272A] pb-3">
            <h2 className="font-mono text-sm font-medium text-zinc-100">Refresh questions</h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {questionCount.toLocaleString('en-US')} questions on this computer
            </p>
          </div>

          <ScopePicker scope={scope} onChange={setScope} estimate={estimate} />

          <div className="flex items-center justify-end gap-3 border-t border-[#27272A] pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleChoose}
              className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              Refresh
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <section className="space-y-5 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="border-b border-[#27272A] pb-3">
          <h2 className="font-mono text-sm font-medium text-zinc-100">Get your question bank</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Blackbook downloads practice questions to this computer. It runs here, not on a website.
          </p>
        </div>

        <ScopePicker scope={scope} onChange={setScope} estimate={estimate} />

        <div className="flex items-center justify-end border-t border-[#27272A] pt-4">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleChoose}
            className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Download questions
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#27272A]" />
          <span className="font-mono text-xs text-zinc-500">Or import a question bank file</span>
          <div className="h-px flex-1 bg-[#27272A]" />
        </div>
        {importSlot}
      </section>
    </div>
  );
}
