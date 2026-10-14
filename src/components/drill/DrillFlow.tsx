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
    drillStore.getState().close();
    onExit();
  }, [onExit]);

  const start = async (config: DrillConfig) => {
    if (!facets) return;
    await drillStore.getState().start(config, facets);
    if (drillStore.getState().session) setStep({ kind: 'play' });
  };

  if (loadError) return <p className="text-sm text-red-400" role="alert">Could not read the question bank: {loadError}</p>;
  if (!facets) return <p className="text-sm text-zinc-400">Loading...</p>;

  const banner = error && (
    <p className="text-sm text-red-400" role="alert">
      {error}
    </p>
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

  if (!session) return <p className="text-sm text-zinc-400">No drill is running.</p>;

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
  if (!session) return null;

  const id = session.queueIds[session.index];
  const question = id === undefined ? undefined : questions[id];
  if (!id || !question) return <p className="text-sm text-red-400">This question is missing from the bank.</p>;

  const answered = session.answered[id];
  const last = session.index === session.queueIds.length - 1;
  const actions = drillStore.getState();

  return (
    <section className="space-y-4">
      <nav className="flex items-center gap-3 text-sm">
        <button type="button" onClick={onExit} className="text-zinc-400 hover:text-zinc-100">
          Save and exit
        </button>
        <span className="ml-auto font-mono text-xs text-zinc-400">
          {session.index + 1} / {session.queueIds.length}
        </span>
      </nav>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
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
          nextLabel: last ? 'Finish' : 'Next',
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
        <button type="button" onClick={onBack} className="text-zinc-400 hover:text-zinc-100">
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
  if (error) return <p className="text-sm text-red-400" role="alert">Could not read your attempts: {error}</p>;
  if (!data) return <p className="text-sm text-zinc-400">Loading...</p>;
  return <MySkills rows={data.rows} unattributed={data.unattributed} onBack={onBack} />;
}
