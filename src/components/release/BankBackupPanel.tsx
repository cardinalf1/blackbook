import React, { useRef } from 'react';
import type { BankBackupPanelProps } from '../../types/screens';

export function BankBackupPanel({
  hasBank,
  questionCount,
  state,
  onExport,
  onImport,
  onShowFile,
}: BankBackupPanelProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#121215] p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="font-mono text-base font-semibold text-zinc-100">Question Bank Backup</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Export a standalone <code className="text-zinc-300">.zip</code> backup of your downloaded question bank, or import one on a new computer.
          </p>
        </div>
        <div className="font-mono text-xs text-zinc-400 shrink-0">
          {hasBank ? `${questionCount} questions stored` : 'No questions stored'}
        </div>
      </div>

      {state.kind === 'error' && (
        <div className="rounded-lg border border-red-950 bg-red-950/20 p-3 text-xs text-red-300">
          {state.message}
        </div>
      )}

      {state.kind === 'importing' && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-2">
          <div className="flex justify-between text-xs text-zinc-300">
            <span>Importing {state.fileName}...</span>
            {state.progress !== null && <span>{Math.round(state.progress * 100)}%</span>}
          </div>
          {state.progress !== null && (
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-zinc-100 transition-all duration-200"
                style={{ width: `${Math.round(state.progress * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {state.kind === 'imported' && (
        <div className="rounded-lg border border-emerald-950 bg-emerald-950/20 p-3 text-xs text-emerald-400 flex items-center justify-between">
          <span>Successfully imported {state.questions} questions!</span>
        </div>
      )}

      {state.kind === 'exported' && (
        <div className="rounded-lg border border-emerald-950 bg-emerald-950/20 p-3 text-xs text-emerald-400 flex flex-wrap items-center justify-between gap-2">
          <span>Question bank backup exported successfully!</span>
          {state.canShowFile && onShowFile && (
            <button
              type="button"
              onClick={onShowFile}
              className="rounded bg-emerald-900/60 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-800 transition-colors"
            >
              Show in folder
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.json"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          disabled={!hasBank || state.kind === 'exporting' || state.kind === 'importing'}
          onClick={onExport}
          className="rounded-lg bg-zinc-100 px-4 py-2 font-mono text-xs font-semibold text-zinc-900 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {state.kind === 'exporting' ? 'Exporting...' : 'Export Bank Zip'}
        </button>

        <button
          type="button"
          disabled={state.kind === 'exporting' || state.kind === 'importing'}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2 font-mono text-xs font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Import Bank Zip / JSON
        </button>
      </div>
    </div>
  );
}
