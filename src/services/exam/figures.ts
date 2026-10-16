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
