import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Trends } from '../../types/dashboard';
import { TrendsCard } from './TrendsCard';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('TrendsCard', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
  });

  async function renderCard(trends: Trends) {
    if (!root) {
      root = createRoot(container);
    }
    await act(async () => {
      root?.render(<TrendsCard trends={trends} />);
    });
  }

  it('renders "No answers in this period yet." when trends data is empty', async () => {
    await renderCard({
      accuracy: [],
      pace: [],
      targetMs: { rw: 71000, math: 95000 },
      hollowBelow: 10,
      tableBelowPoints: 3,
    });

    expect(container.textContent).toContain('No answers in this period yet.');
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('table')).toBeNull();
  });

  it('shows a table when fewer than 3 points and no svg path', async () => {
    const trends: Trends = {
      accuracy: [
        { day: '2026-10-14', mode: 'drill', attempts: 5, correct: 4 },
        { day: '2026-10-15', mode: 'drill', attempts: 12, correct: 9 },
      ],
      pace: [],
      targetMs: { rw: 71000, math: 95000 },
      hollowBelow: 10,
      tableBelowPoints: 3,
    };

    await renderCard(trends);

    // There are 2 points (< 3), so a table must be shown and no svg path
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(container.textContent).toContain('2026-10-14');
    expect(container.textContent).toContain('2026-10-15');
    expect(container.textContent).toContain('80%');
    expect(container.textContent).toContain('75%');

    // No path in SVG since it fell back to table
    const path = container.querySelector('path');
    expect(path).toBeNull();
  });

  it('shows an svg path when 3 or more points', async () => {
    const trends: Trends = {
      accuracy: [
        { day: '2026-10-13', mode: 'drill', attempts: 15, correct: 12 },
        { day: '2026-10-14', mode: 'drill', attempts: 15, correct: 10 },
        { day: '2026-10-15', mode: 'drill', attempts: 15, correct: 14 },
      ],
      pace: [],
      targetMs: { rw: 71000, math: 95000 },
      hollowBelow: 10,
      tableBelowPoints: 3,
    };

    await renderCard(trends);

    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    // Direct label at line end
    expect(container.textContent).toContain('Drills');
    expect(container.textContent).toContain('hollow marker = fewer than 10 answers');
  });

  it('renders hollow markers when attempts < 10 and solid markers when attempts >= 10', async () => {
    const trends: Trends = {
      accuracy: [
        { day: '2026-10-13', mode: 'drill', attempts: 5, correct: 4 }, // hollow (< 10)
        { day: '2026-10-14', mode: 'drill', attempts: 15, correct: 12 }, // solid (>= 10)
        { day: '2026-10-15', mode: 'drill', attempts: 8, correct: 6 }, // hollow (< 10)
      ],
      pace: [],
      targetMs: { rw: 71000, math: 95000 },
      hollowBelow: 10,
      tableBelowPoints: 3,
    };

    await renderCard(trends);

    const circles = Array.from(container.querySelectorAll('circle'));
    expect(circles.length).toBe(3);

    // 1st point (attempts: 5) -> hollow: fill is #000000
    expect(circles[0]?.getAttribute('fill')).toBe('#000000');
    // 2nd point (attempts: 15) -> solid: fill is #FFFFFF
    expect(circles[1]?.getAttribute('fill')).toBe('#FFFFFF');
    // 3rd point (attempts: 8) -> hollow: fill is #000000
    expect(circles[2]?.getAttribute('fill')).toBe('#000000');
  });

  it('renders pace chart with horizontal target line and lines when >= 3 points, table when < 3', async () => {
    const trends: Trends = {
      accuracy: [],
      pace: [
        // rw has 3 points -> chart
        { day: '2026-10-13', mode: 'drill', section: 'rw', attempts: 10, timeMs: 700000 },
        { day: '2026-10-14', mode: 'drill', section: 'rw', attempts: 10, timeMs: 750000 },
        { day: '2026-10-15', mode: 'drill', section: 'rw', attempts: 10, timeMs: 720000 },
        // math has 1 point -> table
        { day: '2026-10-15', mode: 'drill', section: 'math', attempts: 10, timeMs: 900000 },
      ],
      targetMs: { rw: 71000, math: 95000 },
      hollowBelow: 10,
      tableBelowPoints: 3,
    };

    await renderCard(trends);

    // RW has path and target line in SVG
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    expect(container.textContent).toContain('Reading and Writing target');

    // Math has table
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(container.textContent).toContain('Math');
  });
});
