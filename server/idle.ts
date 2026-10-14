// Shuts the local server down when nobody has used it for a while. The open app pings it
// regularly, so this only fires after every Blackbook tab is closed. Never while busy (a download
// or import running). Turned off in dev.

export interface IdleMonitor {
  /** Call on every request. */
  touch(): void;
  stop(): void;
}

export function createIdleMonitor(opts: {
  timeoutMs: number;
  onIdle: () => void;
  isBusy: () => boolean;
  now?: () => number;
  checkEveryMs?: number;
}): IdleMonitor {
  const now = opts.now ?? Date.now;
  let last = now();
  let fired = false;
  const timer = setInterval(() => {
    if (fired) return;
    if (opts.isBusy()) {
      last = now();
      return;
    }
    if (now() - last >= opts.timeoutMs) {
      fired = true;
      clearInterval(timer);
      opts.onIdle();
    }
  }, opts.checkEveryMs ?? 15_000);
  return {
    touch: () => {
      last = now();
    },
    stop: () => clearInterval(timer),
  };
}
