import { describe, expect, it } from 'vitest';
import { createSanitizer } from './sanitize';

// Synthetic markup only (AGENTS.md rule 1).
const sanitize = createSanitizer(window);

describe('createSanitizer', () => {
  it('removes scripts, event handlers and javascript urls', () => {
    const out = sanitize('<p onclick="x()">Hi<script>alert(1)</script></p><img src="javascript:alert(1)" alt="a">');
    expect(out).not.toMatch(/script|onclick|javascript/i);
    expect(out).toContain('<p>Hi</p>');
  });

  it('removes links, forms, iframes, style blocks and svg external images', () => {
    const out = sanitize(
      '<a href="https://example.com">x</a><form><input></form><iframe src="https://example.com"></iframe>' +
        '<style>body{display:none}</style><svg viewBox="0 0 1 1"><image href="https://example.com/a.png"/></svg>',
    );
    expect(out).not.toMatch(/<a |<form|<input|<iframe|<style|<image|example\.com/);
  });

  it('only allows inline png, jpeg and gif images', () => {
    expect(sanitize('<img src="data:image/png;base64,AAAA" alt="a">')).toContain('src="data:image/png;base64,AAAA"');
    expect(sanitize('<img src="https://example.com/a.png" alt="a">')).not.toContain('src=');
    expect(sanitize('<img src="data:image/svg+xml;base64,AAAA" alt="a">')).not.toContain('src=');
  });

  it('only allows in-document svg references', () => {
    const out = sanitize('<svg viewBox="0 0 1 1"><use href="#a"/><use href="https://example.com/s.svg#b"/></svg>');
    expect(out).toContain('href="#a"');
    expect(out).not.toContain('example.com');
  });

  it('keeps only text-align in style attributes', () => {
    expect(sanitize('<p style="text-align: center; position: fixed; top: 0">x</p>')).toBe(
      '<p style="text-align: center">x</p>',
    );
    expect(sanitize('<p style="position: fixed">x</p>')).toBe('<p>x</p>');
  });

  it('keeps formatting the questions rely on', () => {
    const html =
      '<p class="stem_paragraph">A <u>marked</u> <em>word</em> <span class="italic">i</span> ' +
      '<span class="sr-only">hidden</span></p><table><tbody><tr><td>1</td></tr></tbody></table>' +
      '<figure><figcaption>Fig</figcaption></figure><span class="bb-math" data-latex="x" data-alt="x">x</span>';
    expect(sanitize(html)).toBe(html);
  });

  it('is idempotent', () => {
    const messy = '<p style="text-align:left;color:red">a<b>b</p><svg width="5"><use href="#z"/></svg><i>c';
    const once = sanitize(messy);
    expect(sanitize(once)).toBe(once);
  });

  it('handles empty and non-markup input', () => {
    expect(sanitize('')).toBe('');
    // DOMPurify returns tag-free input unchanged; it is still safe to assign as innerHTML.
    expect(sanitize('just text & more')).toBe('just text & more');
    expect(sanitize('<p>a & b</p>')).toBe('<p>a &amp; b</p>');
  });
});
