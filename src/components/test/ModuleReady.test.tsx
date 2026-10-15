import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModuleReady } from './ModuleReady';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ModuleReady', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders title, question count, and minutes when not resuming', async () => {
    const onStart = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ModuleReady
          title="Section 1, Module 1: Reading and Writing"
          questionCount={27}
          timeLimitMs={1920000} // 32 min
          routeNote={null}
          resuming={false}
          notes={[]}
          onStart={onStart}
          onLeave={vi.fn()}
          busy={false}
        />,
      );
    });

    expect(container.textContent).toContain('Section 1, Module 1: Reading and Writing');
    expect(container.textContent).toContain('27 questions, 32 minutes');
    expect(container.textContent).toContain('The clock starts when you press Start');

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Start module',
    );
    expect(startBtn).toBeDefined();
    expect(startBtn?.disabled).toBe(false);

    await act(async () => {
      startBtn?.click();
    });
    expect(onStart).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders routeNote and assembly notes when present', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ModuleReady
          title="Section 1, Module 2: Reading and Writing"
          questionCount={27}
          timeLimitMs={1920000}
          routeNote="Routed to the harder Module 2 based on Module 1 performance."
          resuming={false}
          notes={['1 question was drawn from seen pool due to domain balance']}
          onStart={vi.fn()}
          onLeave={vi.fn()}
          busy={false}
        />,
      );
    });

    expect(container.textContent).toContain(
      'Routed to the harder Module 2 based on Module 1 performance.',
    );
    expect(container.textContent).toContain(
      '1 question was drawn from seen pool due to domain balance',
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('renders resuming state with clock running message and Resume module button', async () => {
    const onStart = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ModuleReady
          title="Section 2, Module 1: Math"
          questionCount={22}
          timeLimitMs={2100000} // 35 min
          routeNote={null}
          resuming={true}
          notes={[]}
          onStart={onStart}
          onLeave={vi.fn()}
          busy={false}
        />,
      );
    });

    expect(container.textContent).toContain('22 questions, 35 minutes');
    expect(container.textContent).toContain('The clock for this module is already running.');

    const resumeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Resume module',
    );
    expect(resumeBtn).toBeDefined();
    expect(resumeBtn?.disabled).toBe(false);

    await act(async () => {
      resumeBtn?.click();
    });
    expect(onStart).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onLeave when "Leave (a started module\'s clock keeps running)" is clicked', async () => {
    const onLeave = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ModuleReady
          title="Section 1, Module 1: Reading and Writing"
          questionCount={27}
          timeLimitMs={1920000}
          routeNote={null}
          resuming={false}
          notes={[]}
          onStart={vi.fn()}
          onLeave={onLeave}
          busy={false}
        />,
      );
    });

    const leaveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes("Leave (a started module's clock keeps running)"),
    );
    expect(leaveBtn).toBeDefined();
    expect(leaveBtn?.disabled).toBe(false);

    await act(async () => {
      leaveBtn?.click();
    });
    expect(onLeave).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('disables all buttons when busy is true', async () => {
    const onStart = vi.fn();
    const onLeave = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ModuleReady
          title="Section 1, Module 1: Reading and Writing"
          questionCount={27}
          timeLimitMs={1920000}
          routeNote={null}
          resuming={false}
          notes={[]}
          onStart={onStart}
          onLeave={onLeave}
          busy={true}
        />,
      );
    });

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Start module',
    );
    const leaveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes("Leave (a started module's clock keeps running)"),
    );

    expect(startBtn?.disabled).toBe(true);
    expect(leaveBtn?.disabled).toBe(true);

    await act(async () => {
      startBtn?.click();
      leaveBtn?.click();
    });

    expect(onStart).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });
});
