import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReferencePanel } from './ReferencePanel';

describe('ReferencePanel', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders all 10 formula groups and the 3 geometric facts', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ReferencePanel
          expanded={false}
          onToggleExpand={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const text = container.textContent ?? '';

    // Title
    expect(text).toContain('Reference');

    // 10 Formula groups
    // 1. Circle: A = \pi r^2 and C = 2\pi r
    expect(container.innerHTML).toMatch(/\\pi\s*r\^?2|πr/);
    expect(container.innerHTML).toMatch(/2\\pi\s*r|2πr/);

    // 2. Rectangle: A = \ell w
    expect(container.innerHTML).toMatch(/\\ell\s*w|ℓw/);

    // 3. Triangle: A = 1/2 bh
    expect(container.innerHTML).toMatch(/bh/);

    // 4. Right triangle: c^2 = a^2 + b^2
    expect(container.innerHTML).toMatch(/c\^?2\s*=\s*a\^?2\s*\+\s*b\^?2|c²\s*=\s*a²\s*\+\s*b²/);

    // 5. Special right triangles
    expect(text).toContain('Special Right Triangles');
    expect(text).toContain('30°');
    expect(text).toContain('60°');
    expect(text).toContain('45°');

    // 6. Rectangular prism: V = \ell wh
    expect(container.innerHTML).toMatch(/\\ell\s*wh|ℓwh/);

    // 7. Cylinder: V = \pi r^2 h
    expect(container.innerHTML).toMatch(/\\pi\s*r\^?2\s*h|πr²h/);

    // 8. Sphere: V = 4/3 \pi r^3
    expect(container.innerHTML).toMatch(/\\pi\s*r\^?3|πr³/);

    // 9. Cone: V = 1/3 \pi r^2 h
    expect(container.innerHTML).toMatch(/\\pi\s*r\^?2\s*h|πr²h/);

    // 10. Rectangular pyramid: V = 1/3 \ell wh
    expect(container.innerHTML).toMatch(/\\ell\s*wh|ℓwh/);

    // 3 Facts
    expect(text).toContain('360');
    expect(text).toContain('radians');
    expect(text).toContain('180');

    await act(async () => {
      root.unmount();
    });
  });

  it('contains no "sin" or "cos"', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ReferencePanel
          expanded={false}
          onToggleExpand={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const lowerText = (container.textContent ?? '').toLowerCase();
    expect(lowerText).not.toContain('sin');
    expect(lowerText).not.toContain('cos');

    await act(async () => {
      root.unmount();
    });
  });

  it('invokes close and expand callbacks on button clicks', async () => {
    const onToggleExpand = vi.fn();
    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ReferencePanel
          expanded={false}
          onToggleExpand={onToggleExpand}
          onClose={onClose}
        />,
      );
    });

    const expandBtn = container.querySelector('button[aria-label="Expand reference"]') as HTMLButtonElement;
    expect(expandBtn).not.toBeNull();
    expect(expandBtn.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      expandBtn.click();
    });
    expect(onToggleExpand).toHaveBeenCalledTimes(1);

    const closeBtn = container.querySelector('button[aria-label="Close reference"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Re-render expanded
    await act(async () => {
      root.render(
        <ReferencePanel
          expanded={true}
          onToggleExpand={onToggleExpand}
          onClose={onClose}
        />,
      );
    });

    const collapseBtn = container.querySelector('button[aria-label="Collapse reference"]') as HTMLButtonElement;
    expect(collapseBtn).not.toBeNull();
    expect(collapseBtn.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      collapseBtn.click();
    });
    expect(onToggleExpand).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ReferencePanel
          expanded={false}
          onToggleExpand={vi.fn()}
          onClose={onClose}
        />,
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });
});
