// Builds the end-of-session report and the Past drills rows. Pure: everything comes in as
// arguments. Only used for finished sessions, so showing correctness here is allowed.

import type { QuestionFacet } from '../../types/drill';
import type { Question } from '../../types/sat';
import type { BreakdownRow, InProgressRow, PastSessionRow, ReportItem, SessionRecord, SessionReport, StoredAttempt } from '../../types/session';
import { isCorrect } from '../answers';

const SECTION_LABEL = { rw: 'Reading and Writing', math: 'Math' } as const;
const DIFFICULTY_LABEL = { E: 'Easy', M: 'Medium', H: 'Hard' } as const;

function correctAnswerText(q: Question): string {
  return q.answer.kind === 'mcq' ? q.answer.correct : q.answer.accepted.join(', ');
}

function breakdown(items: readonly ReportItem[], key: (i: ReportItem) => { code: string; label: string }): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();
  for (const it of items) {
    const k = key(it);
    const r = rows.get(k.code) ?? { code: k.code, label: k.label, correct: 0, total: 0, activeMs: 0 };
    r.total++;
    if (it.correct) r.correct++;
    r.activeMs += it.activeMs;
    rows.set(k.code, r);
  }
  return [...rows.values()].sort((a, b) => a.correct / a.total - b.correct / b.total || a.label.localeCompare(b.label));
}

/**
 * Grades from the bank when the question is still there, otherwise from the stored attempt.
 * Unanswered questions count as wrong, matching the session score.
 */
export function buildReport(
  session: SessionRecord,
  questions: ReadonlyMap<string, Question>,
  attempts: readonly StoredAttempt[],
): SessionReport {
  const byQuestion = new Map(attempts.filter((a) => a.sessionId === session.id).map((a) => [a.questionId, a]));
  const items: ReportItem[] = session.queueIds.map((id, index) => {
    const p = session.progress[id];
    const q = questions.get(id) ?? null;
    const a = byQuestion.get(id);
    const response = p?.response ?? null;
    const correct = response === null ? false : q ? isCorrect(q.answer, response) : (a?.correct ?? false);
    return {
      index,
      questionId: id,
      displayId: q?.displayId ?? id,
      section: q?.section ?? session.config.section,
      domain: q?.domain ?? '',
      skill: q?.skill ?? '',
      difficulty: q?.difficulty ?? 'M',
      response,
      correct,
      correctAnswer: q ? correctAnswerText(q) : '',
      activeMs: p?.activeMs ?? 0,
      firstVisitMs: p?.firstVisitMs ?? null,
      flagged: p?.flagged ?? false,
      changes: p?.changes ?? 0,
      confidence: p?.confidence ?? null,
      question: q,
    };
  });
  return {
    sessionId: session.id,
    mode: session.mode,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    score: { correct: items.filter((i) => i.correct).length, total: items.length },
    totalActiveMs: items.reduce((s, i) => s + i.activeMs, 0),
    items,
    byDomain: breakdown(items, (i) => ({ code: i.question?.domainCode ?? 'unknown', label: i.domain || 'Not in bank' })),
    bySkill: breakdown(items, (i) => ({ code: i.question?.skillCode ?? 'unknown', label: i.skill || 'Not in bank' })),
  };
}

/** "Algebra · 2 skills · Hard · live only", worded from the setup filters. */
export function filtersLabel(session: SessionRecord, facets: readonly QuestionFacet[]): string {
  const c = session.config;
  const parts: string[] = [];
  if (c.domainCode === 'all') parts.push('All domains');
  else parts.push(facets.find((f) => f.domainCode === c.domainCode)?.domain ?? c.domainCode);
  if (c.skillCodes.length === 1) parts.push(facets.find((f) => f.skillCode === c.skillCodes[0])?.skill ?? (c.skillCodes[0] as string));
  else if (c.skillCodes.length > 1) parts.push(`${c.skillCodes.length} skills`);
  if (c.difficulties.length > 0 && c.difficulties.length < 3) parts.push(c.difficulties.map((d) => DIFFICULTY_LABEL[d]).join(', '));
  if (c.liveOnly) parts.push('live only');
  return parts.join(' · ');
}

const TEST_KIND_LABEL = { full: 'Full test', rw: 'Reading and Writing section', math: 'Math section' } as const;

export function kindLabel(session: SessionRecord): string {
  if (session.test) return TEST_KIND_LABEL[session.test.kind];
  if (session.mode === 'exam') return 'Exam module';
  return session.source === 'browse' ? 'Single question' : 'Drill';
}

/** Modules of a test belong to its container record and are not listed on their own. */
const standalone = (s: SessionRecord) => s.exam?.testId === undefined;

function testProgress(s: SessionRecord): string {
  const t = s.test;
  if (!t) return '';
  const modules = t.steps.filter((x) => x.type === 'module').length;
  const step = t.steps[t.stepIndex];
  if (step?.type === 'break') return 'On the break';
  const done = t.steps.slice(0, t.stepIndex).filter((x) => x.type === 'module').length;
  return `Module ${Math.min(done + 1, modules)} of ${modules}`;
}

function testSectionLabel(s: SessionRecord): string {
  const k = s.test?.kind;
  return k === 'full' ? 'Reading and Writing, Math' : k ? SECTION_LABEL[k] : SECTION_LABEL[s.config.section];
}

/** Unfinished sessions for the In progress list, newest activity first. */
export function inProgressRows(sessions: readonly SessionRecord[], facets: readonly QuestionFacet[]): InProgressRow[] {
  return sessions
    .filter((s) => s.status === 'in_progress' && standalone(s))
    .map((s) => ({
      id: s.id,
      kindLabel: kindLabel(s),
      sectionLabel: s.test ? testSectionLabel(s) : SECTION_LABEL[s.config.section],
      filtersLabel: s.test ? (s.test.paused ? 'Emergency pause used' : 'Timed, adaptive second module') : filtersLabel(s, facets),
      answered: s.queueIds.filter((id) => s.progress[id]?.response != null).length,
      total: s.queueIds.length,
      activeMs: s.totalActiveMs,
      lastActivityAt: s.lastActivityAt,
      ...(s.test ? { progressLabel: testProgress(s), isTest: true } : {}),
    }))
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}

/** Finished sessions only, newest finish first. */
export function pastSessionRows(sessions: readonly SessionRecord[], facets: readonly QuestionFacet[]): PastSessionRow[] {
  return sessions
    .filter((s) => s.status === 'finished' && standalone(s))
    .map((s) => ({
      id: s.id,
      finishedAt: s.finishedAt ?? s.lastActivityAt,
      sectionLabel: s.test ? testSectionLabel(s) : SECTION_LABEL[s.config.section],
      filtersLabel: s.test ? (s.test.paused ? 'Emergency pause used' : 'Timed, adaptive second module') : filtersLabel(s, facets),
      kindLabel: kindLabel(s),
      correct: s.score?.correct ?? 0,
      total: s.score?.total ?? s.queueIds.length,
      totalActiveMs: s.totalActiveMs,
      ...(s.test ? { isTest: true } : {}),
    }))
    .sort((a, b) => b.finishedAt - a.finishedAt);
}
