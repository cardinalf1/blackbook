/**
 * MathML to KaTeX & SVG Sanitizer Pipeline
 * Transforms raw College Board Educator Bank payloads into sanitized HTML with KaTeX notation
 */

/**
 * Recursively converts a MathML DOM element into LaTeX syntax
 */
function mathMlElementToLatex(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.trim() || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const tagName = el.tagName.toLowerCase().replace(/^m:/, '');
  const childLatex = Array.from(el.childNodes).map(mathMlElementToLatex).join('');

  switch (tagName) {
    case 'math': {
      const display = el.getAttribute('display') === 'block';
      return display ? `$$${childLatex}$$` : `$${childLatex}$`;
    }
    case 'mfrac': {
      const children = Array.from(el.childNodes).filter(
        c => c.nodeType === Node.ELEMENT_NODE || (c.nodeType === Node.TEXT_NODE && c.textContent?.trim())
      );
      const num = children[0] ? mathMlElementToLatex(children[0]) : '';
      const den = children[1] ? mathMlElementToLatex(children[1]) : '';
      return `\\frac{${num}}{${den}}`;
    }
    case 'msup': {
      const children = Array.from(el.childNodes).filter(
        c => c.nodeType === Node.ELEMENT_NODE || (c.nodeType === Node.TEXT_NODE && c.textContent?.trim())
      );
      const base = children[0] ? mathMlElementToLatex(children[0]) : '';
      const exp = children[1] ? mathMlElementToLatex(children[1]) : '';
      return `${base}^{${exp}}`;
    }
    case 'msub': {
      const children = Array.from(el.childNodes).filter(
        c => c.nodeType === Node.ELEMENT_NODE || (c.nodeType === Node.TEXT_NODE && c.textContent?.trim())
      );
      const base = children[0] ? mathMlElementToLatex(children[0]) : '';
      const sub = children[1] ? mathMlElementToLatex(children[1]) : '';
      return `${base}_{${sub}}`;
    }
    case 'msubsup': {
      const children = Array.from(el.childNodes).filter(
        c => c.nodeType === Node.ELEMENT_NODE || (c.nodeType === Node.TEXT_NODE && c.textContent?.trim())
      );
      const base = children[0] ? mathMlElementToLatex(children[0]) : '';
      const sub = children[1] ? mathMlElementToLatex(children[1]) : '';
      const exp = children[2] ? mathMlElementToLatex(children[2]) : '';
      return `${base}_{${sub}}^{${exp}}`;
    }
    case 'msqrt':
      return `\\sqrt{${childLatex}}`;
    case 'mroot': {
      const children = Array.from(el.childNodes).filter(
        c => c.nodeType === Node.ELEMENT_NODE || (c.nodeType === Node.TEXT_NODE && c.textContent?.trim())
      );
      const base = children[0] ? mathMlElementToLatex(children[0]) : '';
      const deg = children[1] ? mathMlElementToLatex(children[1]) : '2';
      return `\\sqrt[${deg}]{${base}}`;
    }
    case 'mi': {
      const text = el.textContent?.trim() || '';
      if (['pi', 'alpha', 'beta', 'theta', 'lambda', 'sigma', 'omega'].includes(text.toLowerCase())) {
        return `\\${text}`;
      }
      return text;
    }
    case 'mn':
      return el.textContent?.trim() || '';
    case 'mo': {
      const op = el.textContent?.trim() || '';
      const opMap: Record<string, string> = {
        '±': '\\pm ',
        '×': '\\times ',
        '÷': '\\div ',
        '≤': '\\le ',
        '≥': '\\ge ',
        '≠': '\\ne ',
        '≈': '\\approx ',
        '°': '^\\circ ',
        '·': '\\cdot ',
        '√': '\\sqrt ',
        '∞': '\\infty '
      };
      return opMap[op] || op;
    }
    case 'mtext':
      return `\\text{${el.textContent || ''}}`;
    case 'mspace':
      return '\\quad ';
    case 'mtable':
      return `\\begin{matrix}${childLatex}\\end{matrix}`;
    case 'mtr': {
      const cells = Array.from(el.children).map(c => mathMlElementToLatex(c)).join(' & ');
      return `${cells} \\\\ `;
    }
    case 'mtd':
      return childLatex;
    case 'mrow':
    default:
      return childLatex;
  }
}

/**
 * Converts any MathML strings inside an HTML fragment into standard $...$ and $$...$$ LaTeX syntax
 */
export function sanitizeMathMlToLatex(rawHtml: string): string {
  if (!rawHtml) return '';

  // Quick check if MathML is present
  if (!rawHtml.includes('<math') && !rawHtml.includes('<m:math')) {
    return sanitizeSvgAssets(rawHtml);
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const mathNodes = doc.querySelectorAll('math, m\\:math');

    mathNodes.forEach(node => {
      const latex = mathMlElementToLatex(node);
      const span = doc.createElement('span');
      span.setAttribute('data-katex-source', latex);
      span.textContent = latex;
      node.parentNode?.replaceChild(span, node);
    });

    return sanitizeSvgAssets(doc.body.innerHTML);
  } catch {
    return sanitizeSvgAssets(rawHtml);
  }
}

/**
 * Extract embedded SVG diagrams, scrub absolute height/width attributes,
 * and preserve/generate viewBox definitions for responsive dynamic scaling.
 */
export function sanitizeSvgAssets(html: string): string {
  if (!html || !html.includes('<svg')) return html;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const svgElements = doc.querySelectorAll('svg');

    svgElements.forEach(svg => {
      const w = svg.getAttribute('width');
      const h = svg.getAttribute('height');
      const viewBox = svg.getAttribute('viewBox');

      if (!viewBox && w && h) {
        const numW = parseFloat(w.replace('px', ''));
        const numH = parseFloat(h.replace('px', ''));
        if (!isNaN(numW) && !isNaN(numH)) {
          svg.setAttribute('viewBox', `0 0 ${numW} ${numH}`);
        }
      }

      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.classList.add('w-full', 'max-w-md', 'mx-auto', 'h-auto', 'my-3', 'overflow-visible');
    });

    return doc.body.innerHTML;
  } catch {
    return html;
  }
}
