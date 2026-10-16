// The calculator engine slot (docs/calculator-spec.md). None is set up: the Desmos API terms do not
// clearly allow this app's use, so the panel shows a plain message instead. To add an engine,
// implement CalculatorEngine and return it here; nothing else changes.

import type { CalculatorEngine } from '../../types/testRoom';

export function calculatorEngine(): CalculatorEngine | null {
  return null;
}
