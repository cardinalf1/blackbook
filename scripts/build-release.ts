import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`> ${command} ${args.join(' ')}`);
    const proc = spawn(command, args, { stdio: 'inherit', shell: true });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}: ${command} ${args.join(' ')}`));
    });
  });
}

async function sha256File(path: string): Promise<string> {
  const buf = await readFile(path);
  return createHash('sha256').update(buf).digest('hex');
}

async function main() {
  console.log('--- Blackbook 1.0.0 Release Packaging ---');

  // 1. Ensure directories exist
  await mkdir('sidecar', { recursive: true });
  await mkdir('release', { recursive: true });

  // 2. Build Vite web bundle
  console.log('Building Vite web bundle...');
  await run('bun', ['run', 'build']);

  // 3. Build Electron main/preload
  console.log('Building Electron main and preload scripts...');
  await run('bun', ['scripts/build-electron.ts']);

  // 4. Compile Bun sidecar
  const isWindows = process.platform === 'win32';
  const sidecarName = isWindows ? 'blackbook-server.exe' : 'blackbook-server';
  const sidecarPath = join('sidecar', sidecarName);
  console.log(`Compiling local sidecar to ${sidecarPath}...`);
  await run('bun', ['build', '--compile', 'server/main.ts', '--outfile', sidecarPath]);

  // 5. Run electron-builder
  console.log('Packaging desktop application with electron-builder...');
  const targetFlag = isWindows ? '--win' : process.platform === 'darwin' ? '--mac' : '--linux';
  await run('bunx', ['electron-builder', targetFlag, '--publish', 'never']);

  // 6. Generate release/SHA256SUMS.txt
  console.log('Generating SHA256 checksums...');
  const entries = await readdir('release');
  const checksumLines: string[] = [];

  for (const name of entries.sort()) {
    if (name.endsWith('.exe') || name.endsWith('.dmg') || name.endsWith('.zip') || name.endsWith('.AppImage')) {
      const fullPath = join('release', name);
      const hash = await sha256File(fullPath);
      checksumLines.push(`${hash}  ${name}`);
    }
  }

  const sumsPath = join('release', 'SHA256SUMS.txt');
  await writeFile(sumsPath, checksumLines.join('\n') + '\n', 'utf8');
  console.log(`Wrote ${sumsPath}:`);
  console.log(checksumLines.join('\n'));

  console.log('--- Packaging Complete ---');
}

main().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
