// Bundles the Electron main process and preload into out/ (CommonJS, Electron's Node).
// The page is built by Vite (dist/) and the local program by `bun build --compile` (scripts/build-release.ts).

import { build } from 'esbuild';

const common = { bundle: true, platform: 'node' as const, format: 'cjs' as const, target: 'node22', external: ['electron'], sourcemap: false, logLevel: 'warning' as const };

await build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'out/main.cjs' });
// The preload runs sandboxed: it may only use the 'electron' module, so everything else is bundled in.
await build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'out/preload.cjs' });
console.log('Built out/main.cjs and out/preload.cjs');
