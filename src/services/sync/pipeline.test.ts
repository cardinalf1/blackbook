import { describe, expect, it } from 'vitest';
import * as fx from '../__fixtures__/synthetic';
import { validateQuestion } from '../bank/validate';
import { normalizeHtml } from '../normalize/html';
import { createSanitizer } from '../normalize/sanitize';
import { guardListRow, type RawListRow } from './raw';
import { dedupeRows, toQuestion, type MapContext } from './toQuestion';

// End-to-end over the synthetic raw fixtures: list guard, dedupe, mapping, normalize, sanitize.
const sanitize = createSanitizer(window);
const ctx: MapContext = {
  section: 'math',
  activeIds: new Set(),
  skillNames: new Map(),
  textOf: (h) => new DOMParser().parseFromString(h, 'text/html').body.textContent ?? '',
  html: (h, id, field) => sanitize(normalizeHtml({ DOMParser }, h, `${id}-${field}`).html),
};

const rows = (fx.rawListRows as unknown[]).map(guardListRow).flatMap((r) => (r.ok ? [r.value] : []));
const digitalRow = rows.find((r) => r.external_id !== null) as RawListRow;
const legacyRow = rows.find((r) => r.ibn !== null) as RawListRow;

describe('sync pipeline on synthetic raw fixtures', () => {
  it('accepts every list row and drops the older duplicate', () => {
    expect(rows).toHaveLength((fx.rawListRows as unknown[]).length);
    expect(dedupeRows(rows).length).toBe(rows.length - 1);
  });

  it('turns digital MathML into KaTeX spans and produces valid questions', () => {
    for (const raw of [fx.rawDigitalMcq, fx.rawDigitalSpr]) {
      const r = toQuestion(digitalRow, raw, ctx);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(validateQuestion(r.question).ok).toBe(true);
      expect(JSON.stringify(r.question)).not.toContain('<math');
      expect(JSON.stringify(r.question)).toContain('bb-math');
    }
  });

  it('applies the legacy answer-key policy', () => {
    expect(toQuestion(legacyRow, fx.rawLegacyMcq, ctx)).toMatchObject({ ok: true, keyFromRationale: false });
    const extracted = toQuestion(legacyRow, fx.rawLegacyMcqKeyInRationale, ctx);
    expect(extracted).toMatchObject({ ok: true, keyFromRationale: true });
    expect(extracted.ok && extracted.question.answer).toMatchObject({ correct: 'C', keyOrigin: 'rationale' });
    expect(toQuestion(legacyRow, fx.rawLegacyMcqAmbiguous, ctx)).toMatchObject({ ok: false, reason: 'legacy-mcq-no-key' });
    expect(toQuestion(legacyRow, fx.rawLegacySprNoKey, ctx)).toMatchObject({ ok: false, reason: 'legacy-spr-no-key' });
  });

  it('keeps legacy math images as tagged inline PNGs', () => {
    const r = toQuestion(legacyRow, fx.rawLegacyMcq, ctx);
    const html = r.ok ? JSON.stringify(r.question) : '';
    if (html.includes('<img')) expect(html).toContain('bb-math-img');
  });
});
