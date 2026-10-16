import { describe, expect, it } from 'vitest';
import { parseSession } from '../../../server/validate';
import type { DrillConfig } from '../../types/drill';
import type { Annotation } from '../../types/session';
import { abandon, createSession, progressOf, setAnnotations } from './record';

const config: DrillConfig = { section: 'rw', domainCode: 'CAS', skillCodes: ['WIC'], difficulties: ['E'], count: 2, liveOnly: true };
const mark: Annotation = { id: 'a1', target: 'passage', start: 3, end: 9, style: 'yellow', note: '' };

describe('highlights on question progress', () => {
  it('are stored per question and survive the server check', () => {
    const s = setAnnotations(createSession('s', 'drill', config, ['q1', 'q2'], 0), 'q1', [mark, { ...mark, id: 'a2', style: 'underline', note: 'why' }], 5);
    expect(progressOf(s, 'q1').annotations).toHaveLength(2);
    expect(progressOf(s, 'q2').annotations).toBeUndefined();
    expect(parseSession(JSON.parse(JSON.stringify(s)))).not.toBeNull();
  });

  it('are not changed in a closed session', () => {
    const closed = abandon(createSession('s', 'drill', config, ['q1'], 0), 1);
    expect(setAnnotations(closed, 'q1', [mark], 2)).toBe(closed);
  });

  it('a record without them is still valid (older sessions)', () => {
    expect(parseSession(JSON.parse(JSON.stringify(createSession('s', 'drill', config, ['q1'], 0))))).not.toBeNull();
  });

  it('the server rejects bad highlights', () => {
    const base = createSession('s', 'drill', config, ['q1'], 0);
    for (const bad of [
      { ...mark, start: 9, end: 3 },
      { ...mark, style: 'green' },
      { ...mark, target: 'choice' },
      { ...mark, note: 'x'.repeat(1001) },
      { ...mark, start: 1.5 },
    ]) {
      const rec = JSON.parse(JSON.stringify(base));
      rec.progress.q1.annotations = [bad];
      expect(parseSession(rec)).toBeNull();
    }
  });
});
