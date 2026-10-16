// Shims fs.readFileSync for jsdom's default-stylesheet.css and
// Module._resolveFilename for jsdom's xhr-sync-worker.js.
// In compiled standalone binaries (bun build --compile), jsdom's computed-style helper
// calls fs.readFileSync(path.resolve(__dirname, "../../../browser/default-stylesheet.css"), ...)
// and XMLHttpRequest-impl calls require.resolve("./xhr-sync-worker.js") which evaluates to
// the build machine's absolute path. Intercepting these calls prevents ENOENT / Cannot find module
// crashes on sidecar startup.
// NOTE: We MUST patch these BEFORE requiring jsdom, because jsdom evaluates them
// during module initialization. A static `export { JSDOM } from 'jsdom'` causes
// the bundler to hoist and evaluate jsdom before executing this file's statements.

import fs from 'node:fs';
import Module from 'node:module';
import { DEFAULT_STYLESHEET } from './defaultStylesheet';

const origReadFileSync = fs.readFileSync.bind(fs);

(fs as any).readFileSync = function (p: any, options?: any) {
  if (typeof p === 'string' && (p.endsWith('default-stylesheet.css') || p.includes('default-stylesheet.css'))) {
    if (options === 'utf-8' || options === 'utf8' || (typeof options === 'object' && options !== null && options.encoding?.toLowerCase().startsWith('utf'))) {
      return DEFAULT_STYLESHEET;
    }
    return Buffer.from(DEFAULT_STYLESHEET, 'utf-8');
  }
  return origReadFileSync(p, options);
};

const origResolveFilename = (Module as any)._resolveFilename;
if (typeof origResolveFilename === 'function') {
  (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
    if (typeof request === 'string' && request.includes('xhr-sync-worker')) {
      return 'xhr-sync-worker.js';
    }
    return origResolveFilename.call(this, request, parent, isMain, options);
  };
}

// Required dynamically after installing the monkey patches so computed-style.js
// and XMLHttpRequest-impl.js hit the patched methods during module initialization.
const jsdom = require('jsdom');
export const JSDOM: typeof import('jsdom').JSDOM = jsdom.JSDOM;
