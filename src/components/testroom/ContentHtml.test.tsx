import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { textNodes } from '../../services/exam/annotateDom';
import { ContentHtml } from './ContentHtml';

// Synthetic markup in the older questions' shape: a chart's <img> nested inside the passage.
const NESTED =
  '<div class="passage"><p>Before the chart.</p><div class="standalone_image"><img alt="synthetic chart" src="data:image/png;base64,AAAA"></div><p>After.</p></div>';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('ContentHtml', () => {
  it('gives a nested picture its own figure frame, in place', async () => {
    await act(async () => root.render(<ContentHtml html={NESTED} />));
    const slot = container.querySelector('[data-bb-figure="0"]');
    expect(slot?.querySelector('[aria-label="Zoom in"]')).not.toBeNull();
    expect(slot?.querySelector('img[alt="synthetic chart"]')).not.toBeNull();
    // Still between the two paragraphs, and only once.
    expect(container.querySelectorAll('img[alt="synthetic chart"]')).toHaveLength(1);
    expect(container.textContent?.indexOf('Before')).toBeLessThan(container.textContent?.indexOf('100%') ?? 0);
    expect(container.textContent?.indexOf('100%')).toBeLessThan(container.textContent?.indexOf('After.') ?? 0);
  });

  it('a frame toolbar never counts toward highlight offsets', async () => {
    await act(async () => root.render(<ContentHtml html={NESTED} />));
    const counted = textNodes(container).map((t) => t.data).join('');
    expect(counted).toContain('Before the chart.');
    expect(counted).toContain('After.');
    expect(counted).not.toContain('100%');
    expect(counted).not.toContain('Reset');
  });

  it('renders top-level figures in figure frames and isolates their toolbars', async () => {
    const html = '<p>Intro text</p><figure class="image"><svg viewBox="0 0 10 10"></svg></figure><p>Outro text</p>';
    await act(async () => root.render(<ContentHtml html={html} />));
    expect(container.querySelector('[aria-label="Zoom in"]')).not.toBeNull();
    const counted = textNodes(container).map((t) => t.data).join('');
    expect(counted).toContain('Intro text');
    expect(counted).toContain('Outro text');
    expect(counted).not.toContain('100%');
    expect(counted).not.toContain('Reset');
  });

  it('leaves math images inline without figure frames', async () => {
    const html = '<p>Formula: <img class="bb-math-img" alt="x^2" src="data:image/png;base64,AAAA"></p>';
    await act(async () => root.render(<ContentHtml html={html} />));
    expect(container.querySelector('[data-bb-figure]')).toBeNull();
    expect(container.querySelector('[aria-label="Zoom in"]')).toBeNull();
    expect(container.querySelector('img.bb-math-img')).not.toBeNull();
  });
});
