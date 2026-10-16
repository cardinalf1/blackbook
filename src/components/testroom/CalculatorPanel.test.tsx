import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CalculatorEngine,
  CalculatorEngineState,
  CalculatorHandle,
  CalculatorPanelProps,
  PanelRect,
} from '../../types/testRoom';
import { CalculatorPanel } from './CalculatorPanel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('CalculatorPanel', () => {
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

  const defaultRect: PanelRect = {
    x: 64,
    y: 112,
    width: 380,
    height: 540,
  };

  const createProps = (overrides: Partial<CalculatorPanelProps> = {}): CalculatorPanelProps => ({
    mode: 'graphing',
    onModeChange: vi.fn(),
    rect: defaultRect,
    onRectChange: vi.fn(),
    onClose: vi.fn(),
    engine: null,
    engineState: null,
    onEngineStateChange: vi.fn(),
    ...overrides,
  });

  it('null engine shows the not-set-up message', async () => {
    await act(async () => {
      root?.render(<CalculatorPanel {...createProps({ engine: null })} />);
    });

    expect(container.textContent).toContain(
      'No calculator is set up. To use the Desmos calculator, add your own Desmos API key in Settings',
    );
    expect(container.textContent).toContain('Until then, use your own calculator.');
  });

  it('a fake engine whose mount rejects shows the could-not-load message', async () => {
    const rejectingEngine: CalculatorEngine = {
      name: 'rejecting-test-engine',
      mount: vi.fn().mockRejectedValue(new Error('Network error')),
    };

    await act(async () => {
      root?.render(<CalculatorPanel {...createProps({ engine: rejectingEngine })} />);
    });

    expect(container.textContent).toContain(
      'The calculator could not load (offline or blocked). Everything else keeps working.',
    );
  });

  it('a fake engine that resolves gets mount called with (element, "graphing", state) and destroy + onEngineStateChange called on unmount', async () => {
    const fakeState: CalculatorEngineState = { angleUnit: 'radians' };
    const savedStateOnExit: CalculatorEngineState = { angleUnit: 'radians', zoom: 1.5 };

    const mockDestroy = vi.fn();
    const mockGetState = vi.fn().mockReturnValue(savedStateOnExit);
    const mockResize = vi.fn();

    const fakeHandle: CalculatorHandle = {
      destroy: mockDestroy,
      getState: mockGetState,
      resize: mockResize,
    };

    const mockMount = vi.fn().mockResolvedValue(fakeHandle);
    const resolvingEngine: CalculatorEngine = {
      name: 'resolving-test-engine',
      mount: mockMount,
    };

    const onEngineStateChange = vi.fn();

    await act(async () => {
      root?.render(
        <CalculatorPanel
          {...createProps({
            engine: resolvingEngine,
            mode: 'graphing',
            engineState: fakeState,
            onEngineStateChange,
          })}
        />,
      );
    });

    expect(mockMount).toHaveBeenCalledTimes(1);
    const call = mockMount.mock.calls[0];
    expect(call).toBeDefined();
    if (call) {
      const [mountElem, mountMode, mountState] = call;
      expect(mountElem).toBeInstanceOf(HTMLElement);
      expect(mountMode).toBe('graphing');
      expect(mountState).toEqual(fakeState);
    }

    // Unmount and verify cleanup
    await act(async () => {
      root?.unmount();
      root = null;
    });

    expect(mockGetState).toHaveBeenCalledTimes(1);
    expect(onEngineStateChange).toHaveBeenCalledWith('graphing', savedStateOnExit);
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it('mode buttons call onModeChange', async () => {
    const onModeChange = vi.fn();

    await act(async () => {
      root?.render(<CalculatorPanel {...createProps({ mode: 'graphing', onModeChange })} />);
    });

    const graphingBtn = container.querySelector(
      'button[aria-pressed="true"]',
    ) as HTMLButtonElement | null;
    const scientificBtn = container.querySelector(
      'button[aria-pressed="false"]',
    ) as HTMLButtonElement | null;

    expect(graphingBtn?.textContent).toContain('Graphing');
    expect(scientificBtn?.textContent).toContain('Scientific');

    await act(async () => {
      scientificBtn?.click();
    });

    expect(onModeChange).toHaveBeenCalledWith('scientific');

    await act(async () => {
      graphingBtn?.click();
    });

    expect(onModeChange).toHaveBeenCalledWith('graphing');
  });

  it('ArrowRight on the move handle calls onRectChange with x+16', async () => {
    const onRectChange = vi.fn();

    await act(async () => {
      root?.render(
        <CalculatorPanel
          {...createProps({
            rect: defaultRect,
            onRectChange,
          })}
        />,
      );
    });

    const moveHandle = container.querySelector(
      'button[aria-label="Move calculator"]',
    ) as HTMLButtonElement | null;
    expect(moveHandle).not.toBeNull();

    await act(async () => {
      moveHandle?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
    });

    expect(onRectChange).toHaveBeenCalledWith({
      ...defaultRect,
      x: defaultRect.x + 16,
    });
  });

  it('close calls onClose', async () => {
    const onClose = vi.fn();

    await act(async () => {
      root?.render(<CalculatorPanel {...createProps({ onClose })} />);
    });

    const closeBtn = container.querySelector(
      'button[aria-label="Close calculator"]',
    ) as HTMLButtonElement | null;
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn?.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
