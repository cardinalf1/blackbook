import { useEffect, useId } from 'react';
import type { InfoDialogProps } from '../../types/testRoom';
import { T } from '../ui/tokens';

export function InfoDialog({ title, onClose, children }: InfoDialogProps) {
  const titleId = useId();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${T.card} flex max-h-[85vh] w-full max-w-lg flex-col p-6 shadow-2xl`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#27272A]">
          <h2 id={titleId} className={T.title}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`rounded-[2px] p-1 text-zinc-400 hover:text-white ${T.focus}`}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 text-sm text-zinc-200">
          {children}
        </div>

        <div className="flex justify-end pt-4 border-t border-[#27272A]">
          <button
            type="button"
            onClick={onClose}
            className={T.secondary}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
