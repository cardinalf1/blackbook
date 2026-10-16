// The private line between the desktop shell (Electron) and the local program it starts. It runs
// over the child's stdin and stdout, so no web page can reach it. Each message is one line of JSON
// after a fixed prefix; any other stdout line is ordinary log output.
//
// Shell -> program: answers to encryption requests, and "prepare to exit".
// Program -> shell: ready (with the port it got), a fatal start error, encryption requests (the
// keys are sealed with the OS key store, which only the shell can reach), and "ready to exit".
// When stdin closes (the shell quit or crashed) the program stops cleanly by itself, so it never
// outlives the app holding a port.

import type { AppStartupReport } from '../src/types/appInfo';
import type { KeyCipher } from './ai/keyStore';

export const CONTROL_PREFIX = '@@blackbook ';

/** What happened at start, shown to the user as one line when the last run did not stop cleanly. */
export type StartupReport = AppStartupReport;

export type FatalCode = 'newer-db' | 'start';

export type ToShell =
  | { type: 'ready'; port: number; version: string; schemaVersion: number; startup: StartupReport }
  | { type: 'fatal'; code: FatalCode; message: string }
  | { type: 'cipher'; id: number; op: 'available' | 'encrypt' | 'decrypt'; data?: string }
  | { type: 'exit-ready'; id: number; snapshot: string | null; ok: boolean };

export type ToProgram = { type: 'cipher-result'; id: number; ok: boolean; data?: string } | { type: 'prepare-exit'; id: number };

export function encodeLine(msg: ToShell | ToProgram): string {
  return `${CONTROL_PREFIX}${JSON.stringify(msg)}\n`;
}

/** The message on a line, or null for an ordinary log line or anything malformed. */
export function parseLine<T extends ToShell | ToProgram>(line: string, types: readonly T['type'][]): T | null {
  const trimmed = line.replace(/\r$/, '');
  if (!trimmed.startsWith(CONTROL_PREFIX)) return null;
  try {
    const v = JSON.parse(trimmed.slice(CONTROL_PREFIX.length)) as unknown;
    if (typeof v !== 'object' || v === null) return null;
    const type = (v as { type?: unknown }).type;
    return typeof type === 'string' && (types as readonly string[]).includes(type) ? (v as T) : null;
  } catch {
    return null;
  }
}

/** Splits a byte stream into lines, keeping a partial last line until its end arrives. */
export function lineSplitter(onLine: (line: string) => void): { push(chunk: string): void; end(): void } {
  let buf = '';
  return {
    push(chunk) {
      buf += chunk;
      let i = buf.indexOf('\n');
      while (i >= 0) {
        onLine(buf.slice(0, i));
        buf = buf.slice(i + 1);
        i = buf.indexOf('\n');
      }
    },
    end() {
      if (buf !== '') onLine(buf);
      buf = '';
    },
  };
}

export interface ControlIo {
  write(text: string): void;
  /** Subscribes to stdin chunks and its end. */
  onData(fn: (chunk: string) => void): void;
  onEnd(fn: () => void): void;
}

/** The program's side of the line. */
export class ControlChannel {
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: { ok: boolean; data?: string }) => void; timer: ReturnType<typeof setTimeout> }>();
  private prepareExit: ((id: number) => void) | null = null;
  private closed: (() => void) | null = null;
  private ended = false;

  constructor(
    private readonly io: ControlIo,
    private readonly timeoutMs = 5000,
  ) {
    const split = lineSplitter((line) => this.onLine(line));
    io.onData((c) => split.push(c));
    io.onEnd(() => {
      split.end();
      this.ended = true;
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.resolve({ ok: false });
      }
      this.pending.clear();
      this.closed?.();
    });
  }

  send(msg: ToShell): void {
    this.io.write(encodeLine(msg));
  }

  onPrepareExit(fn: (id: number) => void): void {
    this.prepareExit = fn;
  }

  /** Called once when the shell goes away (stdin closed). */
  onClosed(fn: () => void): void {
    this.closed = fn;
  }

  private onLine(line: string): void {
    const msg = parseLine<ToProgram>(line, ['cipher-result', 'prepare-exit']);
    if (!msg) return;
    if (msg.type === 'prepare-exit') {
      this.prepareExit?.(msg.id);
      return;
    }
    const p = this.pending.get(msg.id);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(msg.id);
    p.resolve({ ok: msg.ok, ...(msg.data !== undefined ? { data: msg.data } : {}) });
  }

  /** Asks the shell to run one encryption step. Resolves ok:false on timeout or a closed line. */
  request(op: 'available' | 'encrypt' | 'decrypt', data?: string): Promise<{ ok: boolean; data?: string }> {
    if (this.ended) return Promise.resolve({ ok: false });
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false });
      }, this.timeoutMs);
      this.pending.set(id, { resolve, timer });
      this.send({ type: 'cipher', id, op, ...(data !== undefined ? { data } : {}) });
    });
  }
}

/** Key encryption through the shell's OS key store. */
export function channelCipher(ch: ControlChannel): KeyCipher {
  return {
    async available() {
      const r = await ch.request('available');
      return r.ok && r.data === 'yes';
    },
    async encrypt(plain) {
      const r = await ch.request('encrypt', plain);
      if (!r.ok || r.data === undefined) throw new Error('Could not encrypt the key.');
      return r.data;
    },
    async decrypt(sealed) {
      const r = await ch.request('decrypt', sealed);
      if (!r.ok || r.data === undefined) throw new Error('Could not decrypt the key.');
      return r.data;
    },
  };
}
