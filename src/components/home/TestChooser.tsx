import { useEffect, useRef } from 'react';
import type { TestChooserProps } from '../../types/home';
import { T } from '../ui/tokens';

export function TestChooser({
  open,
  options,
  poolLine,
  onChoose,
  onClose,
}: TestChooserProps) {
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      firstOptionRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-chooser-title"
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md ${T.card} p-6 space-y-4`}
      >
        <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
          <h2 id="test-chooser-title" className={T.title}>
            Take a test
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`${T.secondary} text-xs py-1 px-2.5`}
          >
            Close
          </button>
        </div>

        <div className="space-y-2.5">
          {options.map((option, idx) => (
            <button
              key={option.to}
              ref={idx === 0 ? firstOptionRef : undefined}
              type="button"
              onClick={() => {
                onChoose(option.to);
                onClose();
              }}
              className={`w-full text-left rounded-[2px] border border-[#27272A] bg-black p-3 hover:border-zinc-500 transition-colors ${T.focus} flex flex-col gap-1`}
            >
              <span className={`${T.body} font-medium`}>{option.label}</span>
              {option.hint && <span className={T.muted}>{option.hint}</span>}
            </button>
          ))}
        </div>

        {poolLine && (
          <p className={`${T.muted} pt-2 border-t border-[#27272A]`}>
            {poolLine}
          </p>
        )}
      </div>
    </div>
  );
}
