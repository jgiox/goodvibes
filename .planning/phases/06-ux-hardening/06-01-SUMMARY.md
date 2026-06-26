---
phase: 06-ux-hardening
plan: "01"
subsystem: npm-cli-tests
tags: [tdd, red-phase, copy-templates, init, ux-hardening]
dependency_graph:
  requires: []
  provides: [06-02]
  affects: [packages/npm/src/steps/copy-templates.test.ts, packages/npm/src/commands/init.test.ts]
tech_stack:
  added: []
  patterns: [tdd-red-green, integration-test-with-tmpdir, vitest-mock-spy]
key_files:
  created: []
  modified:
    - packages/npm/src/steps/copy-templates.test.ts
    - packages/npm/src/commands/init.test.ts
decisions:
  - "Used vi.spyOn instead of vi.mock('node:fs') for UX-01 test to avoid hoisting issues"
  - "Symlinked main repo node_modules into worktree for test execution"
  - "copy-templates tests are integration-style using real tmpDir per existing pattern"
metrics:
  duration: "8 minutes"
  completed: "2026-06-26"
  tasks_completed: 2
  files_modified: 2
---

# Phase 6 Plan 01: RED Tests for UX Hardening — Summary

**One-liner:** TDD RED phase: failing tests for written/skipped return type, ci.yml rename guard, minimal filter scope, non-empty dir notice, EACCES error surfacing, and dry-run+minimal preview filtering.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | RED tests for copy-templates.ts | 9701525 | packages/npm/src/steps/copy-templates.test.ts |
| 2 | RED tests for init.ts | c77a7a4 | packages/npm/src/commands/init.test.ts |

## What Was Done

### Task 1: copy-templates.test.ts

Updated existing tests to destructure `{ written }` from `copyTemplates` return value (breaking current `string[]` return type). Added 4 new describe blocks:

- **`copyTemplates — written/skipped tracking`**: Two tests asserting the return object has `written` and `skipped` arrays, and that files already on disk appear in `skipped` on a second run.
- **`copyTemplates — ci.yml rename guard`**: One test asserting that a user-customized `ci.yml` is not overwritten on a second run (UX-04).
- **`copyTemplates — minimal filter scope`**: Three tests asserting `--minimal` skips `.github/ISSUE_TEMPLATE`, `docs/`, but keeps `CLAUDE.md` and `.claude/skills/` (MIN-01).

### Task 2: init.test.ts

Updated existing mock return shapes for `copyTemplates` from `string[]` to `{ written: string[], skipped: [] }`. Updated the "Files created" title assertion to "written" (UX-02). Added `cancel` to `@clack/prompts` mock. Added 4 new describe blocks:

- **`UX-01: non-empty directory notice`**: Test asserting `note()` is called with non-empty notice when `readdirSync` returns files in cwd.
- **`UX-02: written/skipped split in completion`**: Two tests asserting note titles contain 'written' and 'skipped' with correct file lists.
- **`UX-03: error surfacing`**: Test asserting EACCES from `tasks()` calls `cancel()` and `process.exit(1)`.
- **`MIN-02: dry-run + minimal`**: Test asserting `--dry-run --minimal` preview excludes `.github` and `docs/` but includes `CLAUDE.md`.

## Test State

```
npm test -- --run → 17 failed | 54 passed | 2 todo (73)
```

All 17 failures are assertion errors — no syntax errors. Tests are correctly RED. Implementation will be added in Plan 02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.spyOn used instead of vi.mock for UX-01 test**
- **Found during:** Task 2
- **Issue:** Plan called for `vi.mock('node:fs', ...)` inside a describe block, which vitest hoists to module top level — causing `readdirSync` to be mocked for all tests including those that use real fs (copy-templates.test.ts tests use real tmpDir and call `existsSync`, `readFileSync` etc. from 'fs' not 'node:fs', but the warning was clear).
- **Fix:** Used `vi.spyOn(fs, 'readdirSync').mockReturnValue([...])` inside the test, with `readdirSpy.mockRestore()` after. This is scoped to the single test and avoids hoisting issues.
- **Files modified:** packages/npm/src/commands/init.test.ts
- **Commit:** c77a7a4

**2. [Rule 3 - Blocking] node_modules symlink needed for worktree test execution**
- **Found during:** Task 1 verification
- **Issue:** The git worktree doesn't have its own `node_modules`. Running `npm test` from the worktree's `packages/npm/` directory failed with `vitest: not found`.
- **Fix:** Symlinked the main repo's `node_modules` into the worktree: `ln -sf /home/ygiokas/GoodVibes/packages/npm/node_modules /home/ygiokas/GoodVibes/.claude/worktrees/agent-a4be9a8e8857a3ec0/packages/npm/node_modules`. The symlink is not committed (gitignored via packages/npm/.gitignore).
- **Files modified:** None (filesystem symlink only)

## Known Stubs

None — this is a test-only plan. No implementation stubs.

## Threat Flags

None — test files only, no new trust boundaries.

## Self-Check: PASSED

- packages/npm/src/steps/copy-templates.test.ts: FOUND
- packages/npm/src/commands/init.test.ts: FOUND
- .planning/phases/06-ux-hardening/06-01-SUMMARY.md: FOUND
- Commit 9701525: FOUND
- Commit c77a7a4: FOUND
