import React from 'react';

export function LicensesScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 px-4 py-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="font-mono text-2xl font-bold text-white">Third-Party Software Licenses</h1>
          <p className="text-xs text-zinc-400 mt-1">Open-source libraries used in Blackbook</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          Back
        </button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-[#121215] p-6 space-y-4 font-mono text-xs text-zinc-300 leading-relaxed overflow-x-auto">
        <p className="text-zinc-400">
          Blackbook is built using the following open-source software libraries:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-zinc-300">
          <li><strong>React & React-DOM</strong> — MIT License (Meta Platforms, Inc.)</li>
          <li><strong>Vite</strong> — MIT License (Evan You & Vite Contributors)</li>
          <li><strong>Tailwind CSS</strong> — MIT License (Tailwind Labs, Inc.)</li>
          <li><strong>Zustand</strong> — MIT License (Daishi Kato)</li>
          <li><strong>DOMPurify</strong> — Apache-2.0 / MPL-2.0 (Cure53)</li>
          <li><strong>KaTeX</strong> — MIT License (Khan Academy)</li>
          <li><strong>Lucide React</strong> — ISC License (Lucide Contributors)</li>
          <li><strong>Motion</strong> — MIT License (Framer)</li>
          <li><strong>clsx & tailwind-merge</strong> — MIT License (Luke Edwards, Dany Castillo)</li>
          <li><strong>Electron</strong> — MIT License (OpenJS Foundation)</li>
        </ul>
        <p className="text-zinc-500 pt-4 text-[11px]">
          Full license texts and copyright notices are included in the THIRD_PARTY_LICENSES.md file distributed with the application.
        </p>
      </div>
    </div>
  );
}
