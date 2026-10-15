import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RANKING_EXPLANATION } from '../../config/analyticsConfig';
import { missesDrills, rankSkills, topSkillsDrills } from '../../services/analytics/rank';
import { analyticsStore, questionStore } from '../../services/storage';
import { DEFAULT_ANALYTICS_FILTER, type AnalyticsFilter, type AnalyticsTab } from '../../types/analytics';
import type { DrillConfig } from '../../types/drill';
import { AnalyticsShell } from './AnalyticsShell';
import { BehaviorScreen } from './BehaviorScreen';
import { OverviewScreen } from './OverviewScreen';
import { SkillsScreen } from './SkillsScreen';
import { StudyNextScreen } from './StudyNextScreen';
import { TestHistoryScreen } from './TestHistoryScreen';
import { TimingScreen } from './TimingScreen';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Loaded<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: T };

/** Runs `load` again whenever `key` changes; a slower older answer never replaces a newer one. */
function useLoad<T>(load: () => Promise<T>, key: unknown): Loaded<T> {
  const [result, setResult] = useState<Loaded<T>>({ state: 'loading' });
  useEffect(() => {
    let live = true;
    setResult({ state: 'loading' });
    load().then(
      (data) => live && setResult({ state: 'ready', data }),
      (e: unknown) => live && setResult({ state: 'error', message: msg(e) }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result;
}

function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return error ? (
    <div className="rounded-lg border border-red-900/50 bg-[#121215] p-5 text-sm text-red-400" role="alert">
      {children}
    </div>
  ) : (
    <div className="rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400">{children}</div>
  );
}

function Show<T>({ result, children }: { result: Loaded<T>; children: (data: T) => ReactNode }) {
  if (result.state === 'loading') return <Notice>Loading...</Notice>;
  if (result.state === 'error') return <Notice error>Could not read your analytics: {result.message}</Notice>;
  return <>{children(result.data)}</>;
}

/**
 * The analytics area: tabs and filters around the six screens. Every screen gets a summary the
 * local program computed; nothing here sees raw events. Launching a drill is handed to the caller.
 */
export function AnalyticsFlow({ onExit, onLaunch, startTab = 'overview' }: { onExit: () => void; onLaunch: (config: DrillConfig) => void; startTab?: AnalyticsTab }) {
  const [tab, setTab] = useState<AnalyticsTab>(startTab);
  const [filter, setFilter] = useState<AnalyticsFilter>(DEFAULT_ANALYTICS_FILTER);
  const key = JSON.stringify(filter);

  return (
    <AnalyticsShell tab={tab} onTab={setTab} filter={filter} onFilter={setFilter} onBack={onExit}>
      {tab === 'overview' && <OverviewTab filter={filter} filterKey={key} />}
      {tab === 'skills' && <SkillsTab filter={filter} filterKey={key} />}
      {tab === 'timing' && <TimingTab filter={filter} filterKey={key} />}
      {tab === 'behavior' && <BehaviorTab filter={filter} filterKey={key} />}
      {tab === 'tests' && <TestsTab filter={filter} filterKey={key} />}
      {tab === 'study' && <StudyTab filter={filter} filterKey={key} onLaunch={onLaunch} />}
    </AnalyticsShell>
  );
}

interface TabProps {
  filter: AnalyticsFilter;
  filterKey: string;
}

function OverviewTab({ filter, filterKey }: TabProps) {
  const result = useLoad(async () => {
    const [summary, tests] = await Promise.all([analyticsStore.overview(filter), analyticsStore.tests(filter)]);
    return { summary, latestTests: [...tests.tests].reverse().slice(0, 3) };
  }, filterKey);
  return <Show result={result}>{(d) => <OverviewScreen summary={d.summary} latestTests={d.latestTests} />}</Show>;
}

function SkillsTab({ filter, filterKey }: TabProps) {
  const result = useLoad(() => analyticsStore.skills(filter), filterKey);
  const loadDetail = useCallback((skillCode: string) => analyticsStore.skillDetail(filter, skillCode), [filter]);
  const loadQuestion = useCallback(async (id: string) => (await questionStore.get(id)) ?? null, []);
  return <Show result={result}>{(summary) => <SkillsScreen summary={summary} loadDetail={loadDetail} loadQuestion={loadQuestion} />}</Show>;
}

function TimingTab({ filter, filterKey }: TabProps) {
  const result = useLoad(async () => {
    const [summary, skills] = await Promise.all([analyticsStore.timing(filter), analyticsStore.skills({ ...DEFAULT_ANALYTICS_FILTER })]);
    return { summary, names: new Map(skills.rows.map((r) => [r.skillCode, r.skill])) };
  }, filterKey);
  return <Show result={result}>{(d) => <TimingScreen summary={d.summary} skillName={(code) => d.names.get(code) ?? 'Unknown skill'} />}</Show>;
}

function BehaviorTab({ filter, filterKey }: TabProps) {
  const result = useLoad(() => analyticsStore.behavior(filter), filterKey);
  return <Show result={result}>{(summary) => <BehaviorScreen summary={summary} />}</Show>;
}

function TestsTab({ filter, filterKey }: TabProps) {
  const result = useLoad(() => analyticsStore.tests(filter), filterKey);
  return <Show result={result}>{(history) => <TestHistoryScreen history={history} />}</Show>;
}

function StudyTab({ filter, filterKey, onLaunch }: TabProps & { onLaunch: (config: DrillConfig) => void }) {
  const result = useLoad(async () => {
    const [skills, misses] = await Promise.all([analyticsStore.skills(filter), analyticsStore.misses(filter)]);
    return { skills, misses };
  }, filterKey);
  const view = useMemo(() => {
    if (result.state !== 'ready') return null;
    const recommendations = rankSkills(result.data.skills.rows);
    return { recommendations, topDrills: topSkillsDrills(recommendations), missDrills: missesDrills(result.data.misses) };
  }, [result]);
  return (
    <Show result={result}>
      {() =>
        view && (
          <StudyNextScreen
            recommendations={view.recommendations}
            methodNote={RANKING_EXPLANATION}
            topDrills={view.topDrills}
            missDrills={view.missDrills}
            onLaunch={onLaunch}
          />
        )
      }
    </Show>
  );
}
