import { useEffect, useRef } from 'react';
import { useExamStore } from '../stores/examStore';

export function useTelemetry() {
  const { status, isDesmosOpen, updateTelemetry, currentIndex, activeStage } = useExamStore();
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    lastTickRef.current = Date.now();
  }, [currentIndex, activeStage]);

  useEffect(() => {
    if (status !== 'testing') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      // Update dwell time on current question
      // If desmos is open, also increment desmos duration
      updateTelemetry(delta, isDesmosOpen ? delta : 0);
    }, 500);

    return () => clearInterval(interval);
  }, [status, isDesmosOpen, updateTelemetry]);
}
