import { useEffect, useId, useRef } from 'react';
import type { FiveMinuteAlertProps } from '../../types/exam';

export function FiveMinuteAlert({ onDismiss }: FiveMinuteAlertProps) {
  const headingId = useId();
  const descId = useId();
  const okButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    okButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descId}
        className="w-full max-w-sm space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-6 shadow-xl"
      >
        <h2 id={headingId} className="font-mono text-base font-semibold text-zinc-100">
          5 minutes left
        </h2>
        <p id={descId} className="text-sm text-zinc-300">
          You have 5 minutes left in this module. The timer is shown again.
        </p>
        <div className="flex justify-end pt-2">
          <button
            ref={okButtonRef}
            type="button"
            onClick={onDismiss}
            className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
