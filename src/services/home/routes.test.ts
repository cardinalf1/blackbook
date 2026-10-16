// The two-click rule: every screen reachable from Home before Phase 8 is reachable within two clicks
// now, and every old analytics metric is reachable from the Dashboard within two clicks.

import { describe, expect, it } from 'vitest';
import { ANALYTICS_TABS } from '../../types/analytics';
import { DASHBOARD_DETAIL_LINKS, HOME_GROUPS, homeTargetCount, LEGACY_REDIRECTS, PRE_PHASE8_SCREENS, reachableWithin, SETTINGS_MENU, TEST_CHOOSER } from './routes';

describe('navigation after Phase 8', () => {
  it('every pre-Phase 8 home destination is within two clicks of Home', () => {
    const reach = reachableWithin(2);
    const missing = PRE_PHASE8_SCREENS.filter((s) => s.now !== 'in_progress' && !reach.has(s.now));
    expect(missing).toEqual([]);
    // Resume and Start retry are the Up next button itself (one click) or "see all in progress" (one click).
    expect(reach.get('in_progress')).toBe(1);
  });

  it('lists all 13 old home buttons plus the panels, and all six old analytics tabs', () => {
    const old = PRE_PHASE8_SCREENS.map((s) => s.old);
    for (const b of ['Start a drill', 'Practice module', 'Practice test', 'My skills', 'Past drills', 'Your data', 'Weak-skill drill', 'Study report', 'Settings', 'Mistake log', 'Browse questions', 'Step through 20 random questions'])
      expect(old).toContain(b);
    for (const t of ANALYTICS_TABS) expect(old).toContain(`Analytics: ${t.label}`);
  });

  it('Home has one primary action, four groups and a three-item settings menu', () => {
    expect(HOME_GROUPS.map((g) => g.title)).toEqual(['Practice', 'Take a test', 'Progress', 'Library']);
    for (const g of HOME_GROUPS) expect(g.links.length).toBeGreaterThanOrEqual(1);
    expect(SETTINGS_MENU.map((l) => l.to)).toEqual(['settings', 'data', 'bank']);
    expect(TEST_CHOOSER.map((l) => l.to)).toEqual(['test_setup_full', 'test_setup_section', 'exam_setup']);
    expect(homeTargetCount().topLevel).toBe(6);
  });

  it('every old analytics view and the study report are one click from the Dashboard', () => {
    const fromDash = reachableWithin(1, 'dashboard');
    for (const id of ['detail_overview', 'detail_skills', 'detail_timing', 'detail_behavior', 'detail_tests', 'detail_study', 'detail_report', 'my_skills'] as const) {
      expect(fromDash.get(id), id).toBe(1);
    }
    expect(DASHBOARD_DETAIL_LINKS).toHaveLength(8);
  });

  it('old top-level views redirect to the Dashboard', () => {
    expect(LEGACY_REDIRECTS).toEqual({ analytics: 'dashboard', aiReport: 'dashboard', mySkillsTop: 'dashboard' });
  });
});
