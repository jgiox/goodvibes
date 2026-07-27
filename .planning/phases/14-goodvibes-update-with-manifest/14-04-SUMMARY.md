---
phase: 14
plan: "04"
subsystem: npm-cli
tags: [update-command, manifest, categorise, dry-run, force, UPD-02, UPD-03, UPD-04, UPD-05]
dependency_graph:
  requires: [14-02]
  provides: [update-command-ts]
  affects: [packages/npm/src/index.ts, packages/npm/src/commands/upgrade.ts]
tech_stack:
  added: []
  patterns: [manifest-categorise-overwrite-skip-netNew, confirm-prompt-UPD-04, UPD-05-early-exit]
key_files:
  created:
    - packages/npm/src/commands/update.ts
    - packages/npm/src/commands/update.test.ts
  modified:
    - packages/npm/src/commands/upgrade.ts
    - packages/npm/src/index.ts
decisions:
  - Removed .alias('update') from upgrade.ts and updated upgrade.test.ts assertion to expect no alias
  - vi.clearAllMocks() in beforeEach preserves implementations — explicit reset of existsSync in last test to avoid cross-test leakage
metrics:
  duration: "~15 minutes"
  completed: "2026-07-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
---

# Phase 14 Plan 04: TypeScript Update Command Summary

**One-liner:** Manifest-based `goodvibes update` command with overwrite/skip/netNew categorisation, dry-run preview, force flag, confirmation prompt, and CLAUDE.md via mergeClaude.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create update.ts + update.test.ts | 60b1133 | packages/npm/src/commands/update.ts, packages/npm/src/commands/update.test.ts |
| 2 | Remove upgrade alias; wire update into index.ts | f80b4a5 | packages/npm/src/commands/upgrade.ts, packages/npm/src/index.ts |

## What Was Built

### update.ts
Implements `registerUpdateCommand(program: Command): void`:
- `categorise(templateDir, cwd, manifest, projectType)` — first pass over manifest.files computes sha256 of each dest file and compares to manifest sha (unmodified → overwrite, user-modified → skip); second pass over template files detects net-new files not in manifest
- UPD-05 early exit: `readManifest` returns null → `note(...)` + `outro('Nothing updated.')` + `return` (exit 0, no process.exit)
- `--dry-run`: prints three-category summary via `note()` and returns (no files written)
- `--force`: skips `confirm()` prompt; without force and with overwrite files, prompts with `confirm({ message: 'Overwrite N managed file(s)?' })`
- Apply loop: CLAUDE.md → `readFile` + `mergeClaude`; all others → `copy(src, dest, {overwrite: true})`
- `writeManifest` called after apply with filtered list of files that exist in dest
- `getVersion()` uses `createRequire(import.meta.url)` per upgrade.ts pattern

### update.test.ts
7 unit tests covering UPD-02 through UPD-05:
1. Shows no-manifest note and exits 0 when .goodvibes.json absent
2. `--dry-run` prints three categories without writing files
3. `--force` skips confirm prompt and applies overwrites
4. Prompts confirmation before overwriting when `--force` not set
5. Calls `writeManifest` after applying changes
6. Skips template file missing from templateDir during apply
7. User-modified files (skip category) are not overwritten

### upgrade.ts + upgrade.test.ts
Removed `.alias('update')` from `registerUpgradeCommand`. Updated the test assertion from "expect alias to contain update" to "expect alias not to contain update".

### index.ts
Added `import { registerUpdateCommand } from './commands/update.js'` and `registerUpdateCommand(program)` call after `registerUpgradeCommand(program)`.

## Verification

```
Test Files  12 passed | 1 skipped (13)
     Tests  145 passed | 1 skipped | 2 todo (148)
```

All 7 update tests pass. All 9 upgrade tests pass (including updated alias assertion). Full npm suite green.

Acceptance criteria satisfied:
- `grep -n "registerUpdateCommand" packages/npm/src/index.ts` → 2 results (import + call)
- `grep -n "\.alias(" packages/npm/src/commands/upgrade.ts` → no results
- `grep -n "confirm.*Overwrite" packages/npm/src/commands/update.ts` → line 118
- `grep -n "mergeClaude" packages/npm/src/commands/update.ts` → lines 5, 140
- `grep -n "Nothing updated" packages/npm/src/commands/update.ts` → line 90
- `grep -n "readManifest" packages/npm/src/commands/update.ts` → lines 4, 83
- `grep -n "writeManifest" packages/npm/src/commands/update.ts` → lines 4, 146

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] upgrade.test.ts alias test fails after alias removal**
- **Found during:** Task 2
- **Issue:** `upgrade.test.ts` test "registers update as an alias for upgrade" asserts `upgradeCmd!.aliases()).toContain('update')`. Removing the alias makes this test fail.
- **Fix:** Updated the test to assert `not.toContain('update')` and renamed it to "registers upgrade command without update alias (update is now a separate command)".
- **Files modified:** packages/npm/src/commands/upgrade.test.ts
- **Commit:** f80b4a5

**2. [Rule 1 - Bug] existsSync mock leaks between tests via vi.clearAllMocks()**
- **Found during:** Task 1 test debugging
- **Issue:** `vi.clearAllMocks()` preserves mock implementations (unlike `resetAllMocks()`). The "skips template file" test sets `existsSync` to `false`, which persists into the "user-modified files" test causing it to fail.
- **Fix:** Added explicit `vi.mocked(existsSync).mockReturnValue(true)` at the top of the "user-modified files" test with a comment explaining the `clearAllMocks()` behaviour.
- **Files modified:** packages/npm/src/commands/update.test.ts
- **Commit:** 60b1133

**3. [Rule 3 - Blocking] Worktree lacks node_modules for test execution**
- **Found during:** Task 1 verification
- **Issue:** The git worktree has no `node_modules`; running `npm test` from the worktree fails with "vitest: not found".
- **Fix:** Symlinked the main repo's `packages/npm/node_modules` into the worktree: `ln -s /home/ygiokas/GoodVibes/packages/npm/node_modules .../worktrees/.../packages/npm/node_modules`. This is a runtime-only link; not tracked by git.
- **Impact:** Tests run correctly from the worktree path.

## Known Stubs

None — all data flows are live (categorise reads real manifest and file hashes; apply loop uses real copy/mergeClaude; writeManifest called with real computed list).

## Threat Flags

No new trust boundaries beyond those in the plan's threat model. All paths join `cwd` with manifest keys written at init time; no external input.

## Self-Check: PASSED

All created files exist on disk. Both task commits (60b1133, f80b4a5) verified in git log.
