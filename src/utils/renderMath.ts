import katex from 'katex';

/**
 * Renders <span class="bb-math" data-latex> placeholders with KaTeX. Input is already-sanitized
 * question HTML; KaTeX output is safe because `trust` stays off (no \href, \url, \includegraphics).
 */
export function renderMathHtml(html: string): string {
  if (!html.includes('bb-math')) return html;
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
  doc.querySelectorAll('span.bb-math[data-latex]').forEach((span) => {
    const latex = span.getAttribute('data-latex') ?? '';
    span.innerHTML = katex.renderToString(latex, {
      displayMode: span.getAttribute('data-display') === 'block',
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'htmlAndMathml',
    });
  });
  return doc.body.innerHTML;
}
