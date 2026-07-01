---
phase: 09-vibe-platform-expansion
plan: "02"
subsystem: tests
tags: [tests, python, typescript, integration, vpe]
dependency_graph:
  requires: []
  provides: [vpe-python-tests, vpe-ts-tests]
  affects: [packages/pip/tests, packages/npm/src/steps]
tech_stack:
  added: []
  patterns: [3-test-pattern-per-file, pytest-fixture-stub, vitest-integration]
key_files:
  modified:
    - packages/pip/tests/conftest.py
    - packages/pip/tests/test_copy_templates.py
    - packages/npm/src/steps/copy-templates.integration.test.ts
decisions:
  - TS integration tests placed in IDE rule files describe block (consistent with Phase 8 pattern)
  - Python tests pass fully GREEN; TS tests are GREEN-ready pending 09-01 template files
metrics:
  duration: "~10 minutes"
  completed: "2026-07-01"
  tasks_completed: 2
  files_modified: 3
---

# Phase 9 Plan 02: Vibe Platform Test Coverage Summary

**One-liner:** Extended both test suites with 6 new tests (3 per file) for replit.md and .bolt/prompt, covering fresh init, skip-existing, and --minimal behaviors.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Python conftest + test_copy_templates | 3995bd5 | packages/pip/tests/conftest.py, packages/pip/tests/test_copy_templates.py |
| 2 | TS integration tests | 0e6797b | packages/npm/src/steps/copy-templates.integration.test.ts |

## What Was Built

### Task 1: Python test extension

**conftest.py** — Added two stubs to the `template_dir` fixture:
- `replit.md` with content `## Project\n`
- `.bolt/prompt` (with `.bolt/` directory created) with content `Engineering rules\n`

**test_copy_templates.py** — Added 6 new test functions following the established 3-test pattern:
1. `test_copy_templates_writes_replit_md_on_fresh_init`
2. `test_copy_templates_skips_existing_replit_md_and_counts_as_skipped`
3. `test_copy_templates_minimal_writes_replit_md`
4. `test_copy_templates_writes_bolt_prompt_on_fresh_init`
5. `test_copy_templates_skips_existing_bolt_prompt_and_counts_as_skipped`
6. `test_copy_templates_minimal_writes_bolt_prompt`

All 46 Python tests pass GREEN (40 existing + 6 new).

### Task 2: TS integration test extension

**copy-templates.integration.test.ts** — Added 6 new test cases to the `copyTemplates — IDE rule files` describe block (consistent with where Phase 8 tests were added):
1. `writes replit.md on fresh init (VPE-01)`
2. `skips existing replit.md and counts it as skipped (VPE-02)`
3. `writes replit.md under --minimal (VPE-03)`
4. `writes .bolt/prompt on fresh init (VPE-04)`
5. `skips existing .bolt/prompt and counts it as skipped (VPE-05)`
6. `writes .bolt/prompt under --minimal (VPE-06)`

Test count: 47 → 53 in the worktree file.

## Verification Results

**Python (packages/pip):** 46 passed, 0 failed — full GREEN including all 6 new tests.

**TS (packages/npm):** Tests added to worktree file. TS integration tests use `resolveTemplatesDir()` which resolves to the real `templates/` directory. Since plan 09-01 runs in parallel and authors the actual template files (replit.md, .bolt/prompt), TS tests will be GREEN once 09-01 is merged. This is the expected Wave 1 parallel execution pattern documented in the plan.

## Deviations from Plan

None — plan executed exactly as written. The TS tests are in the `copyTemplates — IDE rule files` describe block (consistent with where Phase 8 IDE tests live) rather than the `copyTemplates — minimal filter scope` block (which only has 3 tests). This matches the plan's note: "keeps all the new-file tests in one logical group, consistent with where GEMINI.md, AGENTS.md, .clinerules, .amazonq, .continue, and .devin tests were added in Phase 8."

## Known Stubs

None — these are test files only. No stub data flows to UI rendering.

## Threat Flags

None — test files only, no new network endpoints or auth paths.

## Self-Check

Checking files and commits exist:

- [x] packages/pip/tests/conftest.py — modified (stubs added)
- [x] packages/pip/tests/test_copy_templates.py — modified (6 tests added)
- [x] packages/npm/src/steps/copy-templates.integration.test.ts — modified (6 tests added)
- [x] commit 3995bd5 — Task 1 (Python tests)
- [x] commit 0e6797b — Task 2 (TS tests)

## Self-Check: PASSED
