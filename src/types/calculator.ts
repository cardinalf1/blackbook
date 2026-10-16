// The Desmos calculator key (Phase 9 follow-up). The key goes in and never comes back out: the
// client only ever learns whether one is saved. The calculator page itself is served by the local
// server into a sandboxed frame (docs/calculator-spec.md).

import type { KeyProtection } from './keys';

export interface CalculatorKeyStatus {
  hasKey: boolean;
  /** How the saved key is kept on disk; null when none is saved. */
  keyProtection: KeyProtection | null;
}

/** Plain sentence; never contains the key. */
export interface CalculatorKeyTest {
  ok: boolean;
  message: string;
}

export interface CalculatorKeyStore {
  status(): Promise<CalculatorKeyStatus>;
  setKey(key: string): Promise<CalculatorKeyStatus>;
  removeKey(): Promise<CalculatorKeyStatus>;
  test(): Promise<CalculatorKeyTest>;
}

/** Where the sandboxed calculator page is served. Mode goes in the query: ?mode=graphing|scientific. */
export const CALCULATOR_FRAME_PATH = '/api/calculator/frame';

/** Messages between the app and the calculator frame. State is the engine's opaque saved state. */
export type CalculatorFrameMessage =
  | { bb: 'calc'; type: 'ready' }
  | { bb: 'calc'; type: 'error'; reason: 'load' | 'create' }
  | { bb: 'calc'; type: 'state'; state: unknown }
  | { bb: 'calc'; type: 'setState'; state: unknown };
