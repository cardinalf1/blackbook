// Starts the local program (the compiled Bun server) as a child process and talks to it over the
// control line (server/control.ts). Used by the Electron main process and by --smoke-test.

import { spawn, type ChildProcess } from 'node:child_process';
import { encodeLine, lineSplitter, parseLine, type FatalCode, type StartupReport, type ToProgram, type ToShell } from '../../server/control';

/** The OS key store, from the shell's side (Electron safeStorage). */
export interface ShellCipher {
  available(): boolean;
  encrypt(plain: string): string;
  decrypt(base64: string): string;
}

export interface ReadyInfo {
  port: number;
  version: string;
  schemaVersion: number;
  startup: StartupReport;
}

export class SidecarFatal extends Error {
  constructor(
    readonly code: FatalCode | 'exited' | 'timeout',
    message: string,
  ) {
    super(message);
    this.name = 'SidecarFatal';
  }
}

export interface SidecarOptions {
  command: string;
  args: readonly string[];
  env: NodeJS.ProcessEnv;
  cipher: ShellCipher | null;
  /** Ordinary output lines from the program (already scrubbed by its own logger). */
  log: (line: string) => void;
  /** After ready: the program stopped on its own (a crash). Not called for a requested stop. */
  onCrash: (code: number | null, signal: string | null) => void;
  readyTimeoutMs?: number;
}

export class Sidecar {
  private child: ChildProcess | null = null;
  private ready: ReadyInfo | null = null;
  private stopping = false;
  private exited: Promise<void> = Promise.resolve();
  private nextId = 1;
  private exitWaiters = new Map<number, (r: { ok: boolean; snapshot: string | null }) => void>();

  constructor(private readonly o: SidecarOptions) {}

  get info(): ReadyInfo | null {
    return this.ready;
  }

  get running(): boolean {
    return this.child !== null && this.child.exitCode === null && this.child.signalCode === null;
  }

  get pid(): number | null {
    return this.child?.pid ?? null;
  }

  start(): Promise<ReadyInfo> {
    this.stopping = false;
    this.ready = null;
    const child = spawn(this.o.command, [...this.o.args], { stdio: ['pipe', 'pipe', 'pipe'], env: this.o.env, windowsHide: true });
    this.child = child;
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdin?.on('error', () => undefined);
    this.exited = new Promise((resolve) => child.once('exit', () => resolve()));

    return new Promise<ReadyInfo>((resolve, reject) => {
      let settled = false;
      const fail = (e: SidecarFatal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      };
      const timer = setTimeout(() => {
        fail(new SidecarFatal('timeout', 'The local program did not start in time.'));
        child.kill();
      }, this.o.readyTimeoutMs ?? 30_000);

      const onLine = (line: string) => {
        const msg = parseLine<ToShell>(line, ['ready', 'fatal', 'cipher', 'exit-ready']);
        if (!msg) {
          if (line.trim() !== '') this.o.log(line);
          return;
        }
        if (msg.type === 'ready') {
          this.ready = { port: msg.port, version: msg.version, schemaVersion: msg.schemaVersion, startup: msg.startup };
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(this.ready);
          }
        } else if (msg.type === 'fatal') {
          fail(new SidecarFatal(msg.code, msg.message));
        } else if (msg.type === 'cipher') {
          this.answerCipher(msg.id, msg.op, msg.data);
        } else if (msg.type === 'exit-ready') {
          this.exitWaiters.get(msg.id)?.({ ok: msg.ok, snapshot: msg.snapshot });
          this.exitWaiters.delete(msg.id);
        }
      };
      const out = lineSplitter(onLine);
      child.stdout?.on('data', (c: string) => out.push(c));
      child.stdout?.on('end', () => out.end());
      const err = lineSplitter((l) => l.trim() !== '' && this.o.log(l));
      child.stderr?.on('data', (c: string) => err.push(c));

      child.once('error', (e) => fail(new SidecarFatal('exited', `The local program could not start: ${e.message}`)));
      child.once('exit', (code, signal) => {
        for (const [, w] of this.exitWaiters) w({ ok: false, snapshot: null });
        this.exitWaiters.clear();
        if (!settled) fail(new SidecarFatal('exited', `The local program stopped while starting (code ${code ?? signal ?? 'unknown'}).`));
        else if (!this.stopping) this.o.onCrash(code, signal);
      });
    });
  }

  private send(msg: ToProgram): void {
    if (this.child?.stdin && !this.child.stdin.destroyed) this.child.stdin.write(encodeLine(msg));
  }

  private answerCipher(id: number, op: 'available' | 'encrypt' | 'decrypt', data: string | undefined): void {
    const c = this.o.cipher;
    try {
      if (op === 'available') {
        this.send({ type: 'cipher-result', id, ok: true, data: c?.available() ? 'yes' : 'no' });
      } else if (!c || !c.available() || data === undefined) {
        this.send({ type: 'cipher-result', id, ok: false });
      } else {
        this.send({ type: 'cipher-result', id, ok: true, data: op === 'encrypt' ? c.encrypt(data) : c.decrypt(data) });
      }
    } catch {
      this.send({ type: 'cipher-result', id, ok: false });
    }
  }

  /** Asks the program to finish writes, checkpoint and take the exit snapshot. */
  prepareExit(): Promise<{ ok: boolean; snapshot: string | null }> {
    if (!this.running) return Promise.resolve({ ok: false, snapshot: null });
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.exitWaiters.set(id, resolve);
      this.send({ type: 'prepare-exit', id });
    });
  }

  /** Closes the control line (the program then stops itself); kills it if it is still running after `graceMs`. */
  async stop(graceMs = 4000): Promise<void> {
    const child = this.child;
    if (!child || !this.running) return;
    this.stopping = true;
    child.stdin?.end();
    const timer = new Promise<'late'>((r) => setTimeout(() => r('late'), graceMs));
    if ((await Promise.race([this.exited.then(() => 'ok' as const), timer])) === 'late') {
      child.kill();
      await Promise.race([this.exited, new Promise((r) => setTimeout(r, 1000))]);
    }
  }
}
