import { describe, expect, it } from 'vitest';
import { renderMathHtml } from './renderMath';

describe('renderMathHtml', () => {
  it('renders math spans with KaTeX and leaves other markup alone', () => {
    const out = renderMathHtml('<p>Area: <span class="bb-math" data-latex="\\pi r^{2}">\\pi r^{2}</span> cm.</p>');
    const body = new DOMParser().parseFromString(out, 'text/html').body;
    expect(body.querySelector('.bb-math .katex')).not.toBeNull();
    expect(body.querySelector('.bb-math annotation')?.textContent).toBe('\\pi r^{2}');
    expect(body.textContent).toContain('cm.');
  });

  it('renders display math in display mode', () => {
    const out = renderMathHtml('<span class="bb-math" data-latex="x" data-display="block">x</span>');
    expect(out).toContain('katex-display');
  });

  it('shows bad LaTeX as an inline error instead of throwing', () => {
    expect(() => renderMathHtml('<span class="bb-math" data-latex="\\frac{1">x</span>')).not.toThrow();
  });

  it('does not execute trust-gated commands', () => {
    const out = renderMathHtml('<span class="bb-math" data-latex="\\href{javascript:alert(1)}{x}">x</span>');
    // \href is rendered as error text; the URL survives only as inert attribute/annotation text.
    const body = new DOMParser().parseFromString(out, 'text/html').body;
    expect(body.querySelector('a, [href]')).toBeNull();
  });

  it('returns html without math untouched', () => {
    expect(renderMathHtml('<p>$5 and $10</p>')).toBe('<p>$5 and $10</p>');
  });
});
