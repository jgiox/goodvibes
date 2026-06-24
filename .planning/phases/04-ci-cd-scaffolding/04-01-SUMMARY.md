---
phase: 04-ci-cd-scaffolding
plan: "01"
subsystem: ci-cd
tags: [tdd, testing, red-phase, detect-project-type, smoke-harness]
requirements: [CI-05]

dependency_graph:
  requires: []
  provides: [detect-project-type tests (RED), verify-phase4.sh]
  affects: [04-03-PLAN.md (GREEN phase — must implement detect_project_type)]

tech_stack:
  added: []
  patterns:
    - vitest with real tmpdir (mkdtempSync) for TS integration-style unit tests
    - pytest with tmp_path fixture via conftest.py for Python unit tests
    - bash smoke harness with PASS/FAIL counters (verify-phase3.sh pattern)

key_files:
  created:
    - packages/npm/src/utils/detect-project-type.test.ts
    - packages/pip/tests/test_detect_project_type.py
    - scripts/verify-phase4.sh
  modified:
    - JOURNAL.md

decisions:
  - "RED-only TDD plan: tests define the contract for detect_project_type before Plan 03 ships the implementation"
  - "Both TS and Python tests use real filesystem (no mocks) — Path.exists()/existsSync are stdlib calls, not external I/O"
  - "Empty-dir case returns 'both' (safe default for unknown projects)"

metrics:
  duration: "6 minutes"
  completed: "2026-06-24T17:20:49Z"
  tasks_completed: 3
  files_created: 3
  files_modified: 1
---

# Phase 4 Plan 01: TDD Scaffolding + Smoke Harness Summary

RED-phase tests for project-type detection (TS + Python) and phase 4 smoke harness that validates CI/CD template files and content once Plan 02 delivers them.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write failing TS unit tests for detectProjectType | 99e21d5 | packages/npm/src/utils/detect-project-type.test.ts |
| 2 | Write failing Python tests for detect_project_type | eb4415c | packages/pip/tests/test_detect_project_type.py |
| 3 | Author scripts/verify-phase4.sh smoke harness | 2ce3e8c | scripts/verify-phase4.sh, JOURNAL.md |

## What Was Built

**detect-project-type.test.ts** (43 lines): 5 vitest tests exercising a `detectProjectType(dir: string)` function across all input shapes — node-only, python-via-pyproject, python-via-requirements, both-present, and neither-present (safe default returns 'both'). Uses real tmpdir via `mkdtempSync` with `beforeEach`/`afterEach` lifecycle. Import of `./detect-project-type.js` guarantees RED state until Plan 03 creates the implementation.

**test_detect_project_type.py** (34 lines): 5 pytest tests with identical coverage in Python. Uses `tmp_dir` fixture from conftest.py (wraps `tmp_path`). Each test does a deferred `from goodvibes_cli.utils.detect_project_type import detect_project_type` inside the function body — ImportError at collection time confirms RED state.

**verify-phase4.sh** (75 lines): Smoke harness modeled on verify-phase3.sh. Checks 6 template file paths and 9 content patterns (grep -q). Accepts `--quick` flag to skip unit test execution. Uses `pass`/`fail` counters with `var=$((var + 1))` (avoids `set -e` arithmetic exit bug noted in JOURNAL.md from Phase 1). Exits 1 when any check fails.

## Verification Results

- detect-project-type.test.ts: exists, 5 test cases
- test_detect_project_type.py: exists, 5 test functions
- scripts/verify-phase4.sh: exists, executable, exits non-zero (14 FAILs — templates not yet created by Plan 02)
- No implementation files exist for `detectProjectType` / `detect_project_type` — RED state confirmed

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

- RED gate: Tasks 1 and 2 produce test files that cannot compile/import due to missing implementation. Commits use `test(04-01):` prefix.
- GREEN gate: Deferred to Plan 03 (by design — this plan is RED-only).
- REFACTOR gate: N/A.

This plan intentionally stops at RED. The gate sequence will be complete after Plan 03 ships the implementation.

## Known Stubs

None — test-only plan, no UI or data wiring.

## Threat Flags

None — test files and a bash script reading hardcoded paths introduce no new trust-boundary surface.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| packages/npm/src/utils/detect-project-type.test.ts | FOUND |
| packages/pip/tests/test_detect_project_type.py | FOUND |
| scripts/verify-phase4.sh | FOUND |
| .planning/phases/04-ci-cd-scaffolding/04-01-SUMMARY.md | FOUND |
| Commit 99e21d5 (Task 1) | FOUND |
| Commit eb4415c (Task 2) | FOUND |
| Commit 2ce3e8c (Task 3) | FOUND |
