import { useEffect, useState } from 'react';
import type { RulesNotesScreenProps } from '../../types/home';
import type { RulesNote } from '../../types/ai';
import type { QuestionFacet } from '../../types/drill';
import { loadFacets } from '../../services/drill/facetCache';
import { questionStore, rulesNotesStore } from '../../services/storage';
import { RulesNoteBox } from '../notes/RulesNoteBox';
import { T } from '../ui/tokens';

export function RulesNotesScreen({ onBack }: RulesNotesScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<RulesNote[]>([]);
  const [skillNames, setSkillNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      rulesNotesStore.listNotes(),
      loadFacets(questionStore).catch(() => [] as QuestionFacet[]),
    ])
      .then(([loadedNotes, facets]) => {
        if (!active) return;
        const nameMap = new Map<string, string>();
        for (const facet of facets) {
          if (facet.skillCode && facet.skill && !nameMap.has(facet.skillCode)) {
            nameMap.set(facet.skillCode, facet.skill);
          }
        }
        setSkillNames(nameMap);
        setNotes(loadedNotes);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={`min-h-screen ${T.page} p-4 sm:p-6 max-w-4xl mx-auto space-y-6`}>
      <header className="flex items-center gap-4 border-b border-[#27272A] pb-4">
        <button
          type="button"
          onClick={onBack}
          className={`${T.secondary} text-xs py-1.5 px-3`}
          aria-label="Back"
        >
          Back
        </button>
        <h1 className={`${T.title} text-base`}>My rules notes</h1>
      </header>

      {loading && <p className={T.muted}>Loading notes...</p>}

      {error && !loading && (
        <p className={T.muted}>Could not load rules notes: {error}</p>
      )}

      {!loading && !error && notes.length === 0 && (
        <p className={T.muted}>
          No rules notes yet. Write one from the drill setup (pick one skill) or the mistake log.
        </p>
      )}

      {!loading && !error && notes.length > 0 && (
        <div className="space-y-6">
          {notes.map((note) => {
            const skillName = skillNames.get(note.skillCode) || note.skillCode;
            return (
              <div key={note.skillCode} className="space-y-2">
                <h2 className={T.title}>{skillName}</h2>
                <RulesNoteBox
                  skillCode={note.skillCode}
                  skill={skillName}
                  store={rulesNotesStore}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
