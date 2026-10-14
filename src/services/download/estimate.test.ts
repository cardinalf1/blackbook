import { describe, expect, it } from 'vitest';
import { describeSkips, estimateDownload } from './estimate';

describe('estimateDownload', () => {
  it('scales with sections and the live-set choice', () => {
    const live = estimateDownload({ sections: ['rw', 'math'], liveOnly: true });
    const all = estimateDownload({ sections: ['rw', 'math'], liveOnly: false });
    expect(live).toEqual({ questions: 2019, requests: 2022, minutes: 12 });
    expect(all.questions).toBe(3767);
    expect(all.requests).toBe(3770);
    expect(all.minutes).toBeGreaterThan(live.minutes);
    expect(estimateDownload({ sections: ['math'], liveOnly: true }).requests).toBe(929);
    expect(estimateDownload({ sections: [], liveOnly: true })).toEqual({ questions: 0, requests: 0, minutes: 0 });
  });
});

describe('describeSkips', () => {
  it('groups reasons, strips details and sorts largest first', () => {
    const lines = describeSkips([
      { reason: 'legacy-spr-no-key' },
      { reason: 'legacy-spr-no-key' },
      { reason: 'detail-shape: legacy detail missing or invalid: prompt' },
      { reason: 'http 404' },
      { reason: 'something-new' },
    ]);
    expect(lines[0]).toMatchObject({ reason: 'legacy-spr-no-key', count: 2 });
    expect(lines.find((l) => l.reason === 'detail-shape')?.count).toBe(1);
    expect(lines.find((l) => l.reason === 'download-failed')?.description).toMatch(/refresh/);
    expect(lines.find((l) => l.reason === 'something-new')?.description).toBe('something-new');
  });
});
