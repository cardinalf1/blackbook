import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DASHBOARD_DETAIL_LINKS, type NavLink } from '../../services/home/routes';
import { DetailLinks } from './DetailLinks';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container.remove();
});

async function show(node: React.ReactElement) {
  await act(async () => {
    root?.render(node);
  });
}

const mockLinks: readonly NavLink[] = DASHBOARD_DETAIL_LINKS;

describe('DetailLinks', () => {
  it('renders header "Detailed views" and all links with labels and hints', async () => {
    await show(<DetailLinks links={mockLinks} onOpen={vi.fn()} />);

    expect(container.textContent).toContain('Detailed views');

    for (const link of mockLinks) {
      expect(container.textContent).toContain(link.label);
      if (link.hint) {
        expect(container.textContent).toContain(link.hint);
      }
    }
  });

  it('calls onOpen with corresponding ScreenId when each link is clicked', async () => {
    const onOpen = vi.fn();
    await show(<DetailLinks links={mockLinks} onOpen={onOpen} />);

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.length).toBe(mockLinks.length);

    for (let i = 0; i < mockLinks.length; i++) {
      const link = mockLinks[i]!;
      const btn = buttons[i]!;

      await act(async () => {
        btn.click();
      });

      expect(onOpen).toHaveBeenLastCalledWith(link.to);
    }

    expect(onOpen).toHaveBeenCalledTimes(mockLinks.length);
  });
});
