// Phase 8 insight fixes: no "weakest skill" from fewer than 5 first attempts, the Study next ranking
// picks it, pool health is not an insight, and every insight carries the action code chose.

import { describe, expect, it } from 'vitest';
import type { SkillRow } from '../../types/analytics';
import { buildInsights, ruleCoach, type InsightInputs } from './insights';

const skill = (code: string, attempts: number, correct: number, section: 'rw' | 'math' = 'rw'): SkillRow => ({
  section, domainCode: 'D', domain: 'Domain', skillCode: code, skill: `Skill ${code}`, bankTotal: 40, bankLive: 40, unseenLive: 20,
  counts: { drill: { attempts, correct, timeMs: attempts * 1000 }, exam: { attempts: 0, correct: 0, timeMs: 0 } }, recent: [],
});

const base = (over: Partial<InsightInputs> = {}): InsightInputs => ({
  period: 'custom', answered: 27, correct: 9, skills: [], misses: [], rushedWrong: 0, stuck: 1, reasons: {}, reasonsBefore: null,
  lastFive: { modules: 0, reached: 0, answeredInLastFive: 0 }, changes: { correctToIncorrect: 2, incorrectToCorrect: 3, incorrectToIncorrect: 1 },
  retry: { answered: 0, correct: 0, due: 0, queued: 0 }, ...over,
});

describe('insights after Phase 8', () => {
  it('never names a weakest skill from fewer than 5 first attempts (the "Transitions at 0% after 2" case)', () => {
    const out = buildInsights(base({ skills: [skill('TRA', 2, 0), skill('B', 4, 0)] }));
    expect(out.find((x) => x.id === 'skills_below_target')).toBeUndefined();
  });

  it('ranks by the Wilson lower bound (0 of 5 below 9 of 20), ignoring 0 of 2', () => {
    const out = buildInsights(base({ skills: [skill('FIVE', 5, 0), skill('TWENTY', 20, 9), skill('TRA', 2, 0)] }));
    const x = out.find((i) => i.id === 'skills_below_target');
    expect(x?.headline).toContain('Skill FIVE at 0% (0 of 5)');
    expect(x?.facts.skillsBelow).toBe(2);
    expect(x?.headline).not.toContain('TRA');
    expect(x?.action).toMatchObject({ kind: 'drill', config: { section: 'rw', skillCodes: ['FIVE', 'TWENTY'] } });
  });

  it('has no pool-health insight', () => {
    const out = buildInsights(base({ skills: [skill('A', 30, 10)] }));
    expect(out.map((x) => x.id)).not.toContain('pool_health');
    expect(JSON.stringify(out)).not.toMatch(/full tests left/i);
  });

  it('gives every insight an action and the coach at most 3 lines', () => {
    const out = buildInsights(
      base({
        skills: [skill('A', 30, 10)],
        rushedWrong: 3,
        reasons: { careless: 2 },
        retry: { answered: 4, correct: 2, due: 2, queued: 3 },
        lastFive: { modules: 2, reached: 1, answeredInLastFive: 3 },
        misses: [{ questionId: 'q1', section: 'math', domainCode: 'D', skillCode: 'A', difficulty: 'E', sessionId: 's', missedAt: 1, misses: 1, attempts: 1 }],
      }),
    );
    for (const x of out) expect(x.action, x.id).not.toBeNull();
    expect(out.find((x) => x.id === 'retry_progress')?.action).toEqual({ kind: 'retry', label: 'Retry 2 due questions' });
    expect(out.find((x) => x.id === 'fast_vs_slow')?.action).toMatchObject({ kind: 'drill', config: { questionIds: ['q1'] } });
    const coach = ruleCoach(out);
    expect(coach.length).toBe(3);
    expect(coach[0]?.insightId).toBe('skills_below_target');
  });
});
