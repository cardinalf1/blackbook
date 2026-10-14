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

export type Sanitizer = (html: string) => string;

export function createSanitizer(window: WindowLike): Sanitizer {
  const purify = createDOMPurify(window);
  purify.addHook('uponSanitizeAttribute', (_node, data) => {
    const name = data.attrName;
    const value = data.attrValue;
    if (name === 'style') {
      // Keep text alignment only; everything else could restyle or overlay the app.
      const kept = value.split(';').filter((d) => TEXT_ALIGN.test(d)).map((d) => d.trim().toLowerCase());
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
