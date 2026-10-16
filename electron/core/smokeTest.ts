// `Blackbook --smoke-test`: proves a build works without showing a window. On a temp data folder:
// start the local program, check /healthz, save a session through the API, prepare for exit, stop,
// check the port is free, start again, check the session survived, stop, check the port again.
// Exit code 0 only if every step passed. Runs locally for the Windows build and in CI for all three.

import { createServer } from 'node:net';
import { createSession } from '../../src/services/session/record';
import type { SessionRecord } from '../../src/types/session';
import type { ReadyInfo } from './sidecar';

export interface SmokeSidecar {
  start(): Promise<ReadyInfo>;
  prepareExit(): Promise<{ ok: boolean; snapshot: string | null }>;
  stop(graceMs?: number): Promise<void>;
}

export interface SmokeDeps {
  /** A fresh program on the same data folder each call. */
  makeSidecar: () => SmokeSidecar;
  token: string;
  expectVersion: string;
  fetch: typeof fetch;
  log: (line: string) => void;
}

export function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}

const SMOKE_CONFIG = { section: 'math' as const, domainCode: 'all', skillCodes: [], difficulties: [], count: 1, liveOnly: true };

export async function runSmokeTest(d: SmokeDeps): Promise<boolean> {
  const step = (ok: boolean, what: string): boolean => {
    d.log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
    return ok;
  };
  const call = (port: number, path: string, init: RequestInit = {}) =>
    d.fetch(`http://127.0.0.1:${port}${path}`, { ...init, headers: { 'x-blackbook-token': d.token, 'content-type': 'application/json', ...(init.headers ?? {}) } });

  const sessionId = `smoke-${Date.now()}`;
  let ok = true;
  const first = d.makeSidecar();
  let port: number;
  try {
    const ready = await first.start();
    port = ready.port;
    ok = step(ready.version === d.expectVersion, `started, version ${ready.version}, port ${port}`) && ok;
  } catch (e) {
    step(false, `start: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
  try {
    const h = (await (await d.fetch(`http://127.0.0.1:${port}/healthz`)).json()) as { version?: string; schemaVersion?: number };
    ok = step(h.version === d.expectVersion && typeof h.schemaVersion === 'number', `/healthz says ${JSON.stringify(h)}`) && ok;
    const page = await d.fetch(`http://127.0.0.1:${port}/`);
    ok = step(page.status === 200 && (page.headers.get('content-security-policy') ?? '').includes("default-src 'self'"), `page served (${page.status})`) && ok;
    const session: SessionRecord = createSession(sessionId, 'drill', SMOKE_CONFIG, ['smoke-q1'], Date.now());
    const put = await call(port, `/api/sessions/${sessionId}`, { method: 'PUT', body: JSON.stringify({ session, attempts: [] }) });
    ok = step(put.ok, `session saved through the API (${put.status})`) && ok;
    const prep = await first.prepareExit();
    ok = step(prep.ok, `prepared for exit (snapshot ${prep.snapshot ?? 'none'})`) && ok;
  } catch (e) {
    ok = step(false, `first run: ${e instanceof Error ? e.message : String(e)}`) && ok;
  }
  await first.stop();
  ok = step(await portIsFree(port), `port ${port} free after stop`) && ok;

  const second = d.makeSidecar();
  try {
    const ready = await second.start();
    const got = await call(ready.port, `/api/sessions/${sessionId}`);
    const body = got.ok ? ((await got.json()) as { id?: string } | null) : null;
    ok = step(body?.id === sessionId, 'session still there after a restart') && ok;
    ok = step(ready.startup.uncleanExit === false, 'previous run recorded as a clean stop') && ok;
    await second.stop();
    ok = step(await portIsFree(ready.port), `port ${ready.port} free after the second stop`) && ok;
  } catch (e) {
    ok = step(false, `second run: ${e instanceof Error ? e.message : String(e)}`) && ok;
    await second.stop();
  }
  d.log(ok ? 'SMOKE TEST PASSED' : 'SMOKE TEST FAILED');
  return ok;
}
