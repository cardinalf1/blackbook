// Maps raw list rows + detail responses to normalized Questions. Pure: HTML handling is injected.

import { CHOICE_LETTERS, type ChoiceLetter, type Question, type Section } from '../../types/sat';
import {
  guardDigitalDetail,
  guardLegacyDetail,
  isLegacyDetail,
  rowId,
  type RawDigitalDetail,
  type RawLegacyDetail,
  type RawListRow,
} from './raw';

/** Turns one raw HTML field into final HTML. `field` is unique within the question (e.g. "stem", "c2"). */
export type HtmlProcessor = (html: string, questionId: string, field: string) => string;

export interface MapContext {
  section: Section;
  /** Ids in the bank's live/active arrays. */
  activeIds: ReadonlySet<string>;
  /** Canonical skill name per skill_cd. */
  skillNames: ReadonlyMap<string, string>;
  html: HtmlProcessor;
  /** Plain text of an HTML fragment, used to read rationale prose. */
  textOf: (html: string) => string;
}

export type MapResult =
  | { ok: true; question: Question; keyFromRationale: boolean }
  | { ok: false; reason: SkipReason; detail?: string };

export type SkipReason =
  | 'detail-shape'
  | 'empty-stem'
  | 'mcq-options'
  | 'mcq-key-invalid'
  | 'mcq-key-mismatch'
  | 'mcq-key-conflicts-rationale'
  | 'legacy-mcq-no-key'
  | 'legacy-spr-no-key'
  | 'legacy-unknown-style'
  | 'spr-no-answer';

const CHOICE_IS_CORRECT = /\bChoice ([A-D]) is correct\b/g;

/** Returns the letter if the text says "Choice X is correct" exactly once, else null. */
export function choiceFromRationale(text: string): ChoiceLetter | null {
  const matches = [...text.matchAll(CHOICE_IS_CORRECT)];
  if (matches.length !== 1) return null;
  const letter = matches[0]?.[1];
  return letter !== undefined && (CHOICE_LETTERS as readonly string[]).includes(letter) ? (letter as ChoiceLetter) : null;
}

function toLetter(v: string | undefined): ChoiceLetter | null {
  const up = (v ?? '').trim().toUpperCase();
  return (CHOICE_LETTERS as readonly string[]).includes(up) ? (up as ChoiceLetter) : null;
}

function base(row: RawListRow, ctx: MapContext): Omit<Question, 'source' | 'stimulusHtml' | 'stemHtml' | 'answer' | 'rationaleHtml'> {
  const id = rowId(row);
  return {
    id,
    displayId: row.questionId,
    section: ctx.section,
    domainCode: row.primary_class_cd,
    domain: row.primary_class_cd_desc,
    skillCode: row.skill_cd,
    skill: ctx.skillNames.get(row.skill_cd) ?? row.skill_desc,
    difficulty: row.difficulty,
    scoreBand: row.score_band_range_cd,
    active: ctx.activeIds.has(id),
    updatedAt: row.updateDate,
  };
}

/** True when the HTML has no text and no image, graph or math. */
function isBlank(html: string, ctx: MapContext): boolean {
  return ctx.textOf(html).trim() === '' && !/<(img|svg|math)/.test(html);
}

/** If the rationale names exactly one correct choice, it must agree with the structured key. */
function conflictsWithRationale(correct: ChoiceLetter, rationaleText: string): boolean {
  const said = choiceFromRationale(rationaleText);
  return said !== null && said !== correct;
}

function mapDigital(row: RawListRow, d: RawDigitalDetail, ctx: MapContext): MapResult {
  const id = rowId(row);
  const stemHtml = ctx.html(d.stem, id, 'stem');
  if (isBlank(stemHtml, ctx)) return { ok: false, reason: 'empty-stem' };
  const stimulusHtml = d.stimulus && d.stimulus.trim() !== '' ? ctx.html(d.stimulus, id, 'stimulus') : null;
  const rationaleHtml = ctx.html(d.rationale, id, 'rationale');

  if (d.type === 'spr') {
    const accepted = d.correct_answer.map((a) => a.trim()).filter((a) => a !== '');
    if (accepted.length === 0) return { ok: false, reason: 'spr-no-answer' };
    return {
      ok: true,
      keyFromRationale: false,
      question: { ...base(row, ctx), source: 'digital', stimulusHtml, stemHtml, rationaleHtml, answer: { kind: 'spr', accepted } },
    };
  }

  const opts = d.answerOptions ?? [];
  if (opts.length !== 4) return { ok: false, reason: 'mcq-options', detail: `${opts.length} options` };
  if (d.correct_answer.length !== 1) return { ok: false, reason: 'mcq-key-invalid', detail: `${d.correct_answer.length} keys` };
  const correct = toLetter(d.correct_answer[0]);
  if (correct === null) return { ok: false, reason: 'mcq-key-invalid' };
  // keys[0] is the id of the correct option; it must point at the same letter.
  const keyId = d.keys?.[0];
  if (keyId !== undefined) {
    const idx = opts.findIndex((o) => o.id === keyId);
    if (idx !== CHOICE_LETTERS.indexOf(correct)) return { ok: false, reason: 'mcq-key-mismatch' };
  }
  if (conflictsWithRationale(correct, ctx.textOf(rationaleHtml))) return { ok: false, reason: 'mcq-key-conflicts-rationale' };
  const choices = opts.map((o, i) => ctx.html(o.content, id, `c${i}`)) as [string, string, string, string];
  return {
    ok: true,
    keyFromRationale: false,
    question: {
      ...base(row, ctx),
      source: 'digital',
      stimulusHtml,
      stemHtml,
      rationaleHtml,
      answer: { kind: 'mcq', choices, correct, keyOrigin: 'structured' },
    },
  };
}

function mapLegacy(row: RawListRow, d: RawLegacyDetail, ctx: MapContext): MapResult {
  const id = rowId(row);
  const style = d.answer.style.trim().toLowerCase();
  if (style === 'spr') {
    // Legacy SPR answers exist only in prose. Pulling numbers out of prose is not trusted.
    return { ok: false, reason: 'legacy-spr-no-key' };
  }
  if (style !== 'multiple choice') return { ok: false, reason: 'legacy-unknown-style', detail: d.answer.style };

  const stemHtml = ctx.html(d.prompt, id, 'stem');
  if (isBlank(stemHtml, ctx)) return { ok: false, reason: 'empty-stem' };
  const raw = d.answer.choices ?? {};
  const keys = ['a', 'b', 'c', 'd'];
  if (Object.keys(raw).length !== 4 || !keys.every((k) => raw[k] !== undefined)) {
    return { ok: false, reason: 'mcq-options', detail: Object.keys(raw).join(',') };
  }
  const rationaleHtml = ctx.html(d.answer.rationale, id, 'rationale');
  const rationaleText = ctx.textOf(rationaleHtml);

  let correct: ChoiceLetter | null;
  let keyFromRationale = false;
  if (d.answer.correct_choice !== undefined) {
    correct = toLetter(d.answer.correct_choice);
    if (correct === null) return { ok: false, reason: 'mcq-key-invalid', detail: d.answer.correct_choice };
    if (conflictsWithRationale(correct, rationaleText)) return { ok: false, reason: 'mcq-key-conflicts-rationale' };
  } else {
    correct = choiceFromRationale(rationaleText);
    if (correct === null) return { ok: false, reason: 'legacy-mcq-no-key' };
    keyFromRationale = true;
  }

  const choices = keys.map((k, i) => ctx.html(raw[k]?.body ?? '', id, `c${i}`)) as [string, string, string, string];
  return {
    ok: true,
    keyFromRationale,
    question: {
      ...base(row, ctx),
      source: 'legacy',
      stimulusHtml: d.body && d.body.trim() !== '' ? ctx.html(d.body, id, 'stimulus') : null,
      stemHtml,
      rationaleHtml,
      answer: { kind: 'mcq', choices, correct, keyOrigin: keyFromRationale ? 'rationale' : 'structured' },
    },
  };
}

/** Maps one list row and its raw detail response. Never throws on bad data; returns a skip reason instead. */
export function toQuestion(row: RawListRow, detail: unknown, ctx: MapContext): MapResult {
  if (row.ibn !== null || isLegacyDetail(detail)) {
    const g = guardLegacyDetail(detail);
    return g.ok ? mapLegacy(row, g.value, ctx) : { ok: false, reason: 'detail-shape', detail: g.problem };
  }
  const g = guardDigitalDetail(detail);
  return g.ok ? mapDigital(row, g.value, ctx) : { ok: false, reason: 'detail-shape', detail: g.problem };
}

/** Removes duplicate ids, keeping the row with the newest updateDate. Order of first appearance is kept. */
export function dedupeRows(rows: readonly RawListRow[]): RawListRow[] {
  const best = new Map<string, RawListRow>();
  for (const r of rows) {
    const id = rowId(r);
    const prev = best.get(id);
    if (prev === undefined || r.updateDate > prev.updateDate) best.set(id, r);
  }
  return [...best.values()];
}

/** Canonical skill name per skill_cd: the most common skill_desc (the API has casing variants). */
export function canonicalSkillNames(rows: readonly RawListRow[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const m = counts.get(r.skill_cd) ?? new Map<string, number>();
    m.set(r.skill_desc, (m.get(r.skill_desc) ?? 0) + 1);
    counts.set(r.skill_cd, m);
  }
  const out = new Map<string, string>();
  for (const [cd, m] of counts) {
    const [name] = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [''];
    out.set(cd, name);
  }
  return out;
}
