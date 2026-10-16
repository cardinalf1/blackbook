import type React from 'react';

export interface WelcomeScreenProps {
  onDownload: () => void;
  onImport: () => void;
  onLookAround: () => void;
  downloadEnabled: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onDownload,
  onImport,
  onLookAround,
  downloadEnabled,
}) => {
  return (
    <div className="min-h-screen bg-[#0A0A0C] text-zinc-100 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-xl space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-block rounded-full bg-zinc-800/80 px-3 py-1 text-xs font-mono text-zinc-400 border border-zinc-700/50">
            Digital SAT Practice Environment
          </div>
          <h1 className="font-mono text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Welcome to Blackbook
          </h1>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Private, offline SAT practice. No user accounts, no telemetry, and all data stays strictly on your computer.
          </p>
        </div>

        <div className="space-y-4">
          {downloadEnabled && (
            <div className="rounded-xl border border-zinc-800 bg-[#121215] p-6 hover:border-zinc-700 transition-colors">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-mono text-base font-semibold text-zinc-100">Download Question Bank</h2>
                    <span className="rounded bg-emerald-950/80 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-400 border border-emerald-800">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-md">
                    Downloads practice questions directly from the public educator repository. Stage one finishes in ~30 seconds so you can drill immediately while the rest finishes in the background.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="download"
                  onClick={onDownload}
                  className="w-full sm:w-auto shrink-0 rounded-lg bg-zinc-100 px-4 py-2.5 font-mono text-xs font-semibold text-zinc-900 hover:bg-white transition-colors"
                >
                  Download Bank
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-zinc-800 bg-[#121215] p-6 hover:border-zinc-700 transition-colors">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-mono text-base font-semibold text-zinc-100">Import Existing Backup</h2>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-md">
                  Got a portable bank backup from a classmate or another computer? Import a <code>.zip</code> or <code>.json</code> file to get started immediately offline.
                </p>
              </div>
              <button
                type="button"
                onClick={onImport}
                className="w-full sm:w-auto shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 font-mono text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                Import File
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/60 bg-[#121215]/50 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-mono text-sm font-semibold text-zinc-300">Look Around First</h2>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-md">
                  Browse the interface, configure tool preferences, or examine app settings before adding questions.
                </p>
              </div>
              <button
                type="button"
                onClick={onLookAround}
                className="w-full sm:w-auto shrink-0 rounded-lg text-zinc-400 hover:text-zinc-200 px-4 py-2 font-mono text-xs transition-colors"
              >
                Look Around &rarr;
              </button>
            </div>
          </div>
        </div>

        <div className="text-center font-mono text-[11px] text-zinc-400">
          SAT® is a registered trademark of the College Board, which is not affiliated with and does not endorse this software.
        </div>
      </div>
    </div>
  );
};
