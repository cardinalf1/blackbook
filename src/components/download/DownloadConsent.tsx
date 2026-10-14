import { useEffect, useId, useState } from 'react';
import type { DownloadConsentProps, DownloadScopeChoice } from '../../types/download';

function formatScopeLabel(scope: DownloadScopeChoice): string {
  const setPart = scope.liveOnly ? 'the live set' : 'all questions';
  const hasRw = scope.sections.includes('rw');
  const hasMath = scope.sections.includes('math');
  let sectionPart = '';
  if (hasRw && hasMath) {
    sectionPart = ', Reading and Writing and Math';
  } else if (hasRw) {
    sectionPart = ', Reading and Writing only';
  } else if (hasMath) {
    sectionPart = ', Math only';
  }
  return `${setPart}${sectionPart}`;
}

export function DownloadConsent({
  scope,
  estimate,
  dataFolder,
  onConfirm,
  onCancel,
}: DownloadConsentProps) {
  const headingId = useId();
  const checkboxId = useId();
  const [understood, setUnderstood] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  const scopeLabel = formatScopeLabel(scope);
  const questions = estimate.questions.toLocaleString('en-US');
  const requests = estimate.requests.toLocaleString('en-US');
  const minutes = estimate.minutes.toLocaleString('en-US');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-6 text-[#FAFAFA] shadow-xl">
        <h2 id={headingId} className="font-mono text-sm font-medium text-zinc-100">
          Download questions to this computer
        </h2>

        <div className="space-y-3 text-xs leading-relaxed text-zinc-300">
          <p>
            Blackbook will download about {questions} practice questions ({scopeLabel}) from College
            Board's public SAT Educator Question Bank into a folder on this computer:{' '}
            <code className="font-mono text-zinc-200">{dataFolder}</code>.
          </p>

          <p>
            Blackbook contacts the source directly, about {requests} requests, at most 2 at a time.
            It takes about {minutes} minutes (measured; your connection may differ). Keep Blackbook
            open until it finishes; if it stops, it resumes where it left off.
          </p>

          <p>Nothing is uploaded anywhere: Blackbook has no server and no accounts.</p>

          <p>
            The questions belong to their owner and are for your personal practice; don't share or
            republish them.
          </p>

          <p>
            Blackbook is an independent practice tool, not affiliated with or endorsed by the source.
            If the source starts refusing requests, the download stops and won't retry on its own.
          </p>
        </div>

        <div className="pt-1">
          <label htmlFor={checkboxId} className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
            <input
              id={checkboxId}
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="h-4 w-4 rounded border border-[#27272A] bg-[#0A0A0C] text-zinc-100 accent-zinc-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
            <span>I understand.</span>
          </label>
        </div>

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
            disabled={!understood}
            onClick={onConfirm}
            className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
