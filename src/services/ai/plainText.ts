// Question HTML to plain text for an AI request: images and drawings are skipped, math keeps its
// visible characters, whitespace is collapsed, and the result is cut to a length.

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', minus: '-', times: 'x' };

export function htmlToPlain(html: string | null, max: number): string {
  if (!html) return '';
  let s = html
    .replace(/<(script|style|svg|annotation|annotation-xml)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<img\b[^>]*>/gi, ' [image] ')
    .replace(/<(br|\/p|\/div|\/li|\/tr)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > max) s = `${s.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
  return s;
}
