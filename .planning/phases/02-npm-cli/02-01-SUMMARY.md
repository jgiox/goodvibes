---
phase: 02-npm-cli
plan: "01"
subsystem: cli-tooling
tags: [typescript, commander, tsup, vitest, npm-package, node-version-guard]

dependency_graph:
  requires:
    - phase: 01-template-content-repo-foundation
      provides: templates/ directory (copied via prebuild script into packages/npm/templates/)
  provides:
    - scripts/verify-phase2.sh (32-check smoke test harness for NPM-01..NPM-11 and HDR-01..HDR-06)
    - packages/npm/package.json (goodvibes manifest, bin, engines, no postinstall)
    - packages/npm/src/index.ts (CLI entry point: shebang + Node version guard + Commander stub)
    - packages/npm/tsup.config.ts (ESM build producing dist/index.js with preserved shebang)
    - packages/npm/tsconfig.json (NodeNext, ES2022, strict)
    - packages/npm/vitest.config.ts (node environment, src/**/*.test.ts)
    - packages/npm/src/**/*.test.ts (6 Wave 0 todo-stub test files for Wave 1)
  affects:
    - Wave 1 plans (02-02, 02-03, 02-04) depend on buildable packages/npm/ scaffold
    - Phase 5 upgrade command depends on init stub being replaceable in Wave 1

tech-stack:
  added:
    - commander ^13 (CLI argument parsing, subcommands)
    - "@clack/prompts ^0.9 (spinner/tasks/note/outro terminal UX)"
    - fs-extra ^11 (cross-platform file copy with EMFILE protection)
    - execa ^9 (subprocess calls, cross-spawn inside for PATHEXT)
    - tsup ^8 (TypeScript to ESM bundle with shebang preservation)
    - typescript ^5.5 (pinned per CLAUDE.md; NOT 6.x)
    - "@types/node ^20"
    - vitest ^2 (test framework for todo stubs and Wave 1 unit tests)
  patterns:
    - Shebang in src/index.ts line 1 — tsup auto-preserves it in dist/index.js
    - Node version guard runs BEFORE any dynamic imports (process.version check with stderr + exit 1)
    - prebuild script uses Node.js cpSync to copy root templates/ into packages/npm/templates/ at build time
    - Todo-stub test files (it.todo) allow npm test to exit 0 without implementations

key-files:
  created:
    - scripts/verify-phase2.sh
    - packages/npm/package.json
    - packages/npm/tsconfig.json
    - packages/npm/tsup.config.ts
    - packages/npm/vitest.config.ts
    - packages/npm/src/index.ts
    - packages/npm/src/index.test.ts
    - packages/npm/src/commands/init.test.ts
    - packages/npm/src/steps/copy-templates.test.ts
    - packages/npm/src/utils/detect-python.test.ts
    - packages/npm/src/steps/install-headroom.test.ts
    - packages/npm/src/steps/configure-mcp.test.ts
    - packages/npm/.gitignore
    - packages/npm/package-lock.json
  modified: []

key-decisions:
  - "TypeScript pinned to ^5.5 (not ^6.x) — CLAUDE.md lock; TypeScript 6 breaking changes not yet investigated"
  - "prebuild script uses Node.js cpSync (not shell cp) for cross-platform templates copy — avoids shell injection and Windows cp -r incompatibility"
  - "packages/npm/.gitignore created (none existed) to exclude node_modules/, dist/, templates/ — generated artifacts must not be committed"
  - "init action in entry stub calls process.exit(0) after stub message — prevents Commander hanging on async parseAsync without an action result"

patterns-established:
  - "Pattern: shebang on line 1 of src/index.ts, version guard on lines 2-8, first import on line 10+"
  - "Pattern: $((var + 1)) arithmetic in bash scripts (not ((var++))) to survive set -e on zero counters"
  - "Pattern: verify-phase2.sh --quick for static-only checks; no args for full build+runtime checks"

requirements-completed:
  - NPM-08
  - NPM-09

duration: 7min
completed: "2026-06-23"
---

# Phase 02 Plan 01: npm CLI Scaffold — Wave 0 Foundation Summary

**TSup-bundled Commander.js CLI entry with Node 20 version guard, 25 static + 7 build smoke checks, and 6 todo-stub test files unblocking all Wave 1 plans**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-23T16:22:58Z
- **Completed:** 2026-06-23T16:29:26Z
- **Tasks:** 2
- **Files modified:** 14 created, 1 deleted (.gitkeep)

## Accomplishments

- Created `scripts/verify-phase2.sh` with 32 checks (25 static + 7 build) covering NPM-01..NPM-11 and HDR-01..HDR-06, --quick flag for CI-safe static-only mode, exits 0 only on all-pass
- Scaffolded `packages/npm/` with correct manifest (goodvibes, bin, engines>=20, no postinstall), tsup ESM build producing `dist/index.js` with shebang preserved, Node version guard before any imports
- Created 6 Wave 0 todo-stub test files (23 todos) so `npm test` exits 0 immediately; Wave 1 plans replace stubs with real assertions

## Task Commits

1. **Task 1: Create verify-phase2.sh smoke-test harness** — `5786aca` (feat)
2. **Task 2: Scaffold packages/npm/ with all config and test stubs** — `9352510` (feat)

## Files Created/Modified

- `scripts/verify-phase2.sh` — 32-check smoke harness for all Phase 2 requirements; --quick and full modes
- `packages/npm/package.json` — goodvibes manifest; bin: ./dist/index.js; engines: >=20.0.0; no postinstall
- `packages/npm/tsconfig.json` — NodeNext module/resolution, ES2022 target, strict
- `packages/npm/tsup.config.ts` — ESM format, node20 target, single entry src/index.ts
- `packages/npm/vitest.config.ts` — node environment, src/**/*.test.ts, v8 coverage
- `packages/npm/src/index.ts` — shebang line 1; Node version check lines 2-8; Commander wiring line 10+
- `packages/npm/src/index.test.ts` — todo stubs for Node version check (NPM-08)
- `packages/npm/src/commands/init.test.ts` — todo stubs for init flags (NPM-02..NPM-07)
- `packages/npm/src/steps/copy-templates.test.ts` — todo stubs for file copy (NPM-01, NPM-03)
- `packages/npm/src/utils/detect-python.test.ts` — todo stubs for Python detection (HDR-02)
- `packages/npm/src/steps/install-headroom.test.ts` — todo stubs for install chain (HDR-01, HDR-03)
- `packages/npm/src/steps/configure-mcp.test.ts` — todo stubs for MCP registration (HDR-04, HDR-05)
- `packages/npm/.gitignore` — excludes node_modules/, dist/, templates/ (prebuild artifacts)
- `packages/npm/package-lock.json` — lockfile for reproducible installs

## Decisions Made

1. **TypeScript pinned to ^5.5:** CLAUDE.md explicitly locks TypeScript to ^5.5. The latest is 6.0.3, but the pin is honored — TypeScript 6 breaking changes are not yet investigated for this project.

2. **prebuild uses Node.js cpSync:** The prebuild script uses `require('fs').cpSync` (built-in Node.js API) rather than shell `cp -r` to avoid shell injection and Windows compatibility issues. This copies root `templates/` into `packages/npm/templates/` at build time so npm's `files` field can include it.

3. **packages/npm/.gitignore created as Rule 2 auto-fix:** No `.gitignore` existed in the repo. Without it, `node_modules/`, `dist/`, and `templates/` (prebuild copy) would appear as untracked files after every build and after installing dependencies. Added to prevent generated artifacts from being accidentally committed.

4. **init action stub uses process.exit(0):** The Wave 0 stub calls `process.exit(0)` after printing the stub message. This ensures `node dist/index.js init` exits cleanly rather than hanging, allowing verify-phase2.sh build checks to complete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added packages/npm/.gitignore**
- **Found during:** Task 2 (after npm install + build)
- **Issue:** No .gitignore existed in the repo or packages/npm/. After running `npm install` and `npm run build`, `node_modules/`, `dist/`, and `templates/` appeared as untracked files. Without gitignore, these generated artifacts would be accidentally staged and committed.
- **Fix:** Created `packages/npm/.gitignore` with `node_modules/`, `dist/`, `templates/`, and `*.tsbuildinfo`
- **Files modified:** packages/npm/.gitignore (new file)
- **Verification:** `git status --short` confirmed these paths no longer appear as untracked after the file was created
- **Committed in:** `9352510` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical configuration)
**Impact on plan:** Auto-fix necessary for correct repository hygiene. No scope creep.

## Issues Encountered

None. npm install completed successfully, tsup build succeeded on first attempt (858 bytes ESM output), all 32 verify-phase2.sh checks pass.

Note: `npm audit` reported 5 vulnerabilities in devDependencies. These are in the build toolchain (tsup/esbuild transitive deps), not in runtime dependencies. They do not affect the published package or security of `npx goodvibes init`. Tracked as a deferred item for a future audit sweep.

## Known Stubs

`packages/npm/src/index.ts` line 25: `process.stdout.write('init stub — Wave 1 will implement\n')` — this is the Wave 0 placeholder for the `init` action handler. The plan explicitly requires this stub to allow verify-phase2.sh build checks (`node dist/index.js init --help`, `node dist/index.js --help`) to pass without Wave 1 implementation. Wave 1 plan 02-02 (copy-templates) and plan 02-03 (headroom install) will replace this stub with the real implementation.

## Threat Surface Scan

No new threat surface beyond what is in the plan's threat model. The scaffold introduces no network endpoints, auth paths, or schema changes. The only trust boundary is npm install (pulling commander, @clack/prompts, fs-extra, execa, tsup, typescript, vitest) — all five runtime packages are [VERIFIED] in RESEARCH.md's Package Legitimacy Audit with no postinstall scripts found. The HDR-06 check in verify-phase2.sh (runs at every wave) enforces that no postinstall hook appears in package.json.

## User Setup Required

None — no external service configuration required. The scaffold builds locally with `npm install && npm run build` and requires only Node.js 20+.

## Next Phase Readiness

- Wave 1 plans (02-02, 02-03, 02-04) can now run `npm run build` and `npm test` in packages/npm/
- `node packages/npm/dist/index.js init --help` shows `--dry-run` and `--minimal` flags
- Test stub files are in place at the exact paths Wave 1 plans reference
- verify-phase2.sh --quick passes cleanly (0 failures) and will catch regressions as Wave 1 adds implementation

---
*Phase: 02-npm-cli*
*Completed: 2026-06-23*

## Self-Check: PASSED

- scripts/verify-phase2.sh exists: FOUND
- packages/npm/package.json exists: FOUND
- packages/npm/tsconfig.json exists: FOUND
- packages/npm/tsup.config.ts exists: FOUND
- packages/npm/vitest.config.ts exists: FOUND
- packages/npm/src/index.ts exists: FOUND
- packages/npm/src/index.test.ts exists: FOUND
- packages/npm/src/commands/init.test.ts exists: FOUND
- packages/npm/src/steps/copy-templates.test.ts exists: FOUND
- packages/npm/src/utils/detect-python.test.ts exists: FOUND
- packages/npm/src/steps/install-headroom.test.ts exists: FOUND
- packages/npm/src/steps/configure-mcp.test.ts exists: FOUND
- Commit 5786aca exists: FOUND
- Commit 9352510 exists: FOUND
