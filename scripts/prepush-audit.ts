import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';

function runStep(name: string, fn: () => void) {
  process.stdout.write(`[AUDIT] ${name}... `);
  try {
    fn();
    console.log('PASSED');
  } catch (e) {
    console.log('FAILED');
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

async function main() {
  console.log('=== Blackbook Pre-Push Release Audit ===\n');

  // 1. Check tracked files for forbidden paths
  runStep('Verify no sensitive files are tracked by git', () => {
    const tracked = execSync('git ls-files', { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const forbiddenPrefixes = ['data/', 'sidecar/', 'release/', 'out/', 'secrets/', 'fixtures/'];
    const forbiddenExtensions = ['.db', '.sqlite', '.sqlite3', '.zip', '.exe', '.dmg'];

    for (const file of tracked) {
      for (const prefix of forbiddenPrefixes) {
        if (file.startsWith(prefix)) {
          throw new Error(`Forbidden file tracked in git: ${file}`);
        }
      }
      for (const ext of forbiddenExtensions) {
        if (file.endsWith(ext)) {
          throw new Error(`Forbidden extension tracked in git: ${file}`);
        }
      }
    }
  });

  // 2. Scrub check
  runStep('Verify no personal identifiers or real API keys in tracked files', () => {
    const tracked = execSync('git ls-files', { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.includes('bun.lock'));

    const devRegex = /(?:[A-Za-z]:[\\\/]Users[\\\/]Raghav|\/Users\/Raghav|\/home\/Raghav)/i;
    const keyRegex = /gsk_[a-zA-Z0-9]{45,}/;

    for (const file of tracked) {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.woff2') || file.endsWith('.ico')) continue;
      const content = readFileSync(file, 'utf8');
      if (devRegex.test(content)) {
        throw new Error(`Developer profile path found in ${file}`);
      }
      if (keyRegex.test(content)) {
        throw new Error(`Live API key found in ${file}`);
      }
    }
  });

  // 3. Question Bank Content In-Memory Scan
  runStep('Verify zero source question content in tracked files', () => {
    const bankPath = 'data/app/bank.json';
    if (!existsSync(bankPath)) {
      console.log('(skipped: no local bank)');
      return;
    }

    const rawBank = JSON.parse(readFileSync(bankPath, 'utf8'));
    const questions = rawBank.questions || [];
    if (questions.length === 0) return;

    // Pick 20 diverse question prompt snippets
    const snippets: string[] = [];
    const step = Math.max(1, Math.floor(questions.length / 20));
    for (let i = 0; i < questions.length; i += step) {
      const stem = questions[i]?.prompt?.stem || questions[i]?.body || '';
      const clean = stem.replace(/<[^>]+>/g, '').trim();
      if (clean.length > 50) {
        snippets.push(clean.slice(10, 45));
      }
    }

    const tracked = execSync('git ls-files', { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const file of tracked) {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.woff2') || file.endsWith('.ico')) continue;
      const content = readFileSync(file, 'utf8');
      for (const snippet of snippets) {
        if (content.includes(snippet)) {
          throw new Error(`Found question bank text snippet in tracked file: ${file}`);
        }
      }
    }
  });

  // 4. Typecheck
  runStep('Run TypeScript compiler check (tsc --noEmit)', () => {
    const res = spawnSync('bun', ['run', 'typecheck'], { stdio: 'inherit', shell: true });
    if (res.status !== 0) throw new Error('TypeScript check failed');
  });

  // 5. Test suite
  runStep('Run Vitest test suite', () => {
    const res = spawnSync('bun', ['run', 'test'], { stdio: 'inherit', shell: true });
    if (res.status !== 0) throw new Error('Vitest test suite failed');
  });

  // 6. Release installer & SHA256SUMS check
  runStep('Verify release installer and SHA256 checksum', () => {
    const installerPath = join('release', 'Blackbook-Setup-1.0.0.exe');
    const sumsPath = join('release', 'SHA256SUMS.txt');

    if (!existsSync(installerPath)) {
      throw new Error(`Installer missing: ${installerPath}`);
    }
    if (!existsSync(sumsPath)) {
      throw new Error(`Checksum file missing: ${sumsPath}`);
    }

    const installerBytes = readFileSync(installerPath);
    const hash = createHash('sha256').update(installerBytes).digest('hex');
    const sumsContent = readFileSync(sumsPath, 'utf8');

    if (!sumsContent.includes(hash)) {
      throw new Error(`Checksum mismatch! Computed ${hash} not found in ${sumsPath}`);
    }
  });

  console.log('\n>>> ALL 6 PRE-PUSH AUDIT CHECKS PASSED SUCCESSFULLY! <<<\n');
}

main().catch((e) => {
  console.error('Audit encountered unexpected failure:', e);
  process.exit(1);
});
