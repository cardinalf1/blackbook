// Splits question HTML so each figure can get its own zoom controls (Phase 9). A figure is a
// top-level <figure> holding an <svg> or an <img>: graphs, diagrams and pictures. Tables stay in
// the text (the test-room zoom covers them), and so does a figure nested inside other markup.
// Runs in the browser (and jsdom in tests): it parses with a <template>, it never executes markup.

export type ContentSegment = { kind: 'html'; html: string } | { kind: 'figure'; html: string };

function isZoomableFigure(node: Node): node is Element {
  return node instanceof Element && node.tagName === 'FIGURE' && node.querySelector('svg, img') !== null;
}

export function splitFigures(html: string): ContentSegment[] {
  if (!/<figure\b/i.test(html)) return [{ kind: 'html', html }];
  const template = document.createElement('template');
  template.innerHTML = html;
  const out: ContentSegment[] = [];
  const pending = document.createElement('div');
  const flush = () => {
    if (pending.childNodes.length === 0) return;
    out.push({ kind: 'html', html: pending.innerHTML });
    pending.replaceChildren();
  };
  for (const node of [...template.content.childNodes]) {
    if (isZoomableFigure(node)) {
      flush();
      out.push({ kind: 'figure', html: node.outerHTML });
    } else {
      pending.appendChild(node);
    }
  }
  flush();
  return out;
}

/** Marks where a nested picture was taken out; ContentHtml renders a figure frame in its place. */
export const FIGURE_SLOT_ATTR = 'data-bb-figure';

/**
 * Pictures that are not in a top-level figure (older questions nest a chart's <img> inside the
 * passage's own markup): each non-math <img> is replaced by an empty slot element, and its markup
 * is returned so a figure frame (zoom, Reset, full screen) can be rendered into the slot.
 * Math rendered as images (`math-img`, `bb-math-img`) stays inline.
 */
export function extractInlineImages(html: string): { html: string; images: string[] } {
  if (!/<img\b/i.test(html)) return { html, images: [] };
  const template = document.createElement('template');
  template.innerHTML = html;
  const images: string[] = [];
  for (const img of [...template.content.querySelectorAll('img')]) {
    if (img.classList.contains('math-img') || img.classList.contains('bb-math-img')) continue;
    const slot = document.createElement('span');
    slot.setAttribute(FIGURE_SLOT_ATTR, String(images.length));
    slot.className = 'bb-figure-slot';
    images.push(img.outerHTML);
    img.replaceWith(slot);
  }
  if (images.length === 0) return { html, images };
  const out = document.createElement('div');
  out.append(template.content.cloneNode(true));
  return { html: out.innerHTML, images };
}
