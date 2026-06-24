---
phase: 04-ci-cd-scaffolding
plan: "03"
subsystem: ci-cd
tags: [tdd, green-phase, detect-project-type, copy-templates, ci-variant-selection]
requirements: [CI-01, CI-02, CI-03, CI-04, CI-05]

dependency_graph:
  requires: [04-01 (RED tests), 04-02 (CI templates)]
  provides:
    - detect-project-type.ts (ProjectType + detectProjectType)
    - detect_project_type.py (detect_project_type)
    - copy-templates.ts with projectType param + CI filter + rename + dest-walk return
    - copy_templates.py with project_type param + CI filter + rename + dest-walk return
    - CI variant selection wired into init.ts and init_cmd.py
  affects: [04-04 (smoke harness verification)]

tech_stack:
  added: []
  patterns:
    - "existsSync(join(cwd, 'package.json')) for synchronous project-type detection (no async needed)"
    - "CI variant filter in copy filter callback: skip ciVariants where variant !== selectedVariant"
    - "Post-copy rename: selectedVariant → ci.yml, guarded by existsSync / Path.exists()"
    - "Dest-walk return: walk destDir after copy so output shows ci.yml not ci-node.yml (RESEARCH.md Pitfall 6)"
    - "Dry-run return: filter listTemplateFiles to exclude non-selected variants (preserves --dry-run NPM-07)"

key_files:
  created:
    - packages/npm/src/utils/detect-project-type.ts
    - packages/pip/src/goodvibes_cli/utils/detect_project_type.py
  modified:
    - packages/npm/src/steps/copy-templates.ts
    - packages/npm/src/steps/copy-templates.test.ts
    - packages/npm/src/commands/init.ts
    - packages/npm/src/commands/init.test.ts
    - packages/pip/src/goodvibes_cli/steps/copy_templates.py
    - packages/pip/tests/test_copy_templates.py
    - packages/pip/tests/conftest.py
    - packages/pip/src/goodvibes_cli/commands/init_cmd.py
    - JOURNAL.md

decisions:
  - "Return destDir walk after copy so output list shows ci.yml (not ci-node.yml) — RESEARCH.md Pitfall 6"
  - "Dry-run returns filtered listTemplateFiles (not destDir walk) since destDir is empty during dry-run"
  - "existsSync guard before rename prevents FileNotFoundError when minimal=true skips workflows entirely"

metrics:
  duration: "5 minutes"
  completed: "2026-06-24T17:35:00Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 9
---

# Phase 4 Plan 03: detectProjectType + copyTemplates CI Variant Selection Summary

**GREEN phase: detectProjectType utilities (TS + Python) + CI variant filter/rename wired into copy pipeline, turning all Plan 01 RED tests GREEN and passing 3 new CI variant tests in both packages**

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement detectProjectType (TS) + extend copyTemplates with CI variant selection | 0d12f2f | detect-project-type.ts, copy-templates.ts, copy-templates.test.ts, init.ts, init.test.ts |
| 2 | Implement detect_project_type (Python) + extend copy_templates with CI variant selection | 73b1123 | detect_project_type.py, copy_templates.py, test_copy_templates.py, conftest.py, init_cmd.py |

## What Was Built

**detect-project-type.ts** (15 lines): Synchronous utility using `existsSync` from `node:fs`. Exports `ProjectType = 'node' | 'python' | 'both'` and `detectProjectType(cwd: string): ProjectType`. Returns 'both' as safe default for empty directories.

**detect_project_type.py** (17 lines): Python equivalent using `pathlib.Path.exists()`. Module docstring + `from __future__ import annotations` + `import pathlib` per codebase convention. Returns 'both' as safe default.

**copy-templates.ts changes**: 5th param `projectType: ProjectType = 'both'`. Filter callback extended to skip non-selected CI variants. Post-copy `rename()` converts `ci-${projectType}.yml` to `ci.yml`, guarded by `existsSync`. Dry-run returns `listTemplateFiles` filtered to exclude non-selected variants. Non-dry-run returns `walkDir(destDir)` instead of `listTemplateFiles(templateDir)` — fixes Pitfall 6 (output showing `ci-node.yml` instead of `ci.yml`).

**copy_templates.py changes**: 5th param `project_type: str = "both"`. `ignore_fn` extended with CI variant exclusion. Post-copy `Path.rename()` converts selected variant to `ci.yml`. Dry-run returns filtered `list_template_files`. Non-dry-run returns `sorted(str(f.relative_to(dest_dir)) ...)` walk of destDir.

**conftest.py**: Replaced single `ci.yml` stub with three `ci-node.yml`, `ci-python.yml`, `ci-both.yml` stubs. The rename logic in `copy_templates` now creates `ci.yml` from the selected variant.

**init.ts / init_cmd.py**: Both wired to call `detectProjectType(cwd)` / `detect_project_type(cwd)` and pass the result as the 5th argument to `copyTemplates` / `copy_templates`.

## Verification Results

- `npm test`: 53 passed, 2 todo (0 failures) — includes 5 detectProjectType tests + 3 CI variant tests
- `pytest tests/ -x -q`: 56 passed (0 failures) — includes 5 detect_project_type tests + 3 CI variant tests
- All Plan 01 RED tests are now GREEN

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated init.test.ts assertions for new 5th copyTemplates argument**
- **Found during:** Task 1 (npm test run)
- **Issue:** Two tests in `init.test.ts` asserted `copyTemplates` was called with 4 arguments (no `projectType`). After adding the 5th param to `copyTemplates` and wiring it in `init.ts`, these assertions failed with "expected called with [4 args], received [5 args]"
- **Fix:** Updated both `toHaveBeenCalledWith` assertions to include `expect.any(String)` as the 5th argument
- **Files modified:** `packages/npm/src/commands/init.test.ts`
- **Commit:** 0d12f2f (included in Task 1 commit)

## TDD Gate Compliance

- RED gate: Plan 01 wrote failing tests for `detectProjectType` / `detect_project_type` in separate commits (`99e21d5`, `eb4415c`)
- GREEN gate: This plan (Plan 03) implements the functions and turns those tests GREEN. Commits `0d12f2f` and `73b1123` use `feat(04-03):` prefix confirming GREEN gate.
- REFACTOR gate: No refactoring needed — code is minimal and clear at 15-17 lines each.

## Known Stubs

None — all functions are complete and all tests pass against real filesystem.

## Threat Flags

No new threat surface introduced. All mitigations from plan threat model verified:
- T-04-03-02 (CI variant rename path): `selectedVariant` constructed from enum literal `ci-${projectType}.yml`; existsSync guard implemented before rename call.
- T-04-03-01 (cwd input): `process.cwd()` / `pathlib.Path.cwd()` are OS-controlled, not user input.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| packages/npm/src/utils/detect-project-type.ts | FOUND |
| packages/pip/src/goodvibes_cli/utils/detect_project_type.py | FOUND |
| packages/npm/src/steps/copy-templates.ts (projectType param) | FOUND |
| packages/pip/src/goodvibes_cli/steps/copy_templates.py (project_type param) | FOUND |
| npm test: 53 passed | PASSED |
| pytest: 56 passed | PASSED |
| Commit 0d12f2f (Task 1) | FOUND |
| Commit 73b1123 (Task 2) | FOUND |
