import { describe, expect, it } from 'vitest';
import { splitFigures } from './figures';

describe('splitFigures', () => {
  it('leaves HTML without figures whole', () => {
    expect(splitFigures('<p>a &amp; b</p>')).toEqual([{ kind: 'html', html: '<p>a &amp; b</p>' }]);
  });

  it('pulls out top-level figures with a drawing, keeping text around them in order', () => {
    const html = '<p>Before</p><figure class="image"><svg viewBox="0 0 1 1"><line x1="0" y1="0" x2="1" y2="1"></line></svg></figure><p>After &lt;x&gt;</p>';
    const out = splitFigures(html);
    expect(out.map((s) => s.kind)).toEqual(['html', 'figure', 'html']);
    expect(out[0]?.html).toBe('<p>Before</p>');
    expect(out[1]?.html).toContain('<svg');
    expect(out[2]?.html).toBe('<p>After &lt;x&gt;</p>');
  });

  it('keeps table figures and nested figures in the text', () => {
    const table = '<figure class="table"><table><tbody><tr><td>1</td></tr></tbody></table></figure>';
    const nested = '<div><figure><svg></svg></figure></div>';
    expect(splitFigures(table + nested)).toEqual([{ kind: 'html', html: table + nested }]);
  });

  it('frames a figure holding an image', () => {
    const out = splitFigures('<figure><img alt="graph" src="data:image/png;base64,AAAA"></figure>');
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe('figure');
  });
});
