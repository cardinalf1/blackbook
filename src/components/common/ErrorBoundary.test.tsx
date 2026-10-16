import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

function ProblemChild(): React.JSX.Element {
  throw new Error('Explosion in test');
}

describe('ErrorBoundary', () => {
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

  it('renders children when no error occurs', async () => {
    await act(async () => {
      root?.render(
        <ErrorBoundary>
          <div>Safe Content</div>
        </ErrorBoundary>,
      );
    });
    expect(container.textContent).toContain('Safe Content');
  });

  it('renders friendly error UI and diagnostics when a child throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      root?.render(
        <ErrorBoundary>
          <ProblemChild />
        </ErrorBoundary>,
      );
    });

    expect(container.textContent).toContain('Something went wrong');
    expect(container.textContent).toContain('Explosion in test');
    expect(container.textContent).toContain('Reload app');
    expect(container.textContent).toContain('Copy diagnostics');
    spy.mockRestore();
  });
});
