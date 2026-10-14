// Minimal declarations for the Bun built-ins the server uses, so the project needs no extra
// type package. Only the members actually called are declared.

declare module 'bun:sqlite' {
  export interface Statement {
    run(...params: SqlValue[]): unknown;
    get(...params: SqlValue[]): unknown;
    all(...params: SqlValue[]): unknown[];
  }
  export type SqlValue = string | number | bigint | null | Uint8Array;
  export class Database {
    constructor(path: string, options?: { create?: boolean; strict?: boolean });
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
  }
}

interface BunServer {
  readonly port: number;
  stop(closeActiveConnections?: boolean): void;
}

interface BunServeOptions {
  port: number;
  hostname: string;
  /** Seconds before an idle connection is closed; 0 disables (needed for progress streams). */
  idleTimeout?: number;
  fetch(req: Request): Response | Promise<Response>;
}

declare const Bun: {
  serve(options: BunServeOptions): BunServer;
  readonly version: string;
};
