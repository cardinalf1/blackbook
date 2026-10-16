import { useEffect, useState, type ReactNode } from 'react';
import { DASHBOARD_DETAIL_LINKS, type ScreenId } from '../../services/home/routes';
import { aiStore, dashboardStore } from '../../services/storage';
import type { ReportLine } from '../../types/ai';
import { DASHBOARD_SECTIONS, DEFAULT_DASHBOARD_SCOPE, type DashboardActions, type DashboardData, type DashboardScope } from '../../types/dashboard';
import { T } from '../ui/tokens';
import { CoachCard } from './CoachCard';
import { DetailLinks } from './DetailLinks';
import { HabitsCard } from './HabitsCard';
import { MistakesCard } from './MistakesCard';
import { NumbersRow } from './NumbersRow';
import { ScopeBar } from './ScopeBar';
import { SkillsMap } from './SkillsMap';
import { TestsTable } from './TestsTable';
import { TrendsCard } from './TrendsCard';

type Loaded = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: DashboardData };
type AiLines = { state: 'idle' | 'loading' | 'done' | 'failed'; lines: ReportLine[] | null };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The scope survives leaving for a drill-down and coming back. */
let savedScope: DashboardScope = DEFAULT_DASHBOARD_SCOPE;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`dash-${id}`} aria-labelledby={`dash-${id}-title`} className="scroll-mt-16 space-y-3">
      {/* Each card shows its own title; this one is for screen readers and the section index. */}
      <h2 id={`dash-${id}-title`} tabIndex={-1} className="sr-only">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * The merged Dashboard: one scrolling page loaded from GET /api/dashboard per scope. Sections are
 * thin components; this container only loads, asks for AI wording when available, and routes actions.
 */
export function DashboardScreen({ actions, onBack, onOpenTest, onOpen }: { actions: DashboardActions; onBack: () => void; onOpenTest: (testId: string) => void; onOpen: (to: ScreenId) => void }) {
  const [scope, setScopeState] = useState<DashboardScope>(savedScope);
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [ai, setAi] = useState<AiLines>({ state: 'idle', lines: null });
  const setScope = (s: DashboardScope) => {
    savedScope = s;
    setScopeState(s);
  };

  useEffect(() => {
    let live = true;
    setLoaded((l) => (l.state === 'ready' ? l : { state: 'loading' }));
    setAi({ state: 'idle', lines: null });
    dashboardStore.load(scope).then(
      (data) => {
        if (!live) return;
        setLoaded({ state: 'ready', data });
        if (data.coach.aiAvailable && data.coach.lines.length > 0) {
          setAi({ state: 'loading', lines: null });
          aiStore.coach(data.scope.filter).then(
            (r) => live && setAi(r.origin === 'ai' ? { state: 'done', lines: r.lines } : { state: 'failed', lines: null }),
            () => live && setAi({ state: 'failed', lines: null }),
          );
        }
      },
      (e: unknown) => live && setLoaded({ state: 'error', message: msg(e) }),
    );
    return () => {
      live = false;
    };
  }, [scope]);

  const jump = (id: string) => {
    const el = document.getElementById(`dash-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.querySelector<HTMLElement>('h2')?.focus?.();
  };

  return (
    <div className={`${T.page} space-y-5`}>
      <header className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className={T.secondary}>
          Back
        </button>
        <h1 className="font-mono text-base font-semibold text-white">Dashboard</h1>
        <span className={T.muted}>Everything here is computed on this computer.</span>
      </header>

      <nav aria-label="Dashboard sections" className="sticky top-0 z-20 -mx-1 flex flex-wrap gap-1 border-b border-[#27272A] bg-[#0A0A0C] px-1 py-2">
        {DASHBOARD_SECTIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => jump(s.id)} className={`${T.segment} ${T.segmentOff} border border-[#27272A]`}>
            {s.label}
          </button>
        ))}
      </nav>

      {loaded.state === 'ready' && <ScopeBar scope={scope} resolved={loaded.data.scope} onChange={setScope} />}

      {loaded.state === 'loading' && <div className={`${T.card} ${T.cardPad} ${T.muted}`}>Loading your dashboard...</div>}
      {loaded.state === 'error' && (
        <div className={`${T.card} ${T.cardPad} text-sm text-white`} role="alert">
          Could not build the dashboard: {loaded.message}
        </div>
      )}

      {loaded.state === 'ready' && (
        <>
          <Section id="coach" title="Coach">
            <CoachCard coach={loaded.data.coach} ai={ai} onAction={actions.onAction} />
          </Section>
          <Section id="numbers" title="Numbers">
            <NumbersRow numbers={loaded.data.numbers} />
          </Section>
          <Section id="trends" title="Trends">
            <TrendsCard trends={loaded.data.trends} />
          </Section>
          <Section id="skills" title="Skills">
            <SkillsMap skills={loaded.data.skills} onSkill={(skillCode) => actions.onLink({ to: 'skill', skillCode })} onAction={actions.onAction} />
          </Section>
          <Section id="mistakes" title="Mistakes">
            <MistakesCard mistakes={loaded.data.mistakes} onAction={actions.onAction} onTagSession={actions.onTagSession} onLink={actions.onLink} />
          </Section>
          <Section id="habits" title="Habits">
            <HabitsCard habits={loaded.data.habits} />
          </Section>
          <Section id="tests" title="Tests">
            <TestsTable tests={loaded.data.tests} onOpenTest={onOpenTest} />
          </Section>
          <Section id="details" title="Detailed views">
            <DetailLinks links={DASHBOARD_DETAIL_LINKS} onOpen={onOpen} />
          </Section>
          <p className={`${T.muted} border-t border-[#27272A] pt-4`}>{loaded.data.limits}</p>
        </>
      )}
    </div>
  );
}
