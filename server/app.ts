// The local API. A plain `(Request) => Response` handler, so tests call it directly without a
// network. Every /api route goes through the security checks in security.ts.

import { DOWNLOAD_ENABLED } from '../src/config';
import { importBankText } from '../src/services/import/importBank';
import type { Sanitizer } from '../src/services/normalize/sanitize';
import { filterFromParams } from '../src/services/analytics/filter';
import { previousPeriod, scopeFromParams } from '../src/services/dashboard/scope';
import type { DashboardService } from './dashboard';
import type { AttemptStore, SessionFilter, TelemetryStore } from '../src/services/storage/attemptTypes';
import type { MistakeStore } from '../src/types/mistakes';
import type { RulesNotesStore } from '../src/types/ai';
import type { HiddenSessionsStore } from '../src/types/session';
import type { AnalyticsStore } from '../src/types/analytics';
import type { QuestionQuery } from '../src/services/storage/types';
import type { DownloadProgress, DownloadScopeChoice } from '../src/types/download';
import { DIFFICULTIES, SECTIONS, type Difficulty, type Section } from '../src/types/sat';
import type { DiskBankStore } from './bankStore';
import type { DownloadManager } from './download';
import { ClosedSessionError } from './userDb';
import { BackupError, type BackupManager } from './backups';
import { AiError, type AiService } from './ai/service';
import type { CalculatorService } from './calculator';
import type { ReportPeriod, WeakDrillRequest } from '../src/types/ai';
import { RULES_NOTE_MAX } from '../src/types/ai';
import { isObj, parseAiSettings, parseAttempt, parseEvent, parseSession, parseTag, type ValidatedUserData } from './validate';
import { checkHostAndOrigin, checkRequest, sameSecret, sessionCookie, type SecurityConfig } from './security';

export interface AppDeps {
  security: SecurityConfig;
  bank: DiskBankStore;
  users: AttemptStore & TelemetryStore & MistakeStore & RulesNotesStore & HiddenSessionsStore & { replaceAll(data: ValidatedUserData): Promise<void> };
  /** The AI layer. Absent in tests that do not need it. */
  ai?: AiService;
  /** The Desmos key and calculator page. Absent in tests that do not need it. */
  calculator?: CalculatorService;
  /** Snapshots and restore. Absent in tests that do not need them. */
  backups?: BackupManager;
  /** Summaries computed in SQL. Absent in tests that do not need them. */
  analytics?: AnalyticsStore;
  /** The whole Dashboard page per scope. Absent in tests that do not need it. */
  dashboard?: DashboardService;
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
const MAX_RESTORE_BYTES = 400 * 1024 * 1024;

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
      if (path === '/api/mistake-tags' && m === 'GET') return json(await deps.users.listTags());
      if (path === '/api/mistake-tags' && m === 'POST') {
        const tag = parseTag(await readJson(req));
        if (!tag) return problem(400, 'Malformed mistake tag.');
        await deps.users.addTag(tag);
        return json({ ok: true });
      }
      if (path === '/api/rules-notes' && m === 'GET') return json(await deps.users.listNotes());
      if (path.startsWith('/api/rules-notes/') && m === 'PUT') {
        const skill = decodeURIComponent(path.slice('/api/rules-notes/'.length));
        const body = await readJson(req);
        if (!skill || skill.length > 100 || !isObj(body) || typeof body.text !== 'string' || body.text.length > RULES_NOTE_MAX) return problem(400, 'Malformed note.');
        await deps.users.setNote(skill, body.text);
        return json({ ok: true });
      }

      // ---- hidden from analytics ----
      if (path === '/api/hidden-sessions' && m === 'GET') return json(await deps.users.listHidden());
      if (path === '/api/hidden-sessions' && m === 'POST') {
        const body = await readJson(req);
        if (!isObj(body)) return problem(400, 'Malformed request.');
        if (typeof body.before === 'number' && Number.isFinite(body.before)) return json({ changed: await deps.users.hideBefore(body.before) });
        const ids = body.sessionIds;
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > 10_000 || !ids.every((x) => typeof x === 'string' && x.length > 0 && x.length < 200) || typeof body.hidden !== 'boolean')
          return problem(400, 'Malformed request.');
        return json({ changed: await deps.users.setHidden(ids as string[], body.hidden) });
      }

      // ---- Desmos calculator (the key goes in, never out, except inside the sandboxed calculator page) ----
      if (path.startsWith('/api/calculator/')) {
        const calc = deps.calculator;
        if (!calc) return problem(404, 'Not found.');
        const what = path.slice('/api/calculator/'.length);
        try {
          if (what === 'status' && m === 'GET') return json(await calc.status());
          if (what === 'key' && m === 'PUT') {
            const body = await readJson(req);
            if (!isObj(body) || typeof body.key !== 'string') return problem(400, 'Paste a key.');
            return json(await calc.setKey(body.key));
          }
          if (what === 'key' && m === 'DELETE') return json(await calc.removeKey());
          if (what === 'test' && m === 'POST') return json(await calc.test());
          if (what === 'frame' && m === 'GET') {
            const mode = url.searchParams.get('mode') === 'scientific' ? 'scientific' : 'graphing';
            const page = await calc.frame(mode);
            if (!page) return problem(404, 'No Desmos key is saved.');
            return new Response(page.html, { status: 200, headers: page.headers });
          }
          return problem(404, 'Not found.');
        } catch (e) {
          // Only KeyStore's shape message can arrive here; it never contains the key.
          return problem(400, e instanceof Error ? e.message : 'Could not save the key.');
        }
      }

      // ---- AI (the key goes in, never out) ----
      if (path.startsWith('/api/ai/')) {
        const ai = deps.ai;
        if (!ai) return problem(404, 'Not found.');
        const what = path.slice('/api/ai/'.length);
        try {
          if (what === 'status' && m === 'GET') return json(await ai.status());
          if (what === 'key' && m === 'PUT') {
            const body = await readJson(req);
            if (!isObj(body) || typeof body.key !== 'string') return problem(400, 'Paste a key.');
            return json(await ai.setKey(body.key));
          }
          if (what === 'key' && m === 'DELETE') return json(await ai.removeKey());
          if (what === 'test' && m === 'POST') return json(await ai.testConnection());
          if (what === 'coach' && m === 'GET') {
            const f = filterFromParams(url.searchParams);
            return json(await ai.coach(f, previousPeriod(f)));
          }
          if (what === 'settings' && m === 'PUT') {
            const patch = parseAiSettings(await readJson(req), true);
            if (!patch) return problem(400, 'Malformed settings.');
            return json(await ai.updateSettings(patch));
          }
          const body = m === 'POST' ? await readJson(req) : undefined;
          const drillReq = (): WeakDrillRequest | null => {
            if (!isObj(body)) return null;
            const section: WeakDrillRequest['section'] | null = body.section === 'rw' || body.section === 'math' || body.section === 'both' ? body.section : null;
            const size = typeof body.size === 'number' && Number.isFinite(body.size) ? body.size : null;
            if (!section || size === null || typeof body.ruleOnly !== 'boolean') return null;
            return { section, size, ruleOnly: body.ruleOnly };
          };
          const period = (): ReportPeriod | null => {
            const p = isObj(body) ? body.period : null;
            return p === 'last_test' || p === 'last_7_days' || p === 'all_time' ? p : null;
          };
          if (what === 'preview/weak-drill' && m === 'POST') {
            const r = drillReq();
            return r ? json(await ai.previewWeakDrill(r)) : problem(400, 'Malformed request.');
          }
          if (what === 'weak-drill' && m === 'POST') {
            const r = drillReq();
            return r ? json(await ai.weakDrill(r)) : problem(400, 'Malformed request.');
          }
          if (what === 'preview/report' && m === 'POST') {
            const p = period();
            return p ? json(await ai.previewReport(p)) : problem(400, 'Malformed request.');
          }
          if (what === 'report' && m === 'POST') {
            const p = period();
            return p ? json(await ai.report(p, isObj(body) && body.regenerate === true)) : problem(400, 'Malformed request.');
          }
          return problem(404, 'Not found.');
        } catch (e) {
          if (e instanceof AiError) return problem(400, e.message);
          // Never echo a raw error from the AI path: it might carry request details.
          return problem(500, 'The AI request failed on this computer.');
        }
      }

      if (path === '/api/backups' && m === 'GET') {
        if (!deps.backups) return problem(404, 'Not found.');
        return json(await deps.backups.list());
      }
      if ((path === '/api/backups/restore' || path === '/api/data/restore') && m === 'POST') {
        const backups = deps.backups;
        if (!backups) return problem(404, 'Not found.');
        if (Number(req.headers.get('content-length') ?? '0') > MAX_RESTORE_BYTES) return problem(413, 'That file is too large to restore.');
        const body = await readJson(req);
        try {
          if (path === '/api/backups/restore') {
            if (!isObj(body) || typeof body.name !== 'string') return problem(400, 'Pick a backup to restore.');
            return json(await backups.restoreSnapshot(body.name));
          }
          return json(await backups.restore(isObj(body) ? body.data : undefined));
        } catch (e) {
          if (e instanceof BackupError) return problem(400, e.message);
          throw e;
        }
      }
      if (path === '/api/user-data' && m === 'DELETE') {
        await deps.users.clearAll();
        return json({ ok: true });
      }

      // ---- dashboard (one request per scope) ----
      if (path === '/api/dashboard' && m === 'GET') {
        if (!deps.dashboard) return problem(404, 'Not found.');
        return json(await deps.dashboard.load(scopeFromParams(url.searchParams)));
      }

      // ---- analytics (summaries only; raw events never leave the server) ----
      if (path.startsWith('/api/analytics/') && m === 'GET') {
        if (!deps.analytics) return problem(404, 'Not found.');
        const a = deps.analytics;
        const f = filterFromParams(url.searchParams);
        const what = path.slice('/api/analytics/'.length);
        if (what === 'overview') return json(await a.overview(f));
        if (what === 'skills') return json(await a.skills(f));
        if (what === 'skill') {
          const code = url.searchParams.get('skillCode');
          return code ? json(await a.skillDetail(f, code)) : problem(400, 'Missing skill.');
        }
        if (what === 'misses') {
          const section = url.searchParams.get('limitSection');
          const codes = (url.searchParams.get('skillCodes') ?? '').split(',').filter((c) => c !== '');
          return json(await a.misses(f, { section: SECTIONS.includes(section as Section) ? (section as Section) : undefined, skillCodes: codes }));
        }
        if (what === 'timing') return json(await a.timing(f));
        if (what === 'behavior') return json(await a.behavior(f));
        if (what === 'tests') return json(await a.tests(f));
        return problem(404, 'Not found.');
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
