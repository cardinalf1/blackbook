# Session plan: Phase 10 (desktop app, bank zip, docs, release; unattended, 2026-10-16)

Branch `claude/phase10-release` from `44417bb` (Phase 9 + Desmos key + safety + picture fix). Ledger: `handoff/RUN-LEDGER.md`.

Found at start:
- `handoff/BUGS.md` is empty. Desmos key, typed DELETE and safety copies are already in.
- `gh` is not installed, so Step 10 (push, release, visibility) stops where the prompt says and I write the commands down.
- `origin` = `cardinalf1/blackbook` already exists and is already PUBLIC, holding only the first scaffold commit `a1aafda`. Every local commit already uses the GitHub noreply email.
- `git filter-repo` is not installed (I won't install anything outside the repo).

Plan (commit after every step, ledger after every commit):
0. Gate: typecheck, tests, `bun run sync`.
1. Architecture doc and decision: Electron 44.8.0 + electron-builder 26.15.3 (exact pins), with the Bun server compiled with `bun build --compile` as a sidecar on 127.0.0.1 and a free port. I checked the sidecar compiles (jsdom included) and answers `/api/health`.
   - Server additions: serve the built web bundle with CSP and security headers, `/healthz`, a port-scoped cookie, a `prepare-exit` route (finish writes, WAL checkpoint, exit snapshot), and exit when stdin closes (no orphan holding a port).
   - Electron main (`electron/`, bundled with esbuild): sidecar lifecycle, cookie set by main, sandboxed window, preload with a few calls, navigation allowlist, single instance, window state, menu, shutdown orchestration with hard timeouts, crash screen, safeStorage key cipher over a stdin/stdout line protocol with the sidecar, and `--smoke-test` and `--version`.
   - The pure parts are in `electron/core/*` with Vitest tests.
2. Data folder rules: `--data-dir` and `BLACKBOOK_DATA_DIR`, tests refuse the real folder, backup before migration, newer DB refused, integrity check after an unclean exit, rotating log, diagnostics redaction.
3. Update check (daily, opt-out switch, GitHub public API) and network allowlist test.
4. Two-stage download (live set, then the rest) on the existing atomic merge, plus the bank zip export/import with manifest and SHA-256. My own bank zip goes to Documents\Blackbook Backups, round-trip verified in a temp folder.
5. Gemini writers (disjoint files): (1) welcome, while-you-wait, bank zip screens, Help/About; (2) guides and README drafts from official pages I fetch; (3) icon SVG and the THIRD_PARTY_LICENSES formatting. I review every diff.
6. Build: `scripts/build-release.ts` produces the Windows NSIS installer and SHA256SUMS. CI workflows test.yml and release.yml (draft only).
7. Hygiene: .gitignore rewrite with a test, personal-data scrub with a test, LICENSE/NOTICE/SECURITY/CHANGELOG, legal notes, AGENTS.md release rules.
8. `scripts/prepush-audit.ts` (tracked files, history, installers, snippet check in memory). Push is blocked by the missing `gh`; I prepare the clean history in a temp clone and write the exact commands.
