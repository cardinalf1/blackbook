import { useCallback, useEffect, useState } from 'react';
import { DrillFlow } from './components/drill/DrillFlow';
import { ImportPanel } from './components/ImportPanel';
import { QuestionBrowser } from './components/QuestionBrowser';
import { QuestionView } from './components/QuestionView';
import { questionStore, type BankMeta } from './services/storage';
import { drillStore, useDrill } from './stores/drillStore';
import type { Question } from './types/sat';

const PRACTICE_SIZE = 20;

type View =
  | { kind: 'loading' }
  | { kind: 'home'; meta: BankMeta | null; count: number }
  | { kind: 'practice'; questions: Question[]; index: number }
  | { kind: 'browse' }
  | { kind: 'drill'; startAt: 'setup' | 'play' | 'skills' };

function sample<T>(items: readonly T[], n: number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a.slice(0, n);
}

export default function App() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [error, setError] = useState<string | null>(null);
  const resumable = useDrill((s) => s.resumable);

  const loadHome = useCallback(async () => {
    try {
      const [meta, count] = await Promise.all([questionStore.getMeta(), questionStore.count(), drillStore.getState().init()]).then(
        ([m, c]) => [m, c] as const,
      );
      setView({ kind: 'home', meta, count });
    } catch (e) {
      setError(`Could not open browser storage: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const startPractice = async () => {
    const all = await questionStore.query({});
    setView({ kind: 'practice', questions: sample(all, PRACTICE_SIZE), index: 0 });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="font-mono text-lg">Blackbook</h1>
        <p className="text-xs text-zinc-500">Independent practice tool. Not affiliated with any testing organization.</p>
      </header>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {view.kind === 'home' && (
        <>
          {view.count > 0 && view.meta && (
            <section className="flex flex-wrap items-center gap-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
              <div className="text-sm">
                <div>{view.count} questions loaded</div>
                <div className="text-xs text-zinc-500">
                  Synced {new Date(view.meta.fetchedAt).toLocaleString()}, imported {new Date(view.meta.importedAt).toLocaleString()}
                </div>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView({ kind: 'drill', startAt: 'setup' })}
                  className="rounded-md bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900"
                >
                  Start a drill
                </button>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'drill', startAt: 'skills' })}
                  className="rounded-md border border-[#27272A] px-4 py-1.5 text-sm font-medium text-zinc-100 hover:border-zinc-500"
                >
                  My skills
                </button>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'browse' })}
                  className="rounded-md border border-[#27272A] px-4 py-1.5 text-sm font-medium text-zinc-100 hover:border-zinc-500"
                >
                  Browse questions
                </button>
                <button
                  type="button"
                  onClick={() => void startPractice()}
                  className="rounded-md border border-[#27272A] px-4 py-1.5 text-sm font-medium text-zinc-100 hover:border-zinc-500"
                >
                  Step through {Math.min(PRACTICE_SIZE, view.count)} random questions
                </button>
              </div>
            </section>
          )}
          {resumable && view.count > 0 && (
            <section className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-200">
              <span>
                You have an unfinished drill ({Object.keys(resumable.answered).length} of {resumable.queueIds.length} answered).
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void drillStore
                      .getState()
                      .resume()
                      .then(() => setView({ kind: 'drill', startAt: 'play' }));
                  }}
                  className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-900"
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => void drillStore.getState().discardResumable()}
                  className="rounded-md border border-[#27272A] px-3 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                >
                  Discard
                </button>
              </div>
            </section>
          )}
          <ImportPanel onImported={() => void loadHome()} />
        </>
      )}

      {view.kind === 'practice' && (
        <section className="space-y-4">
          <nav className="flex items-center gap-3 text-sm">
            <button type="button" onClick={() => void loadHome()} className="text-zinc-400 hover:text-zinc-100">
              Back
            </button>
            <span className="ml-auto font-mono text-xs text-zinc-400">
              {view.index + 1} / {view.questions.length}
            </span>
            <button
              type="button"
              disabled={view.index === 0}
              onClick={() => setView({ ...view, index: view.index - 1 })}
              className="rounded-md border border-[#27272A] px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={view.index === view.questions.length - 1}
              onClick={() => setView({ ...view, index: view.index + 1 })}
              className="rounded-md border border-[#27272A] px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </nav>
          {view.questions[view.index] && (
            <QuestionView key={view.questions[view.index]?.id} question={view.questions[view.index] as Question} />
          )}
        </section>
      )}

      {view.kind === 'drill' && <DrillFlow startAt={view.startAt} onExit={() => void loadHome()} />}

      {view.kind === 'browse' && (
        <section className="space-y-4">
          <nav className="flex items-center gap-3 text-sm">
            <button type="button" onClick={() => void loadHome()} className="text-zinc-400 hover:text-zinc-100">
              Back
            </button>
          </nav>
          <QuestionBrowser />
        </section>
      )}
    </main>
  );
}
