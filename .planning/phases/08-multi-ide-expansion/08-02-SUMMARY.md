---
phase: 08-multi-ide-expansion
plan: "02"
subsystem: testing
tags: [tests, ide, coverage, regression-guard, tdd]
dependency_graph:
  requires: [08-01]
  provides: [IDE-01-test-coverage, IDE-03-test-coverage, IDE-04-test-coverage]
  affects: [packages/npm/src/steps/copy-templates.test.ts, packages/pip/tests/test_copy_templates.py, packages/pip/tests/conftest.py]
tech_stack:
  added: []
  patterns: [integration-test-real-templates-dir, unit-test-conftest-fixture-stubs]
key_files:
  modified:
    - packages/npm/src/steps/copy-templates.test.ts
    - packages/pip/tests/test_copy_templates.py
    - packages/pip/tests/conftest.py
    - JOURNAL.md
decisions:
  - "TS tests use real resolveTemplatesDir() (integration-style) — consistent with existing describe blocks; no mocking needed because template files ship with the repo"
  - "Python tests use conftest.py fixture stubs for IDE files — consistent with existing unit-test isolation pattern in this package"
  - "Worktree needed npm install before vitest could run — node_modules not shared across worktrees"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-30"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 8 Plan 02: IDE Rule File Test Coverage — Summary

9 TS and 9 Python test assertions covering IDE-01/03/04 requirements, using real templates/ dir (TS) and fixture stubs (Python).

## What Was Built

Extended both copy-templates test suites with 9 new assertions each, verifying that the four IDE rule files added in plan 08-01 are correctly written, protected from overwrite, and filtered by `--minimal`.

**TypeScript:** New `describe('copyTemplates — IDE rule files')` block in `/packages/npm/src/steps/copy-templates.test.ts`. Uses the real `resolveTemplatesDir()` return value, matching the integration-style convention already established in the file. 9 `it()` tests.

**Python:** Updated `template_dir` fixture in `packages/pip/tests/conftest.py` to create four IDE file stubs. Appended 9 test functions to `packages/pip/tests/test_copy_templates.py` following existing patterns (import inside function body, `mocker.patch` for `merge_claude`).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add IDE file assertions to copy-templates.test.ts | ddbf575 | packages/npm/src/steps/copy-templates.test.ts |
| 2 | Add IDE file assertions to test_copy_templates.py and update conftest fixture | 9818882 | packages/pip/tests/test_copy_templates.py, packages/pip/tests/conftest.py |

## Test Results

**npm:** 80 passed | 2 todo (82 total) — all 9 new IDE tests GREEN.

**pytest:** 27 passed — all 9 new IDE tests GREEN (18 pre-existing + 9 new).

## Coverage Added

| Requirement | Behavior | TS | Python |
|-------------|----------|----|----|
| IDE-01 | writes `.cursor/rules/goodvibes.mdc` on fresh init | it() | def test_...() |
| IDE-01 | writes `.windsurfrules` on fresh init | it() | def test_...() |
| IDE-01 | writes `.kiro/steering/goodvibes.md` on fresh init | it() | def test_...() |
| IDE-01 | writes `.github/copilot-instructions.md` on fresh init | it() | def test_...() |
| IDE-03 | existing `.cursor/rules/goodvibes.mdc` counted as skipped, not overwritten | it() | def test_...() |
| IDE-04 | `--minimal` skips `.github/copilot-instructions.md` | it() | def test_...() |
| IDE-04 | `--minimal` writes `.cursor/rules/goodvibes.mdc` | it() | def test_...() |
| IDE-04 | `--minimal` writes `.windsurfrules` | it() | def test_...() |
| IDE-04 | `--minimal` writes `.kiro/steering/goodvibes.md` | it() | def test_...() |

## Deviations from Plan

**1. [Rule 3 - Blocking] Worktree missing node_modules**

- **Found during:** Task 1 verification
- **Issue:** Worktree has no `node_modules/` — `npm test` fails with `vitest: not found`
- **Fix:** Ran `npm install` inside the worktree's `packages/npm/` directory
- **Files modified:** `packages/npm/node_modules/` (not committed — in .gitignore)
- **Commit:** N/A (install only)

**2. [Rule 3 - Blocking] Worktree venv missing pytest-mock**

- **Found during:** Task 2 verification
- **Issue:** `uv run pytest` creates a fresh venv without dev extras; `mocker` fixture not found
- **Fix:** Used `uv run --with pytest-mock pytest` to inject pytest-mock for test runs in worktree
- **Files modified:** None (runtime flag only; the main repo's venv already has pytest-mock)
- **Commit:** N/A

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- packages/npm/src/steps/copy-templates.test.ts — FOUND (modified)
- packages/pip/tests/test_copy_templates.py — FOUND (modified)
- packages/pip/tests/conftest.py — FOUND (modified)
- Commit ddbf575 — FOUND (git log confirms)
- Commit 9818882 — FOUND (git log confirms)
- npm test: 80 passed — VERIFIED
- pytest 27 passed — VERIFIED
