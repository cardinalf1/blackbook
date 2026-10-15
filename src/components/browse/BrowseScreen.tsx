import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { applyFilters, pickRandom } from '../../services/browse/filter';
import { loadRows } from '../../services/browse/rows';
import { drillStore, useDrill } from '../../stores/drillStore';
import { DEFAULT_BROWSE_FILTERS, type BrowseRow, type BrowseViewState } from '../../types/browse';
import { PlayScreen, ReportScreen } from '../drill/DrillFlow';
import { QuestionBrowser } from '../QuestionBrowser';

// Kept for the whole page session, so leaving Browse (to practice, or home) and coming back
// finds the same filters, page and scroll position.
let savedState: BrowseViewState = { filters: DEFAULT_BROWSE_FILTERS, page: 0 };
let savedScroll = 0;
type Mode = { kind: 'list' } | { kind: 'practice' } | { kind: 'report'; sessionId: string };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Browse with seen and done status. Picking a question (or Random) starts a single-question
 * session with the usual deferred feedback; Done shows its report, then Browse comes back as it was.
 */
export function BrowseScreen({ onBack, onMySkills }: { onBack: () => void; onMySkills: () => void }) {
  const [rows, setRows] = useState<BrowseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<BrowseViewState>(savedState);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const storeError = useDrill((s) => s.error);
  const restoreScroll = useRef(true);

  const refresh = useCallback(() => {
    loadRows().then(
      (r) => {
        setRows(r);
        setError(null);
      },
      (e: unknown) => setError(msg(e)),
    );
  }, []);
  useEffect(refresh, [refresh]);

  // Put the list back where it was once it is rendered again.
  useLayoutEffect(() => {
    if (mode.kind === 'list' && rows && restoreScroll.current) {
      restoreScroll.current = false;
      window.scrollTo(0, savedScroll);
    }
  }, [mode.kind, rows]);

  const changeState = (next: BrowseViewState) => {
    savedState = next;
    setState(next);
  };

  const open = async (questionId: string) => {
    savedScroll = window.scrollY;
    await drillStore.getState().startSingle(questionId);
    if (drillStore.getState().session) {
      setMode({ kind: 'practice' });
      window.scrollTo(0, 0);
    }
  };

  const backToList = () => {
    restoreScroll.current = true;
    setMode({ kind: 'list' });
    refresh();
  };

  if (error) return <div className="rounded-lg border border-red-900/50 bg-[#121215] p-5 text-sm text-red-400" role="alert">Could not load the questions: {error}</div>;
  if (!rows) return <div className="rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400">Loading questions...</div>;

  if (mode.kind === 'practice') return <PlayScreen onExit={backToList} onFinished={(sessionId) => setMode({ kind: 'report', sessionId })} />;
  if (mode.kind === 'report') {
    return (
      <ReportScreen
        sessionId={mode.sessionId}
        backLabel="Back to browse"
        onBack={() => {
          drillStore.getState().closeFinished();
          backToList();
        }}
        onMySkills={() => {
          drillStore.getState().closeFinished();
          onMySkills();
        }}
      />
    );
  }

  return (
    <section className="space-y-4">
      <nav className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="rounded px-1.5 py-0.5 text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Back
        </button>
      </nav>
      {storeError && (
        <div className="rounded-lg border border-red-900/50 bg-[#121215] p-4 text-sm text-red-400" role="alert">
          {storeError}
        </div>
      )}
      <QuestionBrowser
        rows={rows}
        state={state}
        onStateChange={changeState}
        onOpen={(id) => void open(id)}
        onRandom={() => {
          const pick = pickRandom(applyFilters(rows, state.filters));
          if (pick) void open(pick.id);
        }}
      />
    </section>
  );
}
