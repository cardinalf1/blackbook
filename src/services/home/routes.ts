// Navigation after Phase 8: where every screen lives, the Home groups and settings menu that render
// from these lists, the old routes that now redirect, and the graph the two-click test walks.
// Pure data. The Home screen renders HOME_GROUPS and SETTINGS_MENU, so the test proves what is shown.

/** Every destination App can open. */
export type ScreenId =
  | 'home'
  | 'drill_setup'
  | 'random20'
  | 'weak_drill'
  | 'modes800'
  | 'random_question'
  | 'test_chooser'
  | 'test_setup_full'
  | 'test_setup_section'
  | 'exam_setup'
  | 'dashboard'
  | 'past'
  | 'mistakes'
  | 'browse'
  | 'rules_notes'
  | 'settings'
  | 'data'
  | 'bank'
  | 'in_progress'
  | 'detail_overview'
  | 'detail_skills'
  | 'detail_timing'
  | 'detail_behavior'
  | 'detail_tests'
  | 'detail_study'
  | 'detail_report'
  | 'my_skills';

export interface NavLink {
  to: ScreenId;
  label: string;
  /** One short line under the link, plain words. */
  hint?: string;
}

export interface HomeGroup {
  id: 'practice' | 'test' | 'progress' | 'library';
  title: string;
  links: NavLink[];
}

export const HOME_GROUPS: readonly HomeGroup[] = [
  {
    id: 'practice',
    title: 'Practice',
    links: [
      { to: 'drill_setup', label: 'Drill', hint: 'Pick a section, skills and difficulty. Includes a Random 20 set.' },
      { to: 'weak_drill', label: 'Weak-skill drill', hint: 'A set built from your weakest skills.' },
      { to: 'modes800', label: '800 modes', hint: 'Hard-only sets at the real pace.' },
      { to: 'random_question', label: 'One random question' },
    ],
  },
  {
    id: 'test',
    title: 'Take a test',
    links: [{ to: 'test_chooser', label: 'Take a test', hint: 'Full test, one section, or one module.' }],
  },
  {
    id: 'progress',
    title: 'Progress',
    links: [
      { to: 'dashboard', label: 'Dashboard', hint: 'Coach, numbers, trends, skills and tests in one page.' },
      { to: 'past', label: 'Past drills' },
      { to: 'mistakes', label: 'Mistake log' },
    ],
  },
  {
    id: 'library',
    title: 'Library',
    links: [
      { to: 'browse', label: 'Browse questions' },
      { to: 'rules_notes', label: 'My rules notes' },
    ],
  },
];

/** The small menu behind the header's settings button. */
export const SETTINGS_MENU: readonly NavLink[] = [
  { to: 'settings', label: 'Settings', hint: 'Groq key and AI' },
  { to: 'data', label: 'Your data', hint: 'Backup, export, restore' },
  { to: 'bank', label: 'Question bank', hint: 'Refresh, import from file' },
];

/** The "Take a test" chooser. */
export const TEST_CHOOSER: readonly NavLink[] = [
  { to: 'test_setup_full', label: 'Full test', hint: 'Both sections, adaptive second modules, a break. About 2 hours 15 minutes.' },
  { to: 'test_setup_section', label: 'One section', hint: 'Reading and Writing or Math: two modules, adaptive.' },
  { to: 'exam_setup', label: 'One module', hint: 'A single timed module.' },
];

/** "Detailed views" at the bottom of the Dashboard: the old deep pages. */
export const DASHBOARD_DETAIL_LINKS: readonly NavLink[] = [
  { to: 'detail_skills', label: 'See all skills', hint: 'Every skill with drill and exam numbers, misses and history.' },
  { to: 'detail_timing', label: 'See timing detail', hint: 'Your baselines, flagged answers and module pacing.' },
  { to: 'detail_behavior', label: 'See behavior detail', hint: 'Answer changes, strike-outs and confidence.' },
  { to: 'detail_tests', label: 'See test history', hint: 'Estimate ranges over time and routing.' },
  { to: 'detail_study', label: 'See study list', hint: 'Every skill ranked by study priority.' },
  { to: 'detail_overview', label: 'See drill and exam totals', hint: 'Sessions, answers, accuracy and time, side by side.' },
  { to: 'detail_report', label: 'See full study report', hint: 'The weekly report with 5 to 7 insights.' },
  { to: 'my_skills', label: 'See drill skill stats', hint: 'Per-skill drill accuracy from the drill screens.' },
];

/** Every screen reachable from Home before Phase 8 (one per old button or panel), with where it lives now. */
export const PRE_PHASE8_SCREENS: readonly { old: string; now: ScreenId }[] = [
  { old: 'Start a drill', now: 'drill_setup' },
  { old: 'Practice module', now: 'exam_setup' },
  { old: 'Practice test', now: 'test_setup_full' },
  { old: 'My skills', now: 'my_skills' },
  { old: 'Analytics: Overview', now: 'detail_overview' },
  { old: 'Analytics: Skills', now: 'detail_skills' },
  { old: 'Analytics: Timing and pacing', now: 'detail_timing' },
  { old: 'Analytics: Behavior', now: 'detail_behavior' },
  { old: 'Analytics: Test history', now: 'detail_tests' },
  { old: 'Analytics: Study next', now: 'detail_study' },
  { old: 'Past drills', now: 'past' },
  { old: 'Your data', now: 'data' },
  { old: 'Weak-skill drill', now: 'weak_drill' },
  { old: 'Study report', now: 'detail_report' },
  { old: 'Settings', now: 'settings' },
  { old: 'Mistake log', now: 'mistakes' },
  { old: 'Browse questions', now: 'browse' },
  { old: 'Step through 20 random questions', now: 'random20' },
  { old: 'Retry card: Start retry', now: 'in_progress' },
  { old: 'In-progress list: Resume', now: 'in_progress' },
  { old: 'Refresh questions', now: 'bank' },
  { old: 'Import question bank', now: 'bank' },
];

/**
 * Edges of the navigation graph: what one click on each screen opens. Home's edges come from the
 * lists above; the settings menu and the chooser are one click each.
 */
export function navGraph(): Map<ScreenId, ScreenId[]> {
  const g = new Map<ScreenId, ScreenId[]>();
  const add = (from: ScreenId, to: readonly ScreenId[]) => g.set(from, [...(g.get(from) ?? []), ...to]);
  add('home', HOME_GROUPS.flatMap((x) => x.links.map((l) => l.to)));
  // The header's settings button opens the menu; "see all in progress" sits under Up next.
  add('home', ['in_progress']);
  add('test_chooser', TEST_CHOOSER.map((l) => l.to));
  add('drill_setup', ['random20', 'modes800']);
  add('dashboard', DASHBOARD_DETAIL_LINKS.map((l) => l.to));
  return g;
}

/** The settings menu counts as the first click, each item as the second. */
export const SETTINGS_MENU_DEPTH = 2;

/** Screens reachable from `start` in at most `depth` clicks (BFS over navGraph, plus the settings menu). */
export function reachableWithin(depth: number, start: ScreenId = 'home'): Map<ScreenId, number> {
  const g = navGraph();
  const seen = new Map<ScreenId, number>([[start, 0]]);
  let frontier: ScreenId[] = [start];
  for (let d = 1; d <= depth; d++) {
    const next: ScreenId[] = [];
    for (const s of frontier) {
      for (const t of g.get(s) ?? []) {
        if (!seen.has(t)) {
          seen.set(t, d);
          next.push(t);
        }
      }
    }
    frontier = next;
  }
  if (start === 'home' && depth >= SETTINGS_MENU_DEPTH) for (const l of SETTINGS_MENU) if (!seen.has(l.to)) seen.set(l.to, SETTINGS_MENU_DEPTH);
  return seen;
}

/**
 * Home's targets with a loaded bank. Top level: the Up next button, the four group cards and the
 * settings button. Links: every clickable element, including "or choose something else".
 */
export function homeTargetCount(): { topLevel: number; links: number } {
  return { topLevel: 1 + HOME_GROUPS.length + 1, links: 1 + 1 + HOME_GROUPS.reduce((t, g) => t + g.links.length, 0) + 1 };
}

/** Old top-level views that now redirect. */
export type LegacyView = 'analytics' | 'aiReport' | 'mySkillsTop';
export const LEGACY_REDIRECTS: Readonly<Record<LegacyView, ScreenId>> = {
  analytics: 'dashboard',
  aiReport: 'dashboard',
  mySkillsTop: 'dashboard',
};
