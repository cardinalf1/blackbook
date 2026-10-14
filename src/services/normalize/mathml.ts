// MathML (presentation) to LaTeX for KaTeX. Covers every element seen in the question bank
// (docs/api-notes.md). Anything else throws UnsupportedMathmlError so the caller can keep the
// original MathML and count it, instead of rendering something silently wrong.

export class UnsupportedMathmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedMathmlError';
  }
}

const GREEK: Record<string, string> = {
  α: '\\alpha', β: '\\beta', γ: '\\gamma', δ: '\\delta', ε: '\\epsilon', ζ: '\\zeta', η: '\\eta',
  θ: '\\theta', ι: '\\iota', κ: '\\kappa', λ: '\\lambda', μ: '\\mu', ν: '\\nu', ξ: '\\xi', π: '\\pi',
  ρ: '\\rho', σ: '\\sigma', τ: '\\tau', υ: '\\upsilon', φ: '\\phi', ϕ: '\\phi', χ: '\\chi', ψ: '\\psi',
  ω: '\\omega', Γ: '\\Gamma', Δ: '\\Delta', Θ: '\\Theta', Λ: '\\Lambda', Ξ: '\\Xi', Π: '\\Pi',
  Σ: '\\Sigma', Φ: '\\Phi', Ψ: '\\Psi', Ω: '\\Omega',
};

const SYMBOLS: Record<string, string> = {
  '−': '-', '–': '-', '‒': '-', '×': '\\times', '÷': '\\div', '·': '\\cdot', '⋅': '\\cdot',
  '∗': '*', '±': '\\pm', '∓': '\\mp', '≤': '\\le', '≥': '\\ge', '≠': '\\ne', '≈': '\\approx',
  '≅': '\\cong', '∼': '\\sim', '~': '\\sim', '≡': '\\equiv', '∝': '\\propto', '°': '^{\\circ}', '∘': '\\circ',
  '∠': '\\angle', '△': '\\triangle', '⊥': '\\perp', '∥': '\\parallel', '→': '\\to', '←': '\\leftarrow',
  '↔': '\\leftrightarrow', '⇒': '\\Rightarrow', '∞': '\\infty', '…': '\\ldots', '⋯': '\\cdots',
  '′': "'", '″': "''", '√': '\\surd', '∈': '\\in', '∉': '\\notin', '∪': '\\cup', '∩': '\\cap',
  '⊂': '\\subset', '∅': '\\emptyset', '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '⌢': '\\frown',
  ' ': '\\ ', ' ': '\\,', '​': '', '⁡': '', '⁢': '', '⁣': '',
  '%': '\\%', $: '\\$', '&': '\\&', '#': '\\#', _: '\\_', '{': '\\{', '}': '\\}', '\\': '\\backslash',
  '^': '\\hat{}', '|': '|', '‖': '\\|', '⟨': '\\langle', '⟩': '\\rangle',
};

const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'log', 'ln', 'exp', 'lim', 'max', 'min', 'det', 'gcd', 'deg',
]);

const ASCII_SAFE = /^[A-Za-z0-9 .,;:!?'"()[\]<>=+\-*/@]$/;

/** Converts one character for math mode. Throws on characters with no known mapping. */
function mathChar(ch: string): string {
  if (ASCII_SAFE.test(ch)) return ch;
  const mapped = GREEK[ch] ?? SYMBOLS[ch];
  if (mapped !== undefined) return mapped;
  throw new UnsupportedMathmlError(`character U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`);
}

function mathText(text: string): string {
  return joinLatex([...text].map(mathChar));
}

/** Escapes text for \text{...}. */
function textModeEscape(text: string): string {
  return text.replace(/[\\{}$%&#_^~ ]/g, (c) => {
    switch (c) {
      case '\\': return '\\textbackslash{}';
      case '^': return '\\textasciicircum{}';
      case '~': return '\\textasciitilde{}';
      case ' ': return ' ';
      default: return `\\${c}`;
    }
  });
}

/** Concatenates LaTeX fragments, inserting a space where a control word would run into a letter. */
export function joinLatex(parts: readonly string[]): string {
  let out = '';
  for (const p of parts) {
    if (p === '') continue;
    if (/\\[A-Za-z]+$/.test(out) && /^[A-Za-z]/.test(p)) out += ' ';
    out += p;
  }
  return out;
}

function tagOf(el: Element): string {
  const name = el.localName.toLowerCase();
  const colon = name.indexOf(':');
  return colon >= 0 ? name.slice(colon + 1) : name;
}

/** Element children, ignoring whitespace-only text nodes. Non-whitespace stray text is an error. */
function childElements(el: Element): Element[] {
  const out: Element[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 1) out.push(node as Element);
    else if (node.nodeType === 3 && (node.textContent ?? '').trim() !== '') {
      throw new UnsupportedMathmlError(`stray text inside <${tagOf(el)}>`);
    } else if (node.nodeType !== 3 && node.nodeType !== 8) {
      throw new UnsupportedMathmlError(`unexpected node type ${node.nodeType}`);
    }
  }
  return out;
}

function arity(el: Element, n: number): Element[] {
  const kids = childElements(el);
  if (kids.length !== n) throw new UnsupportedMathmlError(`<${tagOf(el)}> expects ${n} children, got ${kids.length}`);
  return kids;
}

function group(el: Element): string {
  return `{${convert(el)}}`;
}

function rowOf(el: Element): string {
  return joinLatex(childElements(el).map(convert));
}

const DELIMS: Record<string, string> = {
  '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '|': '|', '‖': '\\|',
  '⟨': '\\langle', '⟩': '\\rangle', '': '.',
};

function delim(d: string): string {
  const mapped = DELIMS[d];
  if (mapped === undefined) throw new UnsupportedMathmlError(`fence delimiter "${d}"`);
  return mapped;
}

function overAccent(accent: string, base: string): string {
  switch (accent) {
    case '¯': case '‾': case '―': case '-': case '−': case '_': return `\\overline{${base}}`;
    case '→': case '⟶': return `\\overrightarrow{${base}}`;
    case '↔': case '⟷': return `\\overleftrightarrow{${base}}`;
    case '^': case 'ˆ': return `\\hat{${base}}`;
    case '~': case '˜': return `\\tilde{${base}}`;
    case '˙': case '.': return `\\dot{${base}}`;
    case '⌢': return `\\overset{\\frown}{${base}}`;
    default: return `\\overset{${mathText(accent)}}{${base}}`;
  }
}

function convert(el: Element): string {
  const tag = tagOf(el);
  switch (tag) {
    case 'math':
    case 'mrow':
    case 'mpadded':
      return rowOf(el);
    case 'mstyle':
      return el.getAttribute('displaystyle') === 'true' ? joinLatex(['\\displaystyle', rowOf(el)]) : rowOf(el);
    case 'mphantom':
      return `\\phantom{${rowOf(el)}}`;
    case 'semantics': {
      const first = childElements(el)[0];
      return first ? convert(first) : '';
    }
    case 'maligngroup':
    case 'malignmark':
      return '';
    case 'mi': {
      const text = (el.textContent ?? '').trim();
      if (text === '') return '';
      const variant = el.getAttribute('mathvariant');
      if (text.length > 1 && FUNCTIONS.has(text)) return `\\${text}`;
      const body = text.length > 1 && /^[A-Za-z]+$/.test(text) ? `\\mathrm{${text}}` : mathText(text);
      switch (variant) {
        case null: case 'italic': return body;
        case 'normal': return /^[A-Za-z]+$/.test(text) ? `\\mathrm{${text}}` : body;
        case 'bold': return `\\mathbf{${body}}`;
        case 'script': return `\\mathcal{${body}}`;
        case 'double-struck': return `\\mathbb{${body}}`;
        default: throw new UnsupportedMathmlError(`mathvariant="${variant}"`);
      }
    }
    case 'mn': {
      const text = (el.textContent ?? '').trim();
      // A comma inside a number is a thousands separator; braces stop math-mode spacing after it.
      return mathText(text).replace(/,/g, '{,}');
    }
    case 'mo': {
      const text = (el.textContent ?? '').trim();
      if (text === '' && (el.textContent ?? '') !== '') return mathText(el.textContent ?? '');
      return mathText(text);
    }
    case 'mtext': {
      const text = el.textContent ?? '';
      return text === '' ? '' : `\\text{${textModeEscape(text)}}`;
    }
    case 'ms':
      return `\\text{"${textModeEscape(el.textContent ?? '')}"}`;
    case 'mspace':
      return '\\ ';
    case 'mfrac': {
      const [num, den] = arity(el, 2) as [Element, Element];
      const lt = el.getAttribute('linethickness');
      if (lt === '0' || lt === '0px' || lt === '0em') return `\\genfrac{}{}{0pt}{}${group(num)}${group(den)}`;
      return `\\frac${group(num)}${group(den)}`;
    }
    case 'msup': {
      const [base, sup] = arity(el, 2) as [Element, Element];
      return `${group(base)}^${group(sup)}`;
    }
    case 'msub': {
      const [base, sub] = arity(el, 2) as [Element, Element];
      return `${group(base)}_${group(sub)}`;
    }
    case 'msubsup': {
      const [base, sub, sup] = arity(el, 3) as [Element, Element, Element];
      return `${group(base)}_${group(sub)}^${group(sup)}`;
    }
    case 'msqrt':
      return `\\sqrt{${rowOf(el)}}`;
    case 'mroot': {
      const [base, index] = arity(el, 2) as [Element, Element];
      return `\\sqrt[${convert(index)}]${group(base)}`;
    }
    case 'mfenced': {
      const open = el.getAttribute('open') ?? '(';
      const close = el.getAttribute('close') ?? ')';
      const seps = [...(el.getAttribute('separators') ?? ',').replace(/\s/g, '')];
      const kids = childElements(el).map(convert);
      const parts: string[] = [];
      kids.forEach((k, i) => {
        if (i > 0 && seps.length > 0) parts.push(mathChar(seps[Math.min(i - 1, seps.length - 1)] ?? ','));
        parts.push(k);
      });
      return `\\left${delim(open)}${joinLatex(parts)}\\right${delim(close)}`;
    }
    case 'menclose': {
      const notation = (el.getAttribute('notation') ?? 'longdiv').trim();
      const body = rowOf(el);
      switch (notation) {
        case 'top': return `\\overline{${body}}`;
        case 'bottom': return `\\underline{${body}}`;
        case 'box': case 'roundedbox': return `\\boxed{${body}}`;
        case 'updiagonalstrike': return `\\cancel{${body}}`;
        default: throw new UnsupportedMathmlError(`menclose notation="${notation}"`);
      }
    }
    case 'mover': {
      const [base, over] = arity(el, 2) as [Element, Element];
      const accent = tagOf(over) === 'mo' ? (over.textContent ?? '').trim() : null;
      return accent !== null ? overAccent(accent, convert(base)) : `\\overset${group(over)}${group(base)}`;
    }
    case 'munder': {
      const [base, under] = arity(el, 2) as [Element, Element];
      const accent = tagOf(under) === 'mo' ? (under.textContent ?? '').trim() : null;
      if (accent === '_' || accent === '¯' || accent === '‾') return `\\underline{${convert(base)}}`;
      return `\\underset${group(under)}${group(base)}`;
    }
    case 'munderover': {
      const [base, under, over] = arity(el, 3) as [Element, Element, Element];
      return `\\overset${group(over)}{\\underset${group(under)}${group(base)}}`;
    }
    case 'mtable': {
      const rows = childElements(el).map((row) => {
        if (tagOf(row) !== 'mtr') throw new UnsupportedMathmlError(`<${tagOf(row)}> inside <mtable>`);
        return childElements(row).map((cell) => {
          if (tagOf(cell) !== 'mtd') throw new UnsupportedMathmlError(`<${tagOf(cell)}> inside <mtr>`);
          return rowOf(cell);
        });
      });
      const cols = Math.max(1, ...rows.map((r) => r.length));
      const align = (el.getAttribute('columnalign') ?? 'center').trim().split(/\s+/);
      const spec = Array.from({ length: cols }, (_, i) => {
        const a = align[Math.min(i, align.length - 1)];
        return a === 'left' ? 'l' : a === 'right' ? 'r' : 'c';
      }).join('');
      return `\\begin{array}{${spec}}${rows.map((r) => r.join(' & ')).join(' \\\\ ')}\\end{array}`;
    }
    default:
      throw new UnsupportedMathmlError(`<${tag}>`);
  }
}

/** Converts a <math> element to LaTeX. Throws UnsupportedMathmlError for anything not covered. */
export function mathmlToLatex(math: Element): string {
  if (tagOf(math) !== 'math') throw new UnsupportedMathmlError(`expected <math>, got <${tagOf(math)}>`);
  return convert(math);
}
