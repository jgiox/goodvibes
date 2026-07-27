---
phase: 14
plan: "02"
subsystem: npm-write-manifest
tags: [feature, tdd, manifest, sha256]
dependency_graph:
  requires: [14-01]
  provides: [write-manifest-step, writeManifest-wired-in-init]
  affects:
    - packages/npm/src/steps/write-manifest.ts
    - packages/npm/src/steps/write-manifest.test.ts
    - packages/npm/src/commands/init.ts
    - packages/npm/src/commands/init.test.ts
tech_stack:
  added: []
  patterns: [TDD RED/GREEN, node:crypto sha256, createRequire version lookup]
key_files:
  created:
    - packages/npm/src/steps/write-manifest.ts
    - packages/npm/src/steps/write-manifest.test.ts
  modified:
    - packages/npm/src/commands/init.ts
    - packages/npm/src/commands/init.test.ts
decisions:
  - "Used static import for createRequire in init.ts (mirrors upgrade.ts), not dynamic import suggested in PATTERNS.md"
  - "MANIFEST_PATH exported as const so callers can reference the filename without string literals"
  - "readManifest catch block swallows all errors and returns null — intentional per UPD-05 design"
  - "writeManifest filter createdFiles.filter(f => f !== '.goodvibes.json') prevents manifest self-reference (T-14-02-02)"
metrics:
  duration: "4 minutes"
  completed: "2026-07-27"
---

# Phase 14 Plan 02: Write-Manifest Step Summary

**One-liner:** TypeScript `writeManifest` step computes SHA-256 per written file and persists `.goodvibes.json`; `readManifest` returns null on missing or corrupt JSON; both wired into `init.ts` after `tasks()` succeed.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 (RED) | Failing write-manifest tests | a6c6abe | write-manifest.test.ts |
| 1 (GREEN) | write-manifest implementation | df8c0a1 | write-manifest.ts |
| 2 | Wire writeManifest into init.ts + init.test.ts | aaf9fa8 | init.ts, init.test.ts |

## What Was Built

### Task 1 — write-manifest step (TDD)

**RED:** Created `write-manifest.test.ts` with 5 tests using a real tmpdir (no file I/O mocks). Tests imported from `./write-manifest.js` which did not exist, causing a module-not-found failure as expected. Confirmed 1 failed suite, 133 passing tests unchanged.

**GREEN:** Created `write-manifest.ts` with:
- `Manifest` interface: `{ version: string; files: Record<string, string> }`
- `MANIFEST_PATH = '.goodvibes.json'` (exported)
- `writeManifest(destDir, writtenFiles, version)` — for-of loop over files, `readFile` + `createHash('sha256').update(content, 'utf8').digest('hex')`, writes `JSON.stringify(manifest, null, 2) + '\n'`
- `readManifest(destDir)` — try/catch over `readFile` + `JSON.parse`; catch returns null with ponytail comment

All 5 new tests pass. Total test count: 138 passing.

### Task 2 — Wire writeManifest into init.ts

Added to `init.ts`:
- Static import `createRequire` from `node:module`
- Static import `writeManifest` from `../steps/write-manifest.js`
- After the `try/catch` block (after `tasks()` succeeds), before `await Promise.race(...)`:
  ```typescript
  const _req = createRequire(import.meta.url)
  const _ver = (_req('../../package.json') as { version: string }).version
  await writeManifest(cwd, createdFiles.filter(f => f !== '.goodvibes.json'), _ver)
  ```

Added to `init.test.ts`:
- `vi.mock('../steps/write-manifest.js', () => ({ writeManifest: vi.fn().mockResolvedValue(undefined), readManifest: vi.fn().mockResolvedValue(null) }))` at module level
- In `'normal run'` test: asserts `writeManifest` called once with `(String, Array, String)`
- In `'--dry-run'` test: asserts `writeManifest` not called

## Verification

```
Test Files  11 passed | 1 skipped (12)
     Tests  138 passed | 1 skipped | 2 todo (141)
```

- `grep -n "writeManifest" init.ts` → line 10 (import), line 147 (call)
- `grep -n "write-manifest" init.test.ts` → lines 46, 47, 95, 204
- `grep -n "createHash.*sha256" write-manifest.ts` → line 20
- `grep -n "return null" write-manifest.ts` → line 32 (readManifest catch)

## Deviations from Plan

**1. [Rule 1 - Minor] Static import for createRequire instead of dynamic**
- **Found during:** Task 2
- **Issue:** PATTERNS.md showed `const { createRequire } = await import('node:module')` (dynamic) but the plan task action specified static import. Used static import to stay consistent with `upgrade.ts` and avoid async overhead.
- **Files modified:** init.ts
- **Impact:** None — both approaches work identically; static import is simpler

## TDD Gate Compliance

- RED gate: commit `a6c6abe` — `test(14-02): add failing write-manifest tests (RED)`
- GREEN gate: commit `df8c0a1` — `feat(14-02): implement write-manifest step (GREEN)`

## Known Stubs

None — all functions are fully implemented with real file I/O.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. T-14-02-02 mitigation (filter) is implemented at the init.ts call site.

## Self-Check: PASSED

- [x] `packages/npm/src/steps/write-manifest.ts` exists and exports writeManifest, readManifest, MANIFEST_PATH
- [x] `packages/npm/src/steps/write-manifest.test.ts` exists with 5 passing tests
- [x] `packages/npm/src/commands/init.ts` contains `writeManifest` on lines 10 and 147
- [x] `packages/npm/src/commands/init.test.ts` contains `write-manifest` mock and assertions
- [x] commit `a6c6abe` exists (test RED)
- [x] commit `df8c0a1` exists (feat GREEN)
- [x] commit `aaf9fa8` exists (feat wire)
- [x] `npm test` exits 0 with 138 tests passing
