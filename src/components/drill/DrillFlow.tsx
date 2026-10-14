import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadFacets } from '../../services/drill/facetCache';
import { buildTaxonomy } from '../../services/drill/facets';
import { computeSkillStats, summarizeSession } from '../../services/drill/stats';
import { attemptStore, questionStore } from '../../services/storage';
import { drillStore, useDrill } from '../../stores/drillStore';
import type { DrillConfig, QuestionFacet, SkillStatRow } from '../../types/drill';
import { QuestionView } from '../QuestionView';
import { DrillResults } from '../results/DrillResults';
import { MySkills } from '../results/MySkills';
import { DrillSetup } from './DrillSetup';

type Step = { kind: 'setup' } | { kind: 'play' } | { kind: 'review'; questionId: string } | { kind: 'skills' };

/**
 * Setup, the question loop, results, review and the skills table. State lives in the drill store;
 * this component only chooses which screen to show.
 */
export function DrillFlow({ onExit, startAt }: { onExit: () => void; startAt: 'setup' | 'play' | 'skills' }) {
  const session = useDrill((s) => s.session);
  const error = useDrill((s) => s.error);
  const [step, setStep] = useState<Step>({ kind: startAt });
  const [facets, setFacets] = useState<QuestionFacet[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadFacets(questionStore).then(setFacets, (e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  const exit = useCallback(() => {
    // Refuses while an answer is not saved yet; the screen then shows the Retry banner.
    if (!drillStore.getState().close()) return;
    onExit();
  }, [onExit]);

  const start = async (config: DrillConfig) => {
    if (!facets) return;
    await drillStore.getState().start(config, facets);
    if (drillStore.getState().session) setStep({ kind: 'play' });
  };

  if (loadError) return <div className="rounded-lg border border-red-900/50 bg-[#121215] p-5 text-sm text-red-400" role="alert">Could not read the question bank: {loadError}</div>;
  if (!facets) return <div className="rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400">Loading...</div>;

  const banner = error && (
    <div className="rounded-lg border border-red-900/50 bg-[#121215] p-4 text-sm text-red-400" role="alert">
      {error}
    </div>
  );

  if (step.kind === 'setup') {
    return (
      <div className="space-y-3">
        {banner}
        <DrillSetup taxonomy={buildTaxonomy(facets)} facets={facets} onStart={(c) => void start(c)} onCancel={exit} />
      </div>
    );
  }

  if (step.kind === 'skills') {
    return <SkillsScreen facets={facets} onBack={session?.status === 'finished' ? () => setStep({ kind: 'play' }) : exit} />;
  }

  if (!session) return <div className="rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400">No drill is running.</div>;

  if (step.kind === 'review') {
    return <ReviewScreen questionId={step.questionId} onBack={() => setStep({ kind: 'play' })} />;
  }

  if (session.status === 'finished') {
    return <ResultsScreen onReview={(questionId) => setStep({ kind: 'review', questionId })} onDone={exit} onMySkills={() => setStep({ kind: 'skills' })} />;
  }

  return <PlayScreen onExit={exit} />;
}

function PlayScreen({ onExit }: { onExit: () => void }) {
  const session = useDrill((s) => s.session);
  const questions = useDrill((s) => s.questions);
  const flags = useDrill((s) => s.flags);
  const error = useDrill((s) => s.error);
  const unsaved = useDrill((s) => s.unsaved);
  const saveError = useDrill((s) => s.saveError);
  const [retrying, setRetrying] = useState(false);
  if (!session) return null;

  const id = session.queueIds[session.index];
  const question = id === undefined ? undefined : questions[id];
  if (!id || !question) return <div className="rounded-lg border border-red-900/50 bg-[#121215] p-4 text-sm text-red-400" role="alert">This question is missing from the bank.</div>;

  const answered = session.answered[id];
  const last = session.index === session.queueIds.length - 1;
  const actions = drillStore.getState();

  return (
    <section className="space-y-4">
      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={onExit}
          className="rounded px-1.5 py-0.5 text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Save and exit
        </button>
        <span className="font-mono text-xs text-zinc-400">
          {session.index + 1} / {session.queueIds.length}
        </span>
      </nav>
      {saveError && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-900/50 bg-[#121215] p-4 text-sm text-red-400" role="alert">
          <span className="min-w-0 flex-1">{saveError}</span>
          <button
            type="button"
            disabled={retrying}
            onClick={() => {
              setRetrying(true);
              void actions.retrySave().finally(() => setRetrying(false));
            }}
            className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-900 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            {retrying ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      )}
      {error && !saveError && (
        <div className="rounded-lg border border-red-900/50 bg-[#121215] p-4 text-sm text-red-400" role="alert">
          {error}
        </div>
      )}
      <QuestionView
        key={id}
        question={question}
        drill={{
          answered: answered ? { response: answered.response, correct: answered.correct } : undefined,
          struck: session.struck[id] ?? [],
          onStrike: (letter) => void actions.strike(letter),
          flagged: flags[id] === true,
          onToggleFlag: () => void actions.toggleFlag(id),
          initialElapsedMs: session.currentElapsedMs,
          onElapsed: (ms) => void actions.saveElapsed(ms),
          onSubmit: (response, timeMs) => void actions.submit(response, timeMs),
          onNext: () => void actions.next(),
          nextLabel: unsaved ? 'Saving...' : last ? 'Finish' : 'Next',
          nextDisabled: unsaved !== null,
        }}
      />
    </section>
  );
}

function ResultsScreen(props: { onReview: (id: string) => void; onDone: () => void; onMySkills: () => void }) {
  const session = useDrill((s) => s.session);
  const questions = useDrill((s) => s.questions);
  const summary = useMemo(() => {
    if (!session) return null;
    const info = new Map(Object.values(questions).map((q) => [q.id, { displayId: q.displayId, skill: q.skill }]));
    return summarizeSession(session, info);
  }, [session, questions]);
  if (!summary) return null;
  return <DrillResults summary={summary} {...props} />;
}

function ReviewScreen({ questionId, onBack }: { questionId: string; onBack: () => void }) {
  const session = useDrill((s) => s.session);
  const question = useDrill((s) => s.questions[questionId]);
  const answered = session?.answered[questionId];
  if (!question || !answered) return null;
  return (
    <section className="space-y-4">
      <nav className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="rounded px-1.5 py-0.5 text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Back to results
        </button>
      </nav>
      <QuestionView
        key={questionId}
        question={question}
        drill={{
          answered: { response: answered.response, correct: answered.correct },
          struck: [],
          onStrike: () => undefined,
          flagged: false,
          onToggleFlag: () => undefined,
          initialElapsedMs: 0,
          onElapsed: () => undefined,
          onSubmit: () => undefined,
        }}
      />
    </section>
  );
}

function SkillsScreen({ facets, onBack }: { facets: QuestionFacet[]; onBack: () => void }) {
  const [data, setData] = useState<{ rows: SkillStatRow[]; unattributed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    attemptStore.listAttempts().then(
      (attempts) => setData(computeSkillStats(attempts, facets)),
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, [facets]);
  if (error) return <div className="rounded-lg border border-red-900/50 bg-[#121215] p-5 text-sm text-red-400" role="alert">Could not read your attempts: {error}</div>;
  if (!data) return <div className="rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400">Loading...</div>;
  return <MySkills rows={data.rows} unattributed={data.unattributed} onBack={onBack} />;
}
