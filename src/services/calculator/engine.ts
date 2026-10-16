// The calculator engine slot (docs/calculator-spec.md). Desmos is used only when the user has saved
// their own API key in Settings; otherwise there is no engine and the panel says how to add one.

import { useEffect } from 'react';
import { createStore, useStore } from 'zustand';
import { calculatorKeyStore } from '../storage';
import type { CalculatorEngine } from '../../types/testRoom';
import { createDesmosEngine } from './desmos';

/** One engine for the app, so the panel's effects see a stable value. */
const desmos = createDesmosEngine();

interface EngineState {
  /** Null until the first status answer (or when the local server could not be asked). */
  hasKey: boolean | null;
  refresh(): Promise<void>;
}

export const calculatorEngineStore = createStore<EngineState>()((set) => ({
  hasKey: null,
  async refresh() {
    try {
      set({ hasKey: (await calculatorKeyStore.status()).hasKey });
    } catch {
      set({ hasKey: false });
    }
  },
}));

/** The engine to use now: Desmos with a saved key, else none. Asks the server once per mount. */
export function useCalculatorEngine(): CalculatorEngine | null {
  const hasKey = useStore(calculatorEngineStore, (s) => s.hasKey);
  useEffect(() => {
    void calculatorEngineStore.getState().refresh();
  }, []);
  return hasKey ? desmos : null;
}
