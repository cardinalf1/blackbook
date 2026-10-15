import { describe, expect, it } from 'vitest';
import { MIN_ATTEMPTS_TO_RANK } from '../../config/analyticsConfig';
import type { ByMode, ModeCounts, SkillRow } from '../../types/analytics';
import type { Section } from '../../types/sat';
import { estimateVersions, pooled, rateView, wilsonLowerBound } from './metrics';
import { missesDrills, rankSkills, topSkillsDrills } from './rank';

const zero: ModeCounts = { attempts: 0, correct: 0, timeMs: 0 };
const row = (code: string, drill: [number, number], exam: [number, number] = [0, 0], over: Partial<SkillRow> = {}): SkillRow => ({
  section: 'math', domainCode: 'D', domain: 'Domain', skillCode: code, skill: `Skill ${code}`, bankTotal: 30, bankLive: 30, unseenLive: 10,
  counts: { drill: { attempts: drill[1], correct: drill[0], timeMs: 0 }, exam: { attempts: exam[1], correct: exam[0], timeMs: 0 } } as ByMode<ModeCounts>,
  recent: [], ...over,
});

describe('wilsonLowerBound', () => {
  it('is 0 with no answers and never above the raw accuracy', () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
    for (const [c, n] of [[1, 1], [18, 20], [5, 10], [0, 4], [50, 50]] as const) expect(wilsonLowerBound(c, n)).toBeLessThanOrEqual(c / n);
  });
  it('1 of 1 is weaker evidence than 18 of 20', () => {
    expect(wilsonLowerBound(1, 1)).toBeLessThan(wilsonLowerBound(18, 20));
  });
  it('grows with the same accuracy over more answers', () => {
    expect(wilsonLowerBound(9, 10)).toBeLessThan(wilsonLowerBound(90, 100));
  });
});

describe('rateView', () => {
  it('marks small samples as low confidence', () => {
    expect(rateView(1, 1).lowConfidence).toBe(true);
    expect(rateView(18, 20).lowConfidence).toBe(false);
    expect(rateView(0, 0).accuracy).toBeNull();
  });
});

describe('rankSkills', () => {
  it('a 1-of-1 skill does not outrank an 18-of-20 skill as a strength: it needs work sooner', () => {
    const lucky = row('lucky', [1, 1], [0, 0], { unseenLive: 0 });
    const solid = row('solid', [18, 20], [0, 0], { unseenLive: 0 });
    const ranked = rankSkills([solid, lucky]);
    expect(ranked.map((r) => r.skillCode)).toEqual(['lucky', 'solid']);
    expect(ranked[0]?.priority).toBeGreaterThan(ranked[1]?.priority ?? 1);
  });

  it('puts proven weak spots first, then thin data, then proven strengths', () => {
    const weak = row('weak', [6, 20]);
    const thin = row('thin', [2, 3]);
    const strong = row('strong', [28, 30]);
    expect(rankSkills([strong, thin, weak]).map((r) => r.skillCode)).toEqual(['weak', 'thin', 'strong']);
  });

  it('pools drill and exam answers for ranking, and explains each row', () => {
    const r = rankSkills([row('x', [3, 10], [2, 14])]);
    expect(r[0]?.attempts).toBe(24);
    expect(r[0]?.correct).toBe(5);
    expect(r[0]?.reasons[0]).toBe('low accuracy (21%) over 24 attempts');
    expect(pooled(row('y', [1, 2], [3, 4]).counts)).toEqual({ attempts: 6, correct: 4, timeMs: 0 });
  });

  it('says what is missing for thin or untouched skills, and leaves out skills with nothing live', () => {
    const r = rankSkills([row('none', [0, 0], [0, 0], { unseenLive: 20 }), row('few', [1, MIN_ATTEMPTS_TO_RANK - 1]), row('gone', [0, 0], [0, 0], { bankLive: 0, unseenLive: 0 })]);
    expect(r.map((x) => x.skillCode).sort()).toEqual(['few', 'none']);
    expect(r.find((x) => x.skillCode === 'none')?.reasons[0]).toBe('not tried yet');
    expect(r.find((x) => x.skillCode === 'few')?.reasons[0]).toBe(`few attempts so far (${MIN_ATTEMPTS_TO_RANK - 1})`);
    expect(r.find((x) => x.skillCode === 'none')?.reasons).toContain('20 unseen questions left');
  });

  it('unseen questions raise the priority of otherwise equal skills', () => {
    const a = row('a', [10, 20], [0, 0], { unseenLive: 25 });
    const b = row('b', [10, 20], [0, 0], { unseenLive: 0 });
    expect(rankSkills([b, a]).map((x) => x.skillCode)).toEqual(['a', 'b']);
  });
});

describe('drill configs', () => {
  it('builds one top-skills drill per section with only that section\'s skills', () => {
    const rw: SkillRow = row('r1', [2, 20], [0, 0], { section: 'rw' as Section });
    const drills = topSkillsDrills(rankSkills([row('m1', [3, 20]), row('m2', [4, 20]), row('m3', [5, 20]), row('m4', [6, 20]), rw]));
    expect(drills.map((d) => d.section)).toEqual(['rw', 'math']);
    expect(drills[1]?.config.skillCodes).toEqual(['m1', 'm2', 'm3']);
    expect(drills[0]?.config).toMatchObject({ section: 'rw', skillCodes: ['r1'], liveOnly: true });
  });

  it('builds a misses-first review config, oldest miss first, per section', () => {
    const miss = (id: string, section: Section, missedAt: number) => ({
      questionId: id, section, domainCode: 'D', skillCode: 'S', difficulty: 'M' as const, sessionId: 's', missedAt, misses: 1, attempts: 1,
    });
    const d = missesDrills([miss('late', 'math', 300), miss('early', 'math', 100), miss('rw1', 'rw', 200)]);
    expect(d.map((x) => x.section)).toEqual(['rw', 'math']);
    expect(d[1]?.config.questionIds).toEqual(['early', 'late']);
    expect(d[1]?.config.liveOnly).toBe(false);
    expect(missesDrills([])).toEqual([]);
  });
});

describe('estimateVersions', () => {
  it('flags a trend that spans config versions', () => {
    const t = (configVersion: number) => ({ configVersion, estimate: {} as never });
    expect(estimateVersions([t(1), t(1)])).toEqual({ versions: [1], mixed: false });
    expect(estimateVersions([t(1), t(2)])).toEqual({ versions: [1, 2], mixed: true });
    expect(estimateVersions([{ configVersion: 3, estimate: null }])).toEqual({ versions: [], mixed: false });
  });
});


