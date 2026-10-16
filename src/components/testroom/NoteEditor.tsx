import { useEffect, useState } from 'react';
import type { NoteEditorProps } from '../../types/testRoom';
import { T } from '../ui/tokens';

export function NoteEditor({
  initial,
  maxLength,
  onSave,
  onCancel,
}: NoteEditorProps) {
  const [text, setText] = useState(initial);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSave(text);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Note"
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-md flex-col gap-4 rounded-[2px] border border-[#27272A] bg-black p-5 text-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
          <h2 className={T.title}>Note</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close note"
            className="rounded p-1 text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span aria-hidden="true" className="text-lg leading-none">&times;</span>
          </button>
        </div>

        <textarea
          autoFocus
          maxLength={maxLength}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Note text"
          className="h-32 w-full resize-none rounded-[2px] border border-[#27272A] bg-[#0A0A0C] p-3 font-mono text-sm text-white placeholder-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        />

        <div className="flex items-center justify-between pt-1">
          <span className="font-mono text-xs text-zinc-400">
            {text.length} / {maxLength}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className={T.secondary}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(text)}
              className={T.primary}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
