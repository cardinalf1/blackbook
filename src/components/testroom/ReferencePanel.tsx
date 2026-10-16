import { useEffect, useMemo } from 'react';
import katex from 'katex';
import type { ReferencePanelProps } from '../../types/testRoom';
import { T } from '../ui/tokens';

function FormulaKatex({ tex }: { tex: string }) {
  const html = useMemo(() => katex.renderToString(tex, { throwOnError: false }), [tex]);
  return <span className="inline-block" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function ReferencePanel({ expanded, onToggleExpand, onClose }: ReferencePanelProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <aside
      aria-label="Math Reference"
      className="flex h-full w-full flex-col border-l border-[#27272A] bg-[#121215] text-white"
    >
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-[#27272A] px-4 py-3 bg-black">
        <h2 className="font-mono text-sm font-semibold text-white">Reference</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={expanded ? 'Collapse reference' : 'Expand reference'}
            aria-pressed={expanded}
            onClick={onToggleExpand}
            className={`rounded-[2px] p-1.5 text-zinc-400 hover:text-white ${T.focus}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {expanded ? (
                <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" />
              ) : (
                <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v-4h-4" />
              )}
            </svg>
          </button>
          <button
            type="button"
            aria-label="Close reference"
            onClick={onClose}
            className={`rounded-[2px] p-1.5 text-zinc-400 hover:text-white ${T.focus}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className={`grid gap-4 ${expanded ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {/* 1. Circle */}
          <div className="flex flex-col items-center justify-between rounded-[2px] border border-[#27272A] bg-black p-3 text-center">
            <svg
              viewBox="0 0 120 80"
              className="h-16 w-auto text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="60" cy="40" r="28" />
              <line x1="60" y1="40" x2="88" y2="40" strokeDasharray="3 2" />
              <circle cx="60" cy="40" r="1.5" fill="currentColor" stroke="none" />
              <text x="74" y="35" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">
                r
              </text>
            </svg>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-zinc-100">
              <FormulaKatex tex="A = \pi r^2" />
              <FormulaKatex tex="C = 2\pi r" />
            </div>
          </div>

          {/* 2. Rectangle */}
          <div className="flex flex-col items-center justify-between rounded-[2px] border border-[#27272A] bg-black p-3 text-center">
            <svg
              viewBox="0 0 120 80"
              className="h-16 w-auto text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="25" y="20" width="70" height="40" />
              <text x="60" y="74" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">
                ℓ
              </text>
              <text x="16" y="44" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">
                w
              </text>
            </svg>
            <div className="mt-2 text-sm text-zinc-100">
              <FormulaKatex tex="A = \ell w" />
            </div>
          </div>

          {/* 3. Triangle */}
          <div className="flex flex-col items-center justify-between rounded-[2px] border border-[#27272A] bg-black p-3 text-center">
            <svg
              viewBox="0 0 120 80"
              className="h-16 w-auto text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="20,62 100,62 50,18" />
              <line x1="50" y1="18" x2="50" y2="62" strokeDasharray="3 2" />
              <path d="M50,54 h8 v8" strokeWidth="1" />
              <text x="44" y="44" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="end">
                h
              </text>
              <text x="60" y="75" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">
                b
              </text>
            </svg>
            <div className="mt-2 text-sm text-zinc-100">
              <FormulaKatex tex="A = \frac{1}{2}bh" />
            </div>
          </div>

          {/* 4. Right Triangle */}
          <div className="flex flex-col items-center justify-between rounded-[2px] border border-[#27272A] bg-black p-3 text-center">
            <svg
              viewBox="0 0 120 80"
              className="h-16 w-auto text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="30,18 30,62 90,62" />
              <path d="M30,54 h8 v8" strokeWidth="1" />
              <text x="22" y="44" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">
                a
              </text>
              <text x="60" y="75" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">
                b
              </text>
              <text x="66" y="36" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">
                c
              </text>
            </svg>
            <div className="mt-2 text-sm text-zinc-100">
              <FormulaKatex tex="c^2 = a^2 + b^2" />
            </div>
          </div>

          {/* 5. Special Right Triangles */}
          <div className={`flex flex-col items-center justify-between rounded-[2px] border border-[#27272A] bg-black p-3 text-center ${expanded ? 'col-span-2' : ''}`}>
            <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              Special Right Triangles
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {/* 30-60-90 triangle */}
              <div className="flex flex-col items-center">
                <svg
                  viewBox="0 0 120 85"
                  className="h-20 w-auto text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="20,68 95,68 95,24" />
                  <path d="M87,68 v-8 h8" strokeWidth="1" />
                  <text x="35" y="64" fontSize="10" fill="currentColor" stroke="none">30°</text>
                  <text x="83" y="38" fontSize="10" fill="currentColor" stroke="none">60°</text>
                  <text x="103" y="48" fontStyle="italic" fontSize="11" fill="currentColor" stroke="none">x</text>
                  <text x="56" y="80" fontStyle="italic" fontSize="11" fill="currentColor" stroke="none" textAnchor="middle">x√3</text>
                  <text x="52" y="40" fontStyle="italic" fontSize="11" fill="currentColor" stroke="none" textAnchor="middle">2x</text>
                </svg>
                <div className="mt-1 text-xs text-zinc-300">
                  <FormulaKatex tex="x, \; x\sqrt{3}, \; 2x" />
                </div>
              </div>

              {/* 45-45-90 triangle */}
              <div className="flex flex-col items-center">
                <svg
                  viewBox="0 0 120 85"
                  className="h-20 w-auto text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="25,68 85,68 25,28" />
                  <path d="M25,60 h8 v8" strokeWidth="1" />
                  <text x="70" y="64" fontSize="10" fill="currentColor" stroke="none">45°</text>
                  <text x="31" y="40" fontSize="10" fill="currentColor" stroke="none">45°</text>
                  <text x="16" y="50" fontStyle="italic" fontSize="11" fill="currentColor" stroke="none" textAnchor="middle">s</text>
                  <text x="55" y="80" fontStyle="italic" fontSize="11" fill="currentColor" stroke="none" textAnchor="middle">s</text>
                  <text x="62" y="44" fontStyle="italic" fontSize="11" fill="currentColor" stroke="none" textAnchor="middle">s√2</text>
                </svg>
                <div className="mt-1 text-xs text-zinc-300">
                  <FormulaKatex tex="s, \; s, \; s\sqrt{2}" />
                </div>
              </div>
            </div>
          </div>

          {/* 6. Rectangular Prism */}
          <div className="flex flex-col items-center justify-between rounded-[2px] border border-[#27272A] bg-black p-3 text-center">
            <svg
              viewBox="0 0 120 80"
              className="h-16 w-auto text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="24" y="32" width="56" height="32" />
              <line x1="24" y1="32" x2="42" y2="16" />
              <line x1="80" y1="32" x2="98" y2="16" />
              <line x1="80" y1="64" x2="98" y2="48" />
              <line x1="42" y1="16" x2="98" y2="16" />
              <line x1="98" y1="16" x2="98" y2="48" />
              <line x1="24" y1="64" x2="42" y2="48" strokeDasharray="3 2" />
              <line x1="42" y1="48" x2="98" y2="48" strokeDasharray="3 2" />
              <line x1="42" y1="48" x2="42" y2="16" strokeDasharray="3 2" />
              <text x="52" y="75" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">ℓ</text>
              <text x="94" y="60" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">w</text>
              <text x="16" y="50" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">h</text>
            </svg>
            <div className="mt-2 text-sm text-zinc-100">
              <FormulaKatex tex="V = \ell wh" />
            </div>
          </div>

          {/* 7. Cylinder */}
          <div className="flex flex-col items-center justify-between rounded-[2px] border border-[#27272A] bg-black p-3 text-center">
            <svg
              viewBox="0 0 120 80"
              className="h-16 w-auto text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <ellipse cx="60" cy="22" rx="28" ry="9" />
              <line x1="32" y1="22" x2="32" y2="58" />
              <line x1="88" y1="22" x2="88" y2="58" />
              <path d="M32,58 A28,9 0 0,0 88,58" />
              <path d="M32,58 A28,9 0 0,1 88,58" strokeDasharray="3 2" />
              <line x1="60" y1="22" x2="88" y2="22" strokeDasharray="3 2" />
              <circle cx="60" cy="22" r="1.5" fill="currentColor" stroke="none" />
              <text x="74" y="18" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">r</text>
              <text x="24" y="44" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">h</text>
            </svg>
            <div className="mt-2 text-sm text-zinc-100">
              <FormulaKatex tex="V = \pi r^2 h" />
            </div>
          </div>

          {/* 8. Sphere */}
          <div className="flex flex-col items-center justify-between rounded-[2px] border border-[#27272A] bg-black p-3 text-center">
            <svg
              viewBox="0 0 120 80"
              className="h-16 w-auto text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="60" cy="40" r="28" />
              <path d="M32,40 A28,9 0 0,0 88,40" />
              <path d="M32,40 A28,9 0 0,1 88,40" strokeDasharray="3 2" />
              <line x1="60" y1="40" x2="88" y2="40" strokeDasharray="3 2" />
              <circle cx="60" cy="40" r="1.5" fill="currentColor" stroke="none" />
              <text x="74" y="36" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">r</text>
            </svg>
            <div className="mt-2 text-sm text-zinc-100">
              <FormulaKatex tex="V = \frac{4}{3}\pi r^3" />
            </div>
          </div>

          {/* 9. Cone */}
          <div className="flex flex-col items-center justify-between rounded-[2px] border border-[#27272A] bg-black p-3 text-center">
            <svg
              viewBox="0 0 120 80"
              className="h-16 w-auto text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="60" y1="16" x2="32" y2="60" />
              <line x1="60" y1="16" x2="88" y2="60" />
              <path d="M32,60 A28,9 0 0,0 88,60" />
              <path d="M32,60 A28,9 0 0,1 88,60" strokeDasharray="3 2" />
              <line x1="60" y1="16" x2="60" y2="60" strokeDasharray="3 2" />
              <line x1="60" y1="60" x2="88" y2="60" strokeDasharray="3 2" />
              <circle cx="60" cy="60" r="1.5" fill="currentColor" stroke="none" />
              <text x="54" y="40" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="end">h</text>
              <text x="74" y="72" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">r</text>
            </svg>
            <div className="mt-2 text-sm text-zinc-100">
              <FormulaKatex tex="V = \frac{1}{3}\pi r^2 h" />
            </div>
          </div>

          {/* 10. Rectangular Pyramid */}
          <div className="flex flex-col items-center justify-between rounded-[2px] border border-[#27272A] bg-black p-3 text-center">
            <svg
              viewBox="0 0 120 80"
              className="h-16 w-auto text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="60" y1="16" x2="26" y2="58" />
              <line x1="60" y1="16" x2="72" y2="66" />
              <line x1="60" y1="16" x2="94" y2="50" />
              <line x1="26" y1="58" x2="72" y2="66" />
              <line x1="72" y1="66" x2="94" y2="50" />
              <line x1="26" y1="58" x2="48" y2="42" strokeDasharray="3 2" />
              <line x1="48" y1="42" x2="94" y2="50" strokeDasharray="3 2" />
              <line x1="60" y1="16" x2="48" y2="42" strokeDasharray="3 2" />
              <line x1="60" y1="16" x2="60" y2="54" strokeDasharray="3 2" />
              <text x="48" y="74" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">ℓ</text>
              <text x="86" y="63" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="middle">w</text>
              <text x="54" y="38" fontStyle="italic" fontSize="12" fill="currentColor" stroke="none" textAnchor="end">h</text>
            </svg>
            <div className="mt-2 text-sm text-zinc-100">
              <FormulaKatex tex="V = \frac{1}{3}\ell wh" />
            </div>
          </div>
        </div>

        {/* 3 Facts */}
        <div className="rounded-[2px] border border-[#27272A] bg-black p-4 space-y-2.5">
          <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            Geometric Facts
          </div>
          <p className="text-xs leading-relaxed text-zinc-300">
            A circle has 360 degrees of arc.
          </p>
          <p className="text-xs leading-relaxed text-zinc-300">
            A circle has <FormulaKatex tex="2\pi" /> radians of arc.
          </p>
          <p className="text-xs leading-relaxed text-zinc-300">
            The angles of a triangle add up to 180 degrees.
          </p>
        </div>
      </div>
    </aside>
  );
}
