// Highlights in the DOM (Phase 9). Offsets count the characters of "annotatable" text nodes only:
// text inside question HTML (`.bb-content`), but not inside rendered math (`.katex`), a dialog or
// a control. That keeps offsets stable when figure toolbars change their labels or math renders.

const MARK_ATTR = 'data-annotation';

function countable(node: Text, root: Element): boolean {
  const el = node.parentElement;
  if (!el || !root.contains(el)) return false;
  const content = el.closest('.bb-content');
  if (!content) return false;
  // Inside a figure frame only the figure's own text counts, never its zoom toolbar (its "100%" changes).
  const frame = el.closest('[data-bb-figure-frame]');
  if (frame && !frame.contains(content)) return false;
  return el.closest('.katex, [role="dialog"], button') === null;
}

/** Annotatable text nodes under `root`, in document order. */
export function textNodes(root: Element): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (countable(n as Text, root)) out.push(n as Text);
  return out;
}

/** The offset of a DOM boundary point, counted in annotatable text. */
export function offsetOf(root: Element, node: Node, offset: number): number {
  const point = document.createRange();
  point.setStart(node, offset);
  point.collapse(true);
  let total = 0;
  for (const t of textNodes(root)) {
    if (t === node) return total + Math.min(offset, t.length);
    // The node ends at or before the point: count all of it. Otherwise it lies after the point.
    if (point.comparePoint(t, t.length) <= 0) total += t.length;
    else break;
  }
  return total;
}

/** The current selection as offsets in `root`, or null when it is empty or not inside `root`. */
export function selectionOffsets(root: Element, selection: Selection | null): { start: number; end: number } | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = offsetOf(root, range.startContainer, range.startOffset);
  const end = offsetOf(root, range.endContainer, range.endOffset);
  return start < end ? { start, end } : null;
}

/** Removes every highlight mark under `root`, leaving the text as it was. */
export function clearMarks(root: Element): void {
  const marks = root.querySelectorAll(`mark[${MARK_ATTR}]`);
  const parents = new Set<Node>();
  for (const m of marks) {
    const parent = m.parentNode;
    if (!parent) continue;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parents.add(parent);
  }
  for (const p of parents) p.normalize();
}

/**
 * Wraps each range in <mark data-annotation="id" data-style="..."> elements (one per text node it
 * touches). Ranges must not overlap. Call clearMarks first when re-applying.
 */
export function applyMarks(root: Element, ranges: readonly { id: string; start: number; end: number; style: string; hasNote: boolean }[]): void {
  if (ranges.length === 0) return;
  const nodes = textNodes(root);
  // Node start offsets, computed before any wrapping changes the tree.
  const starts: number[] = [];
  let pos = 0;
  for (const t of nodes) {
    starts.push(pos);
    pos += t.length;
  }
  // Work backwards so splitting a node never shifts a range still to do.
  const sorted = [...ranges].sort((a, b) => b.start - a.start);
  for (const r of sorted) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i] as Text;
      const s = starts[i] as number;
      const from = Math.max(r.start, s) - s;
      const to = Math.min(r.end, s + node.length) - s;
      if (from >= to) continue;
      let target = node;
      if (to < target.length) target.splitText(to);
      if (from > 0) target = target.splitText(from);
      const mark = document.createElement('mark');
      mark.setAttribute(MARK_ATTR, r.id);
      mark.setAttribute('data-style', r.style);
      if (r.hasNote) mark.setAttribute('data-note', 'true');
      target.parentNode?.insertBefore(mark, target);
      mark.appendChild(target);
      // The node list now points at the head part (before `from`), which still starts at s.
    }
  }
}

/** The highlight id under a clicked element, if any. */
export function annotationAt(el: EventTarget | null): string | null {
  return el instanceof Element ? (el.closest(`mark[${MARK_ATTR}]`)?.getAttribute(MARK_ATTR) ?? null) : null;
}
