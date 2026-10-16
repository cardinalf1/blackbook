// The owner's tool checklist (Phase 9, step 8b) against the real exam screen: per section and
// question type, exactly the tools in TOOL_INVENTORY appear, and nothing else. Synthetic questions.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question, Section } from '../../types/sat';
import type { ToolId } from '../../types/testRoom';

vi.mock('../../services/storage', async () => {
  const { MemoryAttemptStore } = await import('../../services/storage/attemptsMemory');
  const { MemoryQuestionStore } = await import('../../services/storage/memory');
  const attempts = new MemoryAttemptStore();
  return { attemptStore: attempts, telemetryStore: attempts, mistakeStore: attempts, questionStore: new MemoryQuestionStore() };
});

const { questionStore } = await import('../../services/storage');
const { drillStore } = await import('../../stores/drillStore');
const { testRoomStore } = await import('../../stores/testRoomStore');
const { toolsFor } = await import('../../config/testRoomConfig');
const { TestRoomPlay } = await import('./TestRoom');

function question(id: string, section: Section, kind: 'mcq' | 'spr'): Question {
  return {
    id, source: 'digital', displayId: id, section, domainCode: section === 'math' ? 'H' : 'CAS', domain: 'Domain',
    skillCode: 'S', skill: 'Skill', difficulty: 'M', scoreBand: 3, active: true,
    stimulusHtml: section === 'rw' ? '<p>A synthetic passage about tide pools.</p>' : null,
    stemHtml: `<p>Synthetic question ${id}.</p>`,
    answer: kind === 'mcq' ? { kind: 'mcq', choices: ['one', 'two', 'three', 'four'], correct: 'A', keyOrigin: 'structured' } : { kind: 'spr', accepted: ['2/3'] },
    rationaleHtml: '<p>Because.</p>', updatedAt: 0,
  };
}

const QUESTIONS = [question('m1', 'math', 'mcq'), question('m2', 'math', 'spr'), question('r1', 'rw', 'mcq'), question('r2', 'rw', 'mcq')];

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await (questionStore as unknown as { replaceAll: (q: Question[], m: object) => Promise<void> }).replaceAll(QUESTIONS, { fetchedAt: 'x', importedAt: 'y', count: 4, skippedCount: 0 });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  drillStore.setState({ session: null, questions: {} });
});

async function open(section: Section, ids: string[]) {
  await drillStore.getState().startExam({ section, moduleNumber: 1, tier: 'routing' }, ids, 30 * 60_000, []);
  await act(async () => root.render(<TestRoomPlay onExit={() => undefined} />));
}

const buttonNamed = (name: string) => [...container.querySelectorAll('button')].some((b) => b.textContent?.trim() === name || b.getAttribute('aria-label') === name);

/** Which tools the screen shows right now, probed by their visible names. */
async function toolsOnScreen(): Promise<ToolId[]> {
  const found: ToolId[] = [];
  if (buttonNamed('Calculator')) found.push('calculator');
  if (buttonNamed('Reference')) found.push('reference');
  if ([...container.querySelectorAll('button')].some((b) => b.textContent?.includes('Highlights & Notes'))) found.push('highlights');
  if (buttonNamed('Cross out answer choices')) found.push('eliminator');
  if (container.textContent?.includes('Mark for Review')) found.push('markForReview');
  if ([...container.querySelectorAll('button')].some((b) => /Question \d+ of \d+/.test(b.textContent ?? ''))) found.push('questionMenu');
  if (buttonNamed('Hide timer')) found.push('timerHide');
  if ([...container.querySelectorAll('button')].some((b) => b.textContent?.includes('Directions'))) found.push('directions');
  if (container.textContent?.includes('100%')) found.push('zoom');
  const more = container.querySelector<HTMLButtonElement>('button[aria-label="More options"]');
  if (more) {
    found.push('more');
    await act(async () => more.click());
    if ([...container.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent?.includes('Line Reader'))) found.push('lineReader');
    await act(async () => testRoomStore.getState().closeMore());
  }
  return found.sort();
}

describe('tool inventory on screen', () => {
  it('Math multiple choice: exactly the Math list', async () => {
    await open('math', ['m1', 'm2']);
    expect(await toolsOnScreen()).toEqual([...toolsFor('math', 'mcq')].sort());
  });

  it('Math student-produced response: the Math list without the eliminator, with the directions pane', async () => {
    await open('math', ['m2', 'm1']);
    expect(await toolsOnScreen()).toEqual([...toolsFor('math', 'spr')].sort());
    expect(container.textContent).toContain('How to enter your answer');
    expect(container.textContent).toContain('Answer Preview');
  });

  it('Reading and Writing: exactly its list, never Calculator or Reference', async () => {
    await open('rw', ['r1', 'r2']);
    const tools = await toolsOnScreen();
    expect(tools).toEqual([...toolsFor('rw', 'mcq')].sort());
    expect(tools).not.toContain('calculator');
    expect(tools).not.toContain('reference');
  });

  it('no Back on question 1; the menu reaches the review screen', async () => {
    await open('math', ['m1', 'm2']);
    expect(buttonNamed('Back')).toBe(false);
    expect(buttonNamed('Next')).toBe(true);
    const menuButton = [...container.querySelectorAll('button')].find((b) => /Question 1 of 2/.test(b.textContent ?? ''));
    await act(async () => menuButton?.click());
    const review = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Go to Review Page'));
    await act(async () => review?.click());
    expect(drillStore.getState().session?.exam?.phase).toBe('review');
  });

  it('opening Reference docks the panel; the calculator panel says no engine is set up', async () => {
    await open('math', ['m1']);
    const ref = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Reference');
    await act(async () => ref?.click());
    expect(container.querySelector('[aria-label="Close reference"]')).not.toBeNull();
    const calc = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Calculator');
    await act(async () => calc?.click());
    expect(container.textContent).toContain('No calculator is set up');
  });
});
