import React from 'react';
import type { WhileYouWaitProps } from '../../types/screens';

export function WhileYouWaitPanel({
  stageOneReady,
  questionsReady,
  groqKeySaved,
  desmosKeySaved,
  onOpenSettings,
  onStartFirstDrill,
  onOpenGuide,
}: WhileYouWaitProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#121215] p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="font-mono text-base font-semibold text-zinc-100">While You Wait</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            The question bank is downloading in the background. Here are a few things you can do right now:
          </p>
        </div>
        {stageOneReady && (
          <div className="shrink-0 flex items-center gap-2">
            <span className="font-mono text-xs text-emerald-400">
              {questionsReady} questions ready
            </span>
            <button
              type="button"
              onClick={onStartFirstDrill}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 font-mono text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              Start First Drill
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Groq AI Section */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-medium text-zinc-300">AI Explanations & Coach</span>
            {groqKeySaved ? (
              <span className="rounded bg-emerald-950 px-2 py-0.5 font-mono text-[10px] text-emerald-400 border border-emerald-800">
                Key Saved
              </span>
            ) : (
              <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                Optional
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Get instant AI analysis, hint breakdowns, and tailored practice sets with a free Groq API key.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenGuide('groq')}
              className="text-xs text-zinc-300 hover:text-white underline underline-offset-2"
            >
              How to get a key
            </button>
            <span className="text-zinc-600">•</span>
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-xs text-zinc-300 hover:text-white underline underline-offset-2"
            >
              Configure in Settings
            </button>
          </div>
        </div>

        {/* Desmos Section */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-medium text-zinc-300">Desmos Calculator</span>
            {desmosKeySaved ? (
              <span className="rounded bg-emerald-950 px-2 py-0.5 font-mono text-[10px] text-emerald-400 border border-emerald-800">
                Key Saved
              </span>
            ) : (
              <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                Optional
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Practice math with the real embedded graphing and scientific calculator by adding your Desmos key.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenGuide('desmos')}
              className="text-xs text-zinc-300 hover:text-white underline underline-offset-2"
            >
              How to get a key
            </button>
            <span className="text-zinc-600">•</span>
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-xs text-zinc-300 hover:text-white underline underline-offset-2"
            >
              Configure in Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
