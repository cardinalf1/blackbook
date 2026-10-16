import React from 'react';
import type { SaveCopyPromptProps } from '../../types/screens';

export function SaveCopyPrompt({
  questionCount,
  onSave,
  onNotNow,
}: SaveCopyPromptProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#121215] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <h2 className="font-mono text-base font-semibold text-zinc-100">Download Complete!</h2>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            All <span className="font-mono text-zinc-200">{questionCount}</span> questions are saved locally on your computer.
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Would you like to save a standalone <code className="text-zinc-300">Blackbook-QuestionBank.zip</code> backup to your Documents folder? You can use this to restore your bank anytime without re-downloading.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onNotNow}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 font-mono text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-zinc-100 px-4 py-2 font-mono text-xs font-semibold text-zinc-900 hover:bg-white transition-colors"
          >
            Save backup copy
          </button>
        </div>
      </div>
    </div>
  );
}
