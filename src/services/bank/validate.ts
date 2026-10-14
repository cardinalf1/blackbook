import {
  BANK_SCHEMA_VERSION,
  CHOICE_LETTERS,
  DIFFICULTIES,
  SECTIONS,
  type Answer,
  type ChoiceLetter,
  type Difficulty,
  type Question,
  type Section,
  type SkippedQuestion,
} from '../../types/sat';

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function includes<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

function validateAnswer(v: unknown, errors: string[]): Answer | null {
  if (!isObj(v)) {
    errors.push('answer: not an object');
    return null;
  }
  if (v.kind === 'mcq') {
    const { choices, correct, keyOrigin } = v;
    if (!Array.isArray(choices) || choices.length !== 4 || !choices.every((c) => typeof c === 'string')) {
      errors.push('answer.choices: must be 4 strings');
      return null;
    }
    if (!includes<ChoiceLetter>(CHOICE_LETTERS, correct)) {
      errors.push('answer.correct: must be A-D');
      return null;
    }
    if (keyOrigin !== 'structured' && keyOrigin !== 'rationale') {
      errors.push('answer.keyOrigin: must be structured or rationale');
      return null;
    }
    const [a, b, c, d] = choices as string[];
    return { kind: 'mcq', choices: [a ?? '', b ?? '', c ?? '', d ?? ''], correct, keyOrigin };
  }
  if (v.kind === 'spr') {
    const { accepted } = v;
    if (!Array.isArray(accepted) || accepted.length === 0 || !accepted.every(isNonEmptyString)) {
      errors.push('answer.accepted: must be a non-empty array of non-empty strings');
      return null;
    }
    return { kind: 'spr', accepted: [...accepted] };
  }
  errors.push('answer.kind: must be mcq or spr');
  return null;
}

/** Validates one normalized question. Does not sanitize HTML; callers do that separately. */
export function validateQuestion(v: unknown): Result<Question> {
  const errors: string[] = [];
  if (!isObj(v)) return { ok: false, errors: ['question: not an object'] };

  const str = (key: string): string => {
    const x = v[key];
    if (!isNonEmptyString(x)) {
      errors.push(`${key}: must be a non-empty string`);
      return '';
    }
    return x;
  };

  const id = str('id');
  const displayId = str('displayId');
  const domainCode = str('domainCode');
  const domain = str('domain');
  const skillCode = str('skillCode');
  const skill = str('skill');
  const stemHtml = str('stemHtml');
  const rationaleHtml = str('rationaleHtml');

  const { source, section, difficulty, scoreBand, active, stimulusHtml, updatedAt } = v;
  if (source !== 'digital' && source !== 'legacy') errors.push('source: must be digital or legacy');
  if (!includes<Section>(SECTIONS, section)) errors.push('section: must be rw or math');
  if (!includes<Difficulty>(DIFFICULTIES, difficulty)) errors.push('difficulty: must be E, M or H');
  if (typeof scoreBand !== 'number' || !Number.isInteger(scoreBand) || scoreBand < 1 || scoreBand > 7) {
    errors.push('scoreBand: must be an integer 1-7');
  }
  if (typeof active !== 'boolean') errors.push('active: must be boolean');
  if (stimulusHtml !== null && typeof stimulusHtml !== 'string') errors.push('stimulusHtml: must be string or null');
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) errors.push('updatedAt: must be a number');

  const answer = validateAnswer(v.answer, errors);

  if (errors.length > 0 || answer === null) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id,
      source: source as Question['source'],
      displayId,
      section: section as Section,
      domainCode,
      domain,
      skillCode,
      skill,
      difficulty: difficulty as Difficulty,
      scoreBand: scoreBand as number,
      active: active as boolean,
      stimulusHtml: stimulusHtml as string | null,
      stemHtml,
      answer,
      rationaleHtml,
      updatedAt: updatedAt as number,
    },
  };
}

export interface BankValidation {
  fetchedAt: string;
  questions: Question[];
  skipped: SkippedQuestion[];
  /** Questions that failed validation, with their index in the file and the reasons. */
  invalid: { index: number; id: string | null; errors: string[] }[];
}

/** Validates a parsed bank file. Fails as a whole only if the envelope is wrong; bad questions are reported individually. */
export function validateBank(v: unknown): Result<BankValidation> {
  if (!isObj(v)) return { ok: false, errors: ['file: not a JSON object'] };
  if (v.schemaVersion !== BANK_SCHEMA_VERSION) {
    return { ok: false, errors: [`schemaVersion: expected ${BANK_SCHEMA_VERSION}, got ${JSON.stringify(v.schemaVersion)}`] };
  }
  if (!isNonEmptyString(v.fetchedAt)) return { ok: false, errors: ['fetchedAt: must be a non-empty string'] };
  if (!Array.isArray(v.questions)) return { ok: false, errors: ['questions: must be an array'] };

  const questions: Question[] = [];
  const invalid: BankValidation['invalid'] = [];
  const seen = new Set<string>();
  v.questions.forEach((q: unknown, index) => {
    const r = validateQuestion(q);
    const rawId = isObj(q) && typeof q.id === 'string' ? q.id : null;
    if (!r.ok) {
      invalid.push({ index, id: rawId, errors: r.errors });
    } else if (seen.has(r.value.id)) {
      invalid.push({ index, id: r.value.id, errors: ['id: duplicate'] });
    } else {
      seen.add(r.value.id);
      questions.push(r.value);
    }
  });

  const skipped: SkippedQuestion[] = Array.isArray(v.skipped)
    ? v.skipped.filter((s): s is SkippedQuestion => isObj(s) && isNonEmptyString(s.id) && isNonEmptyString(s.reason))
    : [];

  return { ok: true, value: { fetchedAt: v.fetchedAt, questions, skipped, invalid } };
}
