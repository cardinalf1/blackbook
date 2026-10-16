// Highlights and notes (Phase 9): pure rules. A highlight is a [start, end) range of character
// offsets into one target's text (see annotateDom.ts for how offsets are counted). Highlights on
// the same target never overlap: a new one takes over the text it covers.

import { ANNOTATIONS_MAX } from '../../config/testRoomConfig';
import type { Annotation, AnnotationTarget } from '../../types/session';
import type { HighlightStyle } from '../../types/testRoom';

/**
 * Adds a highlight. Existing highlights on the same target lose the part the new one covers: one
 * fully covered is removed, one partly covered is trimmed, and one the new range sits inside is
 * split in two (its note stays on the first part). Returns the list unchanged for an empty range
 * or when the question already has ANNOTATIONS_MAX highlights.
 */
export function addAnnotation(
  list: readonly Annotation[],
  range: { target: AnnotationTarget; start: number; end: number },
  style: HighlightStyle,
  newId: () => string,
): Annotation[] {
  const { target, start, end } = range;
  if (!(start < end)) return [...list];
  const out: Annotation[] = [];
  for (const a of list) {
    if (a.target !== target || a.end <= start || a.start >= end) {
      out.push(a);
      continue;
    }
    if (a.start < start) out.push({ ...a, end: start });
    if (a.end > end) out.push({ ...a, id: a.start < start ? newId() : a.id, start: end, note: a.start < start ? '' : a.note });
  }
  if (out.length >= ANNOTATIONS_MAX) return [...list];
  out.push({ id: newId(), target, start, end, style, note: '' });
  return sortAnnotations(out);
}

export function sortAnnotations(list: readonly Annotation[]): Annotation[] {
  return [...list].sort((a, b) => (a.target === b.target ? a.start - b.start : a.target < b.target ? -1 : 1));
}

export function restyleAnnotation(list: readonly Annotation[], id: string, style: HighlightStyle): Annotation[] {
  return list.map((a) => (a.id === id ? { ...a, style } : a));
}

export function removeAnnotation(list: readonly Annotation[], id: string): Annotation[] {
  return list.filter((a) => a.id !== id);
}

export function setAnnotationNote(list: readonly Annotation[], id: string, note: string, max: number): Annotation[] {
  const text = note.slice(0, max);
  return list.map((a) => (a.id === id ? { ...a, note: text } : a));
}
