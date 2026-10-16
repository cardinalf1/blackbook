import { describe, expect, it } from 'vitest';
import type { Annotation } from '../../types/session';
import { applyMarks, clearMarks, selectionOffsets, textNodes } from './annotateDom';
import { addAnnotation, removeAnnotation, restyleAnnotation, setAnnotationNote } from './annotations';

let n = 0;
const id = () => `id${++n}`;
const P = 'passage' as const;

describe('addAnnotation', () => {
  it('adds, trims, splits and replaces overlapping highlights on the same target', () => {
    let list: Annotation[] = addAnnotation([], { target: P, start: 0, end: 10 }, 'yellow', id);
    list = setAnnotationNote(list, list[0]!.id, 'keep', 100);
    // Inside: split in two, the note stays on the first part.
    list = addAnnotation(list, { target: P, start: 4, end: 6 }, 'blue', id);
    expect(list.map((a) => [a.start, a.end, a.style, a.note])).toEqual([
      [0, 4, 'yellow', 'keep'],
      [4, 6, 'blue', ''],
      [6, 10, 'yellow', ''],
    ]);
    // Covering everything: one highlight left.
    list = addAnnotation(list, { target: P, start: 0, end: 12 }, 'underline', id);
    expect(list.map((a) => [a.start, a.end, a.style])).toEqual([[0, 12, 'underline']]);
  });

  it('leaves the other target alone and ignores empty ranges', () => {
    const a = addAnnotation([], { target: 'stem', start: 0, end: 5 }, 'pink', id);
    const b = addAnnotation(a, { target: P, start: 0, end: 5 }, 'pink', id);
    expect(b).toHaveLength(2);
    expect(addAnnotation(b, { target: P, start: 3, end: 3 }, 'pink', id)).toEqual(b);
  });

  it('restyles, removes and caps notes', () => {
    const a = addAnnotation([], { target: P, start: 1, end: 2 }, 'yellow', id);
    const key = a[0]!.id;
    expect(restyleAnnotation(a, key, 'blue')[0]?.style).toBe('blue');
    expect(setAnnotationNote(a, key, 'abcdef', 3)[0]?.note).toBe('abc');
    expect(removeAnnotation(a, key)).toEqual([]);
  });
});

describe('marks in the DOM', () => {
  function root(html: string) {
    const div = document.createElement('div');
    div.innerHTML = `<div class="bb-content">${html}</div><button>100%</button>`;
    document.body.appendChild(div);
    return div;
  }

  it('counts only question text, skipping rendered math and controls', () => {
    const r = root('<p>ab<span class="katex">xyz</span>cd</p>');
    expect(textNodes(r).map((t) => t.data)).toEqual(['ab', 'cd']);
  });

  it('wraps ranges across nodes and clears them back to the same text', () => {
    const r = root('<p>Hello <b>bold</b> world</p>');
    const before = r.innerHTML;
    applyMarks(r, [
      { id: 'm1', start: 3, end: 8, style: 'yellow', hasNote: false },
      { id: 'm2', start: 12, end: 15, style: 'underline', hasNote: true },
    ]);
    const marks = [...r.querySelectorAll('mark')];
    expect(marks.map((m) => [m.getAttribute('data-annotation'), m.textContent])).toEqual([
      ['m1', 'lo '],
      ['m1', 'bo'],
      ['m2', 'orl'],
    ]);
    expect(marks[2]?.getAttribute('data-note')).toBe('true');
    clearMarks(r);
    expect(r.innerHTML).toBe(before);
  });

  it('turns a selection into offsets, also across marks', () => {
    const r = root('<p>Hello <b>bold</b> world</p>');
    applyMarks(r, [{ id: 'm1', start: 0, end: 2, style: 'blue', hasNote: false }]);
    const texts = textNodes(r);
    const range = document.createRange();
    range.setStart(texts[1]!, 1); // "llo " -> after "Hel"
    range.setEnd(texts[2]!, 2); // "bold" -> "bo"
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    expect(selectionOffsets(r, sel)).toEqual({ start: 3, end: 8 });
    sel.removeAllRanges();
    expect(selectionOffsets(r, sel)).toBeNull();
  });
});
