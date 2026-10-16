import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SPR_EXAMPLES } from '../../config/examConfig';
import { SprDirections } from './SprDirections';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SprDirections', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
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

  it('every accepted and rejected string from SPR_EXAMPLES appears', async () => {
    await act(async () => {
      root?.render(<SprDirections />);
    });

    // Default heading appears
    expect(container.textContent).toContain('How to enter your answer');

    // Every accepted and rejected value appears in the document
    for (const item of SPR_EXAMPLES) {
      expect(container.textContent).toContain(item.answer);
      for (const accepted of item.accepted) {
        expect(container.textContent).toContain(accepted);
      }
      for (const rejected of item.rejected) {
        expect(container.textContent).toContain(rejected);
      }
    }
  });

  it('renders custom heading when provided', async () => {
    await act(async () => {
      root?.render(<SprDirections heading="Custom Directions Heading" />);
    });

    expect(container.textContent).toContain('Custom Directions Heading');
  });
});
