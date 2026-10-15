// The local API. A plain `(Request) => Response` handler, so tests call it directly without a
// network. Every /api route goes through the security checks in security.ts.

import { DOWNLOAD_ENABLED } from '../src/config';
import { importBankText } from '../src/services/import/importBank';
import type { Sanitizer } from '../src/services/normalize/sanitize';
import type { AttemptStore, SessionFilter, TelemetryStore } from '../src/services/storage/attemptTypes';
import type { QuestionQuery } from '../src/services/storage/types';
import type { DownloadProgress, DownloadScopeChoice } from '../src/types/download';
import { DIFFICULTIES, SECTIONS, type Difficulty, type Section } from '../src/types/sat';
import type { DiskBankStore } from './bankStore';
import type { DownloadManager } from './download';
import { ClosedSessionError } from './userDb';
import { isObj, parseAttempt, parseEvent, parseSession } from './validate';
import { checkHostAndOrigin, checkRequest, sameSecret, sessionCookie, type SecurityConfig } from './security';

export interface AppDeps {
  security: SecurityConfig;
  bank: DiskBankStore;
  users: AttemptStore & TelemetryStore;
  downloads: DownloadManager;
  sanitize: Sanitizer;
  dataFolder: string;
  /** Called on every authorized request (idle shutdown). */
  onActivity?: () => void;
  /** Heartbeat interval for progress streams. */
  streamHeartbeatMs?: number;
}

const MAX_IMPORT_BYTES = 200 * 1024 * 1024;
const MAX_EVENT_BATCH = 5000;
const MAX_EVENT_BYTES = 2 * 1024 * 1024;

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

const problem = (status: number, message: string) => json({ error: message }, status);

async function readJson(req: Request): Promise<unknown> {
  try {
    return (await req.json()) as unknown;
  } catch {
    return undefined;
  }
}

function parseScope(v: unknown): DownloadScopeChoice | null {
  if (!isObj(v) || !Array.isArray(v.sections) || typeof v.liveOnly !== 'boolean') return null;
  const sections = [...new Set(v.sections)].filter((s): s is Section => SECTIONS.includes(s as Section));
  if (sections.length === 0 || sections.length !== v.sections.length) return null;
  return { sections, liveOnly: v.liveOnly };
}

function parseQuery(url: URL): QuestionQuery {
  const q: QuestionQuery = {};
  const section = url.searchParams.get('section');
  const difficulty = url.searchParams.get('difficulty');
  const domainCode = url.searchParams.get('domainCode');
  const skillCode = url.searchParams.get('skillCode');
  if (section && SECTIONS.includes(section as Section)) q.section = section as Section;
  if (difficulty && DIFFICULTIES.includes(difficulty as Difficulty)) q.difficulty = difficulty as Difficulty;
  if (domainCode) q.domainCode = domainCode;
  if (skillCode) q.skillCode = skillCode;
  return q;
}

function progressStream(deps: AppDeps, req: Request): Response {
  const encoder = new TextEncoder();
  let cleanup = () => undefined as void;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (p: DownloadProgress) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(p)}\n\n`));
        } catch {
          cleanup();
        }
      };
      send(deps.downloads.snapshot());
      const unsubscribe = deps.downloads.subscribe(send);
      // Comments keep the connection alive and let the client notice a dead server.
      const beat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          cleanup();
        }
      }, deps.streamHeartbeatMs ?? 10_000);
      cleanup = () => {
        clearInterval(beat);
        unsubscribe();
      };
      req.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export function createHandler(deps: AppDeps): (req: Request) => Promise<Response> {
  let importing = false;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;
    if (!path.startsWith('/api/')) return problem(404, 'Not found.');
    const m = req.method;

    // Token exchange: the app sends the token from its first-load URL and gets a session cookie.
    if (path === '/api/session' && m === 'POST') {
      const base = checkHostAndOrigin(req, deps.security);
      if (!base.ok) return problem(base.status, base.message);
      const body = await readJson(req);
      const token = isObj(body) && typeof body.token === 'string' ? body.token : '';
      if (!sameSecret(token, deps.security.token)) return problem(401, 'Wrong access key. Open Blackbook again from its launch link.');
      return new Response(null, { status: 204, headers: { 'Set-Cookie': sessionCookie(deps.security.token), 'Cache-Control': 'no-store' } });
    }

    const guard = checkRequest(req, deps.security);
    if (!guard.ok) return problem(guard.status, guard.message);
    deps.onActivity?.();

    try {
      // ---- info ----
      if (path === '/api/health' && m === 'GET') return json({ ok: true });
      if (path === '/api/info' && m === 'GET') return json({ dataFolder: deps.dataFolder, downloadEnabled: DOWNLOAD_ENABLED });

      // ---- question bank ----
      if (path === '/api/bank/meta' && m === 'GET') return json(await deps.bank.getMeta());
      if (path === '/api/bank/count' && m === 'GET') return json({ count: await deps.bank.count() });
      if (path === '/api/bank/questions' && m === 'GET') return json(await deps.bank.query(parseQuery(url)));
      if (path.startsWith('/api/bank/questions/') && m === 'GET') {
        const q = await deps.bank.get(decodeURIComponent(path.slice('/api/bank/questions/'.length)));
        return q ? json(q) : problem(404, 'No such question.');
      }
      if (path === '/api/bank' && m === 'DELETE') {
        if (deps.downloads.isRunning() || importing) return problem(409, 'Wait for the current download or import to finish.');
        await deps.bank.clear();
        return json({ ok: true });
      }
      if (path === '/api/bank/import' && m === 'POST') {
        if (deps.downloads.isRunning() || importing) return problem(409, 'Wait for the current download or import to finish.');
        const length = Number(req.headers.get('content-length') ?? '0');
        if (length > MAX_IMPORT_BYTES) return problem(413, 'That file is too large to be a question bank.');
        importing = true;
        try {
          const text = await req.text();
          return json(await importBankText(text, { store: deps.bank, sanitize: deps.sanitize, signal: req.signal }));
        } finally {
          importing = false;
        }
      }

      // ---- user data ----
      if (path === '/api/attempts' && m === 'GET') {
        return json(await deps.users.listAttempts(url.searchParams.get('sessionId') ?? undefined));
      }
      if (path === '/api/flags' && m === 'GET') return json(await deps.users.listFlags());
      if (path.startsWith('/api/flags/') && m === 'PUT') {
        const body = await readJson(req);
        if (!isObj(body) || typeof body.flagged !== 'boolean') return problem(400, 'Malformed flag.');
        await deps.users.setFlag(decodeURIComponent(path.slice('/api/flags/'.length)), body.flagged);
        return json({ ok: true });
      }
      if (path === '/api/sessions' && m === 'GET') {
        const filter: SessionFilter = {};
        const status = url.searchParams.get('status');
        const mode = url.searchParams.get('mode');
        if (status === 'in_progress' || status === 'finished' || status === 'abandoned') filter.status = status;
        if (mode === 'drill' || mode === 'exam') filter.mode = mode;
        return json(await deps.users.listSessions(filter));
      }
      if (path.startsWith('/api/sessions/')) {
        const id = decodeURIComponent(path.slice('/api/sessions/'.length));
        if (m === 'GET') return json(await deps.users.getSession(id));
        if (m === 'PUT') {
          const body = await readJson(req);
          if (!isObj(body)) return problem(400, 'Malformed session.');
          const s = parseSession(body.session);
          if (!s || s.id !== id) return problem(400, 'Malformed session.');
          const raw = body.attempts ?? [];
          if (!Array.isArray(raw) || raw.length > 500) return problem(400, 'Malformed attempts.');
          const attempts = raw.map(parseAttempt);
          if (attempts.some((a) => a === null || a.sessionId !== id || a.mode !== s.mode)) return problem(400, 'Malformed attempts.');
          try {
            await deps.users.saveSession(s, attempts as NonNullable<(typeof attempts)[number]>[]);
          } catch (e) {
            if (e instanceof ClosedSessionError) return problem(409, e.message);
            throw e;
          }
          return json({ ok: true });
        }
      }
      if (path === '/api/events' && m === 'POST') {
        const length = Number(req.headers.get('content-length') ?? '0');
        if (length > MAX_EVENT_BYTES) return problem(413, 'Too many events in one request.');
        const body = await readJson(req);
        if (!isObj(body) || !Array.isArray(body.events) || body.events.length > MAX_EVENT_BATCH) return problem(400, 'Malformed events.');
        const events = body.events.map(parseEvent);
        if (events.some((e) => e === null)) return problem(400, 'Malformed events.');
        await deps.users.appendEvents(events as NonNullable<(typeof events)[number]>[]);
        return json({ ok: true, stored: events.length });
      }
      if (path === '/api/events' && m === 'GET') return json(await deps.users.listEvents(url.searchParams.get('sessionId') ?? undefined));
      if (path === '/api/events' && m === 'DELETE') {
        await deps.users.clearEvents();
        return json({ ok: true });
      }
      if (path === '/api/status' && m === 'GET') return json(await deps.users.questionStatus());
      if (path === '/api/data/stats' && m === 'GET') return json(await deps.users.stats());
      if (path === '/api/data/export' && m === 'GET') {
        return json(await deps.users.exportAll(), 200, { 'Content-Disposition': 'attachment; filename="blackbook-data.json"' });
      }
      if (path === '/api/user-data' && m === 'DELETE') {
        await deps.users.clearAll();
        return json({ ok: true });
      }

      // ---- download ----
      if (path === '/api/download' && m === 'GET') return json(deps.downloads.snapshot());
      if (path === '/api/download/events' && m === 'GET') return progressStream(deps, req);
      if (path === '/api/download/start' && m === 'POST') {
        if (!DOWNLOAD_ENABLED) return problem(403, 'Downloading is turned off in this build. Import a file instead.');
        if (importing) return problem(409, 'Wait for the import to finish.');
        const scope = parseScope(await readJson(req));
        if (!scope) return problem(400, 'Pick at least one section.');
        if (!deps.downloads.start(scope)) return problem(409, 'A download is already running.');
        return json(deps.downloads.snapshot(), 202);
      }
      if (path === '/api/download/cancel' && m === 'POST') {
        deps.downloads.cancel();
        return json({ ok: true });
      }
      if (path === '/api/download/free-cache' && m === 'POST') {
        if (deps.downloads.isRunning()) return problem(409, 'Wait for the download to finish.');
        await deps.downloads.freeCache();
        return json(deps.downloads.snapshot());
      }

      return problem(404, 'Not found.');
    } catch (e) {
      return problem(500, e instanceof Error ? e.message : String(e));
    }
  };
}
