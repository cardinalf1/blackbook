import { describe, expect, it } from 'vitest';
import { katexError } from './html';
import { joinLatex, mathmlToLatex, UnsupportedMathmlError } from './mathml';

// Synthetic MathML only (AGENTS.md rule 1).
function m(inner: string, attrs = ''): Element {
  const doc = new DOMParser().parseFromString(`<body><math ${attrs}>${inner}</math></body>`, 'text/html');
  const el = doc.querySelector('math');
  if (!el) throw new Error('parse failed');
  return el;
}

function latex(inner: string, attrs = ''): string {
  const out = mathmlToLatex(m(inner, attrs));
  // Every conversion the tests accept must also be valid KaTeX.
  expect(katexError(out)).toBeNull();
  return out;
}

describe('mathmlToLatex', () => {
  it('converts tokens and rows', () => {
    expect(latex('<mi>x</mi><mo>+</mo><mn>3</mn><mo>=</mo><mn>7</mn>')).toBe('x+3=7');
  });

  it('braces compound bases and exponents', () => {
    expect(latex('<msup><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow><mn>2</mn></msup>')).toBe('{x+1}^{2}');
    expect(latex('<msub><mi>a</mi><mrow><mi>n</mi><mo>-</mo><mn>1</mn></mrow></msub>')).toBe('{a}_{n-1}');
    expect(latex('<msubsup><mi>x</mi><mn>0</mn><mn>2</mn></msubsup>')).toBe('{x}_{0}^{2}');
  });

  it('converts fractions and roots', () => {
    expect(latex('<mfrac><mn>3</mn><mrow><mi>x</mi><mo>-</mo><mn>2</mn></mrow></mfrac>')).toBe('\\frac{3}{x-2}');
    expect(latex('<msqrt><mn>2</mn><mi>x</mi></msqrt>')).toBe('\\sqrt{2x}');
    expect(latex('<mroot><mi>y</mi><mn>3</mn></mroot>')).toBe('\\sqrt[3]{y}');
  });

  it('converts mfenced with default and custom delimiters', () => {
    expect(latex('<mfenced><mi>a</mi><mi>b</mi></mfenced>')).toBe('\\left(a,b\\right)');
    expect(latex('<mfenced open="|" close="|"><mrow><mi>x</mi><mo>-</mo><mn>4</mn></mrow></mfenced>')).toBe(
      '\\left|x-4\\right|',
    );
    expect(latex('<mfenced open="[" close="]" separators=";"><mn>1</mn><mn>2</mn><mn>3</mn></mfenced>')).toBe(
      '\\left[1;2;3\\right]',
    );
  });

  it('escapes LaTeX special characters in operators', () => {
    expect(latex('<mn>40</mn><mo>%</mo>')).toBe('40\\%');
    expect(latex('<mo>$</mo><mn>12.50</mn>')).toBe('\\$12.50');
    expect(latex('<mi>a</mi><mo>&amp;</mo><mi>b</mi>')).toBe('a\\&b');
  });

  it('maps unicode operators, greek letters and degrees', () => {
    expect(latex('<mi>x</mi><mo>≤</mo><mn>5</mn>')).toBe('x\\le5');
    expect(latex('<mn>2</mn><mi>π</mi><mi>r</mi>')).toBe('2\\pi r');
    expect(latex('<mn>30</mn><mo>°</mo>')).toBe('30^{\\circ}');
    expect(latex('<mn>6</mn><mo>−</mo><mn>2</mn>')).toBe('6-2');
  });

  it('keeps thousands separators tight', () => {
    expect(latex('<mn>1,800</mn>')).toBe('1{,}800');
  });

  it('uses function names for trig', () => {
    expect(latex('<mi>sin</mi><mi>x</mi>')).toBe('\\sin x');
    expect(latex('<mi>cos</mi><mo>(</mo><mi>θ</mi><mo>)</mo>')).toBe('\\cos(\\theta)');
  });

  it('preserves spaces and escapes in mtext', () => {
    expect(latex('<mn>5</mn><mtext> dollars &amp; 50% off</mtext>')).toBe('5\\text{ dollars \\& 50\\% off}');
  });

  it('handles overlines, accents and enclosures', () => {
    expect(latex('<mover><mrow><mi>A</mi><mi>B</mi></mrow><mo>¯</mo></mover>')).toBe('\\overline{AB}');
    expect(latex('<menclose notation="top"><mn>3</mn></menclose>')).toBe('\\overline{3}');
    expect(latex('<mover><mrow><mi>A</mi><mi>B</mi></mrow><mo>→</mo></mover>')).toBe('\\overrightarrow{AB}');
  });

  it('handles script variant and displaystyle', () => {
    expect(latex('<mi mathvariant="script">L</mi>')).toBe('\\mathcal{L}');
    expect(latex('<mstyle displaystyle="true"><mfrac><mn>1</mn><mn>2</mn></mfrac></mstyle>')).toBe(
      '\\displaystyle\\frac{1}{2}',
    );
  });

  it('converts tables with column alignment', () => {
    const out = latex(
      '<mtable columnalign="left"><mtr><mtd><mi>x</mi></mtd><mtd><mn>1</mn></mtd></mtr>' +
        '<mtr><mtd><mi>y</mi></mtd><mtd><mn>2</mn></mtd></mtr></mtable>',
    );
    expect(out).toBe('\\begin{array}{ll}x & 1 \\\\ y & 2\\end{array}');
  });

  it('inserts a space between a control word and a following letter', () => {
    expect(joinLatex(['\\pi', 'r'])).toBe('\\pi r');
    expect(joinLatex(['\\pi', '2'])).toBe('\\pi2');
    expect(joinLatex(['a', '', 'b'])).toBe('ab');
  });

  it('throws UnsupportedMathmlError on unknown elements, characters and wrong arity', () => {
    expect(() => mathmlToLatex(m('<mmultiscripts><mi>x</mi></mmultiscripts>'))).toThrow(UnsupportedMathmlError);
    expect(() => mathmlToLatex(m('<mo>☃</mo>'))).toThrow(/U\+2603/);
    expect(() => mathmlToLatex(m('<mfrac><mn>1</mn></mfrac>'))).toThrow(/expects 2/);
    expect(() => mathmlToLatex(m('<menclose notation="circle"><mn>1</mn></menclose>'))).toThrow(UnsupportedMathmlError);
  });

  it('rejects a non-math root', () => {
    const doc = new DOMParser().parseFromString('<body><p>x</p></body>', 'text/html');
    const p = doc.querySelector('p');
    if (!p) throw new Error('parse failed');
    expect(() => mathmlToLatex(p)).toThrow(UnsupportedMathmlError);
  });
});
