// Raw College Board question bank API shapes and guards. Observed shapes are recorded in
// docs/api-notes.md. Guards check only the fields we use; anything else is ignored.

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export interface RawListRow {
  questionId: string;
  external_id: string | null;
  ibn: string | null;
  primary_class_cd: string;
  primary_class_cd_desc: string;
  skill_cd: string;
  skill_desc: string;
  difficulty: 'E' | 'M' | 'H';
  score_band_range_cd: number;
  updateDate: number;
}

export interface RawLookup {
  readingLiveItems: string[];
  mathLiveItems: string[];
}

export interface RawDigitalDetail {
  type: 'mcq' | 'spr';
  stimulus?: string;
  stem: string;
  answerOptions?: { id: string; content: string }[];
  correct_answer: string[];
  keys?: string[];
  rationale: string;
}

export interface RawLegacyDetail {
  item_id: string;
  body?: string;
  prompt: string;
  answer: {
    style: string;
    choices?: Record<string, { body: string }>;
    correct_choice?: string;
    rationale: string;
  };
}

export type GuardResult<T> = { ok: true; value: T } | { ok: false; problem: string };

const str = (v: unknown): v is string => typeof v === 'string';
const strArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(str);

/** The id to request details with: external_id for digital rows, ibn for legacy rows. */
export function rowId(row: RawListRow): string {
  return row.external_id ?? row.ibn ?? '';
}

export function guardListRow(v: unknown): GuardResult<RawListRow> {
  if (!isObj(v)) return { ok: false, problem: 'row is not an object' };
  const missing: string[] = [];
  for (const k of ['questionId', 'primary_class_cd', 'primary_class_cd_desc', 'skill_cd', 'skill_desc'] as const) {
    if (!str(v[k]) || v[k] === '') missing.push(k);
  }
  if (!['E', 'M', 'H'].includes(v.difficulty as string)) missing.push('difficulty');
  if (typeof v.score_band_range_cd !== 'number') missing.push('score_band_range_cd');
  if (typeof v.updateDate !== 'number') missing.push('updateDate');
  const ext = str(v.external_id) && v.external_id !== '' ? v.external_id : null;
  const ibn = str(v.ibn) && v.ibn !== '' ? v.ibn : null;
  if ((ext === null) === (ibn === null)) missing.push('exactly one of external_id/ibn');
  if (missing.length > 0) return { ok: false, problem: `list row missing or invalid: ${missing.join(', ')}` };
  return {
    ok: true,
    value: {
      questionId: v.questionId as string,
      external_id: ext,
      ibn,
      primary_class_cd: v.primary_class_cd as string,
      primary_class_cd_desc: v.primary_class_cd_desc as string,
      skill_cd: v.skill_cd as string,
      skill_desc: v.skill_desc as string,
      difficulty: v.difficulty as RawListRow['difficulty'],
      score_band_range_cd: v.score_band_range_cd as number,
      updateDate: v.updateDate as number,
    },
  };
}

export function guardLookup(v: unknown): GuardResult<RawLookup> {
  if (!isObj(v) || !strArray(v.readingLiveItems) || !strArray(v.mathLiveItems)) {
    return { ok: false, problem: 'lookup missing readingLiveItems/mathLiveItems' };
  }
  return { ok: true, value: { readingLiveItems: v.readingLiveItems, mathLiveItems: v.mathLiveItems } };
}

export function isLegacyDetail(v: unknown): boolean {
  return isObj(v) && 'item_id' in v;
}

export function guardDigitalDetail(v: unknown): GuardResult<RawDigitalDetail> {
  if (!isObj(v)) return { ok: false, problem: 'detail is not an object' };
  const missing: string[] = [];
  if (v.type !== 'mcq' && v.type !== 'spr') missing.push('type');
  if (!str(v.stem)) missing.push('stem');
  if (!str(v.rationale)) missing.push('rationale');
  if (!strArray(v.correct_answer)) missing.push('correct_answer');
  if (v.stimulus !== undefined && v.stimulus !== null && !str(v.stimulus)) missing.push('stimulus');
  if (v.keys !== undefined && !strArray(v.keys)) missing.push('keys');
  const opts = v.answerOptions;
  if (opts !== undefined && opts !== null) {
    if (!Array.isArray(opts) || !opts.every((o) => isObj(o) && str(o.id) && str(o.content))) missing.push('answerOptions');
  }
  if (missing.length > 0) return { ok: false, problem: `digital detail missing or invalid: ${missing.join(', ')}` };
  return {
    ok: true,
    value: {
      type: v.type as RawDigitalDetail['type'],
      stimulus: str(v.stimulus) ? v.stimulus : undefined,
      stem: v.stem as string,
      answerOptions: Array.isArray(opts) ? (opts as { id: string; content: string }[]) : undefined,
      correct_answer: v.correct_answer as string[],
      keys: strArray(v.keys) ? v.keys : undefined,
      rationale: v.rationale as string,
    },
  };
}

export function guardLegacyDetail(v: unknown): GuardResult<RawLegacyDetail> {
  if (!isObj(v)) return { ok: false, problem: 'detail is not an object' };
  const missing: string[] = [];
  if (!str(v.item_id)) missing.push('item_id');
  if (!str(v.prompt)) missing.push('prompt');
  if (v.body !== undefined && v.body !== null && !str(v.body)) missing.push('body');
  const a = v.answer;
  if (!isObj(a)) missing.push('answer');
  else {
    if (!str(a.style)) missing.push('answer.style');
    if (!str(a.rationale)) missing.push('answer.rationale');
    if (a.correct_choice !== undefined && !str(a.correct_choice)) missing.push('answer.correct_choice');
    if (a.choices !== undefined && !(isObj(a.choices) && Object.values(a.choices).every((c) => isObj(c) && str(c.body)))) {
      missing.push('answer.choices');
    }
  }
  if (missing.length > 0 || !isObj(a)) return { ok: false, problem: `legacy detail missing or invalid: ${missing.join(', ')}` };
  return {
    ok: true,
    value: {
      item_id: v.item_id as string,
      body: str(v.body) ? v.body : undefined,
      prompt: v.prompt as string,
      answer: {
        style: a.style as string,
        choices: a.choices as Record<string, { body: string }> | undefined,
        correct_choice: a.correct_choice as string | undefined,
        rationale: a.rationale as string,
      },
    },
  };
}
