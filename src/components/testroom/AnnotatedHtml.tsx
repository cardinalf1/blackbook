import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ANNOTATION_NOTE_MAX } from '../../config/testRoomConfig';
import { annotationAt, applyMarks, clearMarks, selectionOffsets } from '../../services/exam/annotateDom';
import { addAnnotation, removeAnnotation, restyleAnnotation, setAnnotationNote } from '../../services/exam/annotations';
import type { Annotation, AnnotationTarget, EventPayloads } from '../../types/session';
import type { HighlightStyle } from '../../types/testRoom';
import { ContentHtml } from './ContentHtml';
import { HighlightToolbar } from './HighlightToolbar';
import { NoteEditor } from './NoteEditor';

/** Fired by the header's Highlights & Notes button: highlight the current selection, if it is in one of these. */
export const HIGHLIGHT_SELECTION_EVENT = 'bb-highlight-selection';

type HighlightEvent = 'highlight_added' | 'highlight_changed' | 'highlight_removed' | 'note_saved';

export interface AnnotatedHtmlProps {
  html: string;
  target: AnnotationTarget;
  /** Every highlight on the question; this component shows and edits those of its target. */
  annotations: readonly Annotation[];
  onChange: (next: Annotation[]) => void;
  onEvent: <T extends HighlightEvent>(type: T, payload: EventPayloads[T]) => void;
  onFigureZoom?: (percent: number) => void;
  className?: string;
}

type Editing =
  | { kind: 'new'; start: number; end: number; anchor: { x: number; y: number } }
  | { kind: 'existing'; id: string; anchor: { x: number; y: number } };

const newId = () => crypto.randomUUID();

/** Question HTML the user can highlight, underline and annotate (Reading and Writing). */
export function AnnotatedHtml({ html, target, annotations, onChange, onEvent, onFigureZoom, className = '' }: AnnotatedHtmlProps) {
  const root = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const mine = annotations.filter((a) => a.target === target);

  // Re-apply the marks after every render: figure frames and math can re-render their own HTML.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    clearMarks(el);
    applyMarks(
      el,
      mine.map((a) => ({ id: a.id, start: a.start, end: a.end, style: a.style, hasNote: a.note !== '' })),
    );
  });

  const add = (start: number, end: number, style: HighlightStyle): string | null => {
    const next = addAnnotation(annotations, { target, start, end }, style, newId);
    const created = next.find((a) => a.target === target && a.start === start && a.end === end && !annotations.some((b) => b.id === a.id));
    if (!created) return null;
    onChange(next);
    onEvent('highlight_added', { style, target });
    window.getSelection()?.removeAllRanges();
    return created.id;
  };

  // The header button highlights a selection in this text in the first color.
  useEffect(() => {
    const onHighlight = () => {
      const el = root.current;
      const range = el ? selectionOffsets(el, window.getSelection()) : null;
      if (range) add(range.start, range.end, 'yellow');
    };
    window.addEventListener(HIGHLIGHT_SELECTION_EVENT, onHighlight);
    return () => window.removeEventListener(HIGHLIGHT_SELECTION_EVENT, onHighlight);
  });

  const onMouseUp = (e: React.MouseEvent) => {
    const el = root.current;
    if (!el) return;
    const range = selectionOffsets(el, window.getSelection());
    if (range) {
      const r = window.getSelection()?.getRangeAt(0);
      const rect = r && typeof r.getBoundingClientRect === 'function' ? r.getBoundingClientRect() : undefined;
      setEditing({ kind: 'new', ...range, anchor: { x: rect ? rect.left + rect.width / 2 : e.clientX, y: rect ? rect.top : e.clientY } });
      return;
    }
    const id = annotationAt(e.target);
    if (id) {
      const rect = (e.target as Element).getBoundingClientRect();
      setEditing({ kind: 'existing', id, anchor: { x: rect.left + rect.width / 2, y: rect.top } });
    }
  };

  const current = editing?.kind === 'existing' ? (annotations.find((a) => a.id === editing.id)?.style ?? null) : null;
  const noteTarget = noteFor === null ? undefined : annotations.find((a) => a.id === noteFor);

  return (
    <>
      <div ref={root} onMouseUp={onMouseUp} className={className} data-annotatable={target}>
        <ContentHtml html={html} onFigureZoom={onFigureZoom} />
      </div>
      {editing && (
        <HighlightToolbar
          anchor={editing.anchor}
          current={current}
          onStyle={(style) => {
            if (editing.kind === 'new') add(editing.start, editing.end, style);
            else {
              onChange(restyleAnnotation(annotations, editing.id, style));
              onEvent('highlight_changed', { style });
            }
            setEditing(null);
          }}
          onDelete={
            editing.kind === 'existing'
              ? () => {
                  onChange(removeAnnotation(annotations, editing.id));
                  onEvent('highlight_removed', {});
                  setEditing(null);
                }
              : undefined
          }
          onNote={() => {
            const id = editing.kind === 'existing' ? editing.id : add(editing.start, editing.end, 'yellow');
            setEditing(null);
            if (id) setNoteFor(id);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {noteFor !== null && (
        <NoteEditor
          initial={noteTarget?.note ?? ''}
          maxLength={ANNOTATION_NOTE_MAX}
          onSave={(text) => {
            onChange(setAnnotationNote(annotations, noteFor, text, ANNOTATION_NOTE_MAX));
            onEvent('note_saved', { hasNote: text.trim() !== '' });
            setNoteFor(null);
          }}
          onCancel={() => setNoteFor(null)}
        />
      )}
    </>
  );
}
