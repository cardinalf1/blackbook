// Allowlist HTML sanitizer for question content. Runs at sync and again at import, because an
// imported bank file is untrusted input. Must be idempotent: sanitize(sanitize(x)) === sanitize(x).

import createDOMPurify, { type Config, type WindowLike } from 'dompurify';

const CONFIG: Config = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
  FORBID_TAGS: [
    'a', 'form', 'input', 'button', 'textarea', 'select', 'option', 'style', 'link', 'meta', 'base',
    'iframe', 'object', 'embed', 'image', 'foreignObject', 'video', 'audio', 'source', 'track', 'template',
  ],
  // <use> is how the bank's graphs reuse shapes. The href hook below limits it to in-document refs.
  ADD_TAGS: ['use'],
  ADD_ATTR: ['xlink:href'],
  ALLOW_DATA_ATTR: true,
};

const SAFE_IMAGE_SRC = /^data:image\/(png|jpeg|gif);base64,[A-Za-z0-9+/=\s]*$/;
const TEXT_ALIGN = /^\s*text-align\s*:\s*(left|center|right|justify)\s*$/i;
const SVG_NS = 'http://www.w3.org/2000/svg';

// Graphs (matplotlib output) carry their colors in style="fill:...;stroke:...". On SVG elements
// keep these drawing properties; on HTML elements keep text-align only, since anything else could
// restyle or overlay the app.
const SVG_STYLE_PROPS = new Set([
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
  'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity',
  'clip-path', 'clip-rule', 'font-family', 'font-size', 'font-style', 'font-weight', 'text-anchor',
  'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'letter-spacing',
]);
const SAFE_CSS_VALUE = /^[#\w\s.,%'"()+-]*$/;

function keepSvgDeclaration(decl: string): string | null {
  const colon = decl.indexOf(':');
  if (colon < 0) return null;
  const prop = decl.slice(0, colon).trim().toLowerCase();
  const value = decl.slice(colon + 1).trim();
  if (!SVG_STYLE_PROPS.has(prop) || !SAFE_CSS_VALUE.test(value)) return null;
  // url() may only point inside the document, e.g. a clipPath id.
  const urls = value.match(/url\([^)]*\)/gi) ?? [];
  if (urls.some((u) => !/^url\(\s*#[\w.-]+\s*\)$/i.test(u))) return null;
  if (/url\(/i.test(value.replace(/url\(\s*#[\w.-]+\s*\)/gi, ''))) return null;
  return `${prop}: ${value}`;
}

export type Sanitizer = (html: string) => string;

export function createSanitizer(window: WindowLike): Sanitizer {
  const purify = createDOMPurify(window);
  purify.addHook('uponSanitizeAttribute', (node, data) => {
    const name = data.attrName;
    const value = data.attrValue;
    if (name === 'style') {
      const decls = value.split(';').filter((d) => d.trim() !== '');
      const kept =
        node.namespaceURI === SVG_NS
          ? decls.map(keepSvgDeclaration).filter((d): d is string => d !== null)
          : decls.filter((d) => TEXT_ALIGN.test(d)).map((d) => d.trim().toLowerCase());
      if (kept.length === 0) data.keepAttr = false;
      else data.attrValue = kept.join('; ');
    } else if (name === 'src') {
      if (!SAFE_IMAGE_SRC.test(value)) data.keepAttr = false;
    } else if (name === 'href' || name === 'xlink:href') {
      if (!value.startsWith('#')) data.keepAttr = false;
    }
  });
  return (html: string) => purify.sanitize(html, { ...CONFIG, RETURN_TRUSTED_TYPE: false }).trim();
}
