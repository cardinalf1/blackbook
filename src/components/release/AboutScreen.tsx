import React from 'react';
import type { AboutScreenProps } from '../../types/screens';

export function AboutScreen({
  version,
  electron,
  platform,
  onOpenLicenses,
  onBack,
}: AboutScreenProps): React.JSX.Element {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 px-4 py-8 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="font-mono text-2xl font-bold text-white">About Blackbook</h1>
          <p className="text-xs text-zinc-400 mt-1">Independent offline Digital SAT practice simulator</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          Back
        </button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-[#121215] p-6 space-y-6">
        <div className="space-y-3">
          <div className="inline-block rounded-full bg-zinc-800/80 px-2.5 py-0.5 font-mono text-xs text-zinc-300">
            Blackbook v{version}
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Blackbook is an independent, offline-first study tool designed for students preparing for the Digital SAT. It provides realistic test conditions, timing metrics, rich analytics, and optional AI explanations with complete data privacy.
          </p>
        </div>

        <div className="border-t border-zinc-800/80 pt-4 space-y-2">
          <div className="font-mono text-xs text-zinc-400">Environment Details</div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="text-zinc-500">App Version:</div>
            <div className="text-zinc-200">{version}</div>
            {electron && (
              <>
                <div className="text-zinc-500">Electron:</div>
                <div className="text-zinc-200">{electron}</div>
              </>
            )}
            {platform && (
              <>
                <div className="text-zinc-500">Platform:</div>
                <div className="text-zinc-200">{platform}</div>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-800/80 pt-4 space-y-2">
          <div className="font-mono text-xs text-zinc-400">Legal & Open Source</div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            SAT® is a registered trademark of the College Board, which is not affiliated with and does not endorse this application.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onOpenLicenses}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              Third-Party Licenses
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
