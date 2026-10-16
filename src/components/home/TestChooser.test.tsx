import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_CHOOSER } from '../../services/home/routes';
import { TestChooser } from './TestChooser';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('TestChooser', () => {
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

  it('renders nothing when open is false', async () => {
    await act(async () => {
      root?.render(
        <TestChooser
          open={false}
          options={TEST_CHOOSER}
          poolLine="Fresh questions for about 6 full tests"
          onChoose={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    expect(container.innerHTML).toBe('');
  });

  it('renders modal dialog with title, options, hints and poolLine when open', async () => {
    await act(async () => {
      root?.render(
        <TestChooser
          open={true}
          options={TEST_CHOOSER}
          poolLine="Fresh questions for about 6 full tests (estimate)"
          onChoose={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('test-chooser-title');
    expect(container.querySelector('#test-chooser-title')?.textContent).toBe('Take a test');

    const buttons = dialog?.querySelectorAll('button');
    expect(buttons?.length).toBe(4);

    expect(container.textContent).toContain('Full test');
    expect(container.textContent).toContain('About 2 hours 15 minutes.');
    expect(container.textContent).toContain('One section');
    expect(container.textContent).toContain('Reading and Writing or Math');
    expect(container.textContent).toContain('One module');
    expect(container.textContent).toContain('A single timed module.');
    expect(container.textContent).toContain('Fresh questions for about 6 full tests (estimate)');
  });

  it('moves focus into the dialog on open', async () => {
    await act(async () => {
      root?.render(
        <TestChooser
          open={true}
          options={TEST_CHOOSER}
          poolLine={null}
          onChoose={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const firstOption = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Full test'),
    );
    expect(document.activeElement).toBe(firstOption);
  });

  it('choosing an option calls onChoose with the option destination and closes', async () => {
    const onChoose = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root?.render(
        <TestChooser
          open={true}
          options={TEST_CHOOSER}
          poolLine={null}
          onChoose={onChoose}
          onClose={onClose}
        />,
      );
    });

    const sectionOption = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('One section'),
    );
    expect(sectionOption).toBeDefined();

    await act(async () => {
      sectionOption?.click();
    });

    expect(onChoose).toHaveBeenCalledWith('test_setup_section');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when Close button is clicked', async () => {
    const onClose = vi.fn();

    await act(async () => {
      root?.render(
        <TestChooser
          open={true}
          options={TEST_CHOOSER}
          poolLine={null}
          onChoose={vi.fn()}
          onClose={onClose}
        />,
      );
    });

    const closeBtn = container.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when Escape key is pressed', async () => {
    const onClose = vi.fn();

    await act(async () => {
      root?.render(
        <TestChooser
          open={true}
          options={TEST_CHOOSER}
          poolLine={null}
          onChoose={vi.fn()}
          onClose={onClose}
        />,
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when backdrop is clicked', async () => {
    const onClose = vi.fn();

    await act(async () => {
      root?.render(
        <TestChooser
          open={true}
          options={TEST_CHOOSER}
          poolLine={null}
          onChoose={vi.fn()}
          onClose={onClose}
        />,
      );
    });

    const backdrop = container.firstElementChild as HTMLElement;
    await act(async () => {
      backdrop.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
