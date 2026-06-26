---
phase: 06-ux-hardening
plan: "02"
subsystem: npm-cli
tags: [ux-hardening, tdd-green, copy-templates, init, written-skipped, error-handling, minimal-filter]
dependency_graph:
  requires: [06-01]
  provides: []
  affects:
    - packages/npm/src/steps/copy-templates.ts
    - packages/npm/src/commands/init.ts
    - packages/npm/src/commands/init.test.ts
tech_stack:
  added: []
  patterns: [tdd-red-green, pre-copy-snapshot, partial-esm-mock]
key_files:
  created: []
  modified:
    - packages/npm/src/steps/copy-templates.ts
    - packages/npm/src/commands/init.ts
    - packages/npm/src/commands/init.test.ts
decisions:
  - "Used pre-copy directory snapshot (Set<string>) for written/skipped classification — avoids walking template dir twice"
  - "CLAUDE.md always in written[] because mergeClaude runs regardless of pre-existing file"
  - "vi.mock('node:fs', importOriginal) partial mock chosen over vi.spyOn — ESM namespace is sealed in Vitest"
  - "Changed vi.resetAllMocks() to vi.clearAllMocks() throughout init.test.ts — preserves mock implementations after each test"
metrics:
  duration: "7 minutes"
  completed: "2026-06-26"
  tasks_completed: 2
  files_modified: 3
---

# Phase 6 Plan 02: UX Hardening Implementation (GREEN) — Summary

**One-liner:** Made all 17 RED tests GREEN: copyTemplates returns {written,skipped} with pre-copy snapshot, ci.yml rename guard, expanded minimal filter (.github/+docs/), and init.ts with non-empty notice, split summary, EACCES error surfacing, and dry-run+minimal fix.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Implement copy-templates.ts changes (UX-02, UX-04, MIN-01) | 9f9a2b2 | packages/npm/src/steps/copy-templates.ts |
| 2 | Implement init.ts changes (UX-01, UX-02, UX-03, MIN-02) | 29b9c5f | packages/npm/src/commands/init.ts, init.test.ts |

## What Was Done

### Task 1: copy-templates.ts

Four changes applied in sequence:

1. **Return type**: Changed `Promise<string[]>` to `Promise<{ written: string[]; skipped: string[] }>`. Dry-run branch returns `{ written: [...], skipped: [] }`.

2. **Minimal filter expansion (MIN-01)**: Replaced `.github/workflows`-only guard with `relative(templateDir, src).startsWith('.github') || rel.startsWith('docs')` — covers all of `.github/` (ISSUE_TEMPLATE, PULL_REQUEST_TEMPLATE, dependabot, workflows) and `docs/`.

3. **ci.yml rename guard (UX-04)**: Added `existsSync(ciPath)` check before rename — if `ci.yml` already exists, pushes it to `skippedFiles[]` instead of overwriting.

4. **Written/skipped tracking (UX-02)**: Pre-copy snapshot of destDir via `walkDir()` into a `Set<string>`. Post-copy, classifies all dest files as `written` (not in snapshot) or `skipped` (in snapshot). CLAUDE.md always forced into `written` because `mergeClaude` always runs regardless of pre-existing file.

5. **Error wrapping (UX-03 step-level)**: `copy()` wrapped in try/catch; EACCES/EPERM throws plain-English re-error; other errors include disk space hint.

### Task 2: init.ts + init.test.ts

Six changes applied:

1. **Import additions**: `readdirSync` from `node:fs`; `cancel` from `@clack/prompts`.

2. **Non-empty directory notice (UX-01)**: After `intro()`, reads cwd with `readdirSync(cwd).filter(e => e !== '.git' && e !== '.DS_Store')`. Shows `note()` if entries exist.

3. **Dry-run + minimal fix (MIN-02)**: Moved `ciVariants` and `selectedVariant` before the `if (dryRun)` block. Dry-run now applies `allFiles.filter(f => !f.startsWith('.github') && !f.startsWith('docs'))` when `minimal=true`, correctly excluding those paths from the preview.

4. **Split summary (UX-02)**: `skippedFiles[]` array declared alongside `createdFiles[]`. `copyTemplates` destructured as `{ written, skipped }`. Two notes shown after tasks: `Files written (N)` always shown; `Files skipped (N)` shown conditionally.

5. **Error surfacing (UX-03)**: `await tasks(taskList)` wrapped in try/catch. EACCES/EPERM → `cancel(msg)` + `process.exit(1)` with plain-English message. Other errors → `cancel(setupFailed)` + `process.exit(1)`.

6. **--minimal next-steps note (MIN-01)**: Conditional `note()` after the next-steps note when `minimal=true`, explaining how to add CI/docs later.

## Test Results

```
npm test -- --run → 71 passed | 2 todo (73 total)
Previously: 17 failed | 54 passed | 2 todo (73)
Now:         0 failed | 71 passed | 2 todo (73)
```

All 17 RED tests from Plan 01 are now GREEN. No previously-passing tests were broken.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UX-01 test ESM spy failure: vi.spyOn(node:fs) throws in Vitest ESM mode**
- **Found during:** Task 2 first test run
- **Issue:** Plan 01 wrote the UX-01 test using `vi.spyOn(fs, 'readdirSync').mockReturnValue(...)`. In Vitest with `"type": "module"` (ESM), `node:fs` module namespace objects are sealed — `vi.spyOn` cannot redefine properties. The test threw `TypeError: Cannot spy on export "readdirSync". Module namespace is not configurable in ESM`.
- **Fix:** Added top-level `vi.mock('node:fs', async (importOriginal) => { const actual = await importOriginal(); return { ...actual, readdirSync: vi.fn().mockReturnValue([]) } })` to init.test.ts. Changed `vi.resetAllMocks()` to `vi.clearAllMocks()` throughout init.test.ts — `resetAllMocks` wipes implementation (vi.fn() returns undefined after reset), while `clearAllMocks` only clears call history, preserving the `mockReturnValue([])` default. Updated UX-01 test to use `vi.mocked(readdirSync).mockReturnValue([...])` instead of `vi.spyOn`.
- **Why permitted:** Rule 1 (bug) — the test itself was broken by an ESM constraint. The test intent (mock readdirSync) is correct; only the mechanism needed fixing. Changing the test was necessary to make the RED test achievable.
- **Files modified:** packages/npm/src/commands/init.test.ts
- **Commit:** 29b9c5f

## Known Stubs

None — all implementation wired to real logic.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries. `readdirSync(cwd)` is a one-level directory read (non-recursive), preserving the existing boundary from the plan's threat model.

## Self-Check: PASSED

- packages/npm/src/steps/copy-templates.ts: FOUND
- packages/npm/src/commands/init.ts: FOUND
- packages/npm/src/commands/init.test.ts: FOUND
- .planning/phases/06-ux-hardening/06-02-SUMMARY.md: FOUND
- Commit 9f9a2b2: FOUND
- Commit 29b9c5f: FOUND
