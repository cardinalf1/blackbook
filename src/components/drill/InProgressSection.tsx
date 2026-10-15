import { useEffect, useMemo, useState } from 'react';
import { loadFacets } from '../../services/drill/facetCache';
import { inProgressRows } from '../../services/session/report';
import { questionStore } from '../../services/storage';
import { drillStore, useDrill } from '../../stores/drillStore';
import type { QuestionFacet } from '../../types/drill';
import { InProgressList } from '../results/InProgressList';

/**
 * Every unfinished session, with Resume and Discard. Reads the list the drill store loaded at
 * startup (init) and refreshes it when shown.
 */
export function InProgressSection({ onResumed }: { onResumed: () => void }) {
  const sessions = useDrill((s) => s.inProgress);
  const [facets, setFacets] = useState<QuestionFacet[]>([]);

  useEffect(() => {
    void drillStore.getState().init();
  }, []);
  useEffect(() => {
    if (sessions.length === 0) return;
    // Only for wording the filters; without it the list still works with codes.
    loadFacets(questionStore).then(setFacets, () => undefined);
  }, [sessions.length]);

  const rows = useMemo(() => inProgressRows(sessions, facets), [sessions, facets]);

  return (
    <InProgressList
      rows={rows}
      onResume={(id) => {
        void drillStore
          .getState()
          .resume(id)
          .then(() => {
            if (drillStore.getState().session?.id === id) onResumed();
          });
      }}
      onDiscard={async (id) => {
        await drillStore.getState().discard(id);
        const error = drillStore.getState().error;
        if (error) throw new Error(error);
      }}
    />
  );
}
