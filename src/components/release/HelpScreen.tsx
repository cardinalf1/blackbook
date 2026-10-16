import React, { useState } from 'react';
import type { HelpScreenProps } from '../../types/screens';

export function HelpScreen({
  desktop,
  dataFolder,
  onOpenDataFolder,
  onCopyDiagnostics,
  onOpenSettings,
  onBack,
}: HelpScreenProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await onCopyDiagnostics();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 px-4 py-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="font-mono text-2xl font-bold text-white">Help & Troubleshooting</h1>
          <p className="text-xs text-zinc-400 mt-1">Frequently asked questions, data management, and diagnostics</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          Back
        </button>
      </div>

      <div className="space-y-6">
        <section className="space-y-4">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-zinc-400">Common Questions</h2>

          <div className="rounded-xl border border-zinc-800 bg-[#121215] p-5 space-y-2">
            <h3 className="font-mono text-sm font-medium text-zinc-100">Where are my questions and practice history stored?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Everything is stored locally on your computer in an SQLite database (<code className="text-zinc-300">user.db</code>) and question bank file (<code className="text-zinc-300">bank.json</code>). No data ever leaves your computer.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-[#121215] p-5 space-y-2">
            <h3 className="font-mono text-sm font-medium text-zinc-100">Do I need an internet connection to practice?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              No. Once questions are downloaded or imported from a backup zip, Blackbook is 100% offline. The only features requiring internet are downloading new questions and AI explanations (which call Groq directly with your own key).
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-[#121215] p-5 space-y-2">
            <h3 className="font-mono text-sm font-medium text-zinc-100">How do I add my Desmos or Groq API keys?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Both keys are completely optional. You can configure or remove them anytime from the Settings screen. Keys are stored in an encrypted secrets file in your local app data folder and never transmitted anywhere else.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenSettings}
                className="font-mono text-xs text-zinc-200 underline underline-offset-4 hover:text-white"
              >
                Go to Settings &rarr;
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-zinc-400">Data & Diagnostics</h2>

          <div className="rounded-xl border border-zinc-800 bg-[#121215] p-5 space-y-4">
            <div className="space-y-1">
              <div className="font-mono text-xs text-zinc-300">Application Data Location</div>
              <div className="font-mono text-xs text-zinc-500 bg-zinc-900/80 p-2.5 rounded border border-zinc-800 break-all select-all">
                {dataFolder ?? 'Determined at runtime based on operating system'}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {desktop && onOpenDataFolder && (
                <button
                  type="button"
                  onClick={onOpenDataFolder}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  Open Data Folder
                </button>
              )}
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 font-mono text-xs font-semibold text-zinc-900 hover:bg-white transition-colors"
              >
                {copied ? 'Copied Diagnostics!' : 'Copy Diagnostics'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
