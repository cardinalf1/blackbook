import { describe, expect, it } from 'vitest';
import { normalizeHtml } from './html';
import { createSanitizer } from './sanitize';

// Synthetic markup only (AGENTS.md rule 1).
const env = { DOMParser };
const MML = 'xmlns="http://www.w3.org/1998/Math/MathML"';

function parse(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
}

describe('normalizeHtml: math', () => {
  it('replaces MathML with a KaTeX-ready span carrying the alt text', () => {
    const { html, stats } = normalizeHtml(
      env,
      `<p>Solve <math ${MML} alttext="x squared"><msup><mi>x</mi><mn>2</mn></msup></math> now.</p>`,
      'q1-stem',
    );
    const span = parse(html).querySelector('span.bb-math');
    expect(span?.getAttribute('data-latex')).toBe('{x}^{2}');
    expect(span?.getAttribute('data-alt')).toBe('x squared');
    expect(span?.hasAttribute('data-display')).toBe(false);
    expect(parse(html).querySelector('math')).toBeNull();
    expect(stats).toMatchObject({ mathConverted: 1, mathKept: 0 });
  });

  it('marks display math', () => {
    const { html } = normalizeHtml(env, `<math ${MML} display="block"><mn>1</mn></math>`, 'q1');
    expect(parse(html).querySelector('span.bb-math')?.getAttribute('data-display')).toBe('block');
  });

  it('keeps unsupported MathML, expands mfenced inside it, and records why', () => {
    const { html, stats } = normalizeHtml(
      env,
      `<math ${MML}><mfenced><mi>a</mi></mfenced><mmultiscripts><mi>x</mi></mmultiscripts></math>`,
      'q1',
    );
    const body = parse(html);
    expect(body.querySelector('math')).not.toBeNull();
    expect(body.querySelector('mfenced')).toBeNull();
    expect(Array.from(body.querySelectorAll('mo')).map((o) => o.textContent)).toEqual(['(', ')']);
    expect(stats.mathKept).toBe(1);
    expect(stats.mathKeptReasons[0]).toContain('mmultiscripts');
  });

  it('does not touch literal dollar signs in prose', () => {
    const { html } = normalizeHtml(env, '<p>It costs $5 and $10.</p>', 'q1');
    expect(html).toBe('<p>It costs $5 and $10.</p>');
  });
});

describe('normalizeHtml: svg', () => {
  const svg =
    '<svg width="300" height="200" viewBox="0 0 300 200" role="img" aria-label="A line graph">' +
    '<defs><path id="tick" d="M0 0 L0 5"/></defs><use href="#tick" x="10"/><use xlink:href="#tick" x="20"/>' +
    '<rect fill="url(#grad)" width="10" height="10"/><linearGradient id="grad"/></svg>';

  it('strips fixed size, keeps viewBox and accessibility attributes', () => {
    const { html, stats } = normalizeHtml(env, svg, 'q1-stem');
    const el = parse(html).querySelector('svg');
    expect(el?.getAttribute('width')).toBeNull();
    expect(el?.getAttribute('height')).toBeNull();
    expect(el?.getAttribute('viewBox')).toBe('0 0 300 200');
    expect(el?.getAttribute('aria-label')).toBe('A line graph');
    expect(el?.classList.contains('bb-svg')).toBe(true);
    expect(stats.svgCleaned).toBe(1);
  });

  it('adds a viewBox from width and height when missing', () => {
    const { html } = normalizeHtml(env, '<svg width="120px" height="80"><circle r="1"/></svg>', 'q1');
    expect(parse(html).querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 120 80');
  });

  it('prefixes ids and rewrites every reference to them', () => {
    const { html } = normalizeHtml(env, svg, 'q1-stem');
    const el = parse(html);
    expect(el.querySelector('path')?.getAttribute('id')).toBe('q1-stem-s0-tick');
    const uses = Array.from(el.querySelectorAll('use'));
    expect(uses[0]?.getAttribute('href')).toBe('#q1-stem-s0-tick');
    expect(uses[1]?.getAttribute('xlink:href')).toBe('#q1-stem-s0-tick');
    expect(el.querySelector('rect')?.getAttribute('fill')).toBe('url(#q1-stem-s0-grad)');
    // The inner rect keeps its own width, only the root svg loses fixed size.
    expect(el.querySelector('rect')?.getAttribute('width')).toBe('10');
  });

  it('gives two svgs in one field different prefixes', () => {
    const { html } = normalizeHtml(env, svg + svg, 'q1');
    const ids = Array.from(parse(html).querySelectorAll('path')).map((p) => p.getAttribute('id'));
    expect(new Set(ids).size).toBe(2);
  });
});

describe('normalizeHtml: images and junk', () => {
  it('tags legacy math images and drops align', () => {
    const { html } = normalizeHtml(
      env,
      '<p><img class="math-img" role="math" align="middle" alt="x plus 1" src="data:image/png;base64,AAAA"></p>',
      'q1',
    );
    const img = parse(html).querySelector('img');
    expect(img?.classList.contains('bb-math-img')).toBe(true);
    expect(img?.getAttribute('align')).toBeNull();
    expect(img?.getAttribute('alt')).toBe('x plus 1');
  });

  it('removes the leaked accessibility widget container', () => {
    const { html } = normalizeHtml(
      env,
      '<p>Text.</p><div data-ae_invis="true" id="level-access-access-assistant-highlight-container">&nbsp;</div>',
      'q1',
    );
    expect(html).toBe('<p>Text.</p>');
  });
});

describe('normalizeHtml: malformed input', () => {
  it('returns empty for blank input', () => {
    expect(normalizeHtml(env, '', 'q1').html).toBe('');
    expect(normalizeHtml(env, '   \n ', 'q1').html).toBe('');
  });

  it('repairs unclosed tags instead of throwing', () => {
    const { html } = normalizeHtml(env, '<p>Open <em>emphasis', 'q1');
    expect(html).toBe('<p>Open <em>emphasis</em></p>');
  });

  it('treats a stray closing tag and plain text safely', () => {
    expect(normalizeHtml(env, 'plain </div> text', 'q1').html).toBe('plain  text');
  });

  it('keeps MathML that has stray text as MathML', () => {
    const { stats } = normalizeHtml(env, `<math ${MML}>loose<mi>x</mi></math>`, 'q1');
    expect(stats.mathKept).toBe(1);
  });
});

describe('sanitize after normalize', () => {
  it('keeps converted math, svg and legacy images intact', () => {
    const sanitize = createSanitizer(window);
    const input =
      `<p>A <u>key</u> <math ${MML} alttext="one half"><mfrac><mn>1</mn><mn>2</mn></mfrac></math></p>` +
      '<svg width="10" height="10" viewBox="0 0 10 10"><path id="p" d="M0 0"/><use href="#p"/></svg>' +
      '<img class="math-img" alt="y" src="data:image/png;base64,AAAA">';
    const once = sanitize(normalizeHtml(env, input, 'q9').html);
    const body = parse(once);
    expect(body.querySelector('span.bb-math')?.getAttribute('data-latex')).toBe('\\frac{1}{2}');
    expect(body.querySelector('u')?.textContent).toBe('key');
    expect(body.querySelector('use')?.getAttribute('href')).toBe('#q9-s0-p');
    expect(body.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(sanitize(once)).toBe(once);
  });
});
