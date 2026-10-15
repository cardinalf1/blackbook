import { describe, expect, it } from 'vitest';
import type { DrillConfig } from '../../types/drill';
import type { SessionRecord } from '../../types/session';
import { newSlot, newTest, specFor, advance } from '../test/flow';
import { startTimer } from '../exam/timer';
import { createSession } from './record';
import { inProgressRows, kindLabel, pastSessionRows } from './report';

const config: DrillConfig = { section: 'rw', domainCode: 'all', skillCodes: [], difficulties: [], count: 0, liveOnly: true };
const container = (kind: 'full' | 'rw' | 'math', over: Partial<SessionRecord> = {}): SessionRecord => ({
  ...createSession(`t-${kind}`, 'exam', config, [], 1000, 'exam'),
  test: newTest(kind, false, [newSlot(specFor(kind === 'math' ? 'math' : 'rw', 1, 'routing'), ['a'], [])]),
  ...over,
});
const moduleOf = (testId: string): SessionRecord => ({
  ...createSession('m1', 'exam', config, ['a'], 1000, 'exam'),
  exam: { module: specFor('rw', 1, 'routing'), timer: startTimer(1000, 0), pauses: [], phase: 'in_progress', submittedBy: null, timerHidden: false, fiveMinuteAlertShown: false, assemblyNotes: [], testId },
});

describe('tests in the In progress and Past drills lists', () => {
  it('labels the three kinds', () => {
    expect(kindLabel(container('full'))).toBe('Full test');
    expect(kindLabel(container('rw'))).toBe('Reading and Writing section');
    expect(kindLabel(container('math'))).toBe('Math section');
    expect(kindLabel(moduleOf('x'))).toBe('Exam module');
  });

  it('lists the test once and hides its module sessions', () => {
    const rows = inProgressRows([container('full'), moduleOf('t-full')], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 't-full', kindLabel: 'Full test', isTest: true, progressLabel: 'Module 1 of 4' });
  });

  it('says so when the test is on its break', () => {
    const t = container('full');
    const test = t.test as NonNullable<SessionRecord['test']>;
    const onBreak = { ...t, test: advance(advance(test, 5), 6) };
    expect(inProgressRows([onBreak], [])[0]?.progressLabel).toBe('On the break');
  });

  it('finished tests appear in Past drills, their modules do not; a lone exam module still does', () => {
    const done = { ...container('rw'), status: 'finished' as const, finishedAt: 5000, score: { correct: 30, total: 54 } };
    const lone = { ...moduleOf('x'), id: 'lone', exam: { ...moduleOf('x').exam!, testId: undefined }, status: 'finished' as const, finishedAt: 4000 };
    const mod = { ...moduleOf('t-rw'), status: 'finished' as const, finishedAt: 4500 };
    const rows = pastSessionRows([done, lone, mod], []);
    expect(rows.map((r) => r.id)).toEqual(['t-rw', 'lone']);
    expect(rows[0]).toMatchObject({ kindLabel: 'Reading and Writing section', isTest: true, correct: 30, total: 54 });
  });
});
