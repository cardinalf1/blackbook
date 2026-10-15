import { useEffect, useState } from 'react';
import type { TestKind, TestPreflight, TestSetupProps as BaseTestSetupProps } from '../../types/test';
import { loadPoolHealth, type PoolHealthView } from '../../services/retry/load';
import type { PoolHealth } from '../../services/test/pool';

const KINDS: readonly { id: TestKind; label: string }[] = [
  { id: 'full', label: 'Full test (Reading and Writing, break, Math)' },
  { id: 'rw', label: 'Reading and Writing only' },
  { id: 'math', label: 'Math only' },
];

export interface TestSetupProps extends BaseTestSetupProps {
  allowRepeats?: boolean;
  onAllowRepeatsChange?: (allow: boolean) => void;
  poolHealth?: PoolHealth | PoolHealthView | null;
}

function formatPoolCount(n: number): string {
  return n >= 50 ? '50 or more' : String(n);
}

function getPoolHealthText(health: PoolHealth | PoolHealthView | null | undefined, kind: TestKind): string | null {
  if (!health) return null;
  const p: PoolHealth = 'fresh' in health ? health.fresh : health;
  if (kind === 'full') {
    return `Full tests left: ${formatPoolCount(p.full)} (estimate)`;
  }
  if (kind === 'rw') {
    return `Reading and Writing tests left: ${formatPoolCount(p.rw)} (estimate)`;
  }
  if (kind === 'math') {
    return `Math tests left: ${formatPoolCount(p.math)} (estimate)`;
  }
  return null;
}

function canStartTest(
  preflight: TestPreflight | null,
  busy: boolean,
  includeSeen: boolean,
  allowRepeats: boolean,
): boolean {
  if (preflight === null || busy) {
    return false;
  }
  if (!preflight.allPossible) {
    return false;
  }
  if (preflight.allUnseen) {
    return true;
  }
  if (preflight.allSoft) {
    return includeSeen;
  }
  return allowRepeats;
}

export function TestSetup({
  kind,
  onKindChange,
  preflight,
  includeSeen,
  onIncludeSeenChange,
  allowRepeats: controlledAllowRepeats,
  onAllowRepeatsChange,
  poolHealth: propPoolHealth,
  busy,
  error,
  onStart,
  onCancel,
}: TestSetupProps) {
  const [internalAllowRepeats, setInternalAllowRepeats] = useState(false);
  const allowRepeats = controlledAllowRepeats !== undefined ? controlledAllowRepeats : internalAllowRepeats;

  const handleAllowRepeatsChange = (val: boolean) => {
    setInternalAllowRepeats(val);
    onAllowRepeatsChange?.(val);
  };

  const [loadedHealth, setLoadedHealth] = useState<PoolHealthView | null>(null);
  useEffect(() => {
    if (propPoolHealth === undefined) {
      loadPoolHealth().then(setLoadedHealth, () => undefined);
    }
  }, [propPoolHealth]);

  const activeHealth = propPoolHealth !== undefined ? propPoolHealth : loadedHealth;
  const poolHealthText = getPoolHealthText(activeHealth, kind);

  const isStartDisabled = !canStartTest(preflight, busy, includeSeen, allowRepeats);

  return (
    <section className="space-y-6 rounded-lg border border-[#27272A] bg-[#121215] p-6 text-[#FAFAFA]">
      <div>
        <h2 className="font-mono text-base font-medium text-zinc-100">Practice test setup</h2>
        <p className="mt-2 text-sm text-zinc-400">
          A full test includes four timed modules (27 questions/32 min R&amp;W, 22 questions/35 min Math each),
          Module 2 is easier or harder depending on Module 1, and a 10-minute break between sections.
          There is no going back to a submitted module, and the estimated score range at the end is an approximation.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wider text-zinc-400">Test format</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              onClick={() => onKindChange(k.id)}
              className={`rounded-md border px-4 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                kind === k.id
                  ? 'border-zinc-300 bg-zinc-800 text-zinc-100'
                  : 'border-[#27272A] text-zinc-300 hover:border-zinc-500'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3 rounded-md border border-[#27272A] bg-[#0A0A0C] p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">Question pool status</h3>
          {poolHealthText && <span className="font-mono text-xs text-zinc-400">{poolHealthText}</span>}
        </div>
        {preflight === null ? (
          <p className="text-zinc-400">Checking your questions...</p>
        ) : preflight.allUnseen ? (
          <p className="text-zinc-200">Enough unseen questions for every module.</p>
        ) : (
          <div className="space-y-3">
            {preflight.sections.some((s) => s.shortfalls.length > 0) && (
              <div className="space-y-2">
                {preflight.sections.map(
                  (section) =>
                    section.shortfalls.length > 0 && (
                      <ul
                        key={section.section}
                        className="space-y-1 rounded-md border border-amber-900/50 bg-amber-950/30 p-3 text-xs text-amber-200"
                      >
                        {section.shortfalls.map((line, idx) => (
                          <li key={idx}>{line}</li>
                        ))}
                      </ul>
                    ),
                )}
              </div>
            )}

            {preflight.allSoft ? (
              <div className="space-y-1 pt-1">
                <label className="flex items-center gap-2 text-zinc-200">
                  <input
                    type="checkbox"
                    checked={includeSeen}
                    onChange={(e) => onIncludeSeenChange(e.target.checked)}
                    className="h-4 w-4 rounded border-[#27272A] bg-[#121215] text-zinc-100 focus:ring-zinc-400"
                  />
                  <span>Include questions I have seen but not answered</span>
                </label>
                <p className="text-xs text-zinc-400">
                  Otherwise the test will not start.
                </p>
              </div>
            ) : preflight.allPossible ? (
              <div className="space-y-1 pt-1">
                <label className="flex items-center gap-2 text-zinc-200">
                  <input
                    type="checkbox"
                    checked={allowRepeats}
                    onChange={(e) => handleAllowRepeatsChange(e.target.checked)}
                    className="h-4 w-4 rounded border-[#27272A] bg-[#121215] text-zinc-100 focus:ring-zinc-400"
                  />
                  <span>Allow repeats of questions I have already done</span>
                </label>
                <p className="text-xs text-zinc-400">
                  Otherwise the test will not start.
                </p>
              </div>
            ) : (
              <p className="text-red-400">
                The question bank is too small to build this test.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          disabled={isStartDisabled}
          onClick={onStart}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Start test
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-1 text-sm text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
