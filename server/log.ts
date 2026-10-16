// The local log: plain lines in `logs/blackbook.log` inside the data folder, rotated at 1 MB with
// three old files kept. Every line is scrubbed (keys, tokens, home paths) before it is written.
// Nothing here ever receives question text: callers log events and counts, not content.

import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { redact } from '../src/services/diagnostics/redact';

export const LOG_MAX_BYTES = 1024 * 1024;
export const LOG_KEEP = 3;

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  /** Secrets learned after start (the launch token, a newly saved key) to scrub from now on. */
  addSecret(s: string | null): void;
}

export function logFile(dataFolder: string, name = 'blackbook.log'): string {
  return join(dataFolder, 'logs', name);
}

/** Rotates `path` when it is over the limit: .log -> .log.1 -> .log.2 -> .log.3 (dropped). */
export function rotateIfNeeded(path: string, maxBytes = LOG_MAX_BYTES, keep = LOG_KEEP): void {
  let size = 0;
  try {
    size = statSync(path).size;
  } catch {
    return;
  }
  if (size < maxBytes) return;
  rmSync(`${path}.${keep}`, { force: true });
  for (let i = keep - 1; i >= 1; i--) {
    try {
      renameSync(`${path}.${i}`, `${path}.${i + 1}`);
    } catch {
      // not there
    }
  }
  renameSync(path, `${path}.1`);
}

export function createLogger(opts: { path: string; echo?: boolean; now?: () => Date; maxBytes?: number }): Logger {
  const secrets: string[] = [];
  const home = homedir();
  let dirReady = false;
  const write = (level: string, msg: string) => {
    const line = `${(opts.now ?? (() => new Date()))().toISOString()} ${level} ${redact(msg, { secrets, home })}`;
    if (opts.echo) (level === 'ERROR' ? console.error : console.log)(line);
    try {
      if (!dirReady) {
        mkdirSync(join(opts.path, '..'), { recursive: true });
        dirReady = true;
      }
      rotateIfNeeded(opts.path, opts.maxBytes);
      appendFileSync(opts.path, `${line}\n`, 'utf8');
    } catch {
      // A log that cannot be written must never stop the program.
    }
  };
  return {
    info: (m) => write('INFO', m),
    warn: (m) => write('WARN', m),
    error: (m) => write('ERROR', m),
    addSecret: (s) => {
      if (s && !secrets.includes(s)) secrets.push(s);
    },
  };
}
