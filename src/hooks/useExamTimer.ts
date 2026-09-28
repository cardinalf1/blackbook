import { useEffect } from 'react';
import { useExamStore } from '../stores/examStore';

export function useExamTimer() {
  const { status, tickTimer } = useExamStore();

  useEffect(() => {
    if (status !== 'testing') return;

    const interval = setInterval(() => {
      tickTimer();
    }, 1000);

    return () => clearInterval(interval);
  }, [status, tickTimer]);
}
