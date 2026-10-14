// Sync-time HTML normalizer: MathML to KaTeX-ready spans, SVG cleanup, legacy math images,
// removal of known junk. Runs once per field at sync. Output still goes through sanitizeHtml.

import katex from 'katex';
import { mathmlToLatex, UnsupportedMathmlError } from './mathml';

export interface NormalizeStats {
  /** <math> elements converted to LaTeX that KaTeX accepted. */
  mathConverted: number;
  /** <math> elements kept as MathML because conversion or KaTeX failed. */
  mathKept: number;
  /** Reasons for kept math, e.g. "<mmultiscripts>" or "katex: ...". */
  mathKeptReasons: string[];
  svgCleaned: number;
}

export function emptyStats(): NormalizeStats {
  return { mathConverted: 0, mathKept: 0, mathKeptReasons: [], svgCleaned: 0 };
}

export function mergeStats(into: NormalizeStats, from: NormalizeStats): void {
  into.mathConverted += from.mathConverted;
  into.mathKept += from.mathKept;
  into.mathKeptReasons.push(...from.mathKeptReasons);
  into.svgCleaned += from.svgCleaned;
}

export interface DomEnv {
  DOMParser: typeof DOMParser;
}

/** Accessibility-widget markup that leaked into some rationales (docs/api-notes.md). */
const JUNK_SELECTOR = '#level-access-access-assistant-highlight-container, [data-ae_invis]';

/** Returns an error message if KaTeX rejects the LaTeX, otherwise null. */
export function katexError(latex: string): string | null {
  try {
    katex.renderToString(latex, { throwOnError: true, strict: 'ignore' });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Rewrites deprecated <mfenced> as <mrow><mo>…</mo></mrow> so kept MathML renders natively. */
function expandMfenced(doc: Document, math: Element): void {
  const MML = 'http://www.w3.org/1998/Math/MathML';
  for (const f of Array.from(math.querySelectorAll('mfenced')).reverse()) {
    const row = doc.createElementNS(MML, 'mrow');
    const mo = (t: string): Element => {
      const o = doc.createElementNS(MML, 'mo');
      o.textContent = t;
      return o;
    };
    const seps = [...(f.getAttribute('separators') ?? ',').replace(/\s/g, '')];
    row.appendChild(mo(f.getAttribute('open') ?? '('));
    Array.from(f.children).forEach((child, i) => {
      if (i > 0 && seps.length > 0) row.appendChild(mo(seps[Math.min(i - 1, seps.length - 1)] ?? ','));
      row.appendChild(child);
    });
    row.appendChild(mo(f.getAttribute('close') ?? ')'));
    f.replaceWith(row);
  }
}

function convertMath(doc: Document, root: Element, stats: NormalizeStats): void {
  for (const math of Array.from(root.querySelectorAll('math'))) {
    let latex: string;
    try {
      latex = mathmlToLatex(math);
    } catch (e) {
      if (!(e instanceof UnsupportedMathmlError)) throw e;
      stats.mathKept++;
      stats.mathKeptReasons.push(e.message);
      expandMfenced(doc, math);
      continue;
    }
    const err = katexError(latex);
    if (err !== null) {
      stats.mathKept++;
      stats.mathKeptReasons.push(`katex: ${err}`);
      expandMfenced(doc, math);
      continue;
    }
    const span = doc.createElement('span');
    span.className = 'bb-math';
    span.setAttribute('data-latex', latex);
    if (math.getAttribute('display') === 'block') span.setAttribute('data-display', 'block');
    const alt = math.getAttribute('alttext');
    if (alt) span.setAttribute('data-alt', alt);
    span.textContent = latex;
    math.replaceWith(span);
    stats.mathConverted++;
  }
}

const URL_REF = /url\(\s*#([^)\s]+)\s*\)/g;

function cleanSvg(root: Element, idPrefix: string, stats: NormalizeStats): void {
  root.querySelectorAll('svg').forEach((svg, n) => {
    const prefix = `${idPrefix}-s${n}-`;
    const w = svg.getAttribute('width');
    const h = svg.getAttribute('height');
    if (!svg.getAttribute('viewBox') && w && h) {
      const nw = Number.parseFloat(w);
      const nh = Number.parseFloat(h);
      if (Number.isFinite(nw) && Number.isFinite(nh) && nw > 0 && nh > 0) svg.setAttribute('viewBox', `0 0 ${nw} ${nh}`);
    }
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.classList.add('bb-svg');

    // Make ids unique per question so two SVGs on one screen cannot capture each other's <use> refs.
    const ids = new Set<string>();
    for (const el of [svg, ...Array.from(svg.querySelectorAll('[id]'))]) {
      const id = el.getAttribute('id');
      if (id) {
        ids.add(id);
        el.setAttribute('id', prefix + id);
      }
    }
    if (ids.size === 0) {
      stats.svgCleaned++;
      return;
    }
    for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
      for (const attr of Array.from(el.attributes)) {
        const { name, value } = attr;
        if ((name === 'href' || name === 'xlink:href') && value.startsWith('#') && ids.has(value.slice(1))) {
          el.setAttribute(name, `#${prefix}${value.slice(1)}`);
        } else if (value.includes('url(')) {
          el.setAttribute(name, value.replace(URL_REF, (m, id: string) => (ids.has(id) ? `url(#${prefix}${id})` : m)));
        }
      }
    }
    stats.svgCleaned++;
  });
}

function cleanImages(root: Element): void {
  for (const img of Array.from(root.querySelectorAll('img'))) {
    img.removeAttribute('align');
    if (img.classList.contains('math-img')) img.classList.add('bb-math-img');
  }
}

/**
 * Normalizes one HTML field. `idPrefix` must be unique per question and field (e.g. "q<id>-stem").
 * Returns the new HTML and per-field stats.
 */
export function normalizeHtml(env: DomEnv, html: string, idPrefix: string): { html: string; stats: NormalizeStats } {
  const stats = emptyStats();
  if (html.trim() === '') return { html: '', stats };
  const doc = new env.DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
  const body = doc.body;
  body.querySelectorAll(JUNK_SELECTOR).forEach((el) => el.remove());
  convertMath(doc, body, stats);
  cleanSvg(body, idPrefix.replace(/[^A-Za-z0-9_-]/g, '_'), stats);
  cleanImages(body);
  return { html: body.innerHTML.trim(), stats };
}
