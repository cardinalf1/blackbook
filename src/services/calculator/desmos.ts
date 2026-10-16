// The Desmos engine (docs/calculator-spec.md). The calculator runs in a sandboxed frame served by
// the local server: scripts only, no same-origin access, so Desmos's script never runs with access
// to the app's origin, its token or its data, and this code never sees the key. The two sides talk by
// postMessage: the frame says "ready" or "error", and sends the calculator's state after each change
// (kept here for getState); the app sends a saved state to restore. The state is opaque and stays
// in memory: it is never logged or saved with the session.

import { CALCULATOR_FRAME_PATH, type CalculatorFrameMessage } from '../../types/calculator';
import type { CalculatorEngine, CalculatorEngineState, CalculatorHandle, CalculatorMode } from '../../types/testRoom';

/** How long to wait for the script before saying it could not load (offline or blocked). ASSUMED. */
export const DESMOS_LOAD_TIMEOUT_MS = 15_000;

function isFrameMessage(v: unknown): v is CalculatorFrameMessage {
  return typeof v === 'object' && v !== null && (v as { bb?: unknown }).bb === 'calc' && typeof (v as { type?: unknown }).type === 'string';
}

export function createDesmosEngine(opts: { framePath?: string; timeoutMs?: number } = {}): CalculatorEngine {
  const framePath = opts.framePath ?? CALCULATOR_FRAME_PATH;
  const timeoutMs = opts.timeoutMs ?? DESMOS_LOAD_TIMEOUT_MS;

  return {
    name: 'Desmos',
    mount(element: HTMLElement, mode: CalculatorMode, saved: CalculatorEngineState | null): Promise<CalculatorHandle> {
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('title', mode === 'graphing' ? 'Desmos graphing calculator' : 'Desmos scientific calculator');
      frame.setAttribute('referrerpolicy', 'strict-origin');
      frame.style.cssText = 'border:0;width:100%;height:100%;display:block;background:#fff';
      frame.src = `${framePath}?mode=${mode}`;

      let state: CalculatorEngineState | null = saved;
      let settled = false;
      let onMessage: ((e: MessageEvent) => void) | null = null;

      const cleanup = () => {
        if (onMessage) window.removeEventListener('message', onMessage);
        onMessage = null;
        frame.remove();
      };

      return new Promise<CalculatorHandle>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error('The calculator did not load in time.'));
        }, timeoutMs);

        onMessage = (e: MessageEvent) => {
          // Only this frame's messages; anything else (another frame, an extension) is ignored.
          if (e.source !== frame.contentWindow || !isFrameMessage(e.data)) return;
          const m = e.data;
          if (m.type === 'state') {
            state = m.state;
            return;
          }
          if (settled) return;
          if (m.type === 'error') {
            settled = true;
            clearTimeout(timer);
            cleanup();
            reject(new Error(m.reason === 'load' ? 'The calculator script could not load.' : 'The calculator could not start.'));
            return;
          }
          if (m.type === 'ready') {
            settled = true;
            clearTimeout(timer);
            if (saved !== null) frame.contentWindow?.postMessage({ bb: 'calc', type: 'setState', state: saved } satisfies CalculatorFrameMessage, '*');
            resolve({
              getState: () => state,
              // The frame resizes itself when its own window changes size.
              resize: () => undefined,
              destroy: cleanup,
            });
          }
        };
        window.addEventListener('message', onMessage);
        element.appendChild(frame);
      });
    },
  };
}
