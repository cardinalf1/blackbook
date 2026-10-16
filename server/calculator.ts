// The Desmos calculator (Phase 9 follow-up, docs/calculator-spec.md). The user's own API key lives
// in its own file in the user-data folder (like the Groq key), never in the database, so no export,
// backup or log can hold it. The key reaches the browser only inside the calculator page served
// here, which the app loads in a sandboxed frame (scripts only, no same-origin access): the remote
// script never runs with access to the app's origin, its token or its data, and the app's own code
// never handles the key.

import { randomBytes } from 'node:crypto';
import type { CalculatorKeyStatus, CalculatorKeyTest } from '../src/types/calculator';
import { KeyStore, redact } from './ai/keyStore';

/** The official script. VERIFIED (API docs v1.11, 2026-10-16): the key goes in the apiKey URL parameter. */
export const DESMOS_SCRIPT = 'https://www.desmos.com/api/v1.11/calculator.js';

export interface CalculatorDeps {
  keys: KeyStore;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}

export class CalculatorService {
  constructor(private readonly d: CalculatorDeps) {}

  async status(): Promise<CalculatorKeyStatus> {
    return { hasKey: await this.d.keys.has(), keyProtection: await this.d.keys.protection() };
  }

  async setKey(key: string): Promise<CalculatorKeyStatus> {
    await this.d.keys.set(key);
    return this.status();
  }

  async removeKey(): Promise<CalculatorKeyStatus> {
    await this.d.keys.remove();
    return this.status();
  }

  /**
   * Asks Desmos for the script with the key. VERIFIED (2026-10-16): an unknown key gets
   * 403 "Unrecognized API key", a missing one 403 too, so 200 means Desmos recognizes the key.
   * It cannot show whether a key is limited to some websites: this request has no page origin.
   */
  async test(): Promise<CalculatorKeyTest> {
    const key = await this.d.keys.get();
    if (!key) return { ok: false, message: 'No Desmos key saved yet.' };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.d.timeoutMs ?? 10_000);
    try {
      const res = await this.d.fetch(`${DESMOS_SCRIPT}?apiKey=${encodeURIComponent(key)}`, { signal: ctl.signal, redirect: 'follow' });
      if (res.ok) return { ok: true, message: 'Desmos recognizes this key. The calculator will load in tests and drills.' };
      if (res.status === 403) return { ok: false, message: 'Desmos does not recognize this key. Check it at desmos.com/my-api.' };
      return { ok: false, message: `Desmos answered with an error (HTTP ${res.status}). Try again later.` };
    } catch (e) {
      const why = e instanceof Error && e.name === 'AbortError' ? 'Desmos did not answer in time.' : 'Could not reach Desmos. Are you offline?';
      return { ok: false, message: redact(why, key) };
    } finally {
      clearTimeout(timer);
    }
  }

  /** The calculator page for the sandboxed frame, or null when no key is saved. */
  async frame(mode: 'graphing' | 'scientific'): Promise<{ html: string; headers: Record<string, string> } | null> {
    const key = await this.d.keys.get();
    if (!key) return null;
    const nonce = randomBytes(16).toString('base64');
    return { html: framePage(key, mode, nonce), headers: frameHeaders(nonce) };
  }
}

/**
 * Only Desmos's own hosts may supply scripts, styles, images, fonts and connections; inline code
 * needs the nonce. ASSUMED needs: 'unsafe-eval' and blob: workers (a graphing engine compiles
 * expressions); not verifiable without a key. The page may only be framed by the app itself.
 */
export function frameHeaders(nonce: string): Record<string, string> {
  const desmos = 'https://www.desmos.com https://*.desmos.com';
  return {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy': [
      "default-src 'none'",
      `script-src 'nonce-${nonce}' 'unsafe-eval' ${desmos} blob:`,
      `style-src 'unsafe-inline' ${desmos}`,
      `img-src data: blob: ${desmos}`,
      `font-src data: ${desmos}`,
      `connect-src ${desmos}`,
      `worker-src blob: ${desmos}`,
      "frame-ancestors 'self'",
    ].join('; '),
    'referrer-policy': 'strict-origin',
  };
}

function framePage(key: string, mode: 'graphing' | 'scientific', nonce: string): string {
  // The key passed KeyStore's shape check ([A-Za-z0-9_-] only), so it is safe inside a JS string.
  const src = `${DESMOS_SCRIPT}?apiKey=${encodeURIComponent(key)}`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Calculator</title>
<style>html,body,#calc{margin:0;height:100%;width:100%;overflow:hidden;background:#fff}</style>
</head><body><div id="calc"></div>
<script nonce="${nonce}">
(function () {
  var MODE = ${JSON.stringify(mode)};
  var post = function (m) { m.bb = 'calc'; parent.postMessage(m, '*'); };
  var calc = null;
  var s = document.createElement('script');
  s.src = ${JSON.stringify(src)};
  s.onerror = function () { post({ type: 'error', reason: 'load' }); };
  s.onload = function () {
    try {
      var el = document.getElementById('calc');
      if (MODE === 'scientific') {
        calc = Desmos.ScientificCalculator(el, { settingsMenu: false });
      } else {
        calc = Desmos.GraphingCalculator(el, { keypad: true, expressions: true, settingsMenu: true, zoomButtons: true, border: false });
        calc.setMathBounds({ left: -10, right: 10, bottom: -10, top: 10 });
      }
      calc.observeEvent('change', function () { post({ type: 'state', state: calc.getState() }); });
      window.addEventListener('resize', function () { if (calc) calc.resize(); });
      post({ type: 'ready' });
    } catch (e) {
      post({ type: 'error', reason: 'create' });
    }
  };
  window.addEventListener('message', function (e) {
    if (e.source !== parent || !e.data || e.data.bb !== 'calc' || !calc) return;
    if (e.data.type === 'setState' && e.data.state) {
      try { calc.setState(e.data.state); } catch (err) { /* an old or foreign state: keep the blank one */ }
    }
  });
  document.head.appendChild(s);
})();
</script></body></html>`;
}
