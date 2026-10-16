// Shims fs.readFileSync for jsdom's default-stylesheet.css.
// In compiled standalone binaries (bun build --compile), jsdom's computed-style helper
// calls fs.readFileSync(path.resolve(__dirname, "../../../browser/default-stylesheet.css"), ...)
// where __dirname points to the build machine's path. Intercepting this call and serving
// the embedded stylesheet string prevents an ENOENT crash on sidecar startup.
// NOTE: We MUST patch fs.readFileSync BEFORE requiring jsdom, because jsdom evaluates
// computed-style.js at require/import time. A static `export { JSDOM } from 'jsdom'`
// causes the bundler to hoist and evaluate jsdom before executing this file's statements.

import fs from 'node:fs';
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

// Required dynamically after installing the monkey patch so computed-style.js
// hits the patched readFileSync instead of the native one during module initialization.
const jsdom = require('jsdom');
export const JSDOM: typeof import('jsdom').JSDOM = jsdom.JSDOM;
